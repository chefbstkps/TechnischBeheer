export type Inzet = 'Dienstplaat' | 'Burgerplaat';
export type VoertuigSoort = 'Sedan' | 'Pickup' | 'SUV' | 'Station' | 'Bus' | 'Truck';
export type Transmissie = 'automaat' | 'manual';
export type Aandrijving = '4WD' | '2WD';
export type Verzekerd = 'Self-Reliance' | 'Assuria' | 'Parsasco' | 'Fatum';
export type Verzekertype = 'WA' | 'Mini Casco' | 'Casco';
export type VoertuigStatus = 'Defect' | 'Slecht' | 'Redelijk' | 'Goed';
export type ReparatieReden = 'reparatie' | 'service' | 'diagnose';
export type WerkzaamStatus = 'in behandeling' | 'afgehandeld';
export type MaintenanceStatus = 'in behandeling' | 'begrotingsfase' | 'afgehandeld';
export type MaintenanceAanpakType = 'begroting opmaken' | 'afgehandeld';
export type MaintenanceAfdeling = 'Bouw' | 'Electra' | 'Koeltechniek' | 'GaWaSa' | 'Transport';

export interface Structure {
  id: string;
  name: string;
  beschrijving?: string | null;
  created_at?: string;
}

export interface Department {
  id: string;
  structure_id: string;
  name: string;
  beschrijving?: string | null;
  created_at?: string;
}

export interface DepartmentWithStructure extends Department {
  structure?: Structure;
}

export interface Brand {
  id: string;
  name: string;
  beschrijving?: string | null;
  created_at?: string;
}

export interface Model {
  id: string;
  brand_id: string;
  name: string;
  beschrijving?: string | null;
  created_at?: string;
}

export interface ModelWithBrand extends Model {
  brand?: Brand;
}

export interface Vehicle {
  id: string;
  inzet: Inzet;
  license_plate: string;
  structure_id: string | null;
  department_id: string | null;
  merk: string;
  model: string;
  bouwjaar: number | null;
  soort: VoertuigSoort | null;
  transmissie: Transmissie | null;
  aandrijving: Aandrijving | null;
  chassisnummer: string | null;
  verzekerd: Verzekerd | null;
  verzekertype: Verzekertype | null;
  polisnummer: string | null;
  start_datum: string | null;
  eind_datum: string | null;
  opmerking: string | null;
  status: VoertuigStatus;
  created_at?: string;
  updated_at?: string;
}

export interface VehicleWithRelations extends Vehicle {
  structure?: Structure;
  department?: Department;
}

export interface Repair {
  id: string;
  vehicle_id: string;
  reden: ReparatieReden;
  datum_melding: string | null;
  melding: string | null;
  datum_aanpak: string | null;
  datum_afgehandeld: string | null;
  status: WerkzaamStatus;
  kosten_totaal: number;
  created_at?: string;
  updated_at?: string;
}

export interface RepairPart {
  id: string;
  repair_id: string;
  omschrijving: string;
  aantal: number;
  eenheid: string;
  prijs_per_stuk: number;
  created_at?: string;
}

export interface RepairWithParts extends Repair {
  repair_parts?: RepairPart[];
}

export interface MaintenanceWork {
  id: string;
  afdeling: MaintenanceAfdeling;
  structure_id: string | null;
  department_id: string | null;
  datum_melding: string;
  melding: string | null;
  datum_aanpak: string | null;
  aard_werkzaamheden: string | null;
  status: MaintenanceStatus;
  datum_afgehandeld: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MaintenanceWorkWithRelations extends MaintenanceWork {
  structure?: Structure;
  department?: Department;
}

export interface MaintenanceAanpak {
  id: string;
  maintenance_work_id: string;
  type: MaintenanceAanpakType;
  datum: string;
  beschrijving: string | null;
  bedrag: number | null;
  created_at?: string;
}

export interface Part {
  id: string;
  name: string;
  beschrijving?: string | null;
  created_at?: string;
}
