'use strict';
process.env.NODE_ENV = 'production';

const { execSync } = require('child_process');

console.log('Corriendo migraciones...');
execSync('npx knex migrate:latest', { stdio: 'inherit' });

console.log('Iniciando servidor...');
require('./server.js');