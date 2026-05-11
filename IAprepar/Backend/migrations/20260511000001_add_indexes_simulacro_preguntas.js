'use strict';
exports.up = async (knex) => {
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_simulacro_pregunta_simulacro ON simulacro_pregunta(id_simulacro, orden)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_opcion_respuesta_pregunta   ON opcion_respuesta(id_pregunta)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_pregunta_nodo               ON pregunta(id_nodo)');
};
exports.down = async (knex) => {
  await knex.raw('DROP INDEX IF EXISTS idx_simulacro_pregunta_simulacro');
  await knex.raw('DROP INDEX IF EXISTS idx_opcion_respuesta_pregunta');
  await knex.raw('DROP INDEX IF EXISTS idx_pregunta_nodo');
};
