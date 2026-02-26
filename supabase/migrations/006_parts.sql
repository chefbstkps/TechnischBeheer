-- Auto-onderdelen (PartsManagement): naam + optionele beschrijving
CREATE TABLE IF NOT EXISTS parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  beschrijving TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_parts_name ON parts(name);
