'use strict';
const rateLimit = require('express-rate-limit');

/**
 * Límite general de la API.
 *
 * 100 cada 15 minutos era demasiado justo: terminar un solo simulacro son unas
 * quince peticiones (iniciar, una por respuesta, finalizar, progreso), así que
 * tres simulacros seguidos agotaban el cupo. Se sube a 300, que sigue frenando
 * un abuso real sin castigar el uso normal.
 *
 * Ojo si algún día corre en varias instancias a la vez (Cloud Run, por
 * ejemplo): el contador vive en memoria de cada proceso, así que el límite
 * efectivo se multiplica por el número de instancias. Para un tope exacto
 * habría que llevar el contador a Redis o a la base de datos.
 */
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, mensaje: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' },
});

/** Autenticación: sigue estrecho a propósito, es la puerta de entrada. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '20', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, mensaje: 'Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.' },
});

module.exports = { rateLimiter, authLimiter };
