'use strict';

// Historial de transacciones de puntos para auditoría
exports.up = async (knex) => {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS point_transactions (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
      event_type   event_type_enum NOT NULL,
      points       INTEGER NOT NULL,
      reference_id INTEGER,
      description  TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_point_transactions_user    ON point_transactions(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_point_transactions_type    ON point_transactions(event_type);
  `);
};

exports.down = async (knex) => {
  await knex.raw(`DROP TABLE IF EXISTS point_transactions CASCADE;`);
};
