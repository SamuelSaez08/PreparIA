'use strict';
const db = require('../config/db');

const findAll = ({ materia } = {}) => {
  let sql = `SELECT s.id, s.titulo, s.descripcion, s.duracion_minutos, s.id_materia, s.activo,
                    COUNT(sp.id_pregunta) AS total_preguntas
             FROM simulacro s LEFT JOIN simulacro_pregunta sp ON sp.id_simulacro = s.id
             WHERE s.activo = true`;
  const params = [];
  if (materia) { params.push(materia); sql += ` AND s.id_materia = $${params.length}`; }
  sql += ' GROUP BY s.id ORDER BY s.id';
  return db.query(sql, params);
};

const findById = (id) =>
  db.query('SELECT * FROM simulacro WHERE id = $1', [id]);

const findByIdWithCount = (id) =>
  db.query(
    `SELECT s.id, s.titulo, s.duracion_minutos, s.activo, COUNT(sp.id_pregunta) AS total_preguntas
     FROM simulacro s LEFT JOIN simulacro_pregunta sp ON sp.id_simulacro = s.id
     WHERE s.id = $1 GROUP BY s.id`,
    [id]
  );

const findPreguntasBySimulacro = (idSimulacro) =>
  db.query(
    `SELECT p.id, p.enunciado, p.texto_base, p.dificultad, p.tipo, sp.orden,
            json_agg(json_build_object('id',o.id,'texto',o.texto,'letra',o.letra) ORDER BY o.letra) AS opciones
     FROM simulacro_pregunta sp
     JOIN pregunta p ON p.id = sp.id_pregunta
     JOIN opcion_respuesta o ON o.id_pregunta = p.id
     WHERE sp.id_simulacro = $1
     GROUP BY p.id, p.enunciado, p.texto_base, p.dificultad, p.tipo, sp.orden
     ORDER BY sp.orden`,
    [idSimulacro]
  );

const findPreguntaInSimulacro = (idSimulacro, idPregunta) =>
  db.query('SELECT sp.id FROM simulacro_pregunta sp WHERE sp.id_simulacro = $1 AND sp.id_pregunta = $2', [idSimulacro, idPregunta]);

module.exports = { findAll, findById, findByIdWithCount, findPreguntasBySimulacro, findPreguntaInSimulacro };
