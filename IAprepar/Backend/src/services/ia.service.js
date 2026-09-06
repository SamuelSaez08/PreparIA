'use strict';

const db = require('../config/db');
const { getModel, getModelConFallback } = require('../config/gemini');
const logger = require('../utils/logger');

/* ─────────────────────────────────────────────────────────────────────────────
   UTILIDADES INTERNAS
───────────────────────────────────────────────────────────────────────────── */

const _parseGeminiResponse = (text) => {
  try { return JSON.parse(text); } catch (_) { }
  try {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
    return JSON.parse(cleaned);
  } catch (_) { }
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) return JSON.parse(text.slice(start, end + 1));
  } catch (_) { }
  throw new Error('No se pudo parsear la respuesta de Gemini como JSON válido');
};

const _logIA = async (params) => {
  try {
    await db.query(
      `INSERT INTO ia_log
       (id_usuario, accion, id_materia, id_nodo, dificultad, cantidad_pedida, cantidad_exitosa, tokens_usados, duracion_ms, exitoso, error_mensaje)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        params.id_usuario, params.accion, params.id_materia, params.id_nodo, params.dificultad,
        params.cantidad_pedida, params.cantidad_exitosa, params.tokens_usados, params.duracion_ms,
        params.exitoso, params.error_mensaje || null
      ]
    );
  } catch (err) { logger.error('Error insertando en ia_log:', err.message); }
};

const _sinTilde = (s) => s.toLowerCase()
  .replace(/[áà]/g, 'a').replace(/[éè]/g, 'e').replace(/[íì]/g, 'i')
  .replace(/[óò]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n');

const _validarPregunta = (p) => {
  if (!p.texto_base || typeof p.texto_base !== 'string' || p.texto_base.trim().length < 50) return false;
  if (!p.enunciado || p.enunciado.length < 20) return false;
  if (!p.opciones || p.opciones.length !== 4) return false;
  const correctas = p.opciones.filter(o => o.es_correcta);
  if (correctas.length !== 1) return false;
  for (const op of p.opciones) {
    if (!op.texto || op.texto.trim() === '') return false;
    if (!['A', 'B', 'C', 'D'].includes(op.letra.toUpperCase())) return false;
  }
  const textos = new Set(p.opciones.map(o => o.texto.toLowerCase().trim()));
  if (textos.size !== 4) return false;
  if (!p.explicacion || p.explicacion.length < 30) return false;
  if (/la opci.n (a|b|c|d) es|la respuesta correcta es/i.test(p.enunciado)) return false;
  if (p.nivel_dificultad != null) {
    if (!['basico', 'medio', 'avanzado'].includes(_sinTilde(p.nivel_dificultad))) return false;
  }
  if (p.respuesta_correcta != null) {
    if (p.respuesta_correcta.toUpperCase() !== correctas[0].letra.toUpperCase()) return false;
  }
  if (p.tipo_contexto != null) {
    const tiposValidos = ['noticia', 'situacion', 'definicion', 'caricatura', 'documento_oficial', 'estadistica', 'discurso'];
    if (!tiposValidos.includes(_sinTilde(p.tipo_contexto))) return false;
  }
  return true;
};

const _validarRespuestaJSON = (parsed, cantidadEsperada) => {
  if (!parsed.preguntas || !Array.isArray(parsed.preguntas))
    throw new Error('El formato JSON no contiene un array "preguntas"');
  if (parsed.preguntas.length === 0)
    throw new Error('El array "preguntas" está vacío en la respuesta de Gemini');
  const minimoAceptable = Math.ceil(cantidadEsperada * 0.5);
  if (parsed.preguntas.length < minimoAceptable)
    throw new Error(`Gemini devolvió ${parsed.preguntas.length} pregunta(s) pero se esperaban al menos ${minimoAceptable}`);
};

const _nivelToCompetencia = (nombre) => {
  if (!nombre) return null;
  const n = nombre.toLowerCase();
  if (n.includes('pensamiento social')) return 'pensamiento_social';
  if (n.includes('interpretaci') || n.includes('perspectivas')) return 'interpretacion_perspectivas';
  if (n.includes('reflexivo') || n.includes('sist')) return 'pensamiento_reflexivo';
  return null;
};

const _buildDistribucionTemas = (distribucion_temas) => {
  if (!distribucion_temas || typeof distribucion_temas !== 'object' || Object.keys(distribucion_temas).length === 0) return '';
  const lineas = Object.entries(distribucion_temas)
    .map(([tema, cantidad]) => `- ${tema}: ${cantidad} pregunta${cantidad !== 1 ? 's' : ''}`)
    .join('\n');
  return `\nDistribución de preguntas por tema (OBLIGATORIA):\n${lineas}\n\nAsegúrate de que cada pregunta tenga el campo "tema" con el nombre exacto del tema listado arriba.`;
};

const _shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const _getDificultadStats = (cantidad, mezclar) => {
  if (!mezclar) return { facil: 0, media: cantidad, dificil: 0 };
  const facil = Math.round(cantidad * 0.4);
  const dificil = Math.round(cantidad * 0.2);
  return { facil, media: cantidad - facil - dificil, dificil };
};

const _validarDistribucionCompetencias = (preguntas, cantidadTotal) => {
  const esperado = {
    pensamiento_social: Math.round(cantidadTotal * 0.30),
    interpretacion_perspectivas: Math.round(cantidadTotal * 0.40),
    pensamiento_reflexivo: Math.round(cantidadTotal * 0.30),
  };
  const conteo = { pensamiento_social: 0, interpretacion_perspectivas: 0, pensamiento_reflexivo: 0 };
  for (const p of preguntas) { if (p.competencia in conteo) conteo[p.competencia]++; }
  for (const [comp, esperadoVal] of Object.entries(esperado)) {
    if (Math.abs(conteo[comp] - esperadoVal) > 1)
      logger.warn(`[ia.service] Distribución desviada: ${comp} — esperado ${esperadoVal}, real ${conteo[comp]}`);
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   PROMPT DEL SISTEMA — calibrado con preguntas certificadas ICFES Saber 11
   
   CAMBIOS respecto a la versión anterior:
   1. Texto base: enfasis en SITUACIONES NARRATIVAS (patrón dominante en el ICFES real)
   2. Enunciados: bank de frases reales del ICFES para calibrar el tono
   3. Distractores: regla explícita de "error parcial" (comparten parte del razonamiento)
   4. Explicación: formato estructurado para el feedback de PreparIA
   5. Prohibición explícita de enunciados que empiezan con "¿Qué..." en modo básico
───────────────────────────────────────────────────────────────────────────── */
const PROMPT_SISTEMA = `Eres un experto en el diseño de preguntas para el examen ICFES Saber 11 de Colombia, específicamente para el módulo de Ciencias Sociales y Ciudadanas.

Has analizado cientos de preguntas certificadas y conoces con precisión el estilo, nivel y estructura que el ICFES utiliza.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLA ABSOLUTA: TEXTO BASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cada pregunta DEBE tener un TEXTO BASE antes del enunciado. Sin texto_base la pregunta es INVÁLIDA.

El TEXTO BASE es una situación narrativa, fragmento o dato de 3 a 8 líneas. Existen siete tipos:

  1. "situacion"          → Escenario hipotético con personajes concretos, lugar y conflicto de intereses.
                            Es el tipo MÁS FRECUENTE en el ICFES real. Ejemplo: una asamblea de vecinos,
                            un alcalde que toma una decisión, un estudiante que interpone una tutela.

  2. "noticia"            → Fragmento de artículo de prensa colombiana o latinoamericana,
                            con fecha, datos y contexto geográfico.

  3. "documento_oficial"  → Extracto de ley, sentencia constitucional, artículo de la Constitución,
                            plan de desarrollo, discurso presidencial o resolución administrativa.

  4. "discurso"           → Declaración directa de un personaje histórico, político, funcionario
                            o ciudadano, en primera o tercera persona.

  5. "estadistica"        → Tabla de datos, cifra del DANE, índice del PNUD, porcentaje del PIB
                            o comparativo regional con fuente explícita.

  6. "definicion"         → Concepto académico de ciencia política, economía o sociología,
                            seguido de un caso concreto que lo ejemplifica.

  7. "caricatura"         → Descripción detallada de una caricatura o imagen política:
                            personajes, símbolos, relaciones de poder representadas.

REGLAS DEL TEXTO BASE:
- Mínimo 3 líneas, máximo 8 líneas.
- Debe contener la información SUFICIENTE Y NECESARIA para responder. El estudiante no necesita
  conocimiento externo al texto: todo está en el texto_base.
- Contextualizado en Colombia o con referencia latinoamericana/global cuando aplique.
- No mezclar más de dos tipos en un mismo texto_base.
- Nunca repetir el mismo tipo_contexto en más de 2 preguntas consecutivas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPETENCIAS ICFES Y DISTRIBUCIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cada pregunta debe tener exactamente una competencia. Distribución obligatoria sobre el total:

  "pensamiento_social"            → 30%
  Reconocer e interpretar fenómenos sociales, políticos, económicos e históricos en contextos
  concretos. Típico: ordenar hechos, identificar causas estructurales, clasificar fenómenos.

  "interpretacion_perspectivas"   → 40%
  Identificar, contrastar y analizar distintos puntos de vista, argumentos e intereses.
  OBLIGATORIO: el texto_base debe presentar al menos DOS voces, posturas o intereses en conflicto.
  Típico: comparar posiciones, identificar a quién favorece una medida, detectar prejuicios.

  "pensamiento_reflexivo"         → 30%
  Establecer relaciones causales, consecuencias sistémicas y evaluar soluciones.
  Típico: predecir efectos de una decisión, evaluar si una solución satisface los intereses,
  determinar si un procedimiento es constitucional o legal.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NIVELES DE DIFICULTAD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  "basico"    → 30% — El estudiante IDENTIFICA información explícita en el texto_base.
                No requiere inferencia: la respuesta correcta está textualmente en el texto.

  "medio"     → 50% — El estudiante INFIERE, relaciona causas/efectos o interpreta el texto_base.
                Requiere conectar ideas que no están explícitamente relacionadas en el texto.

  "avanzado"  → 20% — El estudiante APLICA conceptos del texto_base para resolver una situación nueva
                o evalúa la validez de un argumento usando criterios conceptuales.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTRUCTURA DE CADA PREGUNTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. texto_base       → Situación/fragmento/dato (3–8 líneas)
2. enunciado        → Pregunta concreta basada EXCLUSIVAMENTE en el texto_base
3. opciones A–D     → Cuatro opciones plausibles con exactamente una correcta
4. respuesta_correcta → "A", "B", "C" o "D"
5. competencia      → uno de los tres valores exactos
6. nivel_dificultad → "basico" | "medio" | "avanzado"
7. tipo_contexto    → tipo del texto_base usado
8. tema             → tema específico de Ciencias Sociales evaluado
9. explicacion      → ver sección EXPLICACIÓN más abajo

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENUNCIADOS — PATRONES REALES DEL ICFES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usa estos patrones de enunciado, calibrados con preguntas reales certificadas:

  Análisis de argumentos:
  - "¿Cuál de las siguientes afirmaciones sobre [X] NO es correcta?"
  - "¿Cuál contiene un argumento válido en contra de [posición]?"
  - "¿Cuál de los siguientes enunciados contiene un prejuicio cuestionable?"

  Comparación de perspectivas:
  - "¿Son similares las dos posiciones frente a [tema]?"
  - "¿Cómo se ajusta esta solución a los intereses de [parte A] y [parte B]?"
  - "¿Qué intereses están en conflicto en esta situación?"
  - "¿Qué intereses está favoreciendo [acción o declaración]?"

  Aplicación constitucional y jurídica:
  - "¿Cuál de los siguientes mecanismos puede ser usado para [acción]?"
  - "¿[El presidente / El ciudadano] puede hacer esto?"
  - "¿Es legalmente viable el procedimiento realizado por [actor]?"
  - "¿[Actor] está vulnerando algún derecho según la Constitución?"
  - "¿Cómo procedió el gobierno en esta situación según la Constitución?"

  Consecuencias y efectos:
  - "¿Cuál sería un efecto de [decisión]?"
  - "¿Cuál de los siguientes hechos podría ser un efecto de [posición]?"
  - "¿Qué situación genera esta decisión?"
  - "¿Por qué podría fallar [propuesta]?"

  Causas y contexto histórico:
  - "¿Cuál es el orden cronológico (del más antiguo al más reciente) de [hechos]?"
  - "¿Qué periodo de la historia política colombiana se representa en este fragmento?"
  - "¿Cuáles de esos problemas son causas de [fenómeno]?"
  - "¿Por qué [fenómeno] permite comprender [aspecto] del conflicto?"

  Inferencia de perspectiva:
  - "¿Quién elaboró probablemente este planteamiento?"
  - "¿A qué modelo económico/político es afín esta propuesta?"
  - "¿Por qué estas medidas pueden catalogarse como [concepto]?"

  Relación entre ideas:
  - "¿Qué tipo de relación se puede establecer entre las propuestas?"
  - "¿Cuál es la principal utilidad de [institución/norma]?"

REGLA: El enunciado debe redactarse en tercera persona o con el estilo impersonal del ICFES.
Evitar iniciar con "¿Qué..." salvo en preguntas de tipo "¿Qué tipo de relación..." o "¿Qué periodo...".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DISTRACTORES DE CALIDAD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Las tres opciones incorrectas deben seguir estas reglas:

  REGLA 1 — ERROR PARCIAL: Cada distractor debe compartir PARTE del razonamiento correcto
  pero fallar en un aspecto clave (causalidad, alcance, sujeto, o condición).
  Ejemplo real: si la respuesta correcta es "ambas están en contra de la legalización por razones
  distintas", un buen distractor sería "ambas están en contra y se enfocan en la protección
  del consumidor" — comparte el punto de acuerdo pero generaliza mal.

  REGLA 2 — DOS OPCIONES CERCANAS: Al menos dos opciones deben parecer igualmente válidas
  a un estudiante que no ha leído bien el texto. Esto obliga al análisis cuidadoso.

  REGLA 3 — SIN ABSURDOS: Ninguna opción debe ser obviamente incorrecta o fuera del contexto
  del texto_base. Evitar opciones que ningún estudiante elegiría.

  REGLA 4 — TRAMPA CONCEPTUAL: Al menos un distractor debe explotar un error conceptual
  frecuente. Ejemplos: confundir plebiscito con referendo, confundir causa con consecuencia,
  confundir interés general con interés particular, confundir complementariedad con similitud.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXPLICACIÓN — FORMATO PARA PREPARÍA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

La explicación es crítica para PreparIA: se muestra al estudiante cuando falla.
Debe tener esta estructura exacta en el campo "explicacion":

  "✓ [Letra correcta] es correcta porque [razón directa vinculada al texto_base].
   ✗ [Letra distractor 1]: [error conceptual específico que comete quien elige esta opción].
   ✗ [Letra distractor 2]: [error conceptual específico].
   ✗ [Letra distractor 3]: [error conceptual específico].
   💡 Concepto clave: [nombre del concepto o artículo constitucional que resuelve la pregunta]."

REGLAS de la explicación:
- Mínimo 80 caracteres, máximo 400.
- Nombrar el error conceptual concreto en cada distractor (ej: "confunde causa con consecuencia",
  "generaliza incorrectamente", "ignora la condición del texto", "invierte los sujetos").
- El "Concepto clave" al final debe ser un término técnico útil para el estudiante
  (ej: "Mecanismo de reforma constitucional", "Interés general vs. particular",
  "Derecho a la igualdad — Art. 13 C.P.", "Modelo neoliberal vs. proteccionista").

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIVERSIDAD Y VARIEDAD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Incluir diversidad regional colombiana: no solo Bogotá. Usar regiones, departamentos y
  ciudades variadas (Córdoba, Nariño, Chocó, Antioquia, Amazonas, etc.).
- Usar instituciones colombianas reales: Congreso, Corte Constitucional, Registraduría,
  DANE, Defensoría del Pueblo, Procuraduría, Fiscalía, Consejo de Estado, Alcaldías.
- No repetir el mismo personaje, institución o situación en más de una pregunta.
- No repetir el mismo tipo_contexto en más de 2 preguntas consecutivas.
- Para preguntas históricas: incluir siglo XX colombiano (Violencia, Frente Nacional,
  narcotráfico, constitución del 91, conflicto armado) y contexto latinoamericano.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EJEMPLO DE PREGUNTA CORRECTA (patrón "situacion" + "interpretacion_perspectivas")
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "texto_base": "La Junta de Acción Comunal del barrio El Prado en Montería debate la construcción de un parque en un lote baldío. Los residentes con hijos pequeños apoyan el parque porque mejoraría la recreación infantil. Los propietarios de los locales comerciales cercanos se oponen porque temen que la obra reduzca el tráfico de clientes durante meses. El concejal del sector propone iniciar la obra de inmediato, argumentando que el bien común prevalece sobre los intereses particulares.",
  "enunciado": "¿Son similares las posiciones de los residentes con hijos y los propietarios de locales frente a la propuesta del concejal?",
  "opciones": [
    { "letra": "A", "texto": "Son similares, porque los dos grupos priorizan el bienestar de la comunidad sobre sus intereses individuales.", "es_correcta": false },
    { "letra": "B", "texto": "Son diferentes, porque uno apoya la obra por los beneficios colectivos que genera y el otro la rechaza por las pérdidas económicas que le ocasionaría.", "es_correcta": true },
    { "letra": "C", "texto": "Son similares, porque ninguno de los dos grupos tiene en cuenta el impacto de la obra en el barrio.", "es_correcta": false },
    { "letra": "D", "texto": "Son diferentes, porque uno está de acuerdo con el concejal y el otro propone una obra distinta en el mismo lote.", "es_correcta": false }
  ],
  "respuesta_correcta": "B",
  "competencia": "interpretacion_perspectivas",
  "nivel_dificultad": "medio",
  "tipo_contexto": "situacion",
  "tema": "Conflicto de intereses y bien común",
  "explicacion": "✓ B es correcta porque el texto describe explícitamente dos motivaciones opuestas: beneficio colectivo (recreación infantil) vs. perjuicio económico particular (pérdida de clientes). ✗ A: comete el error de atribuirle a ambos grupos la misma valoración del bien común, cuando el texto dice lo contrario del grupo comercial. ✗ C: contradice el texto, que muestra que ambos grupos SÍ argumentan en función del impacto de la obra. ✗ D: inventa una propuesta alternativa que no aparece en el texto. 💡 Concepto clave: Interés general vs. interés particular — Art. 1 C.P. de Colombia."
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROHIBIDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Generar preguntas sin texto_base
- Preguntas que se responden por memorización sin leer el texto_base
- Opciones claramente absurdas o desconectadas del texto
- Distractores que ningún estudiante razonable elegiría
- Explicaciones que solo confirman la respuesta sin nombrar el error conceptual de cada distractor
- Repetir el mismo tipo_contexto en más de 2 preguntas consecutivas
- Usar valores distintos a "basico", "medio", "avanzado" para nivel_dificultad
- Usar valores distintos a los tres exactos para el campo competencia
- Enunciados que revelan la respuesta correcta

RESPONDE ÚNICAMENTE con un JSON válido, sin texto adicional, sin bloques de código markdown.`;

/* ─────────────────────────────────────────────────────────────────────────────
   GENERACIÓN DE PREGUNTAS
───────────────────────────────────────────────────────────────────────────── */

const generarPreguntas = async (opciones, contextData = {}) => {
  const {
    materia, nodo, subtema, nivel, descripcion_nivel, dificultad, cantidad, tipo,
    contexto_adicional, distribucion_temas
  } = opciones;
  const { id_usuario, id_materia, id_nodo } = contextData;
  const modelosFallback = getModelConFallback();
  let modeloActualIdx = 0;
  let model = getModel(modelosFallback[0]);
  const startTime = Date.now();
  let tokens_usados = 0;

  const seccionDistribucion = _buildDistribucionTemas(distribucion_temas);
  const competenciaForzada = _nivelToCompetencia(nivel);
  if (competenciaForzada) {
    logger.warn(`[ia.service] Modo competencia forzada: ${competenciaForzada}. Distribución 30/40/30 anulada.`);
  }

  const promptUsuario = `Genera exactamente ${cantidad} pregunta(s) de selección múltiple para
el examen ICFES colombiano (módulo Sociales y Ciudadanas) con estas especificaciones:

Materia: ${materia}
Tema principal: ${nodo}
${subtema ? 'Subtema específico: ' + subtema : ''}
Competencia ICFES: ${nivel}${descripcion_nivel ? '\n' + descripcion_nivel : ''}
Dificultad predominante: ${dificultad}
${contexto_adicional ? 'Contexto adicional: ' + contexto_adicional : ''}
${competenciaForzada ? `COMPETENCIA OBLIGATORIA: El 100% de las preguntas debe tener competencia="${competenciaForzada}". No aplica la distribución porcentual.` : ''}
${seccionDistribucion}

RECUERDA:
- Cada pregunta DEBE tener un texto_base de 3–8 líneas.
- La explicación debe seguir el formato: ✓ [letra] ... ✗ [distractor] ... 💡 Concepto clave: ...
- Los distractores deben explotar errores conceptuales reales, no ser absurdos.

Responde ÚNICAMENTE con este JSON exacto, sin texto adicional, sin markdown:

{
  "preguntas": [
    {
      "texto_base": "Situación narrativa o fragmento de 3–8 líneas con contexto colombiano...",
      "enunciado": "¿Pregunta concreta usando los patrones del ICFES real?",
      "opciones": [
        { "letra": "A", "texto": "Opción plausible con error parcial", "es_correcta": false },
        { "letra": "B", "texto": "Opción correcta vinculada al texto_base", "es_correcta": true },
        { "letra": "C", "texto": "Opción con trampa conceptual frecuente", "es_correcta": false },
        { "letra": "D", "texto": "Opción cercana a la correcta pero con fallo de alcance", "es_correcta": false }
      ],
      "respuesta_correcta": "B",
      "competencia": "pensamiento_social|interpretacion_perspectivas|pensamiento_reflexivo",
      "tema": "nombre_del_tema",
      "nivel_dificultad": "basico|medio|avanzado",
      "tipo_contexto": "noticia|situacion|definicion|caricatura|documento_oficial|estadistica|discurso",
      "explicacion": "✓ B es correcta porque [razón]. ✗ A: [error conceptual]. ✗ C: [error conceptual]. ✗ D: [error conceptual]. 💡 Concepto clave: [término técnico]."
    }
  ]
}`;

  let attempts = 0;
  let lastError = null;

  while (attempts < 3) {
    attempts++;
    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: promptUsuario }] }],
        systemInstruction: { role: 'system', parts: [{ text: PROMPT_SISTEMA }] }
      });

      const text = result.response.text();
      tokens_usados += result.response.usageMetadata?.totalTokenCount || 0;

      if (
        result.response.promptFeedback?.blockReason === 'SAFETY' ||
        result.response.candidates[0]?.finishReason === 'SAFETY'
      ) throw new Error('Filtro de seguridad activado por Google Gemini.');

      const parsed = _parseGeminiResponse(text);
      _validarRespuestaJSON(parsed, cantidad);

      const exitosas = parsed.preguntas.filter(p => _validarPregunta(p));
      if (exitosas.length < Math.ceil(cantidad * 0.5))
        throw new Error(`Demasiadas preguntas fallaron la validación (${exitosas.length}/${cantidad})`);

      await _logIA({
        id_usuario, accion: 'generar_preguntas', id_materia, id_nodo, dificultad,
        cantidad_pedida: cantidad, cantidad_exitosa: exitosas.length,
        tokens_usados, duracion_ms: Date.now() - startTime, exitoso: true
      });

      return exitosas;
    } catch (err) {
      const detalle = err.errorDetails ? JSON.stringify(err.errorDetails) : (err.status || '');
      logger.warn(`Intento ${attempts} fallido: ${err.message} ${detalle}`.trim());
      lastError = err;
      if (err.message && /401|403/.test(err.message)) break;
      if (err.message && /404|400|503/.test(err.message)) {
        if (modeloActualIdx < modelosFallback.length - 1) {
          modeloActualIdx++;
          model = getModel(modelosFallback[modeloActualIdx]);
          logger.warn(`[ia.service] Error en modelo — cambiando a fallback: ${modelosFallback[modeloActualIdx]}`);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        if (/503/.test(err.message)) {
          logger.warn('[ia.service] 503 en todos los modelos, esperando 3s...');
          await new Promise(r => setTimeout(r, attempts * 3000));
          continue;
        }
      }
      if (err.message && /429/.test(err.message)) {
        logger.warn('[ia.service] Rate limit (429), esperando 10s...');
        await new Promise(r => setTimeout(r, 10000));
        continue;
      }
    }
  }

  await _logIA({
    id_usuario, accion: 'generar_preguntas', id_materia, id_nodo, dificultad,
    cantidad_pedida: cantidad, cantidad_exitosa: 0,
    tokens_usados, duracion_ms: Date.now() - startTime,
    exitoso: false, error_mensaje: lastError.message
  });

  const customError = new Error(`Fallo tras 3 intentos. Último error: ${lastError.message}`);
  customError.statusCode = 502;
  throw customError;
};

/* ─────────────────────────────────────────────────────────────────────────────
   ANÁLISIS DE FALLOS — NUEVO
   
   Recibe las respuestas de un intento de simulacro y devuelve:
     1. feedback_por_pregunta: para cada respuesta incorrecta, el error conceptual específico
     2. analisis_final: resumen por competencia y por tema con diagnóstico y recomendación
   
   Uso desde el backend:
     const analisis = await analizarFallos({ respuestas, preguntas });
   
   Parámetros:
     respuestas  → Array de { id_pregunta, letra_elegida, es_correcta }
     preguntas   → Array de { id, enunciado, texto_base, explicacion, competencia,
                               nivel_dificultad, tema, respuesta_correcta,
                               opciones: [{ letra, texto, es_correcta }] }
───────────────────────────────────────────────────────────────────────────── */
const analizarFallos = async ({ respuestas, preguntas }) => {
  // ── 1. Feedback inmediato por pregunta (sin IA, extrayendo de explicacion) ──
  const feedback_por_pregunta = [];

  for (const resp of respuestas) {
    const pregunta = preguntas.find(p => p.id === resp.id_pregunta);
    if (!pregunta) continue;

    if (resp.es_correcta) {
      feedback_por_pregunta.push({
        id_pregunta: resp.id_pregunta,
        es_correcta: true,
        letra_elegida: resp.letra_elegida,
        letra_correcta: pregunta.respuesta_correcta,
        mensaje: '¡Correcto!',
        error_conceptual: null,
        concepto_clave: _extraerConceptoClave(pregunta.explicacion),
      });
      continue;
    }

    // Extraer el fragmento de explicación correspondiente a la opción elegida
    const errorConceptual = _extraerErrorDistractor(pregunta.explicacion, resp.letra_elegida);
    const conceptoClave = _extraerConceptoClave(pregunta.explicacion);
    const opcionElegida = pregunta.opciones?.find(o => o.letra === resp.letra_elegida);
    const opcionCorrecta = pregunta.opciones?.find(o => o.es_correcta);

    feedback_por_pregunta.push({
      id_pregunta: resp.id_pregunta,
      es_correcta: false,
      letra_elegida: resp.letra_elegida,
      letra_correcta: pregunta.respuesta_correcta,
      texto_elegido: opcionElegida?.texto || null,
      texto_correcto: opcionCorrecta?.texto || null,
      error_conceptual: errorConceptual,
      concepto_clave: conceptoClave,
      explicacion_completa: pregunta.explicacion,
    });
  }

  // ── 2. Análisis final por competencia y tema (con IA si hay ≥1 fallo) ──
  const incorrectas = respuestas.filter(r => !r.es_correcta);

  if (incorrectas.length === 0) {
    return {
      feedback_por_pregunta,
      analisis_final: {
        puntaje: respuestas.length,
        total: respuestas.length,
        porcentaje: 100,
        mensaje_general: '¡Excelente! Respondiste correctamente todas las preguntas.',
        por_competencia: [],
        por_tema: [],
        recomendaciones: [],
      }
    };
  }

  // Estadísticas por competencia
  const statsCompetencia = {};
  const statsTema = {};

  for (const resp of respuestas) {
    const p = preguntas.find(q => q.id === resp.id_pregunta);
    if (!p) continue;

    const comp = p.competencia || 'sin_clasificar';
    const tema = p.tema || 'sin_tema';

    if (!statsCompetencia[comp]) statsCompetencia[comp] = { correctas: 0, total: 0, preguntas_falladas: [] };
    if (!statsTema[tema]) statsTema[tema] = { correctas: 0, total: 0, preguntas_falladas: [] };

    statsCompetencia[comp].total++;
    statsTema[tema].total++;

    if (resp.es_correcta) {
      statsCompetencia[comp].correctas++;
      statsTema[tema].correctas++;
    } else {
      statsCompetencia[comp].preguntas_falladas.push(resp.id_pregunta);
      statsTema[tema].preguntas_falladas.push(resp.id_pregunta);
    }
  }

  // Construir arrays de resultado
  const NOMBRE_COMPETENCIA = {
    pensamiento_social: 'Pensamiento Social',
    interpretacion_perspectivas: 'Interpretación de Perspectivas',
    pensamiento_reflexivo: 'Pensamiento Reflexivo y Sistémico',
  };

  const por_competencia = Object.entries(statsCompetencia).map(([comp, stats]) => {
    const porcentaje = Math.round((stats.correctas / stats.total) * 100);
    return {
      competencia: comp,
      nombre: NOMBRE_COMPETENCIA[comp] || comp,
      correctas: stats.correctas,
      total: stats.total,
      porcentaje,
      nivel: porcentaje >= 80 ? 'dominas' : porcentaje >= 50 ? 'en_proceso' : 'necesita_refuerzo',
    };
  }).sort((a, b) => a.porcentaje - b.porcentaje); // Orden ascendente: peores primero

  const por_tema = Object.entries(statsTema).map(([tema, stats]) => {
    const porcentaje = Math.round((stats.correctas / stats.total) * 100);
    return {
      tema,
      correctas: stats.correctas,
      total: stats.total,
      porcentaje,
      nivel: porcentaje >= 80 ? 'dominas' : porcentaje >= 50 ? 'en_proceso' : 'necesita_refuerzo',
    };
  }).sort((a, b) => a.porcentaje - b.porcentaje);

  // Recomendaciones automáticas (sin IA extra) basadas en las competencias más débiles
  const recomendaciones = _generarRecomendaciones(por_competencia, por_tema);

  const totalCorrectas = respuestas.filter(r => r.es_correcta).length;
  const porcentajeGlobal = Math.round((totalCorrectas / respuestas.length) * 100);

  return {
    feedback_por_pregunta,
    analisis_final: {
      puntaje: totalCorrectas,
      total: respuestas.length,
      porcentaje: porcentajeGlobal,
      mensaje_general: _mensajeGlobal(porcentajeGlobal),
      por_competencia,
      por_tema,
      recomendaciones,
    }
  };
};

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS DE analizarFallos
───────────────────────────────────────────────────────────────────────────── */

/**
 * Extrae el fragmento "✗ [Letra]: ..." de la explicación para la letra indicada.
 * Si el formato no coincide (preguntas viejas sin el nuevo formato), devuelve la explicación completa.
 */
const _extraerErrorDistractor = (explicacion, letra) => {
  if (!explicacion || !letra) return explicacion || null;
  // Patrón: ✗ A: ... (hasta el siguiente ✗ o 💡)
  const regex = new RegExp(`✗\\s*${letra}[:\\.]\\s*([^✗💡]+)`, 'i');
  const match = explicacion.match(regex);
  if (match) return match[1].trim();
  // Fallback: devolver la explicación completa
  return explicacion;
};

/**
 * Extrae el "💡 Concepto clave: ..." de la explicación.
 */
const _extraerConceptoClave = (explicacion) => {
  if (!explicacion) return null;
  const match = explicacion.match(/💡\s*Concepto clave[:\s]+(.+)/i);
  return match ? match[1].trim() : null;
};

/**
 * Genera recomendaciones de estudio basadas en los resultados.
 */
const _generarRecomendaciones = (por_competencia, por_tema) => {
  const recomendaciones = [];

  const TIPS_COMPETENCIA = {
    pensamiento_social: {
      necesita_refuerzo: 'Practica identificar hechos históricos, instituciones y fenómenos sociales colombianos. Repasa el árbol de aprendizaje en los nodos de Historia y Política.',
      en_proceso: 'Continúa practicando preguntas de identificación y clasificación de fenómenos sociales.',
    },
    interpretacion_perspectivas: {
      necesita_refuerzo: 'Esta es la competencia con mayor peso en el ICFES (40%). Practica identificar quién dice qué y qué interés defiende en cada texto. Busca textos con dos o más posiciones.',
      en_proceso: 'Trabaja en distinguir los matices entre posiciones similares. Pregúntate siempre: ¿en qué acuerdan y en qué difieren?',
    },
    pensamiento_reflexivo: {
      necesita_refuerzo: 'Practica preguntas sobre mecanismos constitucionales, consecuencias de decisiones y evaluación de soluciones. Repasa los derechos fundamentales y los mecanismos de participación.',
      en_proceso: 'Profundiza en el análisis de causas y consecuencias. Pregúntate: ¿qué pasaría si...?',
    },
  };

  for (const comp of por_competencia) {
    if (comp.nivel === 'necesita_refuerzo' || comp.nivel === 'en_proceso') {
      const tip = TIPS_COMPETENCIA[comp.competencia]?.[comp.nivel];
      if (tip) recomendaciones.push({ tipo: 'competencia', nombre: comp.nombre, tip });
    }
  }

  // Añadir los 2 temas más débiles
  const temasDebiles = por_tema.filter(t => t.nivel === 'necesita_refuerzo').slice(0, 2);
  for (const tema of temasDebiles) {
    recomendaciones.push({
      tipo: 'tema',
      nombre: tema.tema,
      tip: `Fallaste ${tema.total - tema.correctas} de ${tema.total} pregunta(s) sobre "${tema.tema}". Revisa este tema en el árbol de aprendizaje.`,
    });
  }

  return recomendaciones;
};

const _mensajeGlobal = (porcentaje) => {
  if (porcentaje === 100) return '¡Perfecto! Dominaste todas las preguntas.';
  if (porcentaje >= 80) return '¡Muy bien! Estás en un nivel sólido para el ICFES.';
  if (porcentaje >= 60) return 'Buen avance. Hay algunos temas que vale la pena reforzar.';
  if (porcentaje >= 40) return 'Vas por buen camino, pero necesitas practicar más antes del examen.';
  return 'Hay varias áreas que necesitan refuerzo. ¡Usa el árbol de aprendizaje para repasar!';
};

/**
 * Elige los temas que cubrirá un simulacro general y cuántas preguntas toca
 * a cada uno. Se prefieren las hojas del árbol (los temas concretos) sobre
 * las categorías, y se limita el número de temas para no disparar las
 * peticiones a la IA.
 */
const _elegirNodosParaSimulacro = async (idMateria, cantidad) => {
  const MAX_TEMAS = parseInt(process.env.IA_TEMAS_POR_SIMULACRO || '4', 10);

  const { rows } = await db.query(
    `SELECT n.id, n.nombre
     FROM nodo_aprendizaje n
     WHERE n.id_materia = $1
       AND n.activo = true
       AND NOT EXISTS (
         SELECT 1 FROM nodo_aprendizaje h
         WHERE h.id_padre = n.id AND h.activo = true
       )
     ORDER BY random()
     LIMIT $2`,
    [idMateria, MAX_TEMAS]
  );

  if (!rows.length) return [];

  // Reparto: base para todos y el resto a los primeros.
  const total  = Math.min(rows.length, Math.max(1, cantidad));
  const usados = rows.slice(0, total);
  const base   = Math.floor(cantidad / total);
  const sobra  = cantidad % total;

  return usados.map((n, i) => ({
    id: n.id,
    nombre: n.nombre,
    cantidad: base + (i < sobra ? 1 : 0),
  })).filter(n => n.cantidad > 0);
};

/* ─────────────────────────────────────────────────────────────────────────────
   GENERACIÓN DE SIMULACRO COMPLETO
───────────────────────────────────────────────────────────────────────────── */

const generarSimulacroCompleto = async (opciones) => {
  const { id_materia, id_nivel, id_nodo, cantidad = 10, mezclar_dificultad, titulo, duracion_minutos, id_usuario_admin } = opciones;

  const { rows: matRows } = await db.query('SELECT nombre FROM materia WHERE id = $1', [id_materia]);
  if (!matRows.length) throw new Error('Materia no encontrada');
  const materia = matRows[0].nombre;

  const { rows: todosNiveles } = await db.query('SELECT id, nombre FROM nivel');
  const nivelIdPorCompetencia = {};
  for (const row of todosNiveles) {
    const comp = _nivelToCompetencia(row.nombre);
    if (comp) nivelIdPorCompetencia[comp] = row.id;
  }

  const nivelSimulacro = 'Mixto (distribución ICFES Saber 11)';
  const contextData = { id_usuario: id_usuario_admin, id_materia, id_nodo };
  let todasPreguntas = [];

  if (id_nodo) {
    // ── Simulacro de un tema concreto ────────────────────────────────────
    // Viene de "Practicar este tema" en la ruta de aprendizaje.
    const { rows: nRows } = await db.query(
      'SELECT nombre FROM nodo_aprendizaje WHERE id = $1', [id_nodo]
    );
    const nodo = nRows.length ? nRows[0].nombre : 'Temas Generales';
    const distr = _getDificultadStats(cantidad, mezclar_dificultad);

    const lotes = await Promise.all(
      ['facil', 'media', 'dificil']
        .filter(d => distr[d] > 0)
        .map(d => generarPreguntas(
          { materia, nodo, subtema: '', nivel: nivelSimulacro, descripcion_nivel: null,
            dificultad: d, cantidad: distr[d], tipo: 'seleccion_multiple' }, contextData)
          .then(ps => ps.map(q => ({ ...q, _dificultadDB: d, _idNodo: id_nodo }))))
    );
    todasPreguntas = _shuffle(lotes.flat()).slice(0, cantidad);

  } else {
    // ── Simulacro general repartido entre los temas de la materia ────────
    // Antes se generaba todo bajo el rótulo "Temas Generales" y las
    // preguntas quedaban sin nodo, así que ningún simulacro alimentaba el
    // progreso por tema. Ahora se eligen temas reales del árbol y cada
    // pregunta nace sabiendo a cuál pertenece.
    const nodos = await _elegirNodosParaSimulacro(id_materia, cantidad);

    if (!nodos.length) {
      // Materia sin árbol cargado: se conserva el comportamiento anterior
      // en vez de fallar, aunque el progreso por tema no pueda calcularse.
      logger.warn(`[ia.service] La materia ${id_materia} no tiene nodos; el simulacro no podrá atribuirse por tema.`);
      const distr = _getDificultadStats(cantidad, mezclar_dificultad);
      const lotes = await Promise.all(
        ['facil', 'media', 'dificil']
          .filter(d => distr[d] > 0)
          .map(d => generarPreguntas(
            { materia, nodo: 'Temas Generales', subtema: '', nivel: nivelSimulacro,
              descripcion_nivel: null, dificultad: d, cantidad: distr[d], tipo: 'seleccion_multiple' }, contextData)
            .then(ps => ps.map(q => ({ ...q, _dificultadDB: d, _idNodo: null }))))
      );
      todasPreguntas = _shuffle(lotes.flat()).slice(0, cantidad);

    } else {
      // Una llamada por tema. La dificultad rota entre temas para que la
      // mezcla global se acerque a la distribución del ICFES sin disparar
      // el número de peticiones a la IA.
      const ROTACION = ['media', 'facil', 'media', 'dificil'];

      const lotes = await Promise.all(
        nodos.map((n, i) => {
          const dificultad = mezclar_dificultad === false
            ? 'media'
            : ROTACION[i % ROTACION.length];

          return generarPreguntas(
            { materia, nodo: n.nombre, subtema: '', nivel: nivelSimulacro,
              descripcion_nivel: null, dificultad, cantidad: n.cantidad, tipo: 'seleccion_multiple' },
            { ...contextData, id_nodo: n.id })
            .then(ps => ps.map(q => ({ ...q, _dificultadDB: dificultad, _idNodo: n.id })))
            .catch((err) => {
              // Que falle un tema no debe tumbar el simulacro entero.
              logger.error(`[ia.service] Falló la generación del tema "${n.nombre}": ${err.message}`);
              return [];
            });
        })
      );
      todasPreguntas = _shuffle(lotes.flat()).slice(0, cantidad);
    }
  }

  if (!todasPreguntas.length) {
    throw new Error('La IA no devolvió ninguna pregunta válida. Intenta de nuevo en un momento.');
  }

  _validarDistribucionCompetencias(todasPreguntas, todasPreguntas.length);

  return await db.transaction(async (client) => {
    const { rows: sRows } = await client.query(
      `INSERT INTO simulacro (titulo, descripcion, id_materia, id_nivel, duracion_minutos, activo, creado_por, creado_en)
       VALUES ($1, $2, $3, $4, $5, true, $6, NOW()) RETURNING id`,
      [titulo || `Simulacro Generado (${new Date().toLocaleDateString()})`, 'Simulacro automatizado generado por IA', id_materia, id_nivel, duracion_minutos || 20, id_usuario_admin]
    );
    const idSimulacro = sRows[0].id;

    console.time('batch-insert-simulacro');
    // El nodo ya no es global: cada pregunta trae el suyo desde su generación.
    const idNodos = todasPreguntas.map(q => q._idNodo || id_nodo || null);
    const idNiveles = todasPreguntas.map(p =>
      (p.competencia && nivelIdPorCompetencia[p.competencia]) ? nivelIdPorCompetencia[p.competencia] : id_nivel
    );
    const enunciados = todasPreguntas.map(p => p.enunciado);
    const textoBases = todasPreguntas.map(p => p.texto_base || null);
    const dificultades = todasPreguntas.map(p => p.dificultad || p._dificultadDB || 'media');
    const tipos = todasPreguntas.map(p => p.tipo || 'seleccion_multiple');
    const explicaciones = todasPreguntas.map(p => p.explicacion);
    const temas = todasPreguntas.map(p => p.tema || null);

    const { rows: preguntasInsertadas } = await client.query(
      `INSERT INTO pregunta (id_nodo, id_nivel, enunciado, texto_base, dificultad, tipo, explicacion, tema, activa, creado_por, creado_en)
       SELECT unnest($1::int[]), unnest($2::int[]), unnest($3::text[]), unnest($4::text[]),
              unnest($5::text[])::dificultad_enum, unnest($6::text[])::tipo_pregunta_enum, unnest($7::text[]), unnest($9::text[]), true, $8, NOW()
       RETURNING id`,
      [idNodos, idNiveles, enunciados, textoBases, dificultades, tipos, explicaciones, id_usuario_admin, temas]
    );

    const opIdPreguntas = [], opTextos = [], opLetras = [], opEsCorrectas = [];
    preguntasInsertadas.forEach((row, i) => {
      for (const op of todasPreguntas[i].opciones) {
        opIdPreguntas.push(row.id);
        opTextos.push(op.texto);
        opLetras.push(op.letra);
        opEsCorrectas.push(op.es_correcta);
      }
    });
    await client.query(
      `INSERT INTO opcion_respuesta (id_pregunta, texto, letra, es_correcta)
       SELECT unnest($1::int[]), unnest($2::text[]), unnest($3::text[]), unnest($4::bool[])`,
      [opIdPreguntas, opTextos, opLetras, opEsCorrectas]
    );

    const spIdPreguntas = preguntasInsertadas.map(r => r.id);
    const spOrdenes = preguntasInsertadas.map((_, i) => i + 1);
    await client.query(
      `INSERT INTO simulacro_pregunta (id_simulacro, id_pregunta, orden)
       SELECT $1, unnest($2::int[]), unnest($3::int[])`,
      [idSimulacro, spIdPreguntas, spOrdenes]
    );
    console.timeEnd('batch-insert-simulacro');
    logger.info(`[ia.service] Simulacro ${idSimulacro}: ${todasPreguntas.length} preguntas en batch`);

    return {
      id_simulacro: idSimulacro,
      titulo,
      total_preguntas: todasPreguntas.length,
      preguntas: todasPreguntas
    };
  });
};

/* ─────────────────────────────────────────────────────────────────────────────
   STUBS
───────────────────────────────────────────────────────────────────────────── */

const mejorarPregunta = async () => {
  const err = new Error('mejorarPregunta no implementada');
  err.statusCode = 501; throw err;
};

const generarExplicacion = async () => {
  const err = new Error('generarExplicacion no implementada');
  err.statusCode = 501; throw err;
};

module.exports = {
  generarPreguntas,
  generarSimulacroCompleto,
  analizarFallos,        // ← NUEVO
  mejorarPregunta,
  generarExplicacion,
};