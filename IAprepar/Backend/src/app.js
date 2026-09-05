'use strict';

require('dotenv').config();

const path     = require('path');
const fs       = require('fs');
const express  = require('express');
const helmet   = require('helmet');
const cors     = require('cors');
const morgan   = require('morgan');

const routes                            = require('./routes');
const logger                            = require('./utils/logger');
const { rateLimiter }                   = require('./middlewares/rateLimiter.middleware');
const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware');

const app = express();

// ── Seguridad
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// ── CORS
const envFrontendUrl = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
const extraOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5500,http://127.0.0.1:5500,http://localhost:3001,http://192.168.1.9:5500')
  .split(',')
  .map(o => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const allowedOrigins = [
  'https://prepar-ia.vercel.app',
  'https://preparia.vercel.app',
  envFrontendUrl,
  ...extraOrigins,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const cleanOrigin = origin.replace(/\/+$/, '');

    if (allowedOrigins.includes(cleanOrigin) || /\.vercel\.app$/.test(cleanOrigin)) {
      return callback(null, true);
    }

    logger.warn(`[CORS] Origen no permitido: ${origin}`);
    return callback(null, false);
  },
  methods:              ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders:       ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders:       ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  credentials:          true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// ── Rate limiter
app.use(rateLimiter);

// ── Parsers
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// ── Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(process.env.NODE_ENV === 'production' ? morgan('combined') : morgan('dev'));
}

// ── Request info
app.use((req, _res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// ── Root
app.get('/', (_req, res) => {
  res.json({
    nombre:      'PreparIA API',
    version:     'v1',
    descripcion: 'Plataforma educativa para preparación ICFES',
    docs:        '/api/v1/health',
    estado:      '✅ Activo',
  });
});

// ── API v1
app.use('/api/v1', routes);

// ── Frontend estático
// En desarrollo local el mismo servidor sirve la interfaz, de modo que
// http://localhost:3000/login.html funciona sin necesidad de Live Server ni de
// ningún otro servidor aparte. En producción el frontend lo sirve Vercel y esta
// carpeta no existe junto al backend, así que el bloque simplemente no se activa.
const RUTA_FRONTEND = path.join(__dirname, '..', '..', 'Frontend');

if (fs.existsSync(RUTA_FRONTEND)) {
  app.use(express.static(RUTA_FRONTEND, {
    extensions: ['html'],   // /login → /login.html
    index: false,           // la raíz sigue devolviendo la información de la API
  }));
  logger.info(`🖥️  Frontend servido desde este mismo servidor: http://localhost:${process.env.PORT || 3000}/login.html`);
}

// ── 404
app.use(notFoundHandler);

// ── Error handler
app.use(errorHandler);

module.exports = app;
