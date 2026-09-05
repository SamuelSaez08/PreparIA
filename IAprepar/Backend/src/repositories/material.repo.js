'use strict';
const db = require('../config/db');

/** Material de estudio asociado a cada nodo de aprendizaje (tabla contenido_nodo). */

const listar = ({ idNodo = null, limit = 50, offset = 0 }) => {
  const params = [];
  let where = 'WHERE c.activo = true';
  if (idNodo) { params.push(idNodo); where += ` AND c.id_nodo = $${params.length}`; }

  params.push(limit);  const pLimit  = params.length;
  params.push(offset); const pOffset = params.length;

  return db.query(
    `SELECT c.id, c.id_nodo, c.titulo, c.cuerpo AS contenido, c.tipo, c.url, c.orden, c.creado_en,
            n.nombre AS nodo
     FROM contenido_nodo c
     LEFT JOIN nodo_aprendizaje n ON n.id = c.id_nodo
     ${where}
     ORDER BY c.id_nodo, c.orden, c.id
     LIMIT $${pLimit} OFFSET $${pOffset}`,
    params
  );
};

const contar = ({ idNodo = null }) => {
  const params = [];
  let where = 'WHERE c.activo = true';
  if (idNodo) { params.push(idNodo); where += ` AND c.id_nodo = $${params.length}`; }
  return db.query(`SELECT COUNT(*)::int AS total FROM contenido_nodo c ${where}`, params);
};

const findById = (id) =>
  db.query(
    `SELECT id, id_nodo, titulo, cuerpo AS contenido, tipo, url, orden, activo, creado_en
     FROM contenido_nodo WHERE id = $1`,
    [id]
  );

const insertar = ({ idNodo, titulo, contenido, tipo, url, orden, creadoPor }) =>
  db.query(
    `INSERT INTO contenido_nodo (id_nodo, titulo, cuerpo, tipo, url, orden, activo, creado_por)
     VALUES ($1,$2,$3,$4,$5,$6,true,$7)
     RETURNING id, id_nodo, titulo, cuerpo AS contenido, tipo, url, orden`,
    [idNodo, titulo, contenido || '', tipo || 'texto', url || null, orden || 0, creadoPor || null]
  );

const actualizar = (id, { titulo, contenido, tipo, url, orden }) =>
  db.query(
    `UPDATE contenido_nodo
        SET titulo         = COALESCE($2, titulo),
            cuerpo         = COALESCE($3, cuerpo),
            tipo           = COALESCE($4, tipo),
            url            = COALESCE($5, url),
            orden          = COALESCE($6, orden),
            actualizado_en = NOW()
      WHERE id = $1 AND activo = true
      RETURNING id, id_nodo, titulo, cuerpo AS contenido, tipo, url, orden`,
    [id, titulo ?? null, contenido ?? null, tipo ?? null, url ?? null, orden ?? null]
  );

const desactivar = (id) =>
  db.query('UPDATE contenido_nodo SET activo = false, actualizado_en = NOW() WHERE id = $1 RETURNING id, titulo', [id]);

module.exports = { listar, contar, findById, insertar, actualizar, desactivar };
