'use strict';

// Funciones para resetear puntos semanales y mensuales (guardan snapshot antes de resetear)
exports.up = async (knex) => {
  await knex.raw(`
    -- Reset puntos semanales: guarda snapshot y pone weekly_points a 0
    CREATE OR REPLACE FUNCTION fn_reset_weekly_points() RETURNS VOID AS $$
    DECLARE
      v_label TEXT := TO_CHAR(NOW(), 'IYYY-IW');  -- año-semanaISO, ej: 2026-18
    BEGIN
      -- Guardar snapshot del ranking semanal antes de resetear
      INSERT INTO ranking_snapshots (snapshot_period, period_label, user_id, rank_position, points, streak)
      SELECT
        'weekly'::snapshot_period_enum,
        v_label,
        user_id,
        ROW_NUMBER() OVER (ORDER BY weekly_points DESC, current_streak DESC),
        weekly_points,
        current_streak
      FROM user_stats
      WHERE weekly_points > 0;

      -- Registrar transacción de reset para cada usuario con puntos
      INSERT INTO point_transactions (user_id, event_type, points, description)
      SELECT user_id, 'weekly_reset', 0,
             'Reset semanal de puntos — semana ' || v_label
      FROM user_stats
      WHERE weekly_points > 0;

      -- Resetear puntos semanales
      UPDATE user_stats SET weekly_points = 0, updated_at = NOW()
      WHERE weekly_points > 0;

      RAISE NOTICE 'Reset semanal completado para semana %', v_label;
    END;
    $$ LANGUAGE plpgsql;

    -- Reset puntos mensuales: guarda snapshot y pone monthly_points a 0
    CREATE OR REPLACE FUNCTION fn_reset_monthly_points() RETURNS VOID AS $$
    DECLARE
      v_label TEXT := TO_CHAR(NOW(), 'YYYY-MM');  -- ej: 2026-05
    BEGIN
      -- Guardar snapshot del ranking mensual antes de resetear
      INSERT INTO ranking_snapshots (snapshot_period, period_label, user_id, rank_position, points, streak)
      SELECT
        'monthly'::snapshot_period_enum,
        v_label,
        user_id,
        ROW_NUMBER() OVER (ORDER BY monthly_points DESC, current_streak DESC),
        monthly_points,
        current_streak
      FROM user_stats
      WHERE monthly_points > 0;

      -- Registrar transacción de reset para cada usuario con puntos
      INSERT INTO point_transactions (user_id, event_type, points, description)
      SELECT user_id, 'monthly_reset', 0,
             'Reset mensual de puntos — mes ' || v_label
      FROM user_stats
      WHERE monthly_points > 0;

      -- Resetear puntos mensuales
      UPDATE user_stats SET monthly_points = 0, updated_at = NOW()
      WHERE monthly_points > 0;

      RAISE NOTICE 'Reset mensual completado para mes %', v_label;
    END;
    $$ LANGUAGE plpgsql;
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    DROP FUNCTION IF EXISTS fn_reset_monthly_points();
    DROP FUNCTION IF EXISTS fn_reset_weekly_points();
  `);
};
