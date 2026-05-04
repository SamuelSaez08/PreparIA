'use strict';

const ROLES = Object.freeze({
  ADMIN:      'admin',
  ESTUDIANTE: 'estudiante',
});

const ESTADOS_INTENTO = Object.freeze({
  EN_CURSO:   'en_curso',
  COMPLETADO: 'completado',
  ABANDONADO: 'abandonado',
});

const PERIODOS_LEADERBOARD = Object.freeze({
  ALL_TIME: 'all_time',
  WEEKLY:   'weekly',
  MONTHLY:  'monthly',
});

module.exports = { ROLES, ESTADOS_INTENTO, PERIODOS_LEADERBOARD };
