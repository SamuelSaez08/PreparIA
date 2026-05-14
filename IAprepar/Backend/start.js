'use strict';
process.env.NODE_ENV = 'production';

const { execSync } = require('child_process');

console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);

try {
  console.log('Corriendo migraciones...');
  execSync('npx knex migrate:latest', { stdio: 'inherit' });
  console.log('Migraciones completadas.');
} catch (err) {
  console.error('Error en migraciones:', err.message);
  process.exit(1);
}

console.log('Iniciando servidor...');
require('./server.js');