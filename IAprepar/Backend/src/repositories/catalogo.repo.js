'use strict';
const db = require('../config/db');

/** Materias e itinerarios de nivel: catálogo base del sistema. */

const findMaterias = () =>
  db.query(
    `SELECT m.id, m.nombre, m.descripcion, m.icono, m.activa,
            (SELECT COUNT(*) FROM nodo_aprendizaje n WHERE n.id_materia = m.id AND n.activo = true) AS total_nodos
     FROM materia m
     WHERE m.activa = true
     ORDER BY m.id`
  );

const findNiveles = () =>
  db.query('SELECT id, nombre, descripcion, orden FROM nivel ORDER BY orden, id');

const findNivelPorOrden = (orden) =>
  db.query('SELECT id, nombre, orden FROM nivel WHERE orden = $1', [orden]);

module.exports = { findMaterias, findNiveles, findNivelPorOrden };
