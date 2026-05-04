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

module.exports = { getStatsGlobales, getProgresoMaterias, getActividad30d, getByMateria, upsertProgreso };
