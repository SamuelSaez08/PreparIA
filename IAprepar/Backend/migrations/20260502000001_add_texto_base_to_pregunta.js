'use strict';

exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE pregunta
    ADD COLUMN IF NOT EXISTS texto_base TEXT;
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    ALTER TABLE pregunta
    DROP COLUMN IF EXISTS texto_base;
  `);
};
