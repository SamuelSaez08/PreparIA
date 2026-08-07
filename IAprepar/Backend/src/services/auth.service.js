'use strict';

const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');
const logger  = require('../utils/logger');
const usuarioRepo = require('../repositories/usuario.repo');

const JWT_SECRET      = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET no configurado. Revisa tu archivo .env');
const JWT_EXPIRES_IN  = process.env.JWT_EXPIRES_IN   || '8h';
const SALT_ROUNDS     = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

const register = async ({ nombre, apellido, email, password, grado, id_rol = 2 }) => {
  const { rows: existe } = await db.query(
    'SELECT id FROM usuario WHERE email = $1',
    [email.toLowerCase().trim()]
  );
  if (existe.length) {
    const err = new Error('El correo electrónico ya está registrado.');
    err.statusCode = 409;
    throw err;
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);

  const rows = await db.transaction(async (client) => {
    const { rows: uRows } = await usuarioRepo.create(client, {
      nombre:       nombre.trim(),
      apellido:     (apellido || '').trim(),
      email:        email.toLowerCase().trim(),
      passwordHash: hash,
      idRol:        id_rol,
    });
    const usuario = uRows[0];

    if (id_rol === 2) {
      await usuarioRepo.createPerfil(client, usuario.id, grado || null);
    }

    return uRows;
  });

  // Generate token for auto-login after registration
  const payload = { id_usuario: rows[0].id, rol: 'estudiante' };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  logger.info(`Usuario registrado: ${rows[0].email} (id=${rows[0].id})`);
  return {
    token,
    usuario: {
      id:       rows[0].id,
      nombre:   rows[0].nombre,
      apellido: rows[0].apellido,
      email:    rows[0].email,
      rol:      'estudiante',
    },
  };
};

const login = async ({ email, password, ip, userAgent }) => {
  const { rows } = await usuarioRepo.findByEmail(email.toLowerCase().trim());

  if (!rows.length) {
    const err = new Error('Credenciales incorrectas.');
    err.statusCode = 401;
    throw err;
  }

  const usuario = rows[0];

  if (!usuario.activo) {
    const err = new Error('Tu cuenta está desactivada.');
    err.statusCode = 403;
    throw err;
  }

  const passwordOk = await bcrypt.compare(password, usuario.password_hash);
  if (!passwordOk) {
    const err = new Error('Credenciales incorrectas.');
    err.statusCode = 401;
    throw err;
  }

  await usuarioRepo.closeSessions(usuario.id);

  const payload = { id_usuario: usuario.id, rol: usuario.rol };
  const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  const expMs    = _parseExpiry(JWT_EXPIRES_IN);
  const expiraEn = new Date(Date.now() + expMs);

  await usuarioRepo.createSession({
    idUsuario: usuario.id,
    tokenHash: _hashToken(token),
    ip:        ip || null,
    userAgent: userAgent || null,
    expiraEn,
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

const _parseExpiry = (str) => {
  const match = /^(\d+)([smhd])$/.exec(str);
  if (!match) return 8 * 3600 * 1000;
  const n = parseInt(match[1], 10);
  const u = match[2];
  const factor = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * (factor[u] || 3_600_000);
};

const _hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

module.exports = { register, login, logout };
