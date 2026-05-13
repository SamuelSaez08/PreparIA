'use strict';
const db = require('../config/db');

const findEnCurso = (idUsuario, idSimulacro, estado) =>
  db.query('SELECT id FROM intento_simulacro WHERE id_usuario = $1 AND id_simulacro = $2 AND estado = $3', [idUsuario, idSimulacro, estado]);

const create = (idUsuario, idSimulacro, estado, expiraEn, totalPreguntas) =>
  db.query(
    `INSERT INTO intento_simulacro (id_usuario, id_simulacro, estado, iniciado_en, expira_en, puntaje_obtenido, total_preguntas)
     VALUES ($1,$2,$3,NOW(),$4,0,$5) RETURNING id, estado, iniciado_en, expira_en, total_preguntas`,
    [idUsuario, idSimulacro, estado, expiraEn, totalPreguntas]
  );

const findByIdAndUsuario = (id, idUsuario) =>
  db.query('SELECT * FROM intento_simulacro WHERE id = $1 AND id_usuario = $2', [id, idUsuario]);

const markExpired = (id) =>
  db.query("UPDATE intento_simulacro SET estado = 'abandonado', finalizado_en = NOW() WHERE id = $1", [id]);

const findOpcion = (idOpcion, idPregunta) =>
  db.query('SELECT id, es_correcta FROM opcion_respuesta WHERE id = $1 AND id_pregunta = $2', [idOpcion, idPregunta]);

const upsertRespuesta = (idIntento, idPregunta, idOpcion, esCorrecta) =>
  db.query(
    `INSERT INTO respuesta_intento (id_intento, id_pregunta, id_opcion_elegida, es_correcta, respondida_en)
     VALUES ($1,$2,$3,$4,NOW())
     ON CONFLICT (id_intento, id_pregunta)
     DO UPDATE SET id_opcion_elegida = EXCLUDED.id_opcion_elegida, es_correcta = EXCLUDED.es_correcta, respondida_en = NOW()`,
    [idIntento, idPregunta, idOpcion, esCorrecta]
  );

const getStats = (client, idIntento) =>
  client.query(
    `SELECT
       COUNT(*)                              AS total_respondidas,
       COUNT(*) FILTER (WHERE es_correcta)  AS correctas,
       COUNT(*) FILTER (WHERE NOT es_correcta) AS incorrectas
     FROM respuesta_intento WHERE id_intento = $1`,
    [idIntento]
  );

const updateFinalizado = (client, idIntento, estado, puntaje, correctas, incorrectas, tiempoUsado = null) =>
  client.query(
    `UPDATE intento_simulacro
     SET estado=$1, finalizado_en=NOW(), puntaje_obtenido=$2, correctas=$3, incorrectas=$4,
         tiempo_usado_segundos=COALESCE($6, tiempo_usado_segundos)
     WHERE id=$5 RETURNING *`,
    [estado, puntaje, correctas, incorrectas, idIntento, tiempoUsado]
  );

// ─────────────────────────────────────────────────────────────────────────────
// getRetroalimentacion
//
// Cambios respecto a la versión anterior:
//   + n.nombre  AS competencia        → para analizarFallos (agrupación por competencia)
//   + p.tema                          → para analizarFallos (agrupación por tema)
//   + co.letra  AS respuesta_correcta → para analizarFallos (comparar con letra_elegida)
//   + oc.letra  AS letra_elegida      → para analizarFallos (identificar el distractor)
//
// El resto de la query es idéntico al original.
// ─────────────────────────────────────────────────────────────────────────────
const getRetroalimentacion = (client, idIntento) =>
  client.query(
    `SELECT
       p.id            AS id_pregunta,
       p.enunciado,
       p.texto_base,
       p.explicacion,
       p.tema,

       -- Competencia ICFES desde la tabla nivel (pensamiento_social, etc.)
       n.nombre        AS competencia,
       p.dificultad    AS nivel_dificultad,

       -- Respuesta del usuario
       ri.id_opcion_elegida,
       ri.es_correcta,
       oc.letra        AS letra_elegida,
       oc.texto        AS opcion_elegida_texto,

       -- Opción correcta
       co.id           AS id_opcion_correcta,
       co.letra        AS respuesta_correcta,
       co.texto        AS opcion_correcta_texto,

       -- Todas las opciones de la pregunta (para mostrar en el frontend)
       json_agg(
         json_build_object(
           'id',         o.id,
           'letra',      o.letra,
           'texto',      o.texto,
           'es_correcta', o.es_correcta
         ) ORDER BY o.letra
       ) AS opciones

     FROM respuesta_intento ri
     JOIN pregunta          p  ON p.id  = ri.id_pregunta
     LEFT JOIN nivel        n  ON n.id  = p.id_nivel
     JOIN opcion_respuesta  oc ON oc.id = ri.id_opcion_elegida
     JOIN opcion_respuesta  co ON co.id_pregunta = p.id AND co.es_correcta = true
     JOIN opcion_respuesta  o  ON o.id_pregunta  = p.id
     WHERE ri.id_intento = $1
     GROUP BY
       p.id, p.enunciado, p.texto_base, p.explicacion, p.tema, p.dificultad,
       n.nombre,
       ri.id_opcion_elegida, ri.es_correcta,
       oc.letra, oc.texto,
       co.id, co.letra, co.texto
     ORDER BY p.id`,
    [idIntento]
  );

const getHistorial = (idUsuario, porPagina, offset) =>
  db.query(
    `SELECT i.*, s.titulo AS nombre_simulacro, m.nombre AS materia,
            COUNT(*) OVER() AS total_count
     FROM intento_simulacro i
     LEFT JOIN simulacro s ON s.id = i.id_simulacro
     LEFT JOIN materia m ON m.id = s.id_materia
     WHERE i.id_usuario = $1
     ORDER BY i.iniciado_en DESC
     LIMIT $2 OFFSET $3`,
    [idUsuario, porPagina, offset]
  );

module.exports = {
  findEnCurso, create, findByIdAndUsuario, markExpired,
  findOpcion, upsertRespuesta, getStats, updateFinalizado,
  getRetroalimentacion, getHistorial,
};