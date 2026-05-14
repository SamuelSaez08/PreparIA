'use strict';

const { Pool } = require('pg');
const logger   = require('../utils/logger');

if (!process.env.DATABASE_URL) {
  throw new Error('Variable de entorno faltante: DATABASE_URL. Revisa tu archivo .env');
}

const pool = new Pool({
  connectionString:            process.env.DATABASE_URL,
  ssl:                         process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max:                         parseInt(process.env.PG_MAX_POOL || '10', 10),
  idleTimeoutMillis:           parseInt(process.env.PG_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis:     parseInt(process.env.PG_CONNECTION_TIMEOUT || '10000', 10),
});

pool.on('connect', () => logger.debug('Nueva conexión establecida con PostgreSQL'));
pool.on('error', (err) => logger.error('Error en cliente inactivo del pool:', err.message));

const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    logger.debug(`Query ejecutada en ${Date.now() - start}ms: ${text.substring(0, 80)}...`);
    return result;
  } catch (err) {
    logger.error(`Error en query: ${err.message} | SQL: ${text.substring(0, 120)}`);
    throw err;
  }
};

const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error(`Transacción revertida: ${err.message}`);
    throw err;
  } finally {
    client.release();
  }
};

const testConnection = async () => {
  try {
    const { rows } = await pool.query('SELECT NOW() AS tiempo, current_database() AS bd');
    logger.info(`✅ PostgreSQL conectado — BD: ${rows[0].bd} | ${rows[0].tiempo}`);
    return true;
  } catch (err) {
    logger.error(`❌ No se pudo conectar a PostgreSQL: ${err.message}`);
    return false;
  }
};

module.exports = { query, transaction, testConnection, pool };
