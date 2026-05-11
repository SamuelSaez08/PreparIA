/* ============================================================
   PreparIA — app.js  (router only)
   Detecta la página actual e inicializa el módulo correspondiente.
   La lógica de cada página vive en js/pages/page-*.js.
   Usa typeof guards porque cada HTML carga solo su módulo.
   ============================================================ */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  let page = window.location.pathname.split('/').pop() || '';
  page = page.replace('.html', '').replace(/\?.*$/, '').replace(/#.*$/, '').trim();
  /* eslint-disable no-undef */
  const PAGES = {
    'index': typeof PageIndex !== 'undefined' ? PageIndex : null,
    '': typeof PageIndex !== 'undefined' ? PageIndex : null,
    'login': typeof PageLogin !== 'undefined' ? PageLogin : null,
    'registro': typeof PageRegistro !== 'undefined' ? PageRegistro : null,
    'dashboard': typeof PageDashboard !== 'undefined' ? PageDashboard : null,
    'simulacros': typeof PageSimulacros !== 'undefined' ? PageSimulacros : null,
    'estadisticas': typeof PageEstadisticas !== 'undefined' ? PageEstadisticas : null,
    'ciencias-sociales': typeof PageCienciasSociales !== 'undefined' ? PageCienciasSociales : null,
    'nodo': typeof PageNodo !== 'undefined' ? PageNodo : null,
    'ranking': { init() { /* RankingPage.init() is called by ranking.js */ } },
  };
  /* eslint-enable no-undef */

  const handler = PAGES[page];
  if (handler) handler.init();
});
