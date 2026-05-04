'use strict';

const gamificacionService = require('../services/gamificacion.service');
const { ok, fail }        = require('../utils/response');
const { ROLES } = require('../utils/constants');

// GET /api/v1/ranking?period=all_time|weekly|monthly
const getRanking = async (req, res, next) => {
  try {
    const period = req.query.period || 'all_time';
    const result = await gamificacionService.getLeaderboard(period, req.user.id_usuario);
    return ok(res, 'Ranking obtenido.', result);
  } catch (err) {
    if (err.statusCode) return fail(res, err.message, err.statusCode);
    next(err);
  }
};

// GET /api/v1/usuarios/:id/stats
const getStatsUsuario = async (req, res, next) => {
  try {
    const idUsuario = parseInt(req.params.id, 10);
    // Solo el propio usuario o admin pueden ver los stats detallados
    if (idUsuario !== req.user.id_usuario && req.user.rol !== ROLES.ADMIN) {
      return fail(res, 'No tienes permiso para ver las estadísticas de otro usuario.', 403);
    }
    const result = await gamificacionService.getEstadisticasUsuario(idUsuario);
    return ok(res, 'Estadísticas obtenidas.', result);
  } catch (err) {
    if (err.statusCode) return fail(res, err.message, err.statusCode);
    next(err);
  }
};

module.exports = { getRanking, getStatsUsuario };
