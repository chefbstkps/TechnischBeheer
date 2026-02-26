-- Voeg kolom chassisnummer toe aan vehicles
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS chassisnummer TEXT;
