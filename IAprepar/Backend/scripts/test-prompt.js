'use strict';

/**
 * Script de validación del nuevo schema de preguntas con texto_base obligatorio.
 * Prueba la función _validarPregunta con casos reales sin llamar a la API.
 */

// ── Replica la lógica de _validarPregunta del servicio ──────────────────────
const _sinTilde = (s) => s.toLowerCase()
  .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
  .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ü/g, 'u')
  .replace(/ñ/g, 'n');

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
    const nivelesValidos = ['comprension', 'analisis', 'aplicacion'];
    if (!nivelesValidos.includes(_sinTilde(p.nivel_dificultad))) return false;
  }
  if (p.respuesta_correcta != null) {
    if (p.respuesta_correcta.toUpperCase() !== correctas[0].letra.toUpperCase()) return false;
  }
  if (p.tipo_contexto != null) {
    const tiposValidos = ['noticia', 'situacion', 'definicion', 'caricatura', 'documento_oficial', 'estadistica', 'discurso'];
    if (!tiposValidos.includes(p.tipo_contexto.toLowerCase())) return false;
  }
  return true;
};

// ── Preguntas de prueba que simula lo que devolvería Gemini ──────────────────
const preguntasMock = [
  {
    // Pregunta 1: Historia y geografía — con texto_base correcto
    texto_base: "Según el DANE, en el censo de 2018, Colombia registró 48.2 millones de habitantes, de los cuales el 77.1% residía en zonas urbanas. La región Caribe albergaba el 21% de la población, mientras que Bogotá concentraba el 16%. El informe también destacó que el 9.3% de la población se autoidentificó como afrocolombiana, cifra que refleja la diversidad étnica del país.",
    enunciado: "De acuerdo con el texto anterior, ¿cuál de las siguientes afirmaciones describe correctamente la distribución poblacional de Colombia según el censo de 2018?",
    opciones: [
      { "letra": "A", "texto": "La mayoría de la población colombiana vive en zonas rurales", "es_correcta": false },
      { "letra": "B", "texto": "Bogotá concentra más del 20% de la población total del país", "es_correcta": false },
      { "letra": "C", "texto": "Más del 75% de los colombianos habita en centros urbanos", "es_correcta": true },
      { "letra": "D", "texto": "La región Caribe supera en población a todas las demás regiones combinadas", "es_correcta": false }
    ],
    respuesta_correcta: "C",
    tema: "Historia y geografía",
    nivel_dificultad: "comprensión",
    tipo_contexto: "estadistica",
    explicacion: "El texto indica que el 77.1% de la población reside en zonas urbanas, lo cual equivale a más del 75% (C). La opción A contradice directamente el dato. La B es incorrecta pues Bogotá representa el 16%, no el 20%. La D es falsa porque la región Caribe tiene el 21%, no supera al resto."
  },
  {
    // Pregunta 2: Política y Constitución — con texto_base correcto
    texto_base: "El artículo 103 de la Constitución Política de Colombia establece los mecanismos de participación ciudadana: 'Son mecanismos de participación del pueblo en ejercicio de su soberanía: el voto, el plebiscito, el referendo, la consulta popular, el cabildo abierto, la iniciativa legislativa y la revocatoria del mandato.' En 2016, el plebiscito sobre los Acuerdos de Paz con las FARC fue el primero en aplicarse desde la promulgación de la Constitución de 1991.",
    enunciado: "Según el texto anterior, ¿cuál mecanismo de participación ciudadana fue utilizado para consultar a los colombianos sobre los Acuerdos de Paz con las FARC?",
    opciones: [
      { "letra": "A", "texto": "Referendo constitucional convocado por el Congreso", "es_correcta": false },
      { "letra": "B", "texto": "Plebiscito como consulta al pueblo sobre una decisión del Ejecutivo", "es_correcta": true },
      { "letra": "C", "texto": "Iniciativa legislativa popular para aprobar los acuerdos", "es_correcta": false },
      { "letra": "D", "texto": "Revocatoria del mandato presidencial por incumplimiento", "es_correcta": false }
    ],
    respuesta_correcta: "B",
    tema: "Política y Constitución",
    nivel_dificultad: "comprensión",
    tipo_contexto: "documento_oficial",
    explicacion: "El texto indica explícitamente que el plebiscito de 2016 fue el mecanismo utilizado (B). El referendo sirve para aprobar o derogar leyes, no decisiones del Ejecutivo (A). La iniciativa legislativa (C) y la revocatoria del mandato (D) no corresponden al tipo de consulta descrita."
  },
  {
    // Pregunta 3: Ética y ciudadanía — con texto_base correcto
    texto_base: "En una comunidad del municipio de Quibdó, Chocó, un grupo de madres líderes organizó una asamblea comunitaria para discutir el deterioro del acueducto local. Durante el cabildo abierto, exigieron al alcalde rendición de cuentas sobre los recursos del Sistema General de Participaciones destinados a agua potable. El funcionario presentó informes que mostraban que el 40% de los recursos había sido ejecutado en la cabecera municipal, dejando sin servicio al 60% de las veredas.",
    enunciado: "Con base en la situación descrita, ¿cuál de las siguientes acciones realizaron las madres líderes para ejercer su derecho a la participación ciudadana?",
    opciones: [
      { "letra": "A", "texto": "Interpusieron una tutela ante el Tribunal Superior del Distrito", "es_correcta": false },
      { "letra": "B", "texto": "Convocaron un plebiscito regional para revocar al alcalde", "es_correcta": false },
      { "letra": "C", "texto": "Utilizaron el cabildo abierto para exigir rendición de cuentas al alcalde", "es_correcta": true },
      { "letra": "D", "texto": "Presentaron una demanda de acción popular ante el Consejo de Estado", "es_correcta": false }
    ],
    respuesta_correcta: "C",
    tema: "Ética y ciudadanía",
    nivel_dificultad: "análisis",
    tipo_contexto: "situacion",
    explicacion: "El texto describe explícitamente que el mecanismo utilizado fue el cabildo abierto para exigir rendición de cuentas (C). La tutela (A) protege derechos fundamentales pero no es el mecanismo descrito. El plebiscito (B) no aplica para revocar alcaldes —eso es la revocatoria del mandato—. La acción popular (D) no es el mecanismo descrito en el texto."
  }
];

