'use strict';

/**
 * Resolución de la conexión a PostgreSQL.
 *
 * Acepta tres formas de configuración, en este orden de prioridad:
 *   1. DATABASE_URL completa            → despliegue (Render, Supabase, Neon…)
 *   2. PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD
 *   3. DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD  → instalación local
 *
 * El modo SSL deja de ser fijo: se activa solo cuando hace falta, de modo que
 * el mismo código sirve para un PostgreSQL local (que no acepta SSL) y para un
 * servicio administrado (que lo exige).
 */

const pick = (...nombres) => {
  for (const n of nombres) {
    const valor = process.env[n];
    if (valor !== undefined && String(valor).trim() !== '') return String(valor).trim();
  }
  return undefined;
};

/** Devuelve la cadena de conexión, o null si faltan datos. */
const getConnectionString = () => {
  const directa = pick('DATABASE_URL');
  if (directa) return directa;

  const host     = pick('PGHOST', 'DB_HOST');
  const database = pick('PGDATABASE', 'DB_NAME');
  const user     = pick('PGUSER', 'DB_USER');
  const password = pick('PGPASSWORD', 'DB_PASSWORD') || '';
  const port     = pick('PGPORT', 'DB_PORT') || '5432';

  if (!host || !database || !user) return null;

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
};

/** Host de la conexión resuelta (para decidir el SSL). */
const getHost = () => {
  const cadena = getConnectionString();
  if (!cadena) return null;
  try {
    return new URL(cadena).hostname;
  } catch {
    return pick('PGHOST', 'DB_HOST') || null;
  }
};

const HOSTS_LOCALES = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|host\.docker\.internal)$/i;
const VERDADEROS    = ['1', 'true', 'yes', 'si', 'sí', 'on', 'require'];

/**
 * ¿Debe usarse SSL?
 * - Si DB_SSL / PGSSL están definidas, mandan ellas.
 * - Si no, se infiere del host: local → sin SSL; remoto → con SSL.
 */
const useSsl = () => {
  const explicito = pick('DB_SSL', 'PGSSL', 'PGSSLMODE');
  if (explicito !== undefined) {
    if (explicito.toLowerCase() === 'disable') return false;
    return VERDADEROS.includes(explicito.toLowerCase());
  }
  const host = getHost();
  if (!host) return false;
  return !HOSTS_LOCALES.test(host);
};

/** Config de SSL lista para `pg` y para Knex. */
const getSslConfig = () => (useSsl() ? { rejectUnauthorized: false } : false);

/** Descripción legible para los logs, sin exponer la contraseña. */
const describir = () => {
  const cadena = getConnectionString();
  if (!cadena) return 'sin configurar';
  try {
    const u = new URL(cadena);
    return `${u.hostname}:${u.port || 5432}/${u.pathname.replace(/^\//, '')} (ssl: ${useSsl() ? 'sí' : 'no'})`;
  } catch {
    return `configuración por variables sueltas (ssl: ${useSsl() ? 'sí' : 'no'})`;
  }
};

module.exports = { getConnectionString, getSslConfig, useSsl, getHost, describir };
