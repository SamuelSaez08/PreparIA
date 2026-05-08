'use strict';

const logger          = require('../utils/logger');
const gamificacionRepo = require('../repositories/gamificacion.repo');

// Llama la función atómica de PostgreSQL al finalizar un simulacro
const procesarFinSimulacro = async (idUsuario, idSimulacro, puntaje) => {
  const basePoints = Math.round(puntaje);
  const isPerfect  = puntaje === 100;

  const { rows } = await gamificacionRepo.callCompleteSimulation(idUsuario, idSimulacro, basePoints, isPerfect);

  const resultado = rows[0].resultado;
  logger.info(
    `Gamificación procesada: usuario=${idUsuario} simulacro=${idSimulacro} ` +
    `puntos=${resultado.points_earned} racha=${resultado.new_streak}`
  );
  return resultado;
};

const PAGE_SIZE_MAX = 100;

// Obtiene el leaderboard según el período solicitado
const getLeaderboard = async (period = 'all_time', idUsuarioActual = null, limit = 50, offset = 0) => {
  const vistas = {
    all_time: 'v_leaderboard_alltime',
    weekly:   'v_leaderboard_weekly',
    monthly:  'v_leaderboard_monthly',
  };

  const vista = vistas[period];
  if (!vista) {
    const err = new Error('Período no válido. Usa: all_time, weekly o monthly');
    err.statusCode = 400;
    throw err;
  }

  const safeLimit  = Math.min(Math.max(1, parseInt(limit,  10) || 50), PAGE_SIZE_MAX);
  const safeOffset = Math.max(0, parseInt(offset, 10) || 0);

  const { rows } = await gamificacionRepo.getLeaderboard(vista, safeLimit, safeOffset);

  const totalEntries = rows.length ? parseInt(rows[0].total_entries, 10) : 0;
  const ranking = rows.map(({ total_entries, ...rest }) => rest);

  let posicionUsuario = null;
  if (idUsuarioActual) {
    const { rows: posRows } = await gamificacionRepo.getUserRank(idUsuarioActual, period);
    if (posRows.length) {
      posicionUsuario = {
        rank_position:      posRows[0].rank_position,
        points:             posRows[0].points,
        streak:             posRows[0].streak,
        total_users_ranked: posRows[0].total_users_ranked,
      };
    }
  }

  return { ranking, posicion_usuario: posicionUsuario, total_entries: totalEntries, limit: safeLimit, offset: safeOffset };
};

// Obtiene estadísticas completas de un usuario: stats + escudos + historial 30 días
const getEstadisticasUsuario = async (idUsuario) => {
  const [
    { rows: statsRows },
    { rows: shieldsRows },
    { rows: actividadRows },
  ] = await Promise.all([
    gamificacionRepo.getUserStats(idUsuario),
    gamificacionRepo.getShields(idUsuario),
    gamificacionRepo.getActividad30d(idUsuario),
  ]);

  return {
    stats:                   statsRows.length ? statsRows[0] : null,
    escudos_disponibles:     shieldsRows.length,
    escudos:                 shieldsRows,
    historial_actividad_30d: actividadRows,
  };
};

module.exports = { procesarFinSimulacro, getLeaderboard, getEstadisticasUsuario };
