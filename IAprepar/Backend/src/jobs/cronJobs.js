'use strict';

const cron   = require('node-cron');
const db     = require('../config/db');
const logger = require('../utils/logger');

// Lunes 00:05 UTC — guarda snapshot y resetea puntos semanales
const iniciarResetSemanal = () => {
  cron.schedule('5 0 * * 1', async () => {
    logger.info('Cron: iniciando reset semanal de puntos...');
    try {
      await db.query('SELECT fn_reset_weekly_points()');
      logger.info('Cron: reset semanal completado correctamente.');
    } catch (err) {
      logger.error('Cron: error en reset semanal de puntos:', err.message);
    }
  }, { scheduled: true, timezone: 'UTC' });
};

// Día 1 de cada mes a las 00:10 UTC — guarda snapshot y resetea puntos mensuales
const iniciarResetMensual = () => {
  cron.schedule('10 0 1 * *', async () => {
    logger.info('Cron: iniciando reset mensual de puntos...');
    try {
      await db.query('SELECT fn_reset_monthly_points()');
      logger.info('Cron: reset mensual completado correctamente.');
    } catch (err) {
      logger.error('Cron: error en reset mensual de puntos:', err.message);
    }
  }, { scheduled: true, timezone: 'UTC' });
};

// Diariamente a las 01:00 UTC — rompe racha de usuarios que no hicieron simulacro ayer
const iniciarExpiracionRachas = () => {
  cron.schedule('0 1 * * *', async () => {
    logger.info('Cron: verificando expiración de rachas...');
    try {
      const { rowCount } = await db.query(`
        UPDATE user_stats
        SET    current_streak = 0,
               updated_at     = NOW()
        WHERE  current_streak > 0
          AND  user_id NOT IN (
                 SELECT DISTINCT user_id
                 FROM   daily_activity
                 WHERE  activity_date >= CURRENT_DATE - INTERVAL '1 day'
               )
      `);
      if (rowCount > 0) {
        logger.info(`Cron: rachas expiradas para ${rowCount} usuario(s).`);
      } else {
        logger.info('Cron: ninguna racha expirada hoy.');
      }
    } catch (err) {
      logger.error('Cron: error al expirar rachas:', err.message);
    }
  }, { scheduled: true, timezone: 'UTC' });
};

// Inicializa todos los cron jobs del sistema
const iniciarCronJobs = () => {
  iniciarResetSemanal();
  iniciarResetMensual();
  iniciarExpiracionRachas();
  logger.info(
    'Cron jobs inicializados: ' +
    'reset semanal (lunes 00:05 UTC), ' +
    'reset mensual (día 1 00:10 UTC), ' +
    'expiración de rachas (diario 01:00 UTC)'
  );
};

module.exports = { iniciarCronJobs };
