'use strict';
const db = require('../config/db');

const findArbolByMateria = (idMateria) =>
  db.query(
    `SELECT id, nombre, descripcion, id_padre, id_nivel, orden
     FROM nodo_aprendizaje
     WHERE id_materia = $1 AND activo = true
     ORDER BY id_nivel, orden, nombre`,
    [idMateria]
  );

const findById = (id) =>
  db.query('SELECT * FROM nodo_aprendizaje WHERE id = $1', [id]);

const findAll = ({ materia, nivel, padre } = {}) => {
  let sql = 'SELECT * FROM nodo_aprendizaje WHERE activo = true';
  const params = [];
  if (materia) { params.push(materia); sql += ` AND id_materia = $${params.length}`; }
  if (nivel)   { params.push(nivel);   sql += ` AND id_nivel = $${params.length}`; }
  if (padre)   { params.push(padre);   sql += ` AND id_padre = $${params.length}`; }
  sql += ' ORDER BY id_nivel, orden, nombre';
  return db.query(sql, params);
};

const findMaterial = (idNodo) =>
  db.query(
    'SELECT * FROM material_estudio WHERE id_nodo = $1 AND activo = true ORDER BY orden',
    [idNodo]
  );

const findPadre = (client, idPadre) =>
  client.query('SELECT id_materia, id_nivel FROM nodo_aprendizaje WHERE id = $1', [idPadre]);

const insertNodo = (client, { nombre, icono, idPadre, idMateria, idNivel }) =>
  client.query(
    `INSERT INTO nodo_aprendizaje (nombre, descripcion, id_padre, id_materia, id_nivel)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [nombre, icono || '📌', idPadre, idMateria, idNivel]
  );

const insertMaterial = (client, { idNodo, nombre, contenido, idUsuario }) =>
  client.query(
    `INSERT INTO material_estudio (id_nodo, titulo, contenido, creado_por)
     VALUES ($1, $2, $3, $4)`,
    [idNodo, nombre, contenido, idUsuario]
  );

const findDescendientes = (client, id) =>
  client.query(
    `WITH RECURSIVE descendientes AS (
       SELECT id FROM nodo_aprendizaje WHERE id = $1
       UNION ALL
       SELECT n.id FROM nodo_aprendizaje n
       INNER JOIN descendientes d ON n.id_padre = d.id
     )
     SELECT id FROM descendientes`,
    [id]
  );

const updateNombre = (id, nombre) =>
  db.query(
    `UPDATE nodo_aprendizaje SET nombre = $1 WHERE id = $2 AND activo = true RETURNING id, nombre`,
    [nombre, id]
  );

const softDeleteMateriales = (client, ids) =>
  client.query('UPDATE material_estudio SET activo = false WHERE id_nodo = ANY($1::int[])', [ids]);

const softDeleteNodos = (client, ids) =>
  client.query('UPDATE nodo_aprendizaje SET activo = false WHERE id = ANY($1::int[])', [ids]);

module.exports = {
  findArbolByMateria, findById, findAll, findMaterial,
  findPadre, insertNodo, insertMaterial,
  findDescendientes, softDeleteMateriales, softDeleteNodos,
  updateNombre,
};
