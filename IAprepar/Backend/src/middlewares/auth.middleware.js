'use strict';

const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const logger = require('../utils/logger');
const { fail } = require('../utils/response');
const usuarioRepo = require('../repositories/usuario.repo');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET no configurado. Revisa tu archivo .env');

/** NFR de seguridad: la sesión caduca tras N minutos sin actividad. */
const MINUTOS_INACTIVIDAD = parseInt(process.env.SESSION_IDLE_MINUTES || '30', 10);

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Verifica el JWT y, además, que la sesión siga viva en la base de datos.
 * Cada petición válida renueva la marca de actividad; 30 minutos sin peticiones
 * cierran la sesión aunque el token todavía no haya vencido.
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return fail(res, 'Token de acceso requerido.', 401);
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    logger.warn(`JWT inválido: ${err.message}`);
    return fail(res, 'Token inválido o expirado.', 401);
  }

  try {
    const tokenHash = hashToken(token);
    const { rows } = await usuarioRepo.touchSession(tokenHash, MINUTOS_INACTIVIDAD);

    if (!rows.length) {
      // Distinguimos "no existe" de "caducó por inactividad" para dar un
      // mensaje útil en la interfaz.
      const { rows: sesion } = await usuarioRepo.findSessionByHash(tokenHash);

      if (!sesion.length) {
        return fail(res, 'Sesión no encontrada. Inicia sesión de nuevo.', 401);
      }

      await usuarioRepo.closeSessionByHash(tokenHash);
      return fail(res, `Sesión cerrada por ${MINUTOS_INACTIVIDAD} minutos de inactividad.`, 401);
    }

    req.user      = decoded; // { id_usuario, rol }
    req.tokenHash = tokenHash;
    return next();
  } catch (err) {
    logger.error(`Error validando la sesión: ${err.message}`);
    return next(err);
  }
};

/** Restringe una ruta a uno o varios roles. */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return fail(res, 'No autenticado.', 401);
  if (roles.length && !roles.includes(req.user.rol)) {
    return fail(res, 'No tienes permisos para esta acción.', 403);
  }
  next();
};

module.exports = { authenticate, authorize, hashToken, MINUTOS_INACTIVIDAD };
