'use strict';

/**
 * NFR de seguridad: "las sesiones expiran después de 30 minutos de inactividad".
 * Para poder medir la inactividad hay que registrar cuándo fue la última
 * petición de cada sesión.
 */
exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE sesion_usuario
    ADD COLUMN IF NOT EXISTS ultima_actividad TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_sesion_token_hash ON sesion_usuario(token_hash)
  `);
};

exports.down = async (knex) => {
  await knex.raw(`ALTER TABLE sesion_usuario DROP COLUMN IF EXISTS ultima_actividad`);
  await knex.raw(`DROP INDEX IF EXISTS idx_sesion_token_hash`);
};
