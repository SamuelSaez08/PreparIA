'use strict';

const crypto = require('crypto');
const { getConnectionString, describir } = require('./dbUrl');

const esProduccion = process.env.NODE_ENV === 'production';
const errores = [];

// ── Base de datos ────────────────────────────────────────────────────────────
if (!getConnectionString()) {
  errores.push(
    'Configuración de base de datos. Usa UNA de estas tres opciones en tu .env:\n' +
    '        a) DATABASE_URL=postgresql://usuario:clave@host:5432/basededatos\n' +
    '        b) PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD\n' +
    '        c) DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD'
  );
}

// ── JWT ──────────────────────────────────────────────────────────────────────
if (!process.env.JWT_SECRET) {
  if (esProduccion) {
    errores.push(
      'JWT_SECRET. Genera uno con:\n' +
      '        node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  } else {
    // En desarrollo no bloqueamos el arranque: se genera un secreto temporal
    // para que el proyecto pueda ejecutarse recién clonado. Cambia en cada
    // reinicio, así que las sesiones abiertas se invalidan: es intencional.
    process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
    console.warn(
      '[env] JWT_SECRET no estaba definida. Se generó una temporal para desarrollo.\n' +
      '      Añádela a tu .env para que las sesiones sobrevivan a los reinicios.'
    );
  }
}

if (errores.length) {
  console.error('\n[env] No se puede arrancar. Falta configuración en el archivo .env:\n');
  errores.forEach((e, i) => console.error(`   ${i + 1}. ${e}\n`));
  console.error('   Plantilla completa: Backend/.env.example\n');
  process.exit(1);
}

// ── Avisos no bloqueantes ────────────────────────────────────────────────────
if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'tu_api_key_aqui') {
  console.warn(
    '[env] GEMINI_API_KEY no configurada. La aplicación arranca, pero la generación\n' +
    '      de preguntas y simulacros con IA devolverá error. Consíguela gratis en\n' +
    '      https://aistudio.google.com/apikey'
  );
}

console.log(`[env] Base de datos → ${describir()}`);

module.exports = {};
