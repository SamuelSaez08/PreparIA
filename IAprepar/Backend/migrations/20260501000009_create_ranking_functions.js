'use strict';

// Función para obtener posición exacta de un usuario sin cargar todo el leaderboard
exports.up = async (knex) => {
  await knex.raw(`
    CREATE OR REPLACE FUNCTION fn_get_user_rank(
      p_user_id INTEGER,
      p_period  TEXT  -- 'all_time', 'weekly', 'monthly'
    ) RETURNS TABLE (
      rank_position    BIGINT,
      points           INTEGER,
      streak           INTEGER,
      total_users_ranked BIGINT
    ) AS $$
    DECLARE
      v_points_col TEXT;
    BEGIN
      -- Seleccionar columna según el período
      v_points_col := CASE p_period
        WHEN 'weekly'   THEN 'weekly_points'
        WHEN 'monthly'  THEN 'monthly_points'
        ELSE                 'total_points'
      END;

      RETURN QUERY EXECUTE format('
        WITH ranking AS (
          SELECT
            us.user_id,
            us.%I          AS pts,
            us.current_streak AS str,
            ROW_NUMBER() OVER (ORDER BY us.%I DESC, us.longest_streak DESC) AS pos,
            COUNT(*) OVER () AS total
          FROM user_stats us
          JOIN usuario u ON u.id = us.user_id
          WHERE u.activo = TRUE
        )
        SELECT pos, pts::INTEGER, str, total
        FROM ranking
        WHERE user_id = $1
      ', v_points_col, v_points_col)
      USING p_user_id;
    END;
    $$ LANGUAGE plpgsql STABLE;
  `);
};

exports.down = async (knex) => {
  await knex.raw(`DROP FUNCTION IF EXISTS fn_get_user_rank(INTEGER, TEXT);`);
};
