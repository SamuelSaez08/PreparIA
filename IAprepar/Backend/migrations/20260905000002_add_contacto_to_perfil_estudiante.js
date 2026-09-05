'use strict';

/**
 * RF-02 pide capturar institución educativa y datos de contacto en el registro.
 * `institucion` y `ciudad` ya existían en el esquema pero nunca se llenaban;
 * `telefono` faltaba por completo.
 */
exports.up = async (knex) => {
  await knex.raw(`ALTER TABLE perfil_estudiante ADD COLUMN IF NOT EXISTS institucion VARCHAR(150)`);
  await knex.raw(`ALTER TABLE perfil_estudiante ADD COLUMN IF NOT EXISTS ciudad VARCHAR(100)`);
  await knex.raw(`ALTER TABLE perfil_estudiante ADD COLUMN IF NOT EXISTS telefono VARCHAR(30)`);
};

exports.down = async (knex) => {
  await knex.raw(`ALTER TABLE perfil_estudiante DROP COLUMN IF EXISTS telefono`);
};
