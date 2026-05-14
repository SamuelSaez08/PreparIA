'use strict';

require('dotenv').config();

// Configuración de Knex para migraciones y seeds de PreparIA
module.exports = {
  development: {
    client: 'pg',
    connection: {
      host:     process.env.PGHOST,
      port:     parseInt(process.env.PGPORT || '6543', 10),
      database: process.env.PGDATABASE,
      user:     process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl:      { rejectUnauthorized: false },
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './seeds',
    },
  },
  production: {
    client: 'pg',
    connection: { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './seeds',
    },
  },
};