// ── Pregunta inválida: sin texto_base ────────────────────────────────────────
const preguntaSinTextBase = {
  enunciado: "¿Cuál es la capital de Colombia?",
  opciones: [
    { "letra": "A", "texto": "Medellín", "es_correcta": false },
    { "letra": "B", "texto": "Bogotá", "es_correcta": true },
    { "letra": "C", "texto": "Cali", "es_correcta": false },
    { "letra": "D", "texto": "Barranquilla", "es_correcta": false }
  ],
  respuesta_correcta: "B",
  explicacion: "Bogotá es la capital de Colombia según la Constitución de 1991 y es la ciudad más poblada del país."
};

// ── Ejecutar validaciones ────────────────────────────────────────────────────
console.log('\n=== TEST DE VALIDACIÓN: NUEVO SCHEMA CON texto_base OBLIGATORIO ===\n');

let pasaron = 0;
const total = preguntasMock.length;

preguntasMock.forEach((p, i) => {
  const resultado = _validarPregunta(p);
  const estado = resultado ? 'PASS' : 'FAIL';
  if (resultado) pasaron++;
  console.log(`[${estado}] Pregunta ${i + 1} (${p.tema}) — tipo_contexto: ${p.tipo_contexto}`);
  if (!resultado) {
    console.log(`       → FALLO: verificar campos texto_base, opciones o explicacion`);
  }
});

console.log('\n--- Prueba de pregunta SIN texto_base (debe fallar) ---');
const resultadoInvalido = _validarPregunta(preguntaSinTextBase);
const estadoInvalido = !resultadoInvalido ? 'PASS (correctamente rechazada)' : 'FAIL (debería haber sido rechazada)';
console.log(`[${estadoInvalido}] Pregunta sin texto_base`);

console.log(`\n=== RESUMEN: ${pasaron}/${total} preguntas con texto_base pasaron la validación ===`);
console.log('\n--- Inspección del texto_base de la pregunta 1 ---');
console.log(preguntasMock[0].texto_base);

console.log('\n--- Nuevos campos añadidos al schema ---');
console.log('  ✓ texto_base   (OBLIGATORIO, mínimo 50 caracteres ≈ 3 líneas)');
console.log('  ✓ tipo_contexto (opcional, valores: noticia|situacion|definicion|caricatura|documento_oficial|estadistica|discurso)');
console.log('  ✗ contexto     (campo antiguo — ELIMINADO del schema)');
