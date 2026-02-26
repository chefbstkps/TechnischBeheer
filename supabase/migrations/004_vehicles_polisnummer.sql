-- Voeg kolom polisnummer toe aan vehicles (verzekeringssectie)
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS polisnummer TEXT;
