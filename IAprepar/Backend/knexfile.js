'use strict';

require('dotenv').config();

// Configuración de Knex para migraciones y seeds de PreparIA
module.exports = {
  development: {
    client: 'pg',
    connection: {
      host:     process.env.PGHOST     || 'aws-1-us-west-2.pooler.supabase.com',
      port:     parseInt(process.env.PGPORT || '6543', 10),
      database: process.env.PGDATABASE || 'postgres',
      user:     process.env.PGUSER     || 'postgres.eajateyhrufsggshxppq',
      password: process.env.PGPASSWORD || 'SamUeL#2005SaEz',
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
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './seeds',
    },
  },
};
