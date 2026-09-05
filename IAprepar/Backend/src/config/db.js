'use strict';

const { Pool } = require('pg');
const logger   = require('../utils/logger');
const { getConnectionString, getSslConfig, describir } = require('./dbUrl');

const connectionString = getConnectionString();

if (!connectionString) {
  throw new Error(
    'No hay configuración de base de datos. Define DATABASE_URL, o el grupo ' +
    'PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD, o el grupo ' +
    'DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD en tu archivo .env'
  );
}

const pool = new Pool({
  connectionString,
  ssl:                     getSslConfig(),
  max:                     parseInt(process.env.PG_MAX_POOL || '10', 10),
  idleTimeoutMillis:       parseInt(process.env.PG_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT || '10000', 10),
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
    logger.error(`   Destino: ${describir()}`);
    if (/does not support SSL|server does not support SSL/i.test(err.message)) {
      logger.error('   Sugerencia: tu servidor no acepta SSL. Añade DB_SSL=false al archivo .env');
    }
    if (/no pg_hba\.conf entry|SSL required|no encryption/i.test(err.message)) {
      logger.error('   Sugerencia: tu servidor exige SSL. Añade DB_SSL=true al archivo .env');
    }
    if (/password authentication failed/i.test(err.message)) {
      logger.error('   Sugerencia: usuario o contraseña incorrectos en el archivo .env');
    }
    if (/ECONNREFUSED/i.test(err.message)) {
      logger.error('   Sugerencia: PostgreSQL no está corriendo, o el host/puerto no son los correctos');
    }
    return false;
  }
};

module.exports = { query, transaction, testConnection, pool };
