import { getSupabase } from '../lib/supabase';
import type {
  Repair,
  RepairPart,
  RepairWithParts,
  ReparatieReden,
} from '../types/database';

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
    return data ?? [];
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
    return data ?? [];
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
    return data;
  },

  async create(
    vehicleId: string,
    reden: ReparatieReden,
    extra?: Partial<Repair>
  ): Promise<Repair> {
    const { data, error } = await getSupabase()
      .from('repairs')
      .insert({ vehicle_id: vehicleId, reden, ...extra })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Repair>): Promise<Repair> {
    const { data, error } = await getSupabase()
      .from('repairs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
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
