-- Uitbreiden status maintenance_work met Begrotingsfase
ALTER TABLE maintenance_work
  DROP CONSTRAINT IF EXISTS maintenance_work_status_check;

ALTER TABLE maintenance_work
  ADD CONSTRAINT maintenance_work_status_check
  CHECK (status IN ('in behandeling', 'begrotingsfase', 'afgehandeld'));

-- Tabel voor Aanpak per melding
CREATE TABLE IF NOT EXISTS maintenance_aanpak (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_work_id UUID NOT NULL REFERENCES maintenance_work(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('begroting opmaken', 'afgehandeld')),
  datum DATE NOT NULL,
  beschrijving TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_maintenance_aanpak_work ON maintenance_aanpak(maintenance_work_id);
