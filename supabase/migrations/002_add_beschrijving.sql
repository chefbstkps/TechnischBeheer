-- Add beschrijving (description) to structures and departments

ALTER TABLE structures ADD COLUMN IF NOT EXISTS beschrijving TEXT;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS beschrijving TEXT;
