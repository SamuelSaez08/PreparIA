'use strict';

require('dotenv').config();

const { getConnectionString, getSslConfig } = require('./src/config/dbUrl');

// Misma resolución de conexión que usa el servidor: DATABASE_URL, o el grupo
// PG*, o el grupo DB_*. El SSL se activa solo cuando el host no es local.
const base = {
  client: 'pg',
  connection: {
    connectionString: getConnectionString(),
    ssl: getSslConfig(),
  },
  pool: { min: 0, max: 10 },
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './seeds',
  },
};

module.exports = {
  development: base,
  test:        base,
  production:  base,
};
