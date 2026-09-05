'use strict';

const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');
const logger  = require('../utils/logger');
const usuarioRepo = require('../repositories/usuario.repo');
const { ROLES } = require('../utils/constants');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET no configurado. Revisa tu archivo .env');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const SALT_ROUNDS    = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

const ID_ROL_ESTUDIANTE = 2;

const _parseExpiry = (str) => {
  const match = /^(\d+)([smhd])$/.exec(str);
  if (!match) return 8 * 3600 * 1000;
  const n = parseInt(match[1], 10);
  const factor = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * (factor[match[2]] || 3_600_000);
};

const _hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** Emite el token y abre la sesión en base de datos. */
const _abrirSesion = async ({ idUsuario, rol, ip, userAgent }) => {
  const token    = jwt.sign({ id_usuario: idUsuario, rol }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const expiraEn = new Date(Date.now() + _parseExpiry(JWT_EXPIRES_IN));

  await usuarioRepo.createSession({
    idUsuario,
    tokenHash: _hashToken(token),
    ip:        ip || null,
    userAgent: userAgent || null,
    expiraEn,
  });

  return token;
};

/**
 * RF-02 — Registro de estudiantes.
 * Captura nombre, apellido, correo, grado, institución educativa y datos de
 * contacto (ciudad y teléfono).
 */
const register = async ({
  nombre, apellido, email, password,
  grado, institucion, ciudad, telefono,
  ip, userAgent,
}) => {
  const correo = email.toLowerCase().trim();

  const { rows: existe } = await db.query('SELECT id FROM usuario WHERE email = $1', [correo]);
  if (existe.length) {
    const err = new Error('El correo electrónico ya está registrado.');
    err.statusCode = 409;
    throw err;
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);

  const usuario = await db.transaction(async (client) => {
    const { rows: uRows } = await usuarioRepo.create(client, {
      nombre:       nombre.trim(),
      apellido:     (apellido || '').trim(),
      email:        correo,
      passwordHash: hash,
      idRol:        ID_ROL_ESTUDIANTE,
    });

    await usuarioRepo.createPerfil(client, uRows[0].id, {
      grado:       grado || null,
      institucion: institucion ? institucion.trim() : null,
      ciudad:      ciudad ? ciudad.trim() : null,
      telefono:    telefono ? telefono.trim() : null,
    });

    return uRows[0];
  });

  const token = await _abrirSesion({
    idUsuario: usuario.id,
    rol:       ROLES.ESTUDIANTE,
    ip, userAgent,
  });

  logger.info(`Usuario registrado: ${usuario.email} (id=${usuario.id})`);

  return {
    token,
    usuario: {
      id:       usuario.id,
      nombre:   usuario.nombre,
      apellido: usuario.apellido,
      email:    usuario.email,
      rol:      ROLES.ESTUDIANTE,
    },
  };
};

/** RF-01 — Inicio de sesión. */
const login = async ({ email, password, ip, userAgent }) => {
  const { rows } = await usuarioRepo.findByEmail(email.toLowerCase().trim());

  if (!rows.length) {
    const err = new Error('Credenciales incorrectas.');
    err.statusCode = 401;
    throw err;
  }

  const usuario = rows[0];

  if (!usuario.activo) {
    const err = new Error('Tu cuenta está desactivada. Contacta al administrador.');
    err.statusCode = 403;
    throw err;
  }

  const passwordOk = await bcrypt.compare(password, usuario.password_hash);
  if (!passwordOk) {
    const err = new Error('Credenciales incorrectas.');
    err.statusCode = 401;
    throw err;
  }

  // Una sesión activa por usuario: la anterior se cierra.
  await usuarioRepo.closeSessions(usuario.id);

  const token = await _abrirSesion({
    idUsuario: usuario.id,
    rol:       usuario.rol,
    ip, userAgent,
  });

  logger.info(`Login exitoso: ${usuario.email} | IP: ${ip}`);

  return {
    token,
    usuario: {
      id:       usuario.id,
      nombre:   usuario.nombre,
      apellido: usuario.apellido,
      email:    usuario.email,
      rol:      usuario.rol,
    },
  };
};

const logout = async (idUsuario) => {
  const { rowCount } = await usuarioRepo.closeSessions(idUsuario);
  logger.info(`Logout: usuario id=${idUsuario} (${rowCount} sesión(es) cerradas)`);
  return { cerradas: rowCount };
};

/** Cambio de contraseña del propio usuario. */
const cambiarPassword = async (idUsuario, actual, nueva) => {
  const { rows } = await db.query('SELECT password_hash FROM usuario WHERE id = $1', [idUsuario]);
  if (!rows.length) {
    const err = new Error('Usuario no encontrado.');
    err.statusCode = 404;
    throw err;
  }

  const ok = await bcrypt.compare(actual, rows[0].password_hash);
  if (!ok) {
    const err = new Error('La contraseña actual no es correcta.');
    err.statusCode = 400;
    throw err;
  }

  const hash = await bcrypt.hash(nueva, SALT_ROUNDS);
  await usuarioRepo.updatePassword(idUsuario, hash);

  // Cerrar las sesiones obliga a iniciar sesión con la contraseña nueva.
  await usuarioRepo.closeSessions(idUsuario);

  logger.info(`Contraseña actualizada: usuario id=${idUsuario}`);
  return { actualizada: true };
};

module.exports = { register, login, logout, cambiarPassword };
