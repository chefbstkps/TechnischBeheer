import { getSupabase } from '../lib/supabase';
import { OrganisationService } from './organisationService';
import { ActivityLogService } from './activityLogService';
import { isValidLicensePlateFormat } from '../utils/licensePlate';
import { buildFieldChanges } from '../utils/activityLog';
import type { Vehicle, VehicleWithRelations, Inzet } from '../types/database';

export interface CsvVehiclePreviewRow {
  kenteken: string;
  inzet: string;
  merk: string;
  model: string;
  bouwjaar: string;
  structuur: string;
  afdeling: string;
  soort: string;
  status: string;
}

export interface CsvParseResult {
  valid: boolean;
  errors: string[];
  previewRows: CsvVehiclePreviewRow[];
  totalDataRows: number;
  columns: string[];
}

const VALID_INZET = ['dienstplaat', 'burgerplaat'];
const VALID_SOORT = ['sedan', 'pickup', 'suv', 'station', 'bus', 'truck'];
const VALID_STATUS = ['defect', 'slecht', 'redelijk', 'goed'];
const VALID_TRANSMISSIE = ['automaat', 'manual'];
const VALID_AANDRIJVING = ['4wd', '2wd'];
const VALID_VERZEKERD = ['self-reliance', 'assuria', 'parsasco', 'fatum'];
const VALID_VERZEKERTYPE = ['wa', 'mini casco', 'casco'];

const VEHICLE_DIFF_FIELDS = [
  { field: 'license_plate', label: 'Kenteken', getValue: (vehicle: VehicleWithRelations) => vehicle.license_plate },
  { field: 'inzet', label: 'Inzet', getValue: (vehicle: VehicleWithRelations) => vehicle.inzet },
  { field: 'merk', label: 'Merk', getValue: (vehicle: VehicleWithRelations) => vehicle.merk },
  { field: 'model', label: 'Model', getValue: (vehicle: VehicleWithRelations) => vehicle.model },
  { field: 'bouwjaar', label: 'Bouwjaar', getValue: (vehicle: VehicleWithRelations) => vehicle.bouwjaar },
  { field: 'soort', label: 'Soort', getValue: (vehicle: VehicleWithRelations) => vehicle.soort },
  { field: 'status', label: 'Status', getValue: (vehicle: VehicleWithRelations) => vehicle.status },
  {
    field: 'structure',
    label: 'Structuur',
    getValue: (vehicle: VehicleWithRelations) =>
      (vehicle.structure as { name?: string } | undefined)?.name ?? null,
  },
  {
    field: 'department',
    label: 'Afdeling',
    getValue: (vehicle: VehicleWithRelations) =>
      (vehicle.department as { name?: string } | undefined)?.name ?? null,
  },
  { field: 'chassisnummer', label: 'Chassisnummer', getValue: (vehicle: VehicleWithRelations) => vehicle.chassisnummer },
  { field: 'verzekerd', label: 'Verzekerd bij', getValue: (vehicle: VehicleWithRelations) => vehicle.verzekerd },
  { field: 'verzekertype', label: 'Verzekertype', getValue: (vehicle: VehicleWithRelations) => vehicle.verzekertype },
  { field: 'polisnummer', label: 'Polisnummer', getValue: (vehicle: VehicleWithRelations) => vehicle.polisnummer },
  { field: 'start_datum', label: 'Startdatum verzekering', getValue: (vehicle: VehicleWithRelations) => vehicle.start_datum },
  { field: 'eind_datum', label: 'Einddatum verzekering', getValue: (vehicle: VehicleWithRelations) => vehicle.eind_datum },
  { field: 'opmerking', label: 'Opmerking', getValue: (vehicle: VehicleWithRelations) => vehicle.opmerking },
];

