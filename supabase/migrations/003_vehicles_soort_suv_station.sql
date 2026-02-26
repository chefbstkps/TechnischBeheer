-- Voeg SUV en Station toe aan toegestane voertuigsoorten
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_soort_check;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_soort_check
  CHECK (soort IS NULL OR soort IN ('sedan', 'pickup', 'bus', 'truck', 'suv', 'station'));
