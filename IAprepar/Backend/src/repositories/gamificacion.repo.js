'use strict';
const db = require('../config/db');

const callCompleteSimulation = (idUsuario, idSimulacro, basePoints, isPerfect) =>
  db.query('SELECT fn_complete_simulation($1,$2,$3,$4) AS resultado', [idUsuario, idSimulacro, basePoints, isPerfect]);

const getLeaderboard = (vista) =>
  db.query(`SELECT * FROM ${vista}`);

const getUserRank = (idUsuario, period) =>
  db.query('SELECT * FROM fn_get_user_rank($1,$2)', [idUsuario, period]);

const getUserStats = (idUsuario) =>
  db.query('SELECT * FROM user_stats WHERE user_id = $1', [idUsuario]);

const getShields = (idUsuario) =>
  db.query('SELECT id, earned_at FROM streak_shields WHERE user_id = $1 AND used_at IS NULL ORDER BY earned_at', [idUsuario]);

const getActividad30d = (idUsuario) =>
  db.query(
    `SELECT activity_date, simulations_done, points_earned FROM daily_activity
     WHERE user_id = $1 AND activity_date >= CURRENT_DATE - INTERVAL '30 days' ORDER BY activity_date DESC`,
    [idUsuario]
  );

module.exports = { callCompleteSimulation, getLeaderboard, getUserRank, getUserStats, getShields, getActividad30d };
