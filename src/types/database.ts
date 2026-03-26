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
export type ActivityLogType =
  | 'repair_created'
  | 'repair_updated'
  | 'repair_status_changed'
  | 'repair_part_added'
  | 'maintenance_created'
  | 'maintenance_plan_created'
  | 'maintenance_plan_updated'
  | 'maintenance_status_changed'
  | 'vehicle_created'
  | 'vehicle_updated'
  | 'vehicle_deleted';
export type ActivityLogSubjectType = 'repair' | 'maintenance_work' | 'maintenance_aanpak' | 'vehicle';

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

export interface Rank {
  id: string;
  rang: string;
  afkorting: string;
  sort_order: number;
  created_at?: string;
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
  created_by?: AppUserSummary | null;
}

export interface AppUserSummary {
  id: string;
  username: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name: string;
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
  created_by?: AppUserSummary | null;
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
  created_by?: AppUserSummary | null;
}

export interface ActivityLogRecord {
  id: string;
  user_id: string | null;
  activity_type: ActivityLogType;
  subject_type: ActivityLogSubjectType;
  subject_id: string | null;
  subject_label: string;
  amount: number | null;
  ip_address?: string | null;
  user_agent?: string | null;
  device_type?: string | null;
  details?: Record<string, unknown> | null;
  created_at: string;
}

export interface ActivityLogEntry extends ActivityLogRecord {
  username: string;
}

export interface Part {
  id: string;
  name: string;
  beschrijving?: string | null;
  prijs?: number | null;
  created_at?: string;
}
