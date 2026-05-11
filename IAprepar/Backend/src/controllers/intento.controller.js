'use strict';

const simulacroService    = require('../services/simulacro.service');
const gamificacionService = require('../services/gamificacion.service');
const intentoRepo         = require('../repositories/intento.repo');
const logger              = require('../utils/logger');
const { ok, created, fail } = require('../utils/response');

const getHistorial = async (req, res, next) => {
  try {
    const porPagina = parseInt(req.query.por_pagina || '20', 10);
    const pagina    = parseInt(req.query.pagina || '1', 10);
    const offset    = (pagina - 1) * porPagina;

    const { rows } = await intentoRepo.getHistorial(req.user.id_usuario, porPagina, offset);

    const total = rows.length ? parseInt(rows[0].total_count, 10) : 0;

    // Remove the window-function column and normalize field names for the frontend
    const datos = rows.map(({ total_count, puntaje_obtenido, iniciado_en, ...rest }) => ({
      ...rest,
      puntaje:    puntaje_obtenido,
      porcentaje: puntaje_obtenido,
      fecha:      iniciado_en,
    }));

    return ok(res, 'Historial obtenido.', datos, {
      total,
      pagina,
      porPagina,
    });
  } catch (err) { next(err); }
};

const iniciarIntento = async (req, res, next) => {
  try {
    const { id_simulacro } = req.body;
    if (!id_simulacro) return fail(res, 'id_simulacro es requerido.', 400);
    const result = await simulacroService.iniciarIntento(req.user.id_usuario, id_simulacro);
    return created(res, 'Intento iniciado.', result);
  } catch (err) {
    if (err.statusCode) return fail(res, err.message, err.statusCode);
    next(err);
  }
};

const responderPregunta = async (req, res, next) => {
  try {
    const { id_pregunta, id_opcion } = req.body;
    if (!id_pregunta || !id_opcion) return fail(res, 'id_pregunta y id_opcion son requeridos.', 400);
    const result = await simulacroService.responderPregunta(
      parseInt(req.params.id, 10), req.user.id_usuario, id_pregunta, id_opcion
    );
    return ok(res, 'Respuesta registrada.', result);
  } catch (err) {
    if (err.statusCode) return fail(res, err.message, err.statusCode);
    next(err);
  }
};

const finalizarIntento = async (req, res, next) => {
  try {
    const idIntento = parseInt(req.params.id, 10);
    const idUsuario = req.user.id_usuario;

    const tiempoUsado = req.body?.tiempo_usado;
    const tiempoSegundos = Number.isFinite(Number(tiempoUsado)) ? Math.max(0, Math.round(Number(tiempoUsado))) : null;

    const result = await simulacroService.finalizarIntento(idIntento, idUsuario, tiempoSegundos);

    // Procesar gamificación y puntos al finalizar el simulacro
    let gamificacion = null;
    try {
      const idSimulacro = result.intento?.id_simulacro;
      console.log('[fn_complete_simulation] llamando con intentoId:', idIntento, 'idUsuario:', idUsuario, 'idSimulacro:', idSimulacro, 'puntaje:', result.puntaje);
      if (!idSimulacro) throw new Error(`id_simulacro indefinido en intento ${idIntento} — intento obj: ${JSON.stringify(result.intento)}`);
      gamificacion = await gamificacionService.procesarFinSimulacro(
        idUsuario,
        idSimulacro,
        result.puntaje
      );
      console.log('[fn_complete_simulation] completado:', JSON.stringify(gamificacion));
    } catch (gamErr) {
      // Error de gamificación no debe romper la finalización del simulacro
      console.error('[fn_complete_simulation] ERROR:', gamErr.message, { code: gamErr.code, detail: gamErr.detail, hint: gamErr.hint, stack: gamErr.stack });
      logger.error('Error al procesar gamificación:', gamErr.message, { code: gamErr.code, detail: gamErr.detail });
    }

    return ok(res, 'Simulacro finalizado.', { ...result, porcentaje: result.puntaje, gamificacion });
  } catch (err) {
    if (err.statusCode) return fail(res, err.message, err.statusCode);
    next(err);
  }
};

module.exports = { getHistorial, iniciarIntento, responderPregunta, finalizarIntento };
