'use strict';
exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE intento_simulacro
    ADD COLUMN IF NOT EXISTS tiempo_usado_segundos INTEGER CHECK (tiempo_usado_segundos >= 0)
  `);
};
exports.down = async (knex) => {
  await knex.raw('ALTER TABLE intento_simulacro DROP COLUMN IF EXISTS tiempo_usado_segundos');
};
