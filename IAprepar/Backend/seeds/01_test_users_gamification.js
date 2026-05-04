'use strict';

/**
 * Seed: usuarios de prueba con datos variados de rachas y puntos.
 * IMPORTANTE: Asume que ya existen al menos 10 usuarios en la tabla `usuario`.
 * Si la tabla está vacía, este seed crea los usuarios de gamificación con IDs del 1 al 10.
 * Ejecutar DESPUÉS de correr las migraciones.
 */
exports.seed = async (knex) => {
  // Verificar cuántos usuarios existen
  const { rows } = await knex.raw('SELECT id FROM usuario ORDER BY id LIMIT 10');
  if (!rows.length) {
    console.warn('No hay usuarios en la tabla usuario. Crea usuarios primero con seed_users.js');
    return;
  }

  const userIds = rows.map(r => r.id);

  // Limpiar datos de gamificación existentes de estos usuarios
  await knex('point_transactions').whereIn('user_id', userIds).del();
  await knex('daily_activity').whereIn('user_id', userIds).del();
  await knex('streak_shields').whereIn('user_id', userIds).del();
  await knex('ranking_snapshots').whereIn('user_id', userIds).del();
  await knex('user_stats').whereIn('user_id', userIds).del();

  // Datos variados para simular diferentes perfiles de estudiantes
  const statsData = [
    { total_points: 1250, weekly_points: 180, monthly_points: 620, current_streak: 14, longest_streak: 21, avg_score: 87.5, total_simulations: 28 },
    { total_points: 980,  weekly_points: 95,  monthly_points: 410, current_streak: 7,  longest_streak: 14, avg_score: 74.2, total_simulations: 22 },
    { total_points: 2100, weekly_points: 340, monthly_points: 890, current_streak: 21, longest_streak: 42, avg_score: 92.1, total_simulations: 45 },
    { total_points: 450,  weekly_points: 60,  monthly_points: 200, current_streak: 3,  longest_streak: 7,  avg_score: 61.3, total_simulations: 12 },
    { total_points: 750,  weekly_points: 120, monthly_points: 380, current_streak: 0,  longest_streak: 10, avg_score: 68.9, total_simulations: 18 },
    { total_points: 3200, weekly_points: 420, monthly_points: 1100, current_streak: 35, longest_streak: 56, avg_score: 95.4, total_simulations: 67 },
    { total_points: 320,  weekly_points: 40,  monthly_points: 150, current_streak: 2,  longest_streak: 5,  avg_score: 55.0, total_simulations: 8  },
    { total_points: 1580, weekly_points: 220, monthly_points: 700, current_streak: 10, longest_streak: 28, avg_score: 81.7, total_simulations: 35 },
    { total_points: 890,  weekly_points: 110, monthly_points: 440, current_streak: 5,  longest_streak: 12, avg_score: 70.6, total_simulations: 20 },
    { total_points: 125,  weekly_points: 25,  monthly_points: 80,  current_streak: 1,  longest_streak: 3,  avg_score: 48.0, total_simulations: 4  },
  ];

  const today = new Date();
  const insertStats = userIds.slice(0, statsData.length).map((uid, i) => {
    const s = statsData[i];
    // Calcular last_activity_date según current_streak (0 = ayer + 2 días, >0 = hoy - 0 días para usuarios activos)
    let lastActivity = null;
    if (s.current_streak > 0) {
      lastActivity = new Date(today);
      lastActivity.setDate(lastActivity.getDate() - 1); // ayer (siguen activos)
    } else if (s.total_simulations > 0) {
      lastActivity = new Date(today);
      lastActivity.setDate(lastActivity.getDate() - 3); // hace 3 días (racha rota)
    }
    return {
      user_id:            uid,
      total_points:       s.total_points,
      weekly_points:      s.weekly_points,
      monthly_points:     s.monthly_points,
      current_streak:     s.current_streak,
      longest_streak:     s.longest_streak,
      last_activity_date: lastActivity ? lastActivity.toISOString().split('T')[0] : null,
      avg_score:          s.avg_score,
      total_simulations:  s.total_simulations,
    };
  });

  await knex('user_stats').insert(insertStats);

  // Crear actividad diaria de los últimos 7 días para los usuarios activos
  const activityInserts = [];
  for (let i = 0; i < Math.min(userIds.length, 6); i++) {
    const uid = userIds[i];
    const s = statsData[i];
    if (s.current_streak === 0) continue;
    // Insertar actividad de los últimos 5 días
    for (let d = 0; d < 5; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() - d - 1);
      activityInserts.push({
        user_id:         uid,
        activity_date:   date.toISOString().split('T')[0],
        simulations_done: Math.floor(Math.random() * 3) + 1,
        points_earned:    Math.floor(Math.random() * 50) + 20,
      });
    }
  }
  if (activityInserts.length) {
    await knex('daily_activity').insert(activityInserts);
  }

  // Dar 1 escudo a los 3 usuarios con mayor racha
  const topUsers = userIds.slice(0, 3);
  const shieldInserts = topUsers.map(uid => ({
    user_id:   uid,
    earned_at: new Date().toISOString(),
  }));
  await knex('streak_shields').insert(shieldInserts);

  // Insertar algunas transacciones de puntos de ejemplo
  const txInserts = userIds.slice(0, 5).map((uid, i) => ({
    user_id:     uid,
    event_type:  'simulation_completed',
    points:      statsData[i].total_points > 0 ? Math.min(statsData[i].total_points, 100) : 10,
    description: 'Transacción de ejemplo desde seed',
  }));
  await knex('point_transactions').insert(txInserts);

  console.log(`✅ Seed completado: gamificación inicializada para ${insertStats.length} usuarios`);
};
