'use strict';

/**
 * RF-06 — Realización de exámenes estáticos.
 *
 * A diferencia del simulacro (RF-05), aquí las preguntas NO se generan con IA:
 * son un conjunto fijo tomado del banco, idéntico en cada aplicación, para que
 * el resultado sirva como medida comparable del nivel académico del estudiante.
 */

const db = require('../config/db');
const logger = require('../utils/logger');
const examenRepo   = require('../repositories/examenNivel.repo');
const catalogoRepo = require('../repositories/catalogo.repo');

const PREGUNTAS_POR_NIVEL = parseInt(process.env.EXAMEN_NIVEL_POR_NIVEL || '3', 10);
const UMBRAL_APROBACION   = parseInt(process.env.EXAMEN_NIVEL_UMBRAL || '60', 10);

/** Devuelve el examen en curso o crea uno nuevo con sus preguntas fijas. */
const obtenerOCrear = async (idUsuario, idMateria) => {
  const { rows: enCurso } = await examenRepo.findEnCurso(idUsuario, idMateria);

  if (enCurso.length) {
    const { rows: preguntas } = await examenRepo.findPreguntasDeExamen(enCurso[0].id);
    return { examen: enCurso[0], preguntas, reanudado: true };
  }

  const { rows: banco } = await examenRepo.findPreguntasFijas(idMateria, PREGUNTAS_POR_NIVEL);

  if (!banco.length) {
    const err = new Error('Todavía no hay preguntas cargadas para esta materia. Pide al administrador que cargue el banco.');
    err.statusCode = 409;
    throw err;
  }

  const examen = await db.transaction(async (client) => {
    const { rows } = await examenRepo.crear(client, idUsuario, idMateria);
    await examenRepo.registrarPreguntas(client, rows[0].id, banco);
    return rows[0];
  });

  const { rows: preguntas } = await examenRepo.findPreguntasDeExamen(examen.id);

  logger.info(`Examen de nivel ${examen.id} iniciado: usuario=${idUsuario} materia=${idMateria} (${preguntas.length} preguntas)`);
  return { examen, preguntas, reanudado: false };
};

/** Califica el examen completo y asigna el nivel académico. */
const responder = async (idUsuario, idExamen, respuestas) => {
  const { rows: examenRows } = await examenRepo.findById(idExamen);

  if (!examenRows.length) {
    const err = new Error('Examen no encontrado.');
    err.statusCode = 404; throw err;
  }

  const examen = examenRows[0];

  if (examen.id_usuario !== idUsuario) {
    const err = new Error('Este examen no te pertenece.');
    err.statusCode = 403; throw err;
  }
  if (examen.estado !== 'en_curso') {
    const err = new Error('Este examen ya fue calificado.');
    err.statusCode = 400; throw err;
  }

  const { rows: correctas } = await examenRepo.findOpcionesCorrectas(idExamen);
  const mapa = new Map(correctas.map(c => [c.id_pregunta, c]));

  const elegidas = new Map();
  respuestas.forEach(r => elegidas.set(Number(r.id_pregunta), Number(r.id_opcion)));

  const detalle = [];
  const porNivel = new Map();   // orden_nivel → { idNivel, aciertos, total }
  let aciertos = 0;

  const resultado = await db.transaction(async (client) => {
    for (const [idPregunta, info] of mapa.entries()) {
      const idOpcion   = elegidas.has(idPregunta) ? elegidas.get(idPregunta) : null;
      const esCorrecta = idOpcion !== null && idOpcion === info.id_opcion_correcta;

      if (esCorrecta) aciertos++;

      await examenRepo.guardarRespuesta(client, idExamen, idPregunta, idOpcion, esCorrecta);

      const clave = info.orden_nivel;
      if (!porNivel.has(clave)) porNivel.set(clave, { idNivel: info.id_nivel, aciertos: 0, total: 0 });
      const acc = porNivel.get(clave);
      acc.total++;
      if (esCorrecta) acc.aciertos++;

      detalle.push({
        id_pregunta:        idPregunta,
        id_opcion_elegida:  idOpcion,
        id_opcion_correcta: info.id_opcion_correcta,
        letra_correcta:     info.letra_correcta,
        es_correcta:        esCorrecta,
        explicacion:        info.explicacion,
      });
    }

    const total   = mapa.size;
    const puntaje = total > 0 ? Math.round((aciertos / total) * 100) : 0;

    // Nivel asignado: el más alto en el que superó el umbral, sin saltarse
    // ninguno. Si no supera ni el primero, queda en el nivel inicial.
    const ordenes = [...porNivel.keys()].sort((a, b) => a - b);
    let idNivelAsignado = null;

    for (const orden of ordenes) {
      const { idNivel, aciertos: a, total: t } = porNivel.get(orden);
      const porcentaje = t > 0 ? (a / t) * 100 : 0;
      if (porcentaje >= UMBRAL_APROBACION) idNivelAsignado = idNivel;
      else break;
    }

    if (idNivelAsignado === null && ordenes.length) {
      idNivelAsignado = porNivel.get(ordenes[0]).idNivel;
    }

    const { rows } = await examenRepo.finalizar(client, idExamen, puntaje, idNivelAsignado);
    return { fin: rows[0], puntaje, total };
  });

  const { rows: nivelRows } = await catalogoRepo.findNiveles();
  const nivel = nivelRows.find(n => n.id === resultado.fin.id_nivel_asignado) || null;

  logger.info(`Examen de nivel ${idExamen} calificado: ${resultado.puntaje}% → nivel ${nivel ? nivel.nombre : 'sin asignar'}`);

  return {
    id_examen:       idExamen,
    puntaje:         resultado.puntaje,
    aciertos,
    total_preguntas: resultado.total,
    nivel_asignado:  nivel,
    desglose_por_nivel: [...porNivel.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([orden, v]) => ({
        orden,
        id_nivel:   v.idNivel,
        aciertos:   v.aciertos,
        total:      v.total,
        porcentaje: v.total ? Math.round((v.aciertos / v.total) * 100) : 0,
      })),
    retroalimentacion: detalle,
  };
};

const ultimoResultado = async (idUsuario, idMateria) => {
  const { rows } = await examenRepo.findUltimoCompletado(idUsuario, idMateria);
  return rows[0] || null;
};

module.exports = { obtenerOCrear, responder, ultimoResultado, PREGUNTAS_POR_NIVEL, UMBRAL_APROBACION };
