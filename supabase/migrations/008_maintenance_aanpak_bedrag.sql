-- Bedrag (SRD) toevoegen aan aanpak
ALTER TABLE maintenance_aanpak
  ADD COLUMN IF NOT EXISTS bedrag DECIMAL(12, 2);
