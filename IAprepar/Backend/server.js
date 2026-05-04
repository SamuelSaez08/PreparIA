/**
 * PreparIA — Punto de entrada del servidor
 * Levanta Express, conecta a PostgreSQL y maneja señales del sistema.
 */

'use strict';

require('dotenv').config();
require('./src/config/env');

const app                    = require('./src/app');
const { testConnection, pool } = require('./src/config/db');
const logger                 = require('./src/utils/logger');
const { iniciarCronJobs }    = require('./src/jobs/cronJobs');

const PORT = parseInt(process.env.PORT || '3000', 10);

// ── Arranque ──────────────────────────────────────────────────────────────────
const start = async () => {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('  PreparIA — Backend API  v1.0.0');
  logger.info(`  Entorno: ${process.env.NODE_ENV || 'development'}`);
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Verificar conexión a PostgreSQL antes de arrancar
  const dbOk = await testConnection();
  if (!dbOk) {
    logger.error('No se pudo conectar a la base de datos. Abortando arranque.');
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    logger.info(`🚀 Servidor escuchando en http://localhost:${PORT}`);
    logger.info(`📡 API disponible en http://localhost:${PORT}/api/v1`);
    logger.info(`❤️  Health check: http://localhost:${PORT}/api/v1/health`);
    iniciarCronJobs();
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const shutdown = async (signal) => {
    logger.info(`\n${signal} recibido. Cerrando servidor...`);

    server.close(async () => {
      logger.info('Conexiones HTTP cerradas.');
      try {
        await pool.end();
        logger.info('Pool de PostgreSQL cerrado.');
      } catch (err) {
        logger.error('Error al cerrar pool:', err.message);
      }
      logger.info('✅ Servidor detenido correctamente.');
      process.exit(0);
    });

    // Forzar cierre después de 10 segundos
    setTimeout(() => {
      logger.error('Cierre forzado por timeout.');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  // ── Errores no capturados ─────────────────────────────────────────────────
  process.on('uncaughtException', (err) => {
    logger.error('uncaughtException:', err.message, err.stack);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('unhandledRejection:', reason);
    process.exit(1);
  });
};

start();
