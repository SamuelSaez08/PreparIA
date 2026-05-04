'use strict';

// Snapshots del ranking para preservar posiciones históricas antes de resets
exports.up = async (knex) => {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS ranking_snapshots (
      id              SERIAL PRIMARY KEY,
      snapshot_period snapshot_period_enum NOT NULL,
      period_label    VARCHAR(20) NOT NULL,
      user_id         INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
      rank_position   INTEGER NOT NULL,
      points          INTEGER NOT NULL,
      streak          INTEGER NOT NULL DEFAULT 0,
      captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_ranking_snapshots_period ON ranking_snapshots(snapshot_period, period_label);
    CREATE INDEX IF NOT EXISTS idx_ranking_snapshots_user   ON ranking_snapshots(user_id);
  `);
};

exports.down = async (knex) => {
  await knex.raw(`DROP TABLE IF EXISTS ranking_snapshots CASCADE;`);
};
