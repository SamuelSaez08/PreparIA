'use strict';
const db = require('../config/db');

/**
 * Banco de preguntas ya generadas.
 *
 * Antes cada simulacro pedía preguntas nuevas a la IA aunque la base de datos
 * tuviera cientos válidas para esos mismos temas: el banco crecía y nadie lo
 * usaba. Estas consultas lo aprovechan, con dos efectos: se gasta mucha menos
 * cuota de Gemini y un simulacro puede completarse aunque la IA falle.
 *
 * Solo se devuelven preguntas que tengan opciones y una respuesta correcta
 * marcada; una pregunta sin eso rompería el simulacro.
 */

const _condicionNodos = (idNodos, params) => {
  if (!idNodos || !idNodos.length) return '';
  params.push(idNodos);
  return ` AND p.id_nodo = ANY($${params.length}::int[])`;
};

/** Preguntas que este estudiante todavía no ha respondido nunca. */
const _sinResponder = (idMateria, idNodos, idUsuario, limite, excluir) => {
  const params = [idMateria, idUsuario];
  let sql = `
    SELECT p.id
    FROM pregunta p
    JOIN nodo_aprendizaje n ON n.id = p.id_nodo AND n.id_materia = $1
    WHERE p.activa = true
      AND EXISTS (
        SELECT 1 FROM opcion_respuesta o
        WHERE o.id_pregunta = p.id AND o.es_correcta = true
      )
      AND NOT EXISTS (
        SELECT 1 FROM respuesta_intento r
        JOIN intento_simulacro i ON i.id = r.id_intento
        WHERE r.id_pregunta = p.id AND i.id_usuario = $2
      )`;

  sql += _condicionNodos(idNodos, params);

  if (excluir && excluir.length) {
    params.push(excluir);
    sql += ` AND p.id <> ALL($${params.length}::int[])`;
  }

  params.push(limite);
  sql += ` ORDER BY random() LIMIT $${params.length}`;

  return db.query(sql, params);
};

/** Cualquier pregunta del banco, aunque el estudiante ya la haya visto. */
const _cualquiera = (idMateria, idNodos, limite, excluir) => {
  const params = [idMateria];
  let sql = `
    SELECT p.id
    FROM pregunta p
    JOIN nodo_aprendizaje n ON n.id = p.id_nodo AND n.id_materia = $1
    WHERE p.activa = true
      AND EXISTS (
        SELECT 1 FROM opcion_respuesta o
        WHERE o.id_pregunta = p.id AND o.es_correcta = true
      )`;

  sql += _condicionNodos(idNodos, params);

  if (excluir && excluir.length) {
    params.push(excluir);
    sql += ` AND p.id <> ALL($${params.length}::int[])`;
  }

  params.push(limite);
  sql += ` ORDER BY random() LIMIT $${params.length}`;

  return db.query(sql, params);
};

/**
 * Toma hasta `limite` preguntas del banco.
 * Prioriza las que el estudiante no ha respondido; si no alcanzan, completa
 * con preguntas ya vistas antes que dejar el simulacro corto.
 *
 * @returns {Promise<number[]>} ids de pregunta
 */
const tomar = async ({ idMateria, idNodos = null, idUsuario, limite, excluir = [] }) => {
  if (!limite || limite <= 0) return [];

  const { rows: frescas } = await _sinResponder(idMateria, idNodos, idUsuario, limite, excluir);
  const ids = frescas.map(r => r.id);

  if (ids.length >= limite) return ids.slice(0, limite);

  const yaTomadas = [...excluir, ...ids];
  const { rows: repetidas } = await _cualquiera(idMateria, idNodos, limite - ids.length, yaTomadas);
  return [...ids, ...repetidas.map(r => r.id)];
};

/** Cuántas preguntas utilizables hay para esos temas. Sirve para diagnosticar. */
const contar = ({ idMateria, idNodos = null }) => {
  const params = [idMateria];
  let sql = `
    SELECT COUNT(*)::int AS total
    FROM pregunta p
    JOIN nodo_aprendizaje n ON n.id = p.id_nodo AND n.id_materia = $1
    WHERE p.activa = true
      AND EXISTS (
        SELECT 1 FROM opcion_respuesta o
        WHERE o.id_pregunta = p.id AND o.es_correcta = true
      )`;
  sql += _condicionNodos(idNodos, params);
  return db.query(sql, params);
};

module.exports = { tomar, contar };
