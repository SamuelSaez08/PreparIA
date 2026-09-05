'use strict';
const db = require('../config/db');

const getStatsGlobales = (idUsuario) =>
  db.query(
    `SELECT COUNT(*) AS total_intentos,
            COALESCE(AVG(puntaje_obtenido),0) AS promedio_global,
            COALESCE(MAX(puntaje_obtenido),0) AS mejor_puntaje
     FROM intento_simulacro WHERE id_usuario = $1 AND estado = 'completado'`,
    [idUsuario]
  );

const getProgresoMaterias = (idUsuario) =>
  db.query(
    `SELECT m.nombre, pe.puntaje_promedio AS porcentaje, pe.simulacros_completados, pe.total_correctas, pe.total_preguntas
     FROM progreso_estudiante pe JOIN materia m ON m.id = pe.id_materia
     WHERE pe.id_usuario = $1 ORDER BY m.id`,
    [idUsuario]
  );

const getActividad30d = (idUsuario) =>
  db.query(
    `SELECT DISTINCT DATE(iniciado_en) AS fecha FROM intento_simulacro
     WHERE id_usuario = $1 AND iniciado_en > NOW() - INTERVAL '30 days' ORDER BY fecha`,
    [idUsuario]
  );

const getByMateria = (idUsuario, idMateria) =>
  db.query('SELECT * FROM progreso_estudiante WHERE id_usuario = $1 AND id_materia = $2', [idUsuario, idMateria]);

const upsertProgreso = (client, idUsuario, idMateria, correctas, total, puntaje) =>
  client.query(
    `INSERT INTO progreso_estudiante (id_usuario, id_materia, simulacros_completados, total_correctas, total_preguntas, puntaje_promedio, ultimo_simulacro_en, actualizado_en)
     VALUES ($1,$2,1,$3,$4,$5,NOW(),NOW())
     ON CONFLICT (id_usuario, id_materia)
     DO UPDATE SET
       simulacros_completados = progreso_estudiante.simulacros_completados + 1,
       total_correctas = progreso_estudiante.total_correctas + EXCLUDED.total_correctas,
       total_preguntas = progreso_estudiante.total_preguntas + EXCLUDED.total_preguntas,
       puntaje_promedio = ROUND((progreso_estudiante.total_correctas + EXCLUDED.total_correctas)::numeric / NULLIF(progreso_estudiante.total_preguntas + EXCLUDED.total_preguntas,0) * 100, 2),
       ultimo_simulacro_en = NOW(), actualizado_en = NOW()`,
    [idUsuario, idMateria, correctas, total, puntaje]
  );

/**
 * Dominio por nodo de aprendizaje, derivado de respuestas reales.
 * No hay tabla de "nodo completado": el porcentaje sale de las preguntas de ese
 * nodo que el estudiante ya respondió en sus simulacros.
 */
const getProgresoNodos = (idUsuario, idMateria) =>
  db.query(
    `SELECT n.id, n.nombre, n.id_padre, n.orden, n.id_nivel,
            (SELECT COUNT(*)::int FROM pregunta p
              WHERE p.id_nodo = n.id AND p.activa = true) AS preguntas,
            (SELECT COUNT(*)::int FROM contenido_nodo c
              WHERE c.id_nodo = n.id AND c.activo = true) AS materiales,
            (SELECT COUNT(*)::int FROM respuesta_intento r
               JOIN pregunta p2 ON p2.id = r.id_pregunta
               JOIN intento_simulacro i ON i.id = r.id_intento
              WHERE p2.id_nodo = n.id AND i.id_usuario = $2) AS respondidas,
            (SELECT COUNT(*)::int FROM respuesta_intento r
               JOIN pregunta p2 ON p2.id = r.id_pregunta
               JOIN intento_simulacro i ON i.id = r.id_intento
              WHERE p2.id_nodo = n.id AND i.id_usuario = $2 AND r.es_correcta = true) AS correctas,
            (SELECT MAX(i.iniciado_en) FROM respuesta_intento r
               JOIN pregunta p2 ON p2.id = r.id_pregunta
               JOIN intento_simulacro i ON i.id = r.id_intento
              WHERE p2.id_nodo = n.id AND i.id_usuario = $2) AS ultima_practica
     FROM nodo_aprendizaje n
     WHERE n.id_materia = $1 AND n.activo = true
     ORDER BY COALESCE(n.id_nivel, 0), COALESCE(n.orden, 0), n.id`,
    [idMateria, idUsuario]
  );

module.exports = { getStatsGlobales, getProgresoMaterias, getActividad30d, getByMateria, upsertProgreso, getProgresoNodos };
