'use strict';
const db = require('../config/db');

// ── Autenticación ────────────────────────────────────────────────────────────

const findByEmail = (email) =>
  db.query(
    `SELECT u.id, u.nombre, u.apellido, u.email, u.password_hash, u.activo,
            r.id AS id_rol, r.nombre AS rol
     FROM usuario u JOIN rol r ON r.id = u.id_rol
     WHERE u.email = $1`,
    [email]
  );

const findById = (id) =>
  db.query(
    `SELECT u.id, u.nombre, u.apellido, u.email, u.id_rol, u.activo, u.creado_en,
            r.nombre AS rol
     FROM usuario u JOIN rol r ON r.id = u.id_rol
     WHERE u.id = $1`,
    [id]
  );

const create = (client, { nombre, apellido, email, passwordHash, idRol }) =>
  client.query(
    `INSERT INTO usuario (nombre, apellido, email, password_hash, id_rol, activo, creado_en)
     VALUES ($1,$2,$3,$4,$5,true,NOW())
     RETURNING id, nombre, apellido, email, id_rol, creado_en`,
    [nombre, apellido, email, passwordHash, idRol]
  );

const createPerfil = (client, idUsuario, { grado = null, institucion = null, ciudad = null, telefono = null } = {}) =>
  client.query(
    `INSERT INTO perfil_estudiante (id_usuario, grado, institucion, ciudad, telefono, creado_en)
     VALUES ($1,$2,$3,$4,$5,NOW())
     ON CONFLICT (id_usuario) DO UPDATE SET
       grado       = COALESCE(EXCLUDED.grado,       perfil_estudiante.grado),
       institucion = COALESCE(EXCLUDED.institucion, perfil_estudiante.institucion),
       ciudad      = COALESCE(EXCLUDED.ciudad,      perfil_estudiante.ciudad),
       telefono    = COALESCE(EXCLUDED.telefono,    perfil_estudiante.telefono)`,
    [idUsuario, grado, institucion, ciudad, telefono]
  );

// ── Sesiones ─────────────────────────────────────────────────────────────────

const closeSessions = (idUsuario) =>
  db.query(
    `UPDATE sesion_usuario SET activa = false, cerrada_en = NOW()
     WHERE id_usuario = $1 AND activa = true`,
    [idUsuario]
  );

const createSession = ({ idUsuario, tokenHash, ip, userAgent, expiraEn }, client = null) => {
  const ejecutor = client || db;
  return ejecutor.query(
    `INSERT INTO sesion_usuario (id_usuario, token_hash, ip, user_agent, activa, iniciada_en, expira_en, ultima_actividad)
     VALUES ($1,$2,$3,$4,true,NOW(),$5,NOW())`,
    [idUsuario, tokenHash, ip, userAgent, expiraEn]
  );
};

/**
 * Marca actividad en la sesión y, de paso, valida que siga viva.
 * Devuelve 0 filas si la sesión no existe, fue cerrada, venció el token o
 * superó el límite de inactividad.
 */
const touchSession = (tokenHash, minutosInactividad) =>
  db.query(
    `UPDATE sesion_usuario
        SET ultima_actividad = NOW()
      WHERE token_hash = $1
        AND activa = true
        AND (expira_en IS NULL OR expira_en > NOW())
        AND ultima_actividad > NOW() - ($2 * INTERVAL '1 minute')
      RETURNING id, id_usuario`,
    [tokenHash, minutosInactividad]
  );

const findSessionByHash = (tokenHash) =>
  db.query('SELECT id, id_usuario, activa, expira_en, ultima_actividad FROM sesion_usuario WHERE token_hash = $1', [tokenHash]);

const closeSessionByHash = (tokenHash) =>
  db.query(
    `UPDATE sesion_usuario SET activa = false, cerrada_en = NOW()
     WHERE token_hash = $1 AND activa = true`,
    [tokenHash]
  );

// ── Perfil propio ────────────────────────────────────────────────────────────

