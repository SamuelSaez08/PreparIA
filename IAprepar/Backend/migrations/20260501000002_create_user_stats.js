'use strict';

// Tabla de estadísticas de gamificación por usuario
exports.up = async (knex) => {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id           INTEGER PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
      total_points      INTEGER NOT NULL DEFAULT 0,
      weekly_points     INTEGER NOT NULL DEFAULT 0,
      monthly_points    INTEGER NOT NULL DEFAULT 0,
      current_streak    INTEGER NOT NULL DEFAULT 0,
      longest_streak    INTEGER NOT NULL DEFAULT 0,
      last_activity_date DATE,
      avg_score         NUMERIC(5,2) NOT NULL DEFAULT 0,
      total_simulations INTEGER NOT NULL DEFAULT 0,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_user_stats_total_points   ON user_stats(total_points DESC);
    CREATE INDEX IF NOT EXISTS idx_user_stats_weekly_points  ON user_stats(weekly_points DESC);
    CREATE INDEX IF NOT EXISTS idx_user_stats_monthly_points ON user_stats(monthly_points DESC);
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    DROP TABLE IF EXISTS user_stats CASCADE;
  `);
};
