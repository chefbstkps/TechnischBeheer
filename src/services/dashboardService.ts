import { getSupabase } from '../lib/supabase';

export interface DashboardStats {
  vehiclesCount: number;
  repairsInProgress: number;
  maintenanceInProgress: number;
  totalRepairCosts: number;
}

export const DashboardService = {
  async getStats(): Promise<DashboardStats> {
    const [vehiclesRes, repairsRes, maintenanceRes, costsRes] = await Promise.all([
      getSupabase().from('vehicles').select('id', { count: 'exact', head: true }),
      getSupabase()
        .from('repairs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'in behandeling'),
      getSupabase()
        .from('maintenance_work')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'in behandeling'),
      getSupabase().from('repairs').select('kosten_totaal'),
    ]);

    const vehiclesCount = vehiclesRes.count ?? 0;
    const repairsInProgress = repairsRes.count ?? 0;
    const maintenanceInProgress = maintenanceRes.count ?? 0;
    const totalRepairCosts = (costsRes.data ?? []).reduce(
      (sum, r) => sum + (r.kosten_totaal ?? 0),
      0
    );

    return {
      vehiclesCount,
      repairsInProgress,
      maintenanceInProgress,
      totalRepairCosts,
    };
  },

  async getRecentRepairs(limit = 5) {
    const { data, error } = await getSupabase()
      .from('repairs')
      .select(
        `
        id,
        vehicle_id,
        reden,
        status,
        kosten_totaal,
        created_at,
        vehicle:vehicles(id, license_plate, merk, model)
      `
      )
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  async getRecentMaintenance(limit = 5) {
    const { data, error } = await getSupabase()
      .from('maintenance_work')
      .select(
        `
        id,
        afdeling,
        melding,
        status,
        datum_melding,
        structure:structures(name),
        department:departments(name)
      `
      )
      .order('datum_melding', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },
};
