'use strict';

const hasDbConfig = process.env.DATABASE_URL || (process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER && process.env.PGPASSWORD);

const missing = [];
if (!hasDbConfig) {
  missing.push('DATABASE_URL (o PGHOST, PGDATABASE, PGUSER, PGPASSWORD)');
}
if (!process.env.JWT_SECRET) {
  missing.push('JWT_SECRET');
}

if (missing.length) {
  console.error(`[env] Variables de entorno faltantes: ${missing.join(', ')}`);
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'tu_api_key_aqui') {
  console.warn('[env] GEMINI_API_KEY no configurada — la generación de IA fallará.');
}

module.exports = {};
