'use strict';

const jwt    = require('jsonwebtoken');
const logger = require('../utils/logger');
const { fail } = require('../utils/response');
const { ROLES } = require('../utils/constants');

const JWT_SECRET = process.env.JWT_SECRET || 'preparia_secret_dev';

/** Middleware: verificar JWT en header Authorization */
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return fail(res, 'Token de acceso requerido.', 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id_usuario, rol }
    next();
  } catch (err) {
    logger.warn(`JWT inválido: ${err.message}`);
    return fail(res, 'Token inválido o expirado.', 401);
  }
};

/** Middleware: verificar rol(es) */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return fail(res, 'No autenticado.', 401);
  if (roles.length && !roles.includes(req.user.rol)) {
    return fail(res, 'No tienes permisos para esta acción.', 403);
  }
  next();
};

module.exports = { authenticate, authorize };
