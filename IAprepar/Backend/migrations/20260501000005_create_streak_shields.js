'use strict';

// Escudos de racha que protegen de perder la racha un día
exports.up = async (knex) => {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS streak_shields (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
      earned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      used_at       TIMESTAMPTZ,
      used_for_date DATE
    );

    CREATE INDEX IF NOT EXISTS idx_streak_shields_user ON streak_shields(user_id, used_at);
  `);
};

exports.down = async (knex) => {
  await knex.raw(`DROP TABLE IF EXISTS streak_shields CASCADE;`);
};
