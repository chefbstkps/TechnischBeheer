-- Technisch Beheer - Initial Schema
-- Run this in Supabase SQL Editor to create the database schema

-- Organisatie: Structuren (unieke namen)
CREATE TABLE IF NOT EXISTS structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Organisatie: Afdelingen (niet uniek, vallen onder structuren)
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id UUID NOT NULL REFERENCES structures(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_departments_structure ON departments(structure_id);

-- Voertuigen (eenmalige registratie)
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inzet TEXT NOT NULL CHECK (inzet IN ('dienstplaat', 'burgerplaat')),
  license_plate TEXT NOT NULL UNIQUE,
  structure_id UUID REFERENCES structures(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  merk TEXT,
  model TEXT,
  bouwjaar INTEGER,
  soort TEXT CHECK (soort IN ('sedan', 'pickup', 'bus', 'truck')),
  transmissie TEXT CHECK (transmissie IN ('automaat', 'manual')),
  aandrijving TEXT CHECK (aandrijving IN ('4WD', '2WD')),
  verzekerd TEXT CHECK (verzekerd IN ('Self-Reliance', 'Assuria', 'Parsasco', 'Fatum')),
  verzekertype TEXT CHECK (verzekertype IN ('WA', 'Mini Casco', 'Casco')),
  start_datum DATE,
  eind_datum DATE,
  opmerking TEXT,
  status TEXT NOT NULL DEFAULT 'goed' CHECK (status IN ('defect', 'slecht', 'redelijk', 'goed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vehicles_license_plate ON vehicles(license_plate);
CREATE INDEX idx_vehicles_structure ON vehicles(structure_id);
CREATE INDEX idx_vehicles_department ON vehicles(department_id);

-- Reparaties (reden: reparatie, service, diagnose)
CREATE TABLE IF NOT EXISTS repairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  reden TEXT NOT NULL CHECK (reden IN ('reparatie', 'service', 'diagnose')),
  datum_melding DATE,
  melding TEXT,
  datum_aanpak DATE,
  datum_afgehandeld DATE,
  status TEXT NOT NULL DEFAULT 'in behandeling' CHECK (status IN ('in behandeling', 'afgehandeld')),
  kosten_totaal DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_repairs_vehicle ON repairs(vehicle_id);

-- Onderdelen per reparatie
CREATE TABLE IF NOT EXISTS repair_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_id UUID NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  omschrijving TEXT NOT NULL,
  aantal DECIMAL(10,2) DEFAULT 1,
  eenheid TEXT DEFAULT 'stuk',
  prijs_per_stuk DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_repair_parts_repair ON repair_parts(repair_id);

-- Werkzaamheden voor Bouw, Electra, Koeltechniek, GaWaSa, Transport
CREATE TABLE IF NOT EXISTS maintenance_work (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  afdeling TEXT NOT NULL CHECK (afdeling IN ('Bouw', 'Electra', 'Koeltechniek', 'GaWaSa', 'Transport')),
  structure_id UUID REFERENCES structures(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  datum_melding DATE NOT NULL,
  melding TEXT,
  datum_aanpak DATE,
  aard_werkzaamheden TEXT,
  status TEXT NOT NULL DEFAULT 'in behandeling' CHECK (status IN ('in behandeling', 'afgehandeld')),
  datum_afgehandeld DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_maintenance_work_afdeling ON maintenance_work(afdeling);
CREATE INDEX idx_maintenance_work_status ON maintenance_work(status);

-- Trigger voor kosten bij repair_parts
CREATE OR REPLACE FUNCTION update_repair_total_cost()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE repairs
  SET kosten_totaal = (
    SELECT COALESCE(SUM(aantal * prijs_per_stuk), 0)
    FROM repair_parts
    WHERE repair_id = COALESCE(NEW.repair_id, OLD.repair_id)
  ),
  updated_at = now()
  WHERE id = COALESCE(NEW.repair_id, OLD.repair_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER repair_parts_cost_trigger
AFTER INSERT OR UPDATE OR DELETE ON repair_parts
FOR EACH ROW EXECUTE FUNCTION update_repair_total_cost();

-- Enable RLS (optional, for production)
-- ALTER TABLE structures ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE repairs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE repair_parts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE maintenance_work ENABLE ROW LEVEL SECURITY;
