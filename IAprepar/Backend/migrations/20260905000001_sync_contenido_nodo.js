'use strict';

/**
 * El código (nodo.repo.js) lee y escribe la tabla `contenido_nodo`, que no
 * estaba ni en schema.sql ni en ninguna migración: existía solo en la base de
 * datos de desarrollo, creada a mano. Sin esta migración, una instalación
 * limpia arranca pero falla al abrir el material de estudio de cualquier nodo.
 *
 * La migración es idempotente y, si encuentra datos en la tabla antigua
 * `material_estudio`, los copia una sola vez.
 */
exports.up = async (knex) => {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS contenido_nodo (
      id             SERIAL PRIMARY KEY,
      id_nodo        INTEGER NOT NULL REFERENCES nodo_aprendizaje(id) ON DELETE CASCADE,
      titulo         VARCHAR(200) NOT NULL,
      cuerpo         TEXT NOT NULL DEFAULT '',
      tipo           VARCHAR(30) NOT NULL DEFAULT 'texto',
      url            TEXT,
      orden          INTEGER NOT NULL DEFAULT 0,
      activo         BOOLEAN NOT NULL DEFAULT true,
      creado_por     INTEGER REFERENCES usuario(id),
      creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Por si la tabla ya existía sin alguna de las columnas nuevas.
  await knex.raw(`ALTER TABLE contenido_nodo ADD COLUMN IF NOT EXISTS url TEXT`);
  await knex.raw(`ALTER TABLE contenido_nodo ADD COLUMN IF NOT EXISTS tipo VARCHAR(30) NOT NULL DEFAULT 'texto'`);
  await knex.raw(`ALTER TABLE contenido_nodo ADD COLUMN IF NOT EXISTS orden INTEGER NOT NULL DEFAULT 0`);
  await knex.raw(`ALTER TABLE contenido_nodo ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true`);
  await knex.raw(`ALTER TABLE contenido_nodo ADD COLUMN IF NOT EXISTS creado_por INTEGER REFERENCES usuario(id)`);
  await knex.raw(`ALTER TABLE contenido_nodo ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()`);

  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_contenido_nodo ON contenido_nodo(id_nodo)`);

  // Migración de datos desde material_estudio, solo si aplica.
  const existeMaterial = await knex.raw(`SELECT to_regclass('public.material_estudio') AS t`);
  const hayTablaVieja = existeMaterial.rows[0] && existeMaterial.rows[0].t;

  if (hayTablaVieja) {
    const { rows } = await knex.raw(`SELECT COUNT(*)::int AS n FROM contenido_nodo`);
    if (rows[0].n === 0) {
      await knex.raw(`
        INSERT INTO contenido_nodo (id_nodo, titulo, cuerpo, tipo, url, orden, activo, creado_por)
        SELECT id_nodo, titulo, contenido, tipo::text, url, orden, activo, creado_por
        FROM material_estudio
      `);
    }
  }
};

exports.down = async (knex) => {
  await knex.raw('DROP TABLE IF EXISTS contenido_nodo');
};
