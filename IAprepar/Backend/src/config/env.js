'use strict';

const required = ['PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'JWT_SECRET'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`[env] Variables de entorno faltantes: ${missing.join(', ')}`);
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'tu_api_key_aqui') {
  console.warn('[env] GEMINI_API_KEY no configurada — la generación de IA fallará.');
}

module.exports = {};
