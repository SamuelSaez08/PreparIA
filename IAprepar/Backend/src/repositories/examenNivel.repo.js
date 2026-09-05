'use strict';
const db = require('../config/db');

/** RF-06 — Exámenes estáticos de nivelación. */

const findEnCurso = (idUsuario, idMateria) =>
  db.query(
    `SELECT id, id_usuario, id_materia, estado, creado_en
     FROM examen_nivel
     WHERE id_usuario = $1 AND id_materia = $2 AND estado = 'en_curso'
     ORDER BY id DESC LIMIT 1`,
    [idUsuario, idMateria]
  );

const findById = (id) =>
  db.query('SELECT * FROM examen_nivel WHERE id = $1', [id]);

const findUltimoCompletado = (idUsuario, idMateria) =>
  db.query(
    `SELECT e.id, e.puntaje, e.id_nivel_asignado, e.finalizado_en, n.nombre AS nivel, n.orden
     FROM examen_nivel e
     LEFT JOIN nivel n ON n.id = e.id_nivel_asignado
     WHERE e.id_usuario = $1 AND e.id_materia = $2 AND e.estado = 'completado'
     ORDER BY e.finalizado_en DESC NULLS LAST, e.id DESC
     LIMIT 1`,
    [idUsuario, idMateria]
  );

const crear = (client, idUsuario, idMateria) =>
  client.query(
    `INSERT INTO examen_nivel (id_usuario, id_materia, estado, creado_en)
     VALUES ($1,$2,'en_curso',NOW())
     RETURNING id, id_usuario, id_materia, estado, creado_en`,
    [idUsuario, idMateria]
  );

/**
 * Preguntas fijas del examen: selección determinista (ordenada por id) para que
 * el examen sea el mismo en cada aplicación, tal como exige RF-06.
 */
const findPreguntasFijas = (idMateria, porNivel) =>
  db.query(
    `SELECT id, id_nivel, enunciado, texto_base, dificultad, orden_nivel, opciones
     FROM (
       SELECT p.id, p.id_nivel, p.enunciado, p.texto_base, p.dificultad,
              nv.orden AS orden_nivel,
              ROW_NUMBER() OVER (PARTITION BY p.id_nivel ORDER BY p.id) AS rn,
              (SELECT json_agg(json_build_object('id',o.id,'letra',o.letra,'texto',o.texto) ORDER BY o.letra)
               FROM opcion_respuesta o WHERE o.id_pregunta = p.id) AS opciones
       FROM pregunta p
       JOIN nodo_aprendizaje n ON n.id = p.id_nodo AND n.id_materia = $1
       JOIN nivel nv ON nv.id = p.id_nivel
       WHERE p.activa = true
     ) t
     WHERE rn <= $2 AND opciones IS NOT NULL
     ORDER BY orden_nivel, id`,
    [idMateria, porNivel]
  );

const registrarPreguntas = (client, idExamen, preguntas) => {
  if (!preguntas.length) return Promise.resolve();
  const valores = [];
  const params  = [idExamen];
  preguntas.forEach((p, i) => {
    params.push(p.id, i + 1);
    valores.push(`($1, $${params.length - 1}, $${params.length})`);
  });
  return client.query(
    `INSERT INTO resultado_examen_nivel (id_examen, id_pregunta, orden)
     VALUES ${valores.join(',')}
     ON CONFLICT (id_examen, id_pregunta) DO NOTHING`,
    params
  );
};

const findPreguntasDeExamen = (idExamen) =>
  db.query(
    `SELECT r.id_pregunta AS id, r.orden, p.id_nivel, p.enunciado, p.texto_base, p.dificultad,
            nv.orden AS orden_nivel,
            (SELECT json_agg(json_build_object('id',o.id,'letra',o.letra,'texto',o.texto) ORDER BY o.letra)
             FROM opcion_respuesta o WHERE o.id_pregunta = p.id) AS opciones
     FROM resultado_examen_nivel r
     JOIN pregunta p ON p.id = r.id_pregunta
     JOIN nivel nv ON nv.id = p.id_nivel
     WHERE r.id_examen = $1
     ORDER BY r.orden`,
    [idExamen]
  );

const findOpcionesCorrectas = (idExamen) =>
  db.query(
    `SELECT r.id_pregunta, p.id_nivel, nv.orden AS orden_nivel,
            o.id AS id_opcion_correcta, o.letra AS letra_correcta, p.explicacion
     FROM resultado_examen_nivel r
     JOIN pregunta p ON p.id = r.id_pregunta
     JOIN nivel nv ON nv.id = p.id_nivel
     JOIN opcion_respuesta o ON o.id_pregunta = p.id AND o.es_correcta = true
     WHERE r.id_examen = $1`,
    [idExamen]
  );

const guardarRespuesta = (client, idExamen, idPregunta, idOpcion, esCorrecta) =>
  client.query(
    `UPDATE resultado_examen_nivel
        SET id_opcion_elegida = $3, es_correcta = $4, respondida_en = NOW()
      WHERE id_examen = $1 AND id_pregunta = $2`,
    [idExamen, idPregunta, idOpcion, esCorrecta]
  );

const finalizar = (client, idExamen, puntaje, idNivelAsignado) =>
  client.query(
    `UPDATE examen_nivel
        SET estado = 'completado', puntaje = $2, id_nivel_asignado = $3, finalizado_en = NOW()
      WHERE id = $1
      RETURNING id, puntaje, id_nivel_asignado, finalizado_en`,
    [idExamen, puntaje, idNivelAsignado]
  );

module.exports = {
  findEnCurso, findById, findUltimoCompletado, crear,
  findPreguntasFijas, registrarPreguntas, findPreguntasDeExamen,
  findOpcionesCorrectas, guardarRespuesta, finalizar,
};
