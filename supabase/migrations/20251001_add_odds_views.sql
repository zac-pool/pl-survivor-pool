DROP VIEW IF EXISTS public.odds_team_win_pct_latest;
DROP VIEW IF EXISTS public.odds_latest_best;
DROP VIEW IF EXISTS public.odds_latest_snapshot;

-- Latest snapshot per gameweek
CREATE VIEW public.odds_latest_snapshot AS
SELECT s.*
FROM public.odds_snapshots s
JOIN (
  SELECT gameweek, MAX(taken_at) AS max_taken
  FROM public.odds_snapshots
  GROUP BY gameweek
) m
  ON m.gameweek = s.gameweek AND m.max_taken = s.taken_at;

-- Best (max) price per event for that snapshot, with normalised win probabilities
CREATE VIEW public.odds_latest_best AS
WITH latest AS (
  SELECT id, gameweek FROM public.odds_latest_snapshot
), base AS (
  SELECT
    l.gameweek,
    go.event_id,
    go.commence_time,
    go.home_team,
    go.away_team,
    MAX(go.home_price_decimal) AS best_home,
    MAX(go.draw_price_decimal) AS best_draw,
    MAX(go.away_price_decimal) AS best_away
  FROM public.game_odds go
  JOIN latest l ON l.id = go.snapshot_id
  GROUP BY l.gameweek, go.event_id, go.commence_time, go.home_team, go.away_team
), implied AS (
  SELECT
    b.*,
    CASE WHEN b.best_home > 1 THEN 1.0 / b.best_home END AS home_implied,
    CASE WHEN b.best_draw > 1 THEN 1.0 / b.best_draw END AS draw_implied,
    CASE WHEN b.best_away > 1 THEN 1.0 / b.best_away END AS away_implied
  FROM base b
), final AS (
  SELECT
    i.*,
    (COALESCE(i.home_implied, 0) + COALESCE(i.draw_implied, 0) + COALESCE(i.away_implied, 0)) AS denom
  FROM implied i
)
SELECT
  gameweek,
  event_id,
  commence_time,
  home_team,
  away_team,
  best_home,
  best_draw,
  best_away,
  CASE WHEN denom > 0 THEN home_implied / denom END AS p_home,
  CASE WHEN denom > 0 THEN draw_implied / denom END AS p_draw,
  CASE WHEN denom > 0 THEN away_implied / denom END AS p_away
FROM final;

-- Team-centric rows with normalised win %
CREATE VIEW public.odds_team_win_pct_latest AS
WITH norm AS (
  SELECT
    gameweek, event_id, commence_time, home_team, away_team,
    best_home, best_draw, best_away,
    CASE WHEN best_home > 1 THEN 1.0 / best_home END ih,
    CASE WHEN best_draw > 1 THEN 1.0 / best_draw END id,
    CASE WHEN best_away > 1 THEN 1.0 / best_away END ia
  FROM public.odds_latest_best
), denom AS (
  SELECT *,
         (COALESCE(ih,0) + COALESCE(id,0) + COALESCE(ia,0)) AS s
  FROM norm
)
SELECT
  gameweek,
  event_id,
  commence_time,
  home_team AS team,
  away_team AS opponent,
  'H'::text AS side,
  best_home AS price_decimal,
  CASE WHEN s > 0 THEN COALESCE(ih,0)/s END AS win_pct
FROM denom
UNION ALL
SELECT
  gameweek,
  event_id,
  commence_time,
  away_team AS team,
  home_team AS opponent,
  'A'::text AS side,
  best_away AS price_decimal,
  CASE WHEN s > 0 THEN COALESCE(ia,0)/s END AS win_pct
FROM denom
ORDER BY commence_time, team;
