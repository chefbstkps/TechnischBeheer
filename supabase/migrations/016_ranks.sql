-- Tabel voor politierangen
CREATE TABLE IF NOT EXISTS ranks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rang TEXT NOT NULL,
  afkorting TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ranks_rang_lower
  ON ranks (LOWER(rang));

CREATE UNIQUE INDEX IF NOT EXISTS idx_ranks_afkorting_lower
  ON ranks (LOWER(afkorting));
