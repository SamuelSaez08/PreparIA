'use strict';

require('dotenv').config();

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
const allowedOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.CORS_ORIGIN || 'http://localhost:5500,http://127.0.0.1:5500,http://localhost:3001')
    .split(',')
    .map(o => o.trim()),
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origen no permitido → ${origin}`));
  },
  methods:            ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders:     ['Content-Type', 'Authorization'],
  exposedHeaders:     ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  credentials:        true,
  optionsSuccessStatus: 204,
};

// Preflight explícito — necesario para peticiones con Authorization header desde Vercel
app.options('*', cors(corsOptions));
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

// ── 404
app.use(notFoundHandler);

// ── Error handler
app.use(errorHandler);

module.exports = app;
