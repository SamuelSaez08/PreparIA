'use strict';

const db = require('../config/db');
const { getModel } = require('../config/gemini');
const logger = require('../utils/logger');

/**
 * Normaliza y repara JSON cuando Gemini lo devuelve en distintos formatos:
 *   1. JSON puro
 *   2. JSON envuelto en bloques markdown ```json ... ```
 *   3. JSON precedido o seguido de texto libre (extrae entre primer { y último })
 */
const _parseGeminiResponse = (text) => {
  // Caso 1: JSON puro
  try { return JSON.parse(text); } catch (_) {}

  // Caso 2: JSON envuelto en bloques markdown
  try {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
    return JSON.parse(cleaned);
  } catch (_) {}

  // Caso 3: JSON incrustado en texto libre
  try {
    const start = text.indexOf('{');
    const end   = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
  } catch (_) {}

  throw new Error('No se pudo parsear la respuesta de Gemini como JSON válido');
};

/**
 * Helper para guardar logs en ia_log
 */
const _logIA = async (params) => {
  try {
    await db.query(
      `INSERT INTO ia_log
       (id_usuario, accion, id_materia, id_nodo, dificultad, cantidad_pedida, cantidad_exitosa, tokens_usados, duracion_ms, exitoso, error_mensaje)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        params.id_usuario, params.accion, params.id_materia, params.id_nodo, params.dificultad,
        params.cantidad_pedida, params.cantidad_exitosa, params.tokens_usados, params.duracion_ms,
        params.exitoso, params.error_mensaje || null
      ]
    );
  } catch (err) {
    logger.error('Error insertando en ia_log:', err.message);
  }
};

/**
 * Quita tildes comunes del español para comparaciones tolerantes con la respuesta del modelo.
 */
const _sinTilde = (s) => s.toLowerCase()
  .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
  .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ü/g, 'u')
  .replace(/ñ/g, 'n');

/**
 * Validaciones estrictas internas de calidad de pregunta.
 * texto_base es OBLIGATORIO. tema, nivel_dificultad y tipo_contexto son opcionales pero se validan si están presentes.
 */
const _validarPregunta = (p) => {
  // texto_base OBLIGATORIO: mínimo 50 caracteres (≈ 3 líneas cortas)
  if (!p.texto_base || typeof p.texto_base !== 'string' || p.texto_base.trim().length < 50) return false;

  // Enunciado obligatorio y mínimo 20 caracteres
  if (!p.enunciado || p.enunciado.length < 20) return false;

  // Exactamente 4 opciones
  if (!p.opciones || p.opciones.length !== 4) return false;

  // Exactamente una opción correcta
  const correctas = p.opciones.filter(o => o.es_correcta);
  if (correctas.length !== 1) return false;

  // Cada opción debe tener texto válido y letra A-D
  for (const op of p.opciones) {
    if (!op.texto || op.texto.trim() === '') return false;
    if (!['A', 'B', 'C', 'D'].includes(op.letra.toUpperCase())) return false;
  }

  // Sin textos duplicados en opciones
  const textos = new Set(p.opciones.map(o => o.texto.toLowerCase().trim()));
  if (textos.size !== 4) return false;

  // Explicación obligatoria y mínimo 30 caracteres
  if (!p.explicacion || p.explicacion.length < 30) return false;

  // Filtro: el enunciado no debe revelar la respuesta
  if (/la opci.n (a|b|c|d) es|la respuesta correcta es/i.test(p.enunciado)) return false;

  // Validación opcional: nivel_dificultad debe coincidir con los valores del PROMPT_SISTEMA
  if (p.nivel_dificultad != null) {
    const nivelesValidos = ['basico', 'medio', 'avanzado'];
    if (!nivelesValidos.includes(_sinTilde(p.nivel_dificultad))) return false;
  }

  // Validación opcional: respuesta_correcta debe coincidir con la letra de la opción correcta
  if (p.respuesta_correcta != null) {
    if (p.respuesta_correcta.toUpperCase() !== correctas[0].letra.toUpperCase()) return false;
  }

  // Validación opcional: tipo_contexto debe ser uno de los valores definidos
  if (p.tipo_contexto != null) {
    const tiposValidos = ['noticia', 'situacion', 'definicion', 'caricatura', 'documento_oficial', 'estadistica', 'discurso'];
    if (!tiposValidos.includes(_sinTilde(p.tipo_contexto))) return false;
  }

  return true;
};

/**
 * Valida la estructura general del JSON devuelto por Gemini.
 * Lanza un error descriptivo si la respuesta no es utilizable.
 */
const _validarRespuestaJSON = (parsed, cantidadEsperada) => {
  if (!parsed.preguntas || !Array.isArray(parsed.preguntas)) {
    throw new Error('El formato JSON no contiene un array "preguntas"');
  }

  if (parsed.preguntas.length === 0) {
    throw new Error('El array "preguntas" está vacío en la respuesta de Gemini');
  }

  const minimoAceptable = Math.ceil(cantidadEsperada * 0.5);
  if (parsed.preguntas.length < minimoAceptable) {
    throw new Error(
      `Gemini devolvió ${parsed.preguntas.length} pregunta(s) pero se esperaban al menos ${minimoAceptable} (50% de ${cantidadEsperada})`
    );
  }
};

/**
 * Prompt del sistema con reglas absolutas de texto_base para ICFES Saber 11 Colombia.
 */
const PROMPT_SISTEMA = `Eres un experto en el diseño de preguntas para el examen ICFES Saber 11 de Colombia, específicamente para el módulo de Sociales y Ciudadanas.

REGLA ABSOLUTA: Cada pregunta DEBE tener un TEXTO BASE antes del enunciado. Sin texto_base, la pregunta es INVÁLIDA y será descartada.

EL TEXTO BASE es un fragmento de 3 a 8 líneas que puede ser:
- Un fragmento de noticia o artículo de prensa colombiana o latinoamericana
- Una situación hipotética concreta con personajes, lugar y conflicto
- Una definición académica de un concepto político, económico o social
- La descripción de una caricatura o imagen política
- Un fragmento de documento oficial (ley, sentencia, plan de gobierno, discurso presidencial)
- Una tabla, estadística o dato cuantitativo sobre Colombia o el mundo
- Un fragmento de discurso o declaración de un personaje histórico o público

CARACTERÍSTICAS DEL TEXTO BASE:
- Debe estar escrito en tercera persona o ser una cita directa con fuente
- Debe contener la información SUFICIENTE y NECESARIA para responder la pregunta
- El estudiante NO debe necesitar conocimiento externo: toda la información requerida está en el texto_base
- Debe estar contextualizado en Colombia o con referencia latinoamericana o global cuando aplique
- Longitud: mínimo 3 líneas, máximo 8 líneas

COMPETENCIAS ICFES Y DISTRIBUCIÓN OBLIGATORIA


Cada pregunta debe estar asociada a exactamente una de estas competencias. La distribución sobre el total de preguntas solicitadas debe respetarse:

  a. "pensamiento_social"            → 30% de las preguntas
     Evalúa la capacidad de reconocer e interpretar fenómenos sociales, políticos y económicos en contextos concretos.

  b. "interpretacion_perspectivas"   → 40% de las preguntas
     Evalúa la capacidad de identificar, contrastar y analizar distintos puntos de vista, argumentos e intereses presentes en una situación.

  c. "pensamiento_reflexivo"         → 30% de las preguntas
     Evalúa la capacidad de establecer relaciones causales, consecuencias sistémicas y proponer soluciones fundamentadas.

Redondea al entero más cercano cuando el porcentaje no sea exacto. Incluye el campo "competencia" en cada pregunta con el valor exacto entre comillas: "pensamiento_social", "interpretacion_perspectivas" o "pensamiento_reflexivo".


NIVELES DE DIFICULTAD


Distribución sobre el total de preguntas (salvo indicación contraria en la solicitud):
  - "basico"    → 30%: el estudiante identifica información explícita en el texto_base
  - "medio"     → 50%: el estudiante infiere, relaciona causas/efectos o interpreta el texto_base
  - "avanzado"  → 20%: el estudiante usa conceptos del texto_base para resolver una situación nueva


ESTRUCTURA OBLIGATORIA DE CADA PREGUNTA


1. texto_base (3-8 líneas): presenta la situación, fragmento, definición o estadística
2. enunciado: pregunta concreta basada exclusivamente en el texto_base
3. opciones A, B, C, D: plausibles, sin opciones absurdas, dos opciones cercanas para exigir análisis
4. respuesta_correcta: "A", "B", "C" o "D"
5. competencia: "pensamiento_social" | "interpretacion_perspectivas" | "pensamiento_reflexivo"
6. nivel_dificultad: "basico" | "medio" | "avanzado"
7. tipo_contexto: tipo del texto_base usado
8. tema: tema específico de Ciencias Sociales evaluado
9. explicacion: por qué la respuesta correcta es correcta y por qué cada distractor es incorrecto

TIPOS DE PREGUNTA permitidos:
- Análisis de argumentos: "De las siguientes afirmaciones, ¿cuál NO es correcta?"
- Identificación de posición: "¿Qué intereses está favoreciendo la medida descrita?"
- Aplicación de norma: "Según el texto, ¿cuál mecanismo constitucional corresponde?"
- Relación entre ideas: "¿Qué tipo de relación existe entre las propuestas del texto?"
- Consecuencia lógica: "¿Qué consecuencia tendría la decisión descrita en el texto?"


REGLAS DE VARIEDAD Y ESTILO


- Nunca repetir el mismo tipo_contexto en más de 2 preguntas consecutivas
- No usar el mismo personaje, institución o situación en más de una pregunta
- Incluir diversidad regional colombiana: no solo Bogotá; incluir regiones, departamentos y ciudades variadas
- Usar instituciones colombianas reales: Congreso, Corte Constitucional, Registraduría, DANE, Defensoría del Pueblo, etc.
- Distribuir la competencia "interpretacion_perspectivas" en preguntas que presenten al menos dos voces o puntos de vista en el texto_base

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EJEMPLO DE PREGUNTA CORRECTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "texto_base": "El artículo 67 de la Constitución Política de Colombia de 1991 establece: 'La educación es un derecho de la persona y un servicio público que tiene una función social; con ella se busca el acceso al conocimiento, a la ciencia, a la técnica, y a los demás bienes y valores de la cultura.' Según el DANE, el gasto público en educación en Colombia ha representado entre el 4% y el 5% del PIB en la última década, cifra inferior al promedio de países de la OCDE (5.8%).",
  "enunciado": "De acuerdo con el texto anterior, la característica que mejor define la educación según la Constitución colombiana es que esta",
  "opciones": [
    {"letra": "A", "texto": "es un privilegio reservado a los ciudadanos que pueden costearla", "es_correcta": false},
    {"letra": "B", "texto": "cumple una función social y garantiza el acceso al conocimiento", "es_correcta": true},
    {"letra": "C", "texto": "depende exclusivamente del porcentaje del PIB que el Estado destine", "es_correcta": false},
    {"letra": "D", "texto": "se limita a la transmisión de ciencia y técnica en instituciones privadas", "es_correcta": false}
  ],
  "respuesta_correcta": "B",
  "competencia": "pensamiento_social",
  "nivel_dificultad": "basico",
  "tipo_contexto": "documento_oficial",
  "tema": "Derecho a la educación y gasto público",
  "explicacion": "El artículo 67 define la educación como derecho y servicio público con función social orientado al acceso al conocimiento (B). La opción A contradice el carácter de derecho universal. La C reduce la educación a un indicador económico. La D excluye el rol del Estado y las instituciones públicas."
}

PROHIBIDO

- Generar preguntas sin texto_base
- Preguntas que se responden por memorización sin leer el texto_base
- Opciones claramente absurdas o fuera de contexto
- Repetir el mismo tipo_contexto en más de 2 preguntas consecutivas
- Usar términos distintos a "basico", "medio", "avanzado" para nivel_dificultad
- Usar términos distintos a los tres valores exactos para el campo competencia

RESPONDE ÚNICAMENTE con un JSON válido, sin texto adicional, sin bloques de código markdown.
El JSON debe seguir EXACTAMENTE el schema especificado en cada solicitud.`;

/**
 * Convierte el nombre de la tabla `nivel` al valor de competencia usado en el JSON de Gemini.
 */
const _nivelToCompetencia = (nombre) => {
  if (!nombre) return null;
  const n = nombre.toLowerCase();
  if (n.includes('pensamiento social'))                          return 'pensamiento_social';
  if (n.includes('interpretaci') || n.includes('perspectivas')) return 'interpretacion_perspectivas';
  if (n.includes('reflexivo')    || n.includes('sist'))         return 'pensamiento_reflexivo';
  return null;
};

/**
 * Construye la sección de distribución de temas del prompt cuando se proporciona distribucion_temas.
 */
const _buildDistribucionTemas = (distribucion_temas) => {
  if (!distribucion_temas || typeof distribucion_temas !== 'object' || Object.keys(distribucion_temas).length === 0) {
    return '';
  }

  const lineas = Object.entries(distribucion_temas)
    .map(([tema, cantidad]) => `- ${tema}: ${cantidad} pregunta${cantidad !== 1 ? 's' : ''}`)
    .join('\n');

  return `
Distribución de preguntas por tema (OBLIGATORIA):
${lineas}

Asegúrate de que cada pregunta tenga el campo "tema" con el nombre exacto del tema listado arriba.
No generes más ni menos preguntas de las indicadas por tema.`;
};

/**
 * Genera preguntas de selección múltiple usando Google Gemini.
 * @param {object} opciones - Parámetros de generación.
 * @param {string} opciones.materia - Nombre de la materia.
 * @param {string} opciones.nodo - Tema principal.
 * @param {string} [opciones.subtema] - Subtema específico.
 * @param {string} opciones.nivel - Nivel educativo (grado 10-11).
 * @param {string} opciones.dificultad - facil | media | dificil.
 * @param {number} opciones.cantidad - Número de preguntas a generar.
 * @param {string} [opciones.tipo] - Tipo de pregunta.
 * @param {string} [opciones.contexto_adicional] - Contexto adicional para el prompt.
 * @param {object} [opciones.distribucion_temas] - Distribución por temas: { "Nombre tema": cantidad, ... }
 * @param {object} contextData - Datos de contexto para logging.
 */
const generarPreguntas = async (opciones, contextData = {}) => {
  const {
    materia, nodo, subtema, nivel, descripcion_nivel, dificultad, cantidad, tipo,
    contexto_adicional, distribucion_temas
  } = opciones;
  const { id_usuario, id_materia, id_nodo } = contextData;
  const model = getModel();
  const startTime = Date.now();
  let tokens_usados = 0;

  // Construir sección de distribución de temas si se proporcionó
  const seccionDistribucion = _buildDistribucionTemas(distribucion_temas);

  /**
   * competenciaForzada: cuando el nombre del nivel coincide con una de las tres competencias ICFES,
   * se activa el modo de competencia única. Esto anula la distribución 30/40/30 del PROMPT_SISTEMA
   * y obliga a que el 100% de las preguntas pertenezcan a esa competencia.
   * Se activa solo desde generarPreguntas (endpoint individual); generarSimulacroCompleto
   * usa el nivel neutro "Mixto" para respetar la distribución estándar.
   */
  const competenciaForzada = _nivelToCompetencia(nivel);
  if (competenciaForzada) {
    logger.warn(`[ia.service] Modo competencia forzada activo: ${competenciaForzada}. Distribución 30/40/30 anulada.`);
  }

  const promptUsuario = `Genera exactamente ${cantidad} pregunta(s) de selección múltiple para
el examen ICFES colombiano (módulo Sociales y Ciudadanas) con estas especificaciones:

Materia: ${materia}
Tema principal: ${nodo}
${subtema ? 'Subtema específico: ' + subtema : ''}
Competencia ICFES: ${nivel}${descripcion_nivel ? '\n' + descripcion_nivel : ''}
Dificultad predominante: ${dificultad}
${contexto_adicional ? 'Contexto adicional: ' + contexto_adicional : ''}
${competenciaForzada ? `COMPETENCIA OBLIGATORIA: El 100% de las preguntas debe tener competencia="${competenciaForzada}". No aplica la distribución porcentual del sistema de instrucciones.` : ''}
${seccionDistribucion}

RECUERDA: Cada pregunta DEBE tener un texto_base de 3-8 líneas. Sin texto_base la pregunta es inválida.

Responde ÚNICAMENTE con este JSON exacto, sin texto adicional, sin markdown:

{
  "preguntas": [
    {
      "texto_base": "Párrafo de 3-8 líneas que presenta la situación, fragmento, definición o estadística...",
      "enunciado": "¿Pregunta concreta que se responde a partir del texto_base?",
      "opciones": [
        { "letra": "A", "texto": "Primera opción plausible", "es_correcta": false },
        { "letra": "B", "texto": "Segunda opción plausible", "es_correcta": true },
        { "letra": "C", "texto": "Tercera opción plausible", "es_correcta": false },
        { "letra": "D", "texto": "Cuarta opción plausible",  "es_correcta": false }
      ],
      "respuesta_correcta": "B",
      "competencia": "pensamiento_social|interpretacion_perspectivas|pensamiento_reflexivo",
      "tema": "nombre_del_tema",
      "nivel_dificultad": "basico|medio|avanzado",
      "tipo_contexto": "noticia|situacion|definicion|caricatura|documento_oficial|estadistica|discurso",
      "explicacion": "Explicación de por qué la respuesta correcta es correcta y por qué las otras no."
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
      ) {
        throw new Error('Filtro de seguridad activado por Google Gemini. Reformule el tema o enfoque.');
      }

      const parsed = _parseGeminiResponse(text);

      // Validar estructura general del JSON antes de iterar
      _validarRespuestaJSON(parsed, cantidad);

      let exitosas = [];
      for (const p of parsed.preguntas) {
        if (_validarPregunta(p)) {
          exitosas.push(p);
        }
      }

      if (exitosas.length < Math.ceil(cantidad * 0.5)) {
        throw new Error(`Demasiadas preguntas fallaron la validación de calidad (${exitosas.length}/${cantidad})`);
      }

      await _logIA({
        id_usuario, accion: 'generar_preguntas', id_materia, id_nodo, dificultad,
        cantidad_pedida: cantidad, cantidad_exitosa: exitosas.length,
        tokens_usados, duracion_ms: Date.now() - startTime, exitoso: true
      });

      return exitosas;
    } catch (err) {
      const detalle = err.errorDetails ? JSON.stringify(err.errorDetails) : (err.status || err.statusText || '');
      logger.warn(`Intento ${attempts} fallido al generar con IA: ${err.message} ${detalle}`.trim());
      lastError = err;
      // No reintentar en errores que no se resuelven reintentando inmediatamente
      if (err.message && /400|429|404|401|403|503/.test(err.message)) break;
    }
  }

  // Log de error tras agotar todos los intentos
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

/**
 * Verifica que la distribución de competencias en el array de preguntas
 * respete aproximadamente la proporción 30/40/30 del ICFES Saber 11.
 * Emite un logger.warn por cada competencia que se desvíe más de 1 pregunta.
 */
const _validarDistribucionCompetencias = (preguntas, cantidadTotal) => {
  const esperado = {
    pensamiento_social:          Math.round(cantidadTotal * 0.30),
    interpretacion_perspectivas: Math.round(cantidadTotal * 0.40),
    pensamiento_reflexivo:       Math.round(cantidadTotal * 0.30),
  };
  const conteo = { pensamiento_social: 0, interpretacion_perspectivas: 0, pensamiento_reflexivo: 0 };
  for (const p of preguntas) {
    if (p.competencia in conteo) conteo[p.competencia]++;
  }
  for (const [comp, esperadoVal] of Object.entries(esperado)) {
    if (Math.abs(conteo[comp] - esperadoVal) > 1) {
      logger.warn(
        `[ia.service] Distribución de competencias desviada: ${comp} — esperado ${esperadoVal}, real ${conteo[comp]} (total: ${cantidadTotal})`
      );
    }
  }
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
  const media = cantidad - facil - dificil;
  return { facil, media, dificil };
};

const generarSimulacroCompleto = async (opciones) => {
  const { id_materia, id_nivel, id_nodo, cantidad = 10, mezclar_dificultad, titulo, duracion_minutos, id_usuario_admin } = opciones;

  // Obtener info BD
  const { rows: matRows } = await db.query('SELECT nombre FROM materia WHERE id = $1', [id_materia]);
  if (!matRows.length) throw new Error('Materia no encontrada');
  const materia = matRows[0].nombre;

  // Mapa de competencia → id_nivel para asignar el nivel correcto a cada pregunta
  const { rows: todosNiveles } = await db.query('SELECT id, nombre FROM nivel');
  const nivelIdPorCompetencia = {};
  for (const row of todosNiveles) {
    const comp = _nivelToCompetencia(row.nombre);
    if (comp) nivelIdPorCompetencia[comp] = row.id;
  }

  let nodo = 'Temas Generales';
  if (id_nodo) {
    const { rows: nRows } = await db.query('SELECT nombre FROM nodo_aprendizaje WHERE id = $1', [id_nodo]);
    if (nRows.length) nodo = nRows[0].nombre;
  }

  const distr = _getDificultadStats(cantidad, mezclar_dificultad);
  const contextData = { id_usuario: id_usuario_admin, id_materia, id_nodo };

  // Para el simulacro completo no se fuerza una sola competencia: se pasa un nivel neutro
  // para que el PROMPT_SISTEMA aplique la distribución 30/40/30 entre las tres competencias.
  // La asignación de id_nivel por pregunta se hace abajo usando nivelIdPorCompetencia.
  const nivelSimulacro = 'Mixto (distribución ICFES Saber 11)';

  // Generación paralela de las tres franjas de dificultad
  const [pFacil, pMedia, pDificil] = await Promise.all([
    distr.facil > 0
      ? generarPreguntas({ materia, nodo, subtema: '', nivel: nivelSimulacro, descripcion_nivel: null, dificultad: 'facil',  cantidad: distr.facil,  tipo: 'seleccion_multiple' }, contextData)
          .then(p => p.map(q => ({ ...q, _dificultadDB: 'facil' })))
      : Promise.resolve([]),
    distr.media > 0
      ? generarPreguntas({ materia, nodo, subtema: '', nivel: nivelSimulacro, descripcion_nivel: null, dificultad: 'media',  cantidad: distr.media,  tipo: 'seleccion_multiple' }, contextData)
          .then(p => p.map(q => ({ ...q, _dificultadDB: 'media' })))
      : Promise.resolve([]),
    distr.dificil > 0
      ? generarPreguntas({ materia, nodo, subtema: '', nivel: nivelSimulacro, descripcion_nivel: null, dificultad: 'dificil', cantidad: distr.dificil, tipo: 'seleccion_multiple' }, contextData)
          .then(p => p.map(q => ({ ...q, _dificultadDB: 'dificil' })))
      : Promise.resolve([]),
  ]);
  let todasPreguntas = [...pFacil, ...pMedia, ...pDificil];

  // Shuffle Fisher-Yates para distribuir dificultades homogéneamente
  todasPreguntas = _shuffle(todasPreguntas).slice(0, cantidad);

  // Advertir si la distribución de competencias se desvía del 30/40/30 esperado
  _validarDistribucionCompetencias(todasPreguntas, todasPreguntas.length);

  // Iniciar transacción para guardar
  return await db.transaction(async (client) => {
    // 1. Crear simulacro
    const { rows: sRows } = await client.query(
      `INSERT INTO simulacro (titulo, descripcion, id_materia, id_nivel, duracion_minutos, activo, creado_por, creado_en)
       VALUES ($1, $2, $3, $4, $5, true, $6, NOW()) RETURNING id`,
      [titulo || `Simulacro Generado (${new Date().toLocaleDateString()})`, 'Simulacro automatizado generado por Google Gemini', id_materia, id_nivel, duracion_minutos || 20, id_usuario_admin]
    );
    const idSimulacro = sRows[0].id;

    let indexPregunta = 1;
    // 2. Insertar preguntas y opciones
    for (const p of todasPreguntas) {
      // p.dificultad y p.tipo pueden estar ausentes en el nuevo schema (usa fallbacks seguros)
      const dificuladDB = p.dificultad || p._dificultadDB || 'media';
      const tipoInsert = p.tipo || 'seleccion_multiple';
      // Usar el id_nivel de la competencia que Gemini asignó a la pregunta (si existe en la BD),
      // de lo contrario usar el id_nivel del simulacro
      const idNivelPregunta = (p.competencia && nivelIdPorCompetencia[p.competencia])
        ? nivelIdPorCompetencia[p.competencia]
        : id_nivel;
      const { rows: pRows } = await client.query(
        `INSERT INTO pregunta (id_nodo, id_nivel, enunciado, texto_base, dificultad, tipo, explicacion, activa, creado_por, creado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, NOW()) RETURNING id`,
        [id_nodo || null, idNivelPregunta, p.enunciado, p.texto_base || null, dificuladDB, tipoInsert, p.explicacion, id_usuario_admin]
      );
      const idPreg = pRows[0].id;

      for (const op of p.opciones) {
        await client.query(
          `INSERT INTO opcion_respuesta (id_pregunta, texto, letra, es_correcta) VALUES ($1, $2, $3, $4)`,
          [idPreg, op.texto, op.letra, op.es_correcta]
        );
      }

      await client.query(
        `INSERT INTO simulacro_pregunta (id_simulacro, id_pregunta, orden) VALUES ($1, $2, $3)`,
        [idSimulacro, idPreg, indexPregunta++]
      );
    }

    return {
      id_simulacro: idSimulacro,
      titulo: titulo,
      total_preguntas: todasPreguntas.length,
      preguntas: todasPreguntas
    };
  });
};

const mejorarPregunta = async (idPregunta, contextData) => {
  const err = new Error('Función mejorarPregunta aún no implementada');
  err.statusCode = 501;
  throw err;
};

const generarExplicacion = async (idPregunta, contextData) => {
  const err = new Error('Función generarExplicacion aún no implementada');
  err.statusCode = 501;
  throw err;
};

module.exports = {
  generarPreguntas,
  generarSimulacroCompleto,
  mejorarPregunta,
  generarExplicacion
};
