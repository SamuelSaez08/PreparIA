'use strict';

const logger = require('../utils/logger');

const notFoundHandler = (req, res) => {
  res.status(404).json({
    ok: false,
    mensaje: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
};

const errorHandler = (err, req, res, _next) => {
  logger.error(`${err.statusCode || 500} | ${err.message}`);
  const status = err.statusCode || 500;
  res.status(status).json({
    ok: false,
    mensaje: err.message || 'Error interno del servidor.',
  });
};

module.exports = { notFoundHandler, errorHandler };
