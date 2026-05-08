'use strict';

// Recrea fn_complete_simulation con firma de 5 parámetros (p_date tiene DEFAULT CURRENT_DATE),
// lo que permite llamarla con 4 argumentos desde el servicio y con 5 en tests.
// Esta migración es necesaria porque 20260502000002 eliminó la versión de 4 parámetros
// sin haber creado la versión canónica de 5.
exports.up = async (knex) => {
  await knex.raw(`
    CREATE OR REPLACE FUNCTION fn_complete_simulation(
      p_user_id       INTEGER,
      p_simulation_id INTEGER,
      p_base_points   INTEGER,
      p_is_perfect    BOOLEAN,
      p_date          DATE DEFAULT CURRENT_DATE
    ) RETURNS JSONB AS $$
    DECLARE
      v_today          DATE := p_date;
      v_last_activity  DATE;
      v_current_streak INTEGER;
      v_longest_streak INTEGER;
      v_new_streak     INTEGER;
      v_streak_broke   BOOLEAN := FALSE;
      v_streak_bonus   INTEGER := 0;
      v_perfect_bonus  INTEGER := 0;
      v_total_points   INTEGER;
      v_shield_used    BOOLEAN := FALSE;
      v_shield_id      INTEGER;
      v_stats          user_stats%ROWTYPE;
    BEGIN
      -- Obtener o crear registro de stats del usuario
      INSERT INTO user_stats (user_id)
      VALUES (p_user_id)
      ON CONFLICT (user_id) DO NOTHING;

      SELECT * INTO v_stats FROM user_stats WHERE user_id = p_user_id FOR UPDATE;

      v_last_activity  := v_stats.last_activity_date;
      v_current_streak := v_stats.current_streak;
      v_longest_streak := v_stats.longest_streak;

      -- Calcular nueva racha según el último día de actividad
      IF v_last_activity IS NULL THEN
        v_new_streak   := 1;
        v_streak_broke := FALSE;

      ELSIF v_today = v_last_activity THEN
        -- Simulacro en el mismo día: racha sin cambio
        v_new_streak   := v_current_streak;
        v_streak_broke := FALSE;

      ELSIF v_today = v_last_activity + INTERVAL '1 day' THEN
        -- Día consecutivo: incrementar racha
        v_new_streak   := v_current_streak + 1;
        v_streak_broke := FALSE;

      ELSE
        -- Brecha de más de un día: buscar escudo disponible
        SELECT id INTO v_shield_id
        FROM streak_shields
        WHERE user_id = p_user_id AND used_at IS NULL
        ORDER BY earned_at ASC
        LIMIT 1;

        IF FOUND THEN
          UPDATE streak_shields
          SET used_at = NOW(), used_for_date = v_today
          WHERE id = v_shield_id;

          v_new_streak   := v_current_streak + 1;
          v_streak_broke := FALSE;
          v_shield_used  := TRUE;
        ELSE
          v_new_streak   := 1;
          v_streak_broke := TRUE;
        END IF;
      END IF;

      -- Bonus por racha múltiplo de 7 días consecutivos
      IF v_new_streak > 0 AND v_new_streak % 7 = 0 THEN
        v_streak_bonus := 20;
      END IF;

      -- Bonus por simulacro perfecto (100% de aciertos)
      IF p_is_perfect THEN
        v_perfect_bonus := 15;
      END IF;

      v_total_points := p_base_points + v_streak_bonus + v_perfect_bonus;

      -- Actualizar racha más larga si aplica
      IF v_new_streak > v_longest_streak THEN
        v_longest_streak := v_new_streak;
      END IF;

      -- Actualizar estadísticas del usuario
      UPDATE user_stats SET
        total_points       = total_points + v_total_points,
        weekly_points      = weekly_points + v_total_points,
        monthly_points     = monthly_points + v_total_points,
        current_streak     = v_new_streak,
        longest_streak     = v_longest_streak,
        last_activity_date = v_today,
        avg_score          = ROUND(
          (avg_score * total_simulations + p_base_points)::NUMERIC /
          NULLIF(total_simulations + 1, 0), 2
        ),
        total_simulations  = total_simulations + 1,
        updated_at         = NOW()
      WHERE user_id = p_user_id;

      -- Registrar actividad del día (insert o actualizar si ya hizo simulacros hoy)
      INSERT INTO daily_activity (user_id, activity_date, simulations_done, points_earned)
      VALUES (p_user_id, v_today, 1, v_total_points)
      ON CONFLICT (user_id, activity_date)
      DO UPDATE SET
        simulations_done = daily_activity.simulations_done + 1,
        points_earned    = daily_activity.points_earned + v_total_points;

      -- Registrar transacción de puntos base
      INSERT INTO point_transactions (user_id, event_type, points, reference_id, description)
      VALUES (p_user_id, 'simulation_completed', p_base_points, p_simulation_id,
              'Puntos base por completar simulacro #' || p_simulation_id);

      -- Registrar bonus de racha si aplica
      IF v_streak_bonus > 0 THEN
        INSERT INTO point_transactions (user_id, event_type, points, reference_id, description)
        VALUES (p_user_id, 'streak_bonus', v_streak_bonus, p_simulation_id,
                'Bonus por racha de ' || v_new_streak || ' días consecutivos');
      END IF;

      -- Registrar bonus de puntaje perfecto si aplica
      IF v_perfect_bonus > 0 THEN
        INSERT INTO point_transactions (user_id, event_type, points, reference_id, description)
        VALUES (p_user_id, 'perfect_score_bonus', v_perfect_bonus, p_simulation_id,
                'Bonus por simulacro con puntaje perfecto');
      END IF;

      RETURN jsonb_build_object(
        'new_streak',     v_new_streak,
        'streak_broke',   v_streak_broke,
        'streak_bonus',   v_streak_bonus,
        'perfect_bonus',  v_perfect_bonus,
        'points_earned',  v_total_points,
        'longest_streak', v_longest_streak,
        'shield_used',    v_shield_used
      );
    END;
    $$ LANGUAGE plpgsql;
  `);
};

exports.down = async (knex) => {
  await knex.raw(`DROP FUNCTION IF EXISTS fn_complete_simulation(INTEGER, INTEGER, INTEGER, BOOLEAN, DATE);`);
};