const getPerfil = (idUsuario) =>
  db.query(
    `SELECT u.id, u.nombre, u.apellido, u.email, u.activo, u.creado_en,
            r.nombre AS rol,
            p.grado, p.institucion, p.ciudad, p.telefono
     FROM usuario u
     JOIN rol r ON r.id = u.id_rol
     LEFT JOIN perfil_estudiante p ON p.id_usuario = u.id
     WHERE u.id = $1`,
    [idUsuario]
  );

const updateDatosBasicos = (client, idUsuario, { nombre, apellido }) =>
  client.query(
    `UPDATE usuario
        SET nombre   = COALESCE($2, nombre),
            apellido = COALESCE($3, apellido)
      WHERE id = $1
      RETURNING id, nombre, apellido, email`,
    [idUsuario, nombre ?? null, apellido ?? null]
  );

const updatePassword = (idUsuario, passwordHash) =>
  db.query('UPDATE usuario SET password_hash = $2 WHERE id = $1 RETURNING id', [idUsuario, passwordHash]);

// ── Administración (RF-03) ───────────────────────────────────────────────────

const listar = ({ busqueda = null, rol = null, activo = null, limit = 25, offset = 0 }) => {
  const params = [];
  let where = 'WHERE 1=1';

  if (busqueda) {
    params.push(`%${busqueda.toLowerCase()}%`);
    where += ` AND (LOWER(u.nombre) LIKE $${params.length} OR LOWER(u.apellido) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`;
  }
  if (rol) {
    params.push(rol);
    where += ` AND r.nombre = $${params.length}`;
  }
  if (activo !== null) {
    params.push(activo);
    where += ` AND u.activo = $${params.length}`;
  }

  params.push(limit);
  const pLimit = params.length;
  params.push(offset);
  const pOffset = params.length;

  return db.query(
    `SELECT u.id, u.nombre, u.apellido, u.email, u.activo, u.creado_en,
            r.nombre AS rol,
            p.grado, p.institucion, p.ciudad, p.telefono,
            (SELECT COUNT(*) FROM intento_simulacro i WHERE i.id_usuario = u.id AND i.estado = 'completado') AS simulacros_completados
     FROM usuario u
     JOIN rol r ON r.id = u.id_rol
     LEFT JOIN perfil_estudiante p ON p.id_usuario = u.id
     ${where}
     ORDER BY u.creado_en DESC, u.id DESC
     LIMIT $${pLimit} OFFSET $${pOffset}`,
    params
  );
};

const contar = ({ busqueda = null, rol = null, activo = null }) => {
  const params = [];
  let where = 'WHERE 1=1';
  if (busqueda) {
    params.push(`%${busqueda.toLowerCase()}%`);
    where += ` AND (LOWER(u.nombre) LIKE $${params.length} OR LOWER(u.apellido) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`;
  }
  if (rol) { params.push(rol); where += ` AND r.nombre = $${params.length}`; }
  if (activo !== null) { params.push(activo); where += ` AND u.activo = $${params.length}`; }

  return db.query(
    `SELECT COUNT(*)::int AS total FROM usuario u JOIN rol r ON r.id = u.id_rol ${where}`,
    params
  );
};

const setActivo = (id, activo) =>
  db.query(
    'UPDATE usuario SET activo = $2 WHERE id = $1 RETURNING id, nombre, apellido, email, activo',
    [id, activo]
  );

const setRol = (id, idRol) =>
  db.query('UPDATE usuario SET id_rol = $2 WHERE id = $1 RETURNING id, id_rol', [id, idRol]);

const eliminar = (id) =>
  db.query('DELETE FROM usuario WHERE id = $1 RETURNING id, email', [id]);

const findRolPorNombre = (nombre) =>
  db.query('SELECT id, nombre FROM rol WHERE nombre = $1', [nombre]);

module.exports = {
  findByEmail, findById, create, createPerfil,
  closeSessions, createSession, touchSession, findSessionByHash, closeSessionByHash,
  getPerfil, updateDatosBasicos, updatePassword,
  listar, contar, setActivo, setRol, eliminar, findRolPorNombre,
};