function colIndex(colsLower: string[], ...names: string[]): number {
  for (const n of names) {
    const idx = colsLower.findIndex((c) => c === n);
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Parse and validate CSV for vehicle import without importing.
 */
export function parseAndValidateVehicleCsv(csvContent: string): CsvParseResult {
  const errors: string[] = [];
  const lines = csvContent.trim().split(/\r?\n/).filter(Boolean);

  if (lines.length === 0) {
    return {
      valid: false,
      errors: ['Het bestand is leeg.'],
      previewRows: [],
      totalDataRows: 0,
      columns: [],
    };
  }

  const headerLine = lines[0];
  const sep = headerLine.includes(';') ? ';' : ',';
  const cols = headerLine.split(sep).map((c) => c.trim());
  const colsLower = cols.map((c) => c.toLowerCase());

  const kentekenIdx = colIndex(colsLower, 'kenteken', 'license_plate');
  const inzetIdx = colIndex(colsLower, 'inzet');
  const merkIdx = colIndex(colsLower, 'merk', 'brand');
  const modelIdx = colIndex(colsLower, 'model');
  const bouwjaarIdx = colIndex(colsLower, 'bouwjaar', 'year');
  const structuurIdx = colIndex(colsLower, 'structuur', 'structure');
  const afdelingIdx = colIndex(colsLower, 'afdeling', 'department');
  const soortIdx = colIndex(colsLower, 'soort');
  const statusIdx = colIndex(colsLower, 'status');
  const transmissieIdx = colIndex(colsLower, 'transmissie');
  const aandrijvingIdx = colIndex(colsLower, 'aandrijving');
  const verzekerdIdx = colIndex(colsLower, 'verzekerd');
  const verzekertypeIdx = colIndex(colsLower, 'verzekertype');

  if (kentekenIdx < 0) errors.push('Ontbrekende verplichte kolom: "kenteken".');
  if (inzetIdx < 0) errors.push('Ontbrekende verplichte kolom: "inzet".');
  if (merkIdx < 0) errors.push('Ontbrekende verplichte kolom: "merk".');
  if (modelIdx < 0) errors.push('Ontbrekende verplichte kolom: "model".');

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      previewRows: [],
      totalDataRows: Math.max(0, lines.length - 1),
      columns: cols,
    };
  }

  const previewRows: CsvVehiclePreviewRow[] = [];
  const maxPreview = 7;

  for (let i = 1; i < lines.length; i++) {
    const lineNum = i + 1;
    const parts = lines[i].split(sep).map((p) => p.trim());
    const kenteken = (parts[kentekenIdx] ?? '').trim();
    const inzetRaw = (parts[inzetIdx] ?? '').trim().toLowerCase();
    const merk = (parts[merkIdx] ?? '').trim();
    const model = (parts[modelIdx] ?? '').trim();
    const bouwjaar = parts[bouwjaarIdx] ?? '';
    const structuur = (parts[structuurIdx] ?? '').trim();
    const afdeling = (parts[afdelingIdx] ?? '').trim();
    const soort = (parts[soortIdx] ?? '').trim();
    const status = (parts[statusIdx] ?? '').trim();
    const transmissie = parts[transmissieIdx] ?? '';
    const aandrijving = parts[aandrijvingIdx] ?? '';
    const verzekerd = (parts[verzekerdIdx] ?? '').trim();
    const verzekertype = (parts[verzekertypeIdx] ?? '').trim();

    if (!kenteken) {
      errors.push(`Rij ${lineNum}: kolom "kenteken" is verplicht en mag niet leeg zijn.`);
      continue;
    }
    if (!inzetRaw) {
      errors.push(`Rij ${lineNum}: kolom "inzet" is verplicht (Dienstplaat of Burgerplaat).`);
      continue;
    }
    if (!VALID_INZET.includes(inzetRaw)) {
      errors.push(`Rij ${lineNum}: ongeldige "inzet" "${parts[inzetIdx]}". Gebruik Dienstplaat of Burgerplaat.`);
      continue;
    }
    const inzetVal: Inzet = inzetRaw === 'dienstplaat' ? 'Dienstplaat' : 'Burgerplaat';
    if (!isValidLicensePlateFormat(kenteken, inzetVal)) {
      errors.push(
        `Rij ${lineNum}: ongeldig kenteken "${kenteken}" voor ${inzetVal} (dienstplaat: 0000-D, burgerplaat: PA-00-00 of 00-00 AP).`
      );
      continue;
    }
    if (!merk) {
      errors.push(`Rij ${lineNum}: kolom "merk" is verplicht.`);
      continue;
    }
    if (!model) {
      errors.push(`Rij ${lineNum}: kolom "model" is verplicht.`);
      continue;
    }
    if (bouwjaar && (Number.isNaN(Number(bouwjaar)) || Number(bouwjaar) < 1900 || Number(bouwjaar) > new Date().getFullYear() + 1)) {
      errors.push(`Rij ${lineNum}: ongeldig "bouwjaar" "${bouwjaar}".`);
      continue;
    }
    if (status && !VALID_STATUS.includes(status.toLowerCase())) {
      errors.push(`Rij ${lineNum}: ongeldige "status" "${status}". Geldig: Defect, Slecht, Redelijk, Goed.`);
      continue;
    }
    if (soort && !VALID_SOORT.includes(soort.toLowerCase())) {
      errors.push(`Rij ${lineNum}: ongeldige "soort" "${soort}". Geldig: Sedan, Pickup, SUV, Station, Bus, Truck.`);
      continue;
    }
    if (transmissie && !VALID_TRANSMISSIE.includes(transmissie.toLowerCase())) {
      errors.push(`Rij ${lineNum}: ongeldige "transmissie" "${transmissie}". Geldig: automaat, manual.`);
      continue;
    }
    if (aandrijving && !VALID_AANDRIJVING.includes(aandrijving.toLowerCase())) {
      errors.push(`Rij ${lineNum}: ongeldige "aandrijving" "${aandrijving}". Geldig: 4WD, 2WD.`);
      continue;
    }
    if (verzekerd && !VALID_VERZEKERD.includes(verzekerd.toLowerCase())) {
      errors.push(`Rij ${lineNum}: ongeldige "verzekerd" "${verzekerd}".`);
      continue;
    }
    if (verzekertype && !VALID_VERZEKERTYPE.includes(verzekertype.toLowerCase())) {
      errors.push(`Rij ${lineNum}: ongeldige "verzekertype" "${verzekertype}". Geldig: WA, Mini Casco, Casco.`);
      continue;
    }
    if (afdeling && !structuur) {
      errors.push(`Rij ${lineNum}: "afdeling" vereist een "structuur".`);
      continue;
    }

    if (previewRows.length < maxPreview) {
      previewRows.push({
        kenteken,
        inzet: inzetRaw === 'dienstplaat' ? 'Dienstplaat' : 'Burgerplaat',
        merk,
        model,
        bouwjaar,
        structuur,
        afdeling,
        soort: soort || '—',
        status: status || 'Goed',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    previewRows,
    totalDataRows: lines.length - 1,
    columns: cols,
  };
}

/** Supabase CHECK constraints expect lowercase for inzet, soort, status. */
function normalizeVehicleFields<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj } as Record<string, unknown>;
  if (typeof out.inzet === 'string') out.inzet = (out.inzet as string).toLowerCase();
  if (typeof out.soort === 'string' && out.soort) out.soort = (out.soort as string).toLowerCase();
  if (typeof out.status === 'string') out.status = (out.status as string).toLowerCase();
  return out as T;
}

export const VehicleService = {
  async list(): Promise<VehicleWithRelations[]> {
    const { data, error } = await getSupabase()
      .from('vehicles')
      .select(
        `
        *,
        structure:structures(id, name),
        department:departments(id, name, structure_id)
      `
      )
      .order('license_plate');
    if (error) throw error;
    const vehicles = data ?? [];
    const createdByMap = await ActivityLogService.getCreatedByMap(
      'vehicle',
      'vehicle_created',
      vehicles.map((vehicle) => vehicle.id)
    );
    return vehicles.map((vehicle) => ({
      ...vehicle,
      created_by: createdByMap[vehicle.id] ?? null,
    }));
  },

  async getById(id: string): Promise<VehicleWithRelations | null> {
    const { data, error } = await getSupabase()
      .from('vehicles')
      .select(
        `
        *,
        structure:structures(id, name),
        department:departments(id, name, structure_id)
      `
      )
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    const createdByMap = await ActivityLogService.getCreatedByMap('vehicle', 'vehicle_created', [id]);
    return {
      ...data,
      created_by: createdByMap[id] ?? null,
    };
  },

  async checkLicensePlateUnique(
    licensePlate: string,
    excludeVehicleId?: string
  ): Promise<boolean> {
    const formatted = licensePlate.trim().toUpperCase();
    let query = getSupabase()
      .from('vehicles')
      .select('id')
      .ilike('license_plate', formatted);
    if (excludeVehicleId) {
      query = query.neq('id', excludeVehicleId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return !data;
  },

  async create(vehicle: Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>): Promise<Vehicle> {
    const normalized = normalizeVehicleFields({
      ...vehicle,
      license_plate: vehicle.license_plate.trim().toUpperCase(),
    });
    const { data, error } = await getSupabase()
      .from('vehicles')
      .insert(normalized)
      .select()
      .single();
    if (error) throw error;
    const createdVehicle = await this.getById(data.id);
    await ActivityLogService.log({
      user_id: null,
      activity_type: 'vehicle_created',
      subject_type: 'vehicle',
      subject_id: data.id,
      subject_label: createdVehicle?.license_plate ?? data.license_plate,
      amount: null,
      details: {
        changes: createdVehicle
          ? VEHICLE_DIFF_FIELDS.map((field) => ({
              field: field.field,
              label: field.label,
              before: null,
              after: field.getValue(createdVehicle),
            }))
          : null,
      },
    }).catch(() => undefined);
    return data;
  },

  async update(
    id: string,
    updates: Partial<Omit<Vehicle, 'id'>>
  ): Promise<Vehicle> {
    const before = await this.getById(id);
    const payload = normalizeVehicleFields({
      ...updates,
      updated_at: new Date().toISOString(),
    } as Partial<Vehicle>);
    if (updates.license_plate) {
      payload.license_plate = updates.license_plate.trim().toUpperCase();
    }
    const { data, error } = await getSupabase()
      .from('vehicles')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    const after = await this.getById(id);
    if (before && after) {
      const changes = buildFieldChanges(before, after, VEHICLE_DIFF_FIELDS);
      if (changes.length > 0) {
        await ActivityLogService.log({
          user_id: null,
          activity_type: 'vehicle_updated',
          subject_type: 'vehicle',
          subject_id: id,
          subject_label: after.license_plate,
          amount: null,
          details: { changes },
        }).catch(() => undefined);
      }
    }
    return data;
  },

  async delete(id: string): Promise<void> {
    const vehicle = await this.getById(id);
    const { error } = await getSupabase().from('vehicles').delete().eq('id', id);
    if (error) throw error;
    if (vehicle) {
      await ActivityLogService.log({
        user_id: null,
        activity_type: 'vehicle_deleted',
        subject_type: 'vehicle',
        subject_id: id,
        subject_label: vehicle.license_plate,
        amount: null,
        details: {
          snapshot: {
            kenteken: vehicle.license_plate,
            merk: vehicle.merk,
            model: vehicle.model,
            status: vehicle.status,
          },
        },
      }).catch(() => undefined);
    }
  },

  /**
   * Import vehicles from CSV.
   * CSV format: kenteken,inzet,merk,model,bouwjaar,structuur,afdeling,soort,status,... (header required)
   * Structuur and afdeling are matched by name; they must already exist.
   */
  async importFromCsv(csvContent: string): Promise<{ vehicles: number }> {
    const lines = csvContent.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      throw new Error('CSV moet minimaal een header en één datarij bevatten.');
    }

    const header = lines[0];
    const sep = header.includes(';') ? ';' : ',';
    const cols = header.split(sep).map((c) => c.trim().toLowerCase());

    const colIdx = (names: string[]) => {
      for (const n of names) {
        const i = cols.findIndex((c) => c === n);
        if (i >= 0) return i;
      }
      return -1;
    };

    const kentekenIdx = colIdx(['kenteken', 'license_plate']);
    const inzetIdx = colIdx(['inzet']);
    const merkIdx = colIdx(['merk', 'brand']);
    const modelIdx = colIdx(['model']);
    const bouwjaarIdx = colIdx(['bouwjaar', 'year']);
    const structuurIdx = colIdx(['structuur', 'structure']);
    const afdelingIdx = colIdx(['afdeling', 'department']);
    const soortIdx = colIdx(['soort']);
    const statusIdx = colIdx(['status']);
    const transmissieIdx = colIdx(['transmissie']);
    const aandrijvingIdx = colIdx(['aandrijving']);
    const chassisnummerIdx = colIdx(['chassisnummer']);
    const verzekerdIdx = colIdx(['verzekerd']);
    const verzekertypeIdx = colIdx(['verzekertype']);
    const polisnummerIdx = colIdx(['polisnummer']);
    const startDatumIdx = colIdx(['start_datum', 'startdatum']);
    const eindDatumIdx = colIdx(['eind_datum', 'einddatum']);
    const opmerkingIdx = colIdx(['opmerking']);

    if (kentekenIdx < 0 || inzetIdx < 0 || merkIdx < 0 || modelIdx < 0) {
      throw new Error('CSV moet kolommen "kenteken", "inzet", "merk" en "model" bevatten.');
    }

    const structures = await OrganisationService.listStructures();
    const departments = await OrganisationService.listDepartments();
    const structureByName = new Map<string, string>();
    for (const s of structures) {
      structureByName.set(s.name.toLowerCase(), s.id);
    }
    const deptByKey = new Map<string, string>();
    for (const d of departments) {
      const sName = structures.find((x) => x.id === d.structure_id)?.name?.toLowerCase() ?? '';
      deptByKey.set(`${sName}:${d.name.toLowerCase()}`, d.id);
    }

    let created = 0;
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(sep).map((p) => p.trim());
      const kenteken = (parts[kentekenIdx] ?? '').trim().toUpperCase();
      const inzetRaw = (parts[inzetIdx] ?? '').trim().toLowerCase();
      const merk = (parts[merkIdx] ?? '').trim();
      const model = (parts[modelIdx] ?? '').trim();
      const bouwjaarStr = parts[bouwjaarIdx] ?? '';
      const structuur = (parts[structuurIdx] ?? '').trim();
      const afdeling = (parts[afdelingIdx] ?? '').trim();

      if (!kenteken || !merk || !model) continue;
      const inzet: Inzet = inzetRaw === 'dienstplaat' ? 'Dienstplaat' : 'Burgerplaat';
      if (!isValidLicensePlateFormat(kenteken, inzet)) continue;

      const existing = await this.checkLicensePlateUnique(kenteken);
      if (!existing) continue;

      let structureId: string | null = null;
      let departmentId: string | null = null;
      if (structuur) {
        structureId = structureByName.get(structuur.toLowerCase()) ?? null;
        if (afdeling && structureId) {
          const key = `${structuur.toLowerCase()}:${afdeling.toLowerCase()}`;
          departmentId = deptByKey.get(key) ?? null;
        }
      }

      const bouwjaar = bouwjaarStr && !Number.isNaN(Number(bouwjaarStr)) ? Number(bouwjaarStr) : null;
      const soortVal = (parts[soortIdx] ?? '').trim();
      const soort = soortVal && VALID_SOORT.includes(soortVal.toLowerCase())
        ? (soortVal.toLowerCase() as Vehicle['soort'])
        : null;
      const statusVal = (parts[statusIdx] ?? '').trim();
      const status =
        statusVal && VALID_STATUS.includes(statusVal.toLowerCase())
          ? (statusVal.charAt(0).toUpperCase() + statusVal.slice(1).toLowerCase() as Vehicle['status'])
          : 'Goed';
      const transmissieVal = parts[transmissieIdx];
      const transmissie =
        transmissieVal && VALID_TRANSMISSIE.includes((transmissieVal as string).toLowerCase())
          ? ((transmissieVal as string).toLowerCase() as Vehicle['transmissie'])
          : null;
      const aandrijvingVal = parts[aandrijvingIdx];
      const aandrijving =
        aandrijvingVal && VALID_AANDRIJVING.includes((aandrijvingVal as string).toLowerCase())
          ? ((aandrijvingVal as string).toUpperCase() as Vehicle['aandrijving'])
          : null;
      const verzekerdVal = (parts[verzekerdIdx] ?? '').trim();
      const verzekerdMap: Record<string, Vehicle['verzekerd']> = {
        'self-reliance': 'Self-Reliance',
        assuria: 'Assuria',
        parsasco: 'Parsasco',
        fatum: 'Fatum',
      };
      const verzekerd = verzekerdVal ? verzekerdMap[verzekerdVal.toLowerCase()] ?? null : null;
      const verzekertypeVal = (parts[verzekertypeIdx] ?? '').trim().toLowerCase();
      const verzekertype =
        verzekertypeVal && VALID_VERZEKERTYPE.includes(verzekertypeVal)
          ? (verzekertypeVal === 'wa'
              ? 'WA'
              : verzekertypeVal === 'mini casco'
                ? 'Mini Casco'
                : 'Casco')
          : null;

      const chassisnummer = (parts[chassisnummerIdx] ?? '').trim() || null;
      const polisnummer = (parts[polisnummerIdx] ?? '').trim() || null;
      const startDatum = (parts[startDatumIdx] ?? '').trim() || null;
      const eindDatum = (parts[eindDatumIdx] ?? '').trim() || null;
      const opmerking = (parts[opmerkingIdx] ?? '').trim() || null;

      await this.create({
        inzet,
        license_plate: kenteken,
        structure_id: structureId,
        department_id: departmentId,
        merk,
        model,
        bouwjaar,
        soort,
        transmissie,
        aandrijving,
        chassisnummer,
        verzekerd,
        verzekertype,
        polisnummer,
        start_datum: startDatum || null,
        eind_datum: eindDatum || null,
        opmerking,
        status,
      });
      created++;
    }

    return { vehicles: created };
  },
};
