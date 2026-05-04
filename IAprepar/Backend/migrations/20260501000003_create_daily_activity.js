'use strict';

// Registro diario de actividad para cálculo de rachas
exports.up = async (knex) => {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS daily_activity (
      id               SERIAL PRIMARY KEY,
      user_id          INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
      activity_date    DATE NOT NULL,
      simulations_done INTEGER NOT NULL DEFAULT 0,
      points_earned    INTEGER NOT NULL DEFAULT 0,
      UNIQUE (user_id, activity_date)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_activity_user_date ON daily_activity(user_id, activity_date DESC);
  `);
};

exports.down = async (knex) => {
  await knex.raw(`DROP TABLE IF EXISTS daily_activity CASCADE;`);
};
