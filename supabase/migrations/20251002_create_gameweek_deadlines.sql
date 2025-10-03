CREATE TABLE IF NOT EXISTS public.gameweek_deadlines (
  gameweek integer PRIMARY KEY,
  first_kickoff timestamptz NOT NULL,
  pick_deadline timestamptz NOT NULL,
  odds_refresh_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gameweek_deadlines_updated_at ON public.gameweek_deadlines;
CREATE TRIGGER gameweek_deadlines_updated_at
BEFORE UPDATE ON public.gameweek_deadlines
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
