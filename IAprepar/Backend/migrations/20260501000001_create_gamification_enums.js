'use strict';

// Crea los ENUMs necesarios para el sistema de gamificación
exports.up = async (knex) => {
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE event_type_enum AS ENUM (
        'simulation_completed',
        'streak_bonus',
        'perfect_score_bonus',
        'weekly_reset',
        'monthly_reset'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE snapshot_period_enum AS ENUM ('weekly', 'monthly', 'all_time');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    DROP TYPE IF EXISTS event_type_enum CASCADE;
    DROP TYPE IF EXISTS snapshot_period_enum CASCADE;
  `);
};
