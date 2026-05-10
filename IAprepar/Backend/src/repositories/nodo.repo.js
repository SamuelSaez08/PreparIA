'use strict';
const db = require('../config/db');

const findArbolByMateria = (idMateria) =>
  db.query(
    `SELECT id, nombre, descripcion AS icono, id_padre, id_nivel, orden
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
    `SELECT id, id_nodo, titulo, cuerpo AS contenido, tipo, orden
     FROM contenido_nodo
     WHERE id_nodo = $1 AND activo = true
     ORDER BY orden`,
    [idNodo]
  );

const findPadre = (client, idPadre) =>
  client.query('SELECT id_materia, id_nivel FROM nodo_aprendizaje WHERE id = $1', [idPadre]);

const insertNodo = (client, { nombre, idPadre, idMateria, idNivel }) =>
  client.query(
    `INSERT INTO nodo_aprendizaje (nombre, id_padre, id_materia, id_nivel)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [nombre, idPadre, idMateria, idNivel]
  );

const insertMaterial = (client, { idNodo, nombre, contenido }) =>
  client.query(
    `INSERT INTO contenido_nodo (id_nodo, titulo, cuerpo)
     VALUES ($1, $2, $3)`,
    [idNodo, nombre, contenido]
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
  client.query('UPDATE contenido_nodo SET activo = false WHERE id_nodo = ANY($1::int[])', [ids]);

const softDeleteNodos = (client, ids) =>
  client.query('UPDATE nodo_aprendizaje SET activo = false WHERE id = ANY($1::int[])', [ids]);

module.exports = {
  findArbolByMateria, findById, findAll, findMaterial,
  findPadre, insertNodo, insertMaterial,
  findDescendientes, softDeleteMateriales, softDeleteNodos,
  updateNombre,
};
