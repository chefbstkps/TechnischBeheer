import { getSupabase } from '../lib/supabase';
import { ActivityLogService } from './activityLogService';
import { buildFieldChanges } from '../utils/activityLog';
import type {
  MaintenanceWork,
  MaintenanceWorkWithRelations,
  MaintenanceAfdeling,
  MaintenanceAanpak,
  MaintenanceAanpakType,
  MaintenanceStatus,
} from '../types/database';

const AANPAK_DIFF_FIELDS = [
  { field: 'type', label: 'Aanpak', getValue: (aanpak: MaintenanceAanpak) => aanpak.type },
  { field: 'datum', label: 'Datum', getValue: (aanpak: MaintenanceAanpak) => aanpak.datum },
  { field: 'beschrijving', label: 'Beschrijving', getValue: (aanpak: MaintenanceAanpak) => aanpak.beschrijving },
  { field: 'bedrag', label: 'Bedrag', getValue: (aanpak: MaintenanceAanpak) => aanpak.bedrag },
];

function getWorkLabel(work: MaintenanceWork | null | undefined): string {
  if (!work) return 'Onbekende melding';
  return [work.afdeling, work.datum_melding].filter(Boolean).join(' · ');
}

async function getLatestAanpakByWorkId(workId: string): Promise<MaintenanceAanpak | null> {
  const { data, error } = await getSupabase()
    .from('maintenance_aanpak')
    .select('*')
    .eq('maintenance_work_id', workId)
    .order('datum', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function syncMaintenanceWorkStatus(workId: string): Promise<MaintenanceWorkWithRelations | null> {
  const latestAanpak = await getLatestAanpakByWorkId(workId);
  if (!latestAanpak) {
    return MaintenanceService.getById(workId);
  }

  const newStatus: MaintenanceStatus =
    latestAanpak.type === 'begroting opmaken' ? 'begrotingsfase' : 'afgehandeld';
  const updates: Partial<MaintenanceWork> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
    datum_afgehandeld: latestAanpak.type === 'afgehandeld' ? latestAanpak.datum : null,
    datum_aanpak: latestAanpak.datum,
  };

  const { error } = await getSupabase()
    .from('maintenance_work')
    .update(updates)
    .eq('id', workId);
  if (error) throw error;

  return MaintenanceService.getById(workId);
}

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
    await ActivityLogService.log({
      user_id: null,
      activity_type: 'maintenance_created',
      subject_type: 'maintenance_work',
      subject_id: data.id,
      subject_label: getWorkLabel(data),
      amount: null,
      details: {
        afdeling: data.afdeling,
        datum_melding: data.datum_melding,
        melding: data.melding,
      },
    }).catch(() => undefined);
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
    const aanpakList = data ?? [];
    const createdByMap = await ActivityLogService.getCreatedByMap(
      'maintenance_aanpak',
      'maintenance_plan_created',
      aanpakList.map((aanpak) => aanpak.id)
    );
    return aanpakList.map((aanpak) => ({
      ...aanpak,
      created_by: createdByMap[aanpak.id] ?? null,
    }));
  },

  async listAanpakByWorkIds(workIds: string[]): Promise<MaintenanceAanpak[]> {
    if (workIds.length === 0) return [];
    const { data, error } = await getSupabase()
      .from('maintenance_aanpak')
      .select('*')
      .in('maintenance_work_id', workIds)
      .order('datum', { ascending: false });
    if (error) throw error;
    const aanpakList = data ?? [];
    const createdByMap = await ActivityLogService.getCreatedByMap(
      'maintenance_aanpak',
      'maintenance_plan_created',
      aanpakList.map((aanpak) => aanpak.id)
    );
    return aanpakList.map((aanpak) => ({
      ...aanpak,
      created_by: createdByMap[aanpak.id] ?? null,
    }));
  },

  async createAanpak(
    maintenanceWorkId: string,
    type: MaintenanceAanpakType,
    datum: string,
    beschrijving: string | null,
    bedrag: number | null
  ): Promise<MaintenanceAanpak> {
    const beforeWork = await this.getById(maintenanceWorkId);
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

    const afterWork = await syncMaintenanceWorkStatus(maintenanceWorkId);
    const subjectLabel = getWorkLabel(afterWork ?? beforeWork);

    await ActivityLogService.log({
      user_id: null,
      activity_type: 'maintenance_plan_created',
      subject_type: 'maintenance_aanpak',
      subject_id: aanpak.id,
      subject_label: subjectLabel,
      amount: aanpak.bedrag != null ? Number(aanpak.bedrag) : null,
      details: {
        aanpak: aanpak.type,
        datum: aanpak.datum,
        beschrijving: aanpak.beschrijving,
        bedrag: aanpak.bedrag != null ? Number(aanpak.bedrag) : null,
      },
    }).catch(() => undefined);

    if (beforeWork?.status !== afterWork?.status) {
      await ActivityLogService.log({
        user_id: null,
        activity_type: 'maintenance_status_changed',
        subject_type: 'maintenance_work',
        subject_id: maintenanceWorkId,
        subject_label: subjectLabel,
        amount: aanpak.bedrag != null ? Number(aanpak.bedrag) : null,
        details: {
          from_status: beforeWork?.status ?? null,
          to_status: afterWork?.status ?? null,
        },
      }).catch(() => undefined);
    }

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
    const { data: beforeAanpak, error: beforeError } = await getSupabase()
      .from('maintenance_aanpak')
      .select('*')
      .eq('id', aanpakId)
      .single();
    if (beforeError) throw beforeError;

    const beforeWork = await this.getById(beforeAanpak.maintenance_work_id);
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
    const afterWork = await syncMaintenanceWorkStatus(data.maintenance_work_id);
    const changes = buildFieldChanges(beforeAanpak, data, AANPAK_DIFF_FIELDS);
    const subjectLabel = getWorkLabel(afterWork ?? beforeWork);

    if (changes.length > 0) {
      await ActivityLogService.log({
        user_id: null,
        activity_type: 'maintenance_plan_updated',
        subject_type: 'maintenance_aanpak',
        subject_id: aanpakId,
        subject_label: subjectLabel,
        amount: data.bedrag != null ? Number(data.bedrag) : null,
        details: { changes },
      }).catch(() => undefined);
    }

    if (beforeWork?.status !== afterWork?.status) {
      await ActivityLogService.log({
        user_id: null,
        activity_type: 'maintenance_status_changed',
        subject_type: 'maintenance_work',
        subject_id: data.maintenance_work_id,
        subject_label: subjectLabel,
        amount: data.bedrag != null ? Number(data.bedrag) : null,
        details: {
          from_status: beforeWork?.status ?? null,
          to_status: afterWork?.status ?? null,
        },
      }).catch(() => undefined);
    }

    return data;
  },
};
