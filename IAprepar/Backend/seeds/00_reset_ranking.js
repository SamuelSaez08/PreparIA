'use strict';

// Limpia todas las tablas de gamificación manteniendo los usuarios.
// Ejecutar con: npx knex seed:run --specific=00_reset_ranking.js
exports.seed = async (knex) => {
  await knex.raw(`
    TRUNCATE TABLE
      ranking_snapshots,
      point_transactions,
      streak_shields,
      daily_activity,
      user_stats
    RESTART IDENTITY CASCADE;
  `);
};
