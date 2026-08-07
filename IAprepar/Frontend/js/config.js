'use strict';

/* ============================================================
   PreparIA — config.js
   Cargado ANTES de api.js en cada HTML.
   Detecta automáticamente si estamos en desarrollo o producción.
   ============================================================ */
const PREPARIA_CONFIG = (() => {
  const host = window.location.hostname;

  // Detecta entorno
  const isDev = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.');

  return {
    API_BASE_URL: isDev
      ? 'http://localhost:3000/api/v1'
      : 'https://preparia.onrender.com/api/v1',
  };
})();
