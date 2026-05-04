'use strict';

// Elimina el overload de 4 parámetros de fn_complete_simulation que generaba
// ambigüedad cuando el servicio llamaba con 4 args. La versión canónica es la
// de 5 parámetros (con p_date DATE DEFAULT CURRENT_DATE), que acepta llamadas
// con 4 o 5 argumentos sin ambigüedad.
exports.up = async (knex) => {
  await knex.raw(`
    DROP FUNCTION IF EXISTS fn_complete_simulation(INTEGER, INTEGER, INTEGER, BOOLEAN);
  `);
};

exports.down = async (knex) => {
  // No restaurar el overload conflictivo: su ausencia es el estado correcto.
};
