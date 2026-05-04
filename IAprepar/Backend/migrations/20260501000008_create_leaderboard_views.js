'use strict';

// Vistas de leaderboard: all_time, weekly y monthly (top 100 con ranking)
exports.up = async (knex) => {
  await knex.raw(`
    -- Leaderboard general (todos los tiempos)
    CREATE OR REPLACE VIEW v_leaderboard_alltime AS
    SELECT
      ROW_NUMBER() OVER (ORDER BY us.total_points DESC, us.longest_streak DESC) AS rank_position,
      u.id          AS user_id,
      u.nombre      AS nombre,
      u.apellido    AS apellido,
      us.total_points   AS points,
      us.current_streak AS streak,
      us.longest_streak,
      us.total_simulations,
      us.avg_score
    FROM user_stats us
    JOIN usuario u ON u.id = us.user_id
    WHERE u.activo = TRUE
    ORDER BY us.total_points DESC, us.longest_streak DESC
    LIMIT 100;

    -- Leaderboard semanal
    CREATE OR REPLACE VIEW v_leaderboard_weekly AS
    SELECT
      ROW_NUMBER() OVER (ORDER BY us.weekly_points DESC, us.current_streak DESC) AS rank_position,
      u.id          AS user_id,
      u.nombre      AS nombre,
      u.apellido    AS apellido,
      us.weekly_points  AS points,
      us.current_streak AS streak,
      us.total_simulations,
      us.avg_score
    FROM user_stats us
    JOIN usuario u ON u.id = us.user_id
    WHERE u.activo = TRUE
    ORDER BY us.weekly_points DESC, us.current_streak DESC
    LIMIT 100;

    -- Leaderboard mensual
    CREATE OR REPLACE VIEW v_leaderboard_monthly AS
    SELECT
      ROW_NUMBER() OVER (ORDER BY us.monthly_points DESC, us.current_streak DESC) AS rank_position,
      u.id          AS user_id,
      u.nombre      AS nombre,
      u.apellido    AS apellido,
      us.monthly_points AS points,
      us.current_streak AS streak,
      us.total_simulations,
      us.avg_score
    FROM user_stats us
    JOIN usuario u ON u.id = us.user_id
    WHERE u.activo = TRUE
    ORDER BY us.monthly_points DESC, us.current_streak DESC
    LIMIT 100;
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    DROP VIEW IF EXISTS v_leaderboard_monthly CASCADE;
    DROP VIEW IF EXISTS v_leaderboard_weekly  CASCADE;
    DROP VIEW IF EXISTS v_leaderboard_alltime CASCADE;
  `);
};
