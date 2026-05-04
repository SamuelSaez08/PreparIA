'use strict';
exports.up = async (knex) => {
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_intento_simulacro_usuario_estado ON intento_simulacro(id_usuario, estado)');
};
exports.down = async (knex) => {
  await knex.raw('DROP INDEX IF EXISTS idx_intento_simulacro_usuario_estado');
};
