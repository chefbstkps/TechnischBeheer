import { getSupabase } from '../lib/supabase';
import type {
  MaintenanceWork,
  MaintenanceWorkWithRelations,
  MaintenanceAfdeling,
  MaintenanceAanpak,
  MaintenanceAanpakType,
  MaintenanceStatus,
} from '../types/database';

export const MaintenanceService = {
  async list(afdeling?: MaintenanceAfdeling): Promise<MaintenanceWorkWithRelations[]> {
    let q = getSupabase()
      .from('maintenance_work')
      .select(
        `
        *,
        structure:structures(id, name),
        department:departments(id, name, structure_id)
      `
      )
      .order('datum_melding', { ascending: false });
    if (afdeling) {
      q = q.eq('afdeling', afdeling);
    }
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string): Promise<MaintenanceWorkWithRelations | null> {
    const { data, error } = await getSupabase()
      .from('maintenance_work')
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
    return data;
  },

  async create(
    work: Omit<MaintenanceWork, 'id' | 'created_at' | 'updated_at'>
  ): Promise<MaintenanceWork> {
    const { data, error } = await getSupabase()
      .from('maintenance_work')
      .insert(work)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(
    id: string,
    updates: Partial<Omit<MaintenanceWork, 'id'>>
  ): Promise<MaintenanceWork> {
    const { data, error } = await getSupabase()
      .from('maintenance_work')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await getSupabase()
      .from('maintenance_work')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async listAanpakByWork(maintenanceWorkId: string): Promise<MaintenanceAanpak[]> {
    const { data, error } = await getSupabase()
      .from('maintenance_aanpak')
      .select('*')
      .eq('maintenance_work_id', maintenanceWorkId)
      .order('datum', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async listAanpakByWorkIds(workIds: string[]): Promise<MaintenanceAanpak[]> {
    if (workIds.length === 0) return [];
    const { data, error } = await getSupabase()
      .from('maintenance_aanpak')
      .select('*')
      .in('maintenance_work_id', workIds)
      .order('datum', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async createAanpak(
    maintenanceWorkId: string,
    type: MaintenanceAanpakType,
    datum: string,
    beschrijving: string | null,
    bedrag: number | null
  ): Promise<MaintenanceAanpak> {
    const { data: aanpak, error: insertError } = await getSupabase()
      .from('maintenance_aanpak')
      .insert({
        maintenance_work_id: maintenanceWorkId,
        type,
        datum,
        beschrijving: beschrijving?.trim() || null,
        bedrag: bedrag != null ? Number(bedrag) : null,
      })
      .select()
      .single();
    if (insertError) throw insertError;

    const newStatus: MaintenanceStatus =
      type === 'begroting opmaken' ? 'begrotingsfase' : 'afgehandeld';
    const updates: Partial<MaintenanceWork> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (type === 'afgehandeld') {
      updates.datum_afgehandeld = datum;
    }
    const { error: updateError } = await getSupabase()
      .from('maintenance_work')
      .update(updates)
      .eq('id', maintenanceWorkId);
    if (updateError) throw updateError;

    return aanpak;
  },

  async updateAanpak(
    aanpakId: string,
    updates: {
      type: MaintenanceAanpakType;
      datum: string;
      beschrijving: string | null;
      bedrag: number | null;
    }
  ): Promise<MaintenanceAanpak> {
    const { data, error } = await getSupabase()
      .from('maintenance_aanpak')
      .update({
        type: updates.type,
        datum: updates.datum,
        beschrijving: updates.beschrijving?.trim() || null,
        bedrag: updates.bedrag != null ? Number(updates.bedrag) : null,
      })
      .eq('id', aanpakId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
