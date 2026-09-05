'use strict';
const db = require('../config/db');

/** Banco de preguntas: consulta y edición manual (RF-04). */

const listar = ({ idNodo = null, idNivel = null, dificultad = null, busqueda = null, limit = 25, offset = 0 }) => {
  const params = [];
  let where = 'WHERE p.activa = true';

  if (idNodo)     { params.push(idNodo);     where += ` AND p.id_nodo = $${params.length}`; }
  if (idNivel)    { params.push(idNivel);    where += ` AND p.id_nivel = $${params.length}`; }
  if (dificultad) { params.push(dificultad); where += ` AND p.dificultad = $${params.length}`; }
  if (busqueda)   { params.push(`%${busqueda.toLowerCase()}%`); where += ` AND LOWER(p.enunciado) LIKE $${params.length}`; }

  params.push(limit);  const pLimit  = params.length;
  params.push(offset); const pOffset = params.length;

  return db.query(
    `SELECT p.id, p.enunciado, p.texto_base, p.dificultad, p.tipo, p.explicacion,
            p.id_nodo, p.id_nivel, p.creado_en,
            n.nombre AS nodo,
            (SELECT json_agg(json_build_object('id',o.id,'letra',o.letra,'texto',o.texto,'es_correcta',o.es_correcta) ORDER BY o.letra)
             FROM opcion_respuesta o WHERE o.id_pregunta = p.id) AS opciones
     FROM pregunta p
     LEFT JOIN nodo_aprendizaje n ON n.id = p.id_nodo
     ${where}
     ORDER BY p.id DESC
     LIMIT $${pLimit} OFFSET $${pOffset}`,
    params
  );
};

const contar = ({ idNodo = null, idNivel = null, dificultad = null, busqueda = null }) => {
  const params = [];
  let where = 'WHERE p.activa = true';
  if (idNodo)     { params.push(idNodo);     where += ` AND p.id_nodo = $${params.length}`; }
  if (idNivel)    { params.push(idNivel);    where += ` AND p.id_nivel = $${params.length}`; }
  if (dificultad) { params.push(dificultad); where += ` AND p.dificultad = $${params.length}`; }
  if (busqueda)   { params.push(`%${busqueda.toLowerCase()}%`); where += ` AND LOWER(p.enunciado) LIKE $${params.length}`; }
  return db.query(`SELECT COUNT(*)::int AS total FROM pregunta p ${where}`, params);
};

const findById = (id) =>
  db.query(
    `SELECT p.*, n.nombre AS nodo,
            (SELECT json_agg(json_build_object('id',o.id,'letra',o.letra,'texto',o.texto,'es_correcta',o.es_correcta) ORDER BY o.letra)
             FROM opcion_respuesta o WHERE o.id_pregunta = p.id) AS opciones
     FROM pregunta p
     LEFT JOIN nodo_aprendizaje n ON n.id = p.id_nodo
     WHERE p.id = $1`,
    [id]
  );

const insertPregunta = (client, { idNodo, idNivel, enunciado, textoBase, dificultad, explicacion, creadoPor }) =>
  client.query(
    `INSERT INTO pregunta (id_nodo, id_nivel, enunciado, texto_base, dificultad, explicacion, activa, creado_por, creado_en)
     VALUES ($1,$2,$3,$4,$5,$6,true,$7,NOW())
     RETURNING id`,
    [idNodo, idNivel, enunciado, textoBase || null, dificultad || 'media', explicacion || null, creadoPor || null]
  );

const insertOpcion = (client, { idPregunta, letra, texto, esCorrecta }) =>
  client.query(
    `INSERT INTO opcion_respuesta (id_pregunta, texto, letra, es_correcta)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [idPregunta, texto, letra, esCorrecta]
  );

const updatePregunta = (client, id, { enunciado, textoBase, dificultad, explicacion }) =>
  client.query(
    `UPDATE pregunta
        SET enunciado      = COALESCE($2, enunciado),
            texto_base     = COALESCE($3, texto_base),
            dificultad     = COALESCE($4, dificultad),
            explicacion    = COALESCE($5, explicacion),
            actualizado_en = NOW()
      WHERE id = $1 AND activa = true
      RETURNING id`,
    [id, enunciado ?? null, textoBase ?? null, dificultad ?? null, explicacion ?? null]
  );

const deleteOpciones = (client, idPregunta) =>
  client.query('DELETE FROM opcion_respuesta WHERE id_pregunta = $1', [idPregunta]);

/** Baja lógica: preservamos el historial de intentos que la referencian. */
const desactivar = (id) =>
  db.query('UPDATE pregunta SET activa = false, actualizado_en = NOW() WHERE id = $1 RETURNING id', [id]);

const estaEnSimulacro = (id) =>
  db.query('SELECT 1 FROM simulacro_pregunta WHERE id_pregunta = $1 LIMIT 1', [id]);

module.exports = {
  listar, contar, findById,
  insertPregunta, insertOpcion, updatePregunta, deleteOpciones,
  desactivar, estaEnSimulacro,
};
