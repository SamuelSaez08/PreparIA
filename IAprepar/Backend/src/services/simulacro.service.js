'use strict';

const db            = require('../config/db');
const logger        = require('../utils/logger');
const { ESTADOS_INTENTO: ESTADOS } = require('../utils/constants');
const simulacroRepo = require('../repositories/simulacro.repo');
const intentoRepo   = require('../repositories/intento.repo');
const progresoRepo  = require('../repositories/progreso.repo');

const iniciarIntento = async (idUsuario, idSimulacro) => {
  const { rows: simRows } = await simulacroRepo.findByIdWithCount(idSimulacro);

  if (!simRows.length) {
    const err = new Error('Simulacro no encontrado.');
    err.statusCode = 404; throw err;
  }

  const sim = simRows[0];
  if (!sim.activo) {
    const err = new Error('Este simulacro no está disponible.');
    err.statusCode = 400; throw err;
  }

  const { rows: enCurso } = await intentoRepo.findEnCurso(idUsuario, idSimulacro, ESTADOS.EN_CURSO);

  if (enCurso.length) {
    return { intento_existente: true, id_intento: enCurso[0].id };
  }

  const expiraEn = new Date(Date.now() + sim.duracion_minutos * 60_000);

  const { rows } = await intentoRepo.create(
    idUsuario, idSimulacro, ESTADOS.EN_CURSO, expiraEn, parseInt(sim.total_preguntas, 10)
  );

  logger.info(`Intento iniciado: usuario=${idUsuario} simulacro=${idSimulacro} intento=${rows[0].id}`);

  const { rows: preguntas } = await simulacroRepo.findPreguntasBySimulacro(idSimulacro);

  return {
    intento:   rows[0],
    simulacro: { id: sim.id, titulo: sim.titulo, duracion_minutos: sim.duracion_minutos },
    preguntas,
  };
};

const responderPregunta = async (idIntento, idUsuario, idPregunta, idOpcion) => {
  const intento = await _verificarIntento(idIntento, idUsuario);

  const { rows: spRows } = await simulacroRepo.findPreguntaInSimulacro(intento.id_simulacro, idPregunta);
  if (!spRows.length) {
    const err = new Error('La pregunta no pertenece a este simulacro.');
    err.statusCode = 400; throw err;
  }

  const { rows: opRows } = await intentoRepo.findOpcion(idOpcion, idPregunta);
  if (!opRows.length) {
    const err = new Error('La opción no corresponde a esta pregunta.');
    err.statusCode = 400; throw err;
  }

  const esCorrecta = opRows[0].es_correcta;

  await intentoRepo.upsertRespuesta(idIntento, idPregunta, idOpcion, esCorrecta);

  return { id_pregunta: idPregunta, es_correcta: esCorrecta };
};

const finalizarIntento = async (idIntento, idUsuario, tiempoUsado = null) => {
  const intento = await _verificarIntento(idIntento, idUsuario);

  return await db.transaction(async (client) => {
    const { rows: stats } = await intentoRepo.getStats(client, idIntento);

    const { total_respondidas, correctas, incorrectas } = stats[0];
    const totalPreguntas = intento.total_preguntas;
    const puntaje = totalPreguntas > 0
      ? Math.round((parseInt(correctas, 10) / totalPreguntas) * 100)
      : 0;

    const { rows: intentoActualizado } = await intentoRepo.updateFinalizado(
      client, idIntento, ESTADOS.COMPLETADO, puntaje,
      parseInt(correctas, 10), parseInt(incorrectas, 10), tiempoUsado
    );

    await _actualizarProgreso(client, idUsuario, intento.id_simulacro, puntaje, parseInt(correctas, 10), totalPreguntas);

    const { rows: retroalimentacion } = await intentoRepo.getRetroalimentacion(client, idIntento);

    logger.info(
      `Intento ${idIntento} finalizado: ${puntaje}% (${correctas}/${totalPreguntas})` +
      (tiempoUsado !== null ? ` tiempo_usado=${tiempoUsado}s` : '')
    );

    return {
      intento:           intentoActualizado[0],
      puntaje,
      correctas:         parseInt(correctas, 10),
      incorrectas:       parseInt(incorrectas, 10),
      total_respondidas: parseInt(total_respondidas, 10),
      total_preguntas:   totalPreguntas,
      retroalimentacion,
    };
  });
};

const _verificarIntento = async (idIntento, idUsuario) => {
  const { rows } = await intentoRepo.findByIdAndUsuario(idIntento, idUsuario);
  if (!rows.length) {
    const err = new Error('Intento no encontrado.');
    err.statusCode = 404; throw err;
  }
  const intento = rows[0];
  if (intento.estado !== ESTADOS.EN_CURSO) {
    const err = new Error(`El intento ya está en estado: ${intento.estado}.`);
    err.statusCode = 400; throw err;
  }
  if (intento.expira_en && new Date(intento.expira_en) < new Date()) {
    await intentoRepo.markExpired(idIntento);
    const err = new Error('El tiempo del simulacro ha expirado.');
    err.statusCode = 410; throw err;
  }
  return intento;
};

const _actualizarProgreso = async (client, idUsuario, idSimulacro, puntaje, correctas, total) => {
  const { rows: simRows } = await client.query(
    'SELECT id_materia FROM simulacro WHERE id = $1', [idSimulacro]
  );
  if (!simRows.length) return;
  const idMateria = simRows[0].id_materia;

  await progresoRepo.upsertProgreso(client, idUsuario, idMateria, correctas, total, puntaje);
};

module.exports = { iniciarIntento, responderPregunta, finalizarIntento };
