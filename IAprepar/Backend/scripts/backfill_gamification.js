'use strict';

require('dotenv').config({ path: __dirname + '/../.env' });
const { pool } = require('../src/config/db');

async function run() {
  try {
    console.log('Iniciando script de backfill de gamificación...');

    // 1. Procesar solo los intentos que no tienen entrada en point_transactions
    // (safe para correr múltiples veces — no duplica datos)
    console.log('Buscando simulacros completados sin gamificación...');
    const { rows: intentos } = await pool.query(`
      SELECT i.id_usuario, i.id_simulacro, i.puntaje_obtenido,
             i.finalizado_en::DATE AS fecha
      FROM intento_simulacro i
      WHERE i.estado = 'completado'
        AND NOT EXISTS (
          SELECT 1 FROM point_transactions pt
          WHERE pt.user_id    = i.id_usuario
            AND pt.event_type = 'simulation_completed'
            AND pt.reference_id = i.id_simulacro
            AND DATE(pt.created_at) = i.finalizado_en::DATE
        )
      ORDER BY i.id_usuario ASC, i.finalizado_en ASC
    `);

    console.log(`Se encontraron ${intentos.length} simulacros para backfill.`);
    if (intentos.length === 0) {
      console.log('✅ No hay datos faltantes. La gamificación está al día.');
      return;
    }

    // 2. Ejecutar fn_complete_simulation con la fecha histórica
    let procesados = 0;
    for (const intento of intentos) {
      const basePoints = Math.round(intento.puntaje_obtenido || 0);
      const isPerfect = basePoints === 100;
      await pool.query(
        `SELECT fn_complete_simulation($1, $2, $3, $4, $5)`,
        [intento.id_usuario, intento.id_simulacro, basePoints, isPerfect, intento.fecha]
      );
      procesados++;
    }

    console.log(`✅ ¡Backfill completado exitosamente! Se procesaron ${procesados} simulacros históricos.`);

    // Mostrar un resumen de los usuarios
    const { rows: stats } = await pool.query(`SELECT user_id, current_streak, total_simulations, total_points FROM user_stats ORDER BY total_points DESC LIMIT 10`);
    console.log('\nTop 10 usuarios tras el cálculo:');
    console.table(stats);

  } catch (err) {
    console.error('❌ Error en el backfill:', err);
  } finally {
    process.exit(0);
  }
}

run();
