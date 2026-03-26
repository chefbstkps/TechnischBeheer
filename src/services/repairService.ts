import { getSupabase } from '../lib/supabase';
import { ActivityLogService } from './activityLogService';
import { buildFieldChanges } from '../utils/activityLog';
import type {
  Repair,
  RepairPart,
  RepairWithParts,
  ReparatieReden,
} from '../types/database';

type RepairWithVehicle = RepairWithParts & { vehicle?: { id: string; license_plate: string } | { id: string; license_plate: string }[] };

const REPAIR_DIFF_FIELDS = [
  { field: 'datum_melding', label: 'Datum melding', getValue: (repair: Repair) => repair.datum_melding },
  { field: 'reden', label: 'Werkzaamheden', getValue: (repair: Repair) => repair.reden },
  { field: 'melding', label: 'Beschrijving', getValue: (repair: Repair) => repair.melding },
  { field: 'status', label: 'Status', getValue: (repair: Repair) => repair.status },
  { field: 'datum_aanpak', label: 'Datum aanpak', getValue: (repair: Repair) => repair.datum_aanpak },
  { field: 'datum_afgehandeld', label: 'Datum afgehandeld', getValue: (repair: Repair) => repair.datum_afgehandeld },
];

async function getRepairWithVehicle(repairId: string): Promise<RepairWithVehicle | null> {
  const { data, error } = await getSupabase()
    .from('repairs')
    .select(
      `
        *,
        repair_parts(*),
        vehicle:vehicles(id, license_plate)
      `
    )
    .eq('id', repairId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function resolveVehicle(repair: RepairWithVehicle | null | undefined) {
  if (!repair?.vehicle) return null;
  return Array.isArray(repair.vehicle) ? repair.vehicle[0] ?? null : repair.vehicle;
}

function getRepairSubjectLabel(repair: Repair, licensePlate: string | null | undefined): string {
  return [licensePlate ?? 'Onbekend voertuig', repair.reden].filter(Boolean).join(' · ');
}

export const RepairService = {
  /** Alle reparaties met voertuiginformatie (license_plate) voor overzichtspagina. */
  async listAll(): Promise<(RepairWithParts & { vehicle?: { id: string; license_plate: string } })[]> {
    const { data, error } = await getSupabase()
      .from('repairs')
      .select(
        `
        *,
        repair_parts(*),
        vehicle:vehicles(id, license_plate)
      `
      )
      .order('created_at', { ascending: false });
    if (error) throw error;
    const repairs = data ?? [];
    const createdByMap = await ActivityLogService.getCreatedByMap(
      'repair',
      'repair_created',
      repairs.map((repair) => repair.id)
    );
    return repairs.map((repair) => ({
      ...repair,
      created_by: createdByMap[repair.id] ?? null,
    }));
  },

  async listByVehicle(vehicleId: string): Promise<RepairWithParts[]> {
    const { data, error } = await getSupabase()
      .from('repairs')
      .select(
        `
        *,
        repair_parts(*)
      `
      )
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const repairs = data ?? [];
    const createdByMap = await ActivityLogService.getCreatedByMap(
      'repair',
      'repair_created',
      repairs.map((repair) => repair.id)
    );
    return repairs.map((repair) => ({
      ...repair,
      created_by: createdByMap[repair.id] ?? null,
    }));
  },

  async getById(id: string): Promise<RepairWithParts | null> {
    const { data, error } = await getSupabase()
      .from('repairs')
      .select(
        `
        *,
        repair_parts(*)
      `
      )
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    const createdByMap = await ActivityLogService.getCreatedByMap('repair', 'repair_created', [id]);
    return {
      ...data,
      created_by: createdByMap[id] ?? null,
    };
  },

  async create(
    vehicleId: string,
    reden: ReparatieReden,
    extra?: Partial<Repair>,
    options?: { source?: 'VehicleDetail' | 'Repairs' }
  ): Promise<Repair> {
    const { data, error } = await getSupabase()
      .from('repairs')
      .insert({ vehicle_id: vehicleId, reden, ...extra })
      .select()
      .single();
    if (error) throw error;
    const repairWithVehicle = await getRepairWithVehicle(data.id);
    const vehicle = resolveVehicle(repairWithVehicle);
    await ActivityLogService.log({
      user_id: null,
      activity_type: 'repair_created',
      subject_type: 'repair',
      subject_id: data.id,
      subject_label: getRepairSubjectLabel(data, vehicle?.license_plate),
      amount: Number(data.kosten_totaal ?? 0),
      details: {
        source: options?.source ?? null,
        reden: data.reden,
        datum_melding: data.datum_melding,
        melding: data.melding,
        voertuig: vehicle?.license_plate ?? null,
      },
    }).catch(() => undefined);
    return data;
  },

  async update(id: string, updates: Partial<Repair>): Promise<Repair> {
    const before = await getRepairWithVehicle(id);
    const { data, error } = await getSupabase()
      .from('repairs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    const after = await getRepairWithVehicle(id);
    if (before && after) {
      const allChanges = buildFieldChanges(before, after, REPAIR_DIFF_FIELDS);
      const statusChanges = allChanges.filter((change) =>
        ['status', 'datum_aanpak', 'datum_afgehandeld'].includes(change.field)
      );
      const detailChanges = allChanges.filter(
        (change) => !['status', 'datum_aanpak', 'datum_afgehandeld'].includes(change.field)
      );
      const vehicle = resolveVehicle(after);
      const subjectLabel = getRepairSubjectLabel(after, vehicle?.license_plate);

      if (detailChanges.length > 0) {
        await ActivityLogService.log({
          user_id: null,
          activity_type: 'repair_updated',
          subject_type: 'repair',
          subject_id: id,
          subject_label: subjectLabel,
          amount: Number(after.kosten_totaal ?? 0),
          details: { changes: detailChanges },
        }).catch(() => undefined);
      }

      const beforeStatus = before.status;
      const afterStatus = after.status;
      if (beforeStatus !== afterStatus) {
        await ActivityLogService.log({
          user_id: null,
          activity_type: 'repair_status_changed',
          subject_type: 'repair',
          subject_id: id,
          subject_label: subjectLabel,
          amount: Number(after.kosten_totaal ?? 0),
          details: {
            from_status: beforeStatus,
            to_status: afterStatus,
            changes: statusChanges,
          },
        }).catch(() => undefined);
      }
    }
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await getSupabase().from('repairs').delete().eq('id', id);
    if (error) throw error;
  },

  async addPart(
    repairId: string,
    part: Omit<RepairPart, 'id' | 'repair_id' | 'created_at'>
  ): Promise<RepairPart> {
    const { data, error } = await getSupabase()
      .from('repair_parts')
      .insert({ repair_id: repairId, ...part })
      .select()
      .single();
    if (error) throw error;
    const repair = await getRepairWithVehicle(repairId);
    const vehicle = resolveVehicle(repair);
    await ActivityLogService.log({
      user_id: null,
      activity_type: 'repair_part_added',
      subject_type: 'repair',
      subject_id: repairId,
      subject_label: repair ? getRepairSubjectLabel(repair, vehicle?.license_plate) : vehicle?.license_plate ?? 'Onbekend voertuig',
      amount: Number(part.aantal) * Number(part.prijs_per_stuk),
      details: {
        onderdeel: data.omschrijving,
        aantal: data.aantal,
        eenheid: data.eenheid,
        prijs_per_stuk: data.prijs_per_stuk,
        reparatie_totaal: repair?.kosten_totaal != null ? Number(repair.kosten_totaal) : null,
      },
    }).catch(() => undefined);
    return data;
  },

  async updatePart(
    id: string,
    updates: Partial<Omit<RepairPart, 'id' | 'repair_id'>>
  ): Promise<RepairPart> {
    const { data, error } = await getSupabase()
      .from('repair_parts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deletePart(id: string): Promise<void> {
    const { error } = await getSupabase()
      .from('repair_parts')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getTotalCostByVehicle(vehicleId: string): Promise<number> {
    const { data, error } = await getSupabase()
      .from('repairs')
      .select('kosten_totaal')
      .eq('vehicle_id', vehicleId);
    if (error) throw error;
    const total = (data ?? []).reduce((sum, r) => sum + (r.kosten_totaal ?? 0), 0);
    return total;
  },

  /** Totale reparatiekosten per voertuig (vehicle_id -> totaal). Eén query voor alle voertuigen. */
  async getTotalCostsByVehicle(): Promise<Record<string, number>> {
    const { data, error } = await getSupabase()
      .from('repairs')
      .select('vehicle_id, kosten_totaal');
    if (error) throw error;
    const map: Record<string, number> = {};
    for (const row of data ?? []) {
      const id = row.vehicle_id as string;
      map[id] = (map[id] ?? 0) + (Number(row.kosten_totaal) ?? 0);
    }
    return map;
  },
};
