'use strict';
process.env.NODE_ENV = 'production';

const { execSync } = require('child_process');

console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);

try {
  console.log('Corriendo migraciones...');
  const output = execSync('npx knex migrate:latest', { 
    encoding: 'utf8',
    stderr: 'pipe'
  });
  console.log(output);
  console.log('Migraciones completadas.');
} catch (err) {
  console.error('STDOUT:', err.stdout);
  console.error('STDERR:', err.stderr);
  process.exit(1);
}

console.log('Iniciando servidor...');
require('./server.js');