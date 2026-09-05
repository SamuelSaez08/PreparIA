'use strict';
const db = require('../config/db');

/** Consultas agregadas que alimentan los reportes del administrador (caso de uso 4.7). */

const resumenGeneral = (desde, hasta) =>
  db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM usuario u JOIN rol r ON r.id = u.id_rol WHERE r.nombre = 'estudiante') AS total_estudiantes,
       (SELECT COUNT(*)::int FROM usuario WHERE activo = true)                                           AS usuarios_activos,
       (SELECT COUNT(*)::int FROM pregunta WHERE activa = true)                                          AS total_preguntas,
       (SELECT COUNT(*)::int FROM simulacro WHERE activo = true)                                         AS total_simulacros,
       COUNT(*)::int                                                                                     AS intentos_completados,
       COALESCE(ROUND(AVG(i.puntaje_obtenido)::numeric, 2), 0)                                           AS promedio_general,
       COALESCE(MAX(i.puntaje_obtenido), 0)                                                              AS mejor_puntaje,
       COALESCE(MIN(i.puntaje_obtenido), 0)                                                              AS peor_puntaje
     FROM intento_simulacro i
     WHERE i.estado = 'completado'
       AND ($1::date IS NULL OR i.iniciado_en >= $1::date)
       AND ($2::date IS NULL OR i.iniciado_en < ($2::date + INTERVAL '1 day'))`,
    [desde || null, hasta || null]
  );

const rendimientoPorEstudiante = (desde, hasta, limit = 200) =>
  db.query(
    `SELECT u.id, u.nombre, u.apellido, u.email, p.grado, p.institucion,
            COUNT(i.id)::int AS simulacros,
            COALESCE(ROUND(AVG(i.puntaje_obtenido)::numeric, 2), 0) AS promedio,
            COALESCE(MAX(i.puntaje_obtenido), 0) AS mejor,
            MAX(i.iniciado_en) AS ultimo_intento
     FROM usuario u
     JOIN rol r ON r.id = u.id_rol AND r.nombre = 'estudiante'
     LEFT JOIN perfil_estudiante p ON p.id_usuario = u.id
     LEFT JOIN intento_simulacro i
            ON i.id_usuario = u.id
           AND i.estado = 'completado'
           AND ($1::date IS NULL OR i.iniciado_en >= $1::date)
           AND ($2::date IS NULL OR i.iniciado_en < ($2::date + INTERVAL '1 day'))
     GROUP BY u.id, u.nombre, u.apellido, u.email, p.grado, p.institucion
     ORDER BY promedio DESC, simulacros DESC, u.id
     LIMIT $3`,
    [desde || null, hasta || null, limit]
  );

const rendimientoPorMateria = (desde, hasta) =>
  db.query(
    `SELECT m.id, m.nombre AS materia,
            COUNT(i.id)::int AS intentos,
            COALESCE(ROUND(AVG(i.puntaje_obtenido)::numeric, 2), 0) AS promedio
     FROM materia m
     LEFT JOIN simulacro s ON s.id_materia = m.id
     LEFT JOIN intento_simulacro i
            ON i.id_simulacro = s.id
           AND i.estado = 'completado'
           AND ($1::date IS NULL OR i.iniciado_en >= $1::date)
           AND ($2::date IS NULL OR i.iniciado_en < ($2::date + INTERVAL '1 day'))
     GROUP BY m.id, m.nombre
     ORDER BY m.id`,
    [desde || null, hasta || null]
  );

const preguntasMasFalladas = (desde, hasta, limit = 20) =>
  db.query(
    `SELECT p.id, p.enunciado, n.nombre AS nodo, p.dificultad,
            COUNT(*)::int AS veces_respondida,
            SUM(CASE WHEN r.es_correcta THEN 0 ELSE 1 END)::int AS fallos,
            ROUND(100.0 * SUM(CASE WHEN r.es_correcta THEN 0 ELSE 1 END) / NULLIF(COUNT(*),0), 1) AS porcentaje_fallo
     FROM respuesta_intento r
     JOIN pregunta p ON p.id = r.id_pregunta
     LEFT JOIN nodo_aprendizaje n ON n.id = p.id_nodo
     JOIN intento_simulacro i ON i.id = r.id_intento
     WHERE ($1::date IS NULL OR i.iniciado_en >= $1::date)
       AND ($2::date IS NULL OR i.iniciado_en < ($2::date + INTERVAL '1 day'))
     GROUP BY p.id, p.enunciado, n.nombre, p.dificultad
     HAVING COUNT(*) >= 3
     ORDER BY porcentaje_fallo DESC, veces_respondida DESC
     LIMIT $3`,
    [desde || null, hasta || null, limit]
  );

const guardarReporte = ({ idUsuario, tipo, descripcion, desde, hasta, datos }) =>
  db.query(
    `INSERT INTO reporte (id_usuario, tipo, descripcion, fecha_inicio, fecha_fin, datos_json, creado_en)
     VALUES ($1,$2,$3,$4,$5,$6,NOW())
     RETURNING id, tipo, creado_en`,
    [idUsuario, tipo, descripcion || null, desde || null, hasta || null, JSON.stringify(datos)]
  );

const listarReportes = (limit = 20) =>
  db.query(
    `SELECT r.id, r.tipo, r.descripcion, r.fecha_inicio, r.fecha_fin, r.creado_en,
            u.nombre, u.apellido
     FROM reporte r JOIN usuario u ON u.id = r.id_usuario
     ORDER BY r.creado_en DESC
     LIMIT $1`,
    [limit]
  );

const findReporte = (id) =>
  db.query('SELECT * FROM reporte WHERE id = $1', [id]);

module.exports = {
  resumenGeneral, rendimientoPorEstudiante, rendimientoPorMateria,
  preguntasMasFalladas, guardarReporte, listarReportes, findReporte,
};
