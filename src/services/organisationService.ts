import { getSupabase } from '../lib/supabase';
import type { Structure, Department, Rank } from '../types/database';

export interface CsvPreviewRow {
  structuur: string;
  structuurbeschrijving: string;
  afdeling: string;
  afdelingbeschrijving: string;
}

export interface CsvParseResult {
  valid: boolean;
  errors: string[];
  previewRows: CsvPreviewRow[];
  totalDataRows: number;
  columns: string[];
}

/**
 * Parse and validate CSV without importing.
 * Returns preview data and detailed validation errors.
 */
export function parseAndValidateCsv(csvContent: string): CsvParseResult {
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

  const structuurIdx = colsLower.findIndex((c) => c === 'structuur' || c === 'structure');
  const afdelingIdx = colsLower.findIndex((c) => c === 'afdeling' || c === 'department');
  const structuurBeschrijvingIdx = colsLower.findIndex(
    (c) => c === 'structuurbeschrijving' || c === 'structure_description'
  );
  const afdelingBeschrijvingIdx = colsLower.findIndex(
    (c) => c === 'afdelingbeschrijving' || c === 'department_description'
  );

  if (structuurIdx < 0) {
    errors.push('Ontbrekende verplichte kolom: "structuur".');
  }
  if (afdelingIdx < 0) {
    errors.push('Ontbrekende verplichte kolom: "afdeling".');
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      previewRows: [],
      totalDataRows: lines.length - 1,
      columns: cols,
    };
  }

  const previewRows: CsvPreviewRow[] = [];
  const maxPreview = 7;

  for (let i = 1; i < lines.length; i++) {
    const lineNum = i + 1;
    const parts = lines[i].split(sep).map((p) => p.trim());
    const structuur = parts[structuurIdx] ?? '';
    const afdeling = parts[afdelingIdx] ?? '';
    const structuurBeschrijving =
      structuurBeschrijvingIdx >= 0 ? (parts[structuurBeschrijvingIdx] ?? '').trim() : '';
    const afdelingBeschrijving =
      afdelingBeschrijvingIdx >= 0 ? (parts[afdelingBeschrijvingIdx] ?? '').trim() : '';

    if (parts.length < Math.max(structuurIdx, afdelingIdx) + 1) {
      errors.push(`Rij ${lineNum}: onvoldoende kolommen (verwacht minimaal ${Math.max(structuurIdx, afdelingIdx) + 1}, gevonden ${parts.length}).`);
      continue;
    }

    if (afdeling && !structuur.trim()) {
      errors.push(`Rij ${lineNum}: kolom "structuur" is leeg, maar "afdeling" heeft waarde "${afdeling}". Elke afdeling moet onder een structuur vallen.`);
    }

    if (!structuur.trim() && !afdeling.trim()) {
      continue;
    }

    if (!structuur.trim()) {
      errors.push(
        `Rij ${lineNum}: kolom "structuur" is verplicht en mag niet leeg zijn${afdeling ? ` (afdeling "${afdeling}" kan niet zonder structuur)` : ''}.`
      );
      continue;
    }

    if (previewRows.length < maxPreview) {
      previewRows.push({
        structuur: structuur.trim(),
        structuurbeschrijving: structuurBeschrijving,
        afdeling: afdeling.trim(),
        afdelingbeschrijving: afdelingBeschrijving,
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

export const OrganisationService = {
  async listStructures(): Promise<Structure[]> {
    const { data, error } = await getSupabase()
      .from('structures')
      .select('*')
      .order('name');
    if (error) throw error;
    return data ?? [];
  },

  async createStructure(name: string, beschrijving?: string | null): Promise<Structure> {
    const { data, error } = await getSupabase()
      .from('structures')
      .insert({ name, beschrijving: beschrijving ?? null })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateStructure(id: string, name: string, beschrijving?: string | null): Promise<Structure> {
    const { data, error } = await getSupabase()
      .from('structures')
      .update({ name, beschrijving: beschrijving ?? null })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteStructure(id: string): Promise<void> {
    const { error } = await getSupabase().from('structures').delete().eq('id', id);
    if (error) throw error;
  },

  async listDepartments(structureId?: string): Promise<Department[]> {
    let q = getSupabase().from('departments').select('*').order('name');
    if (structureId) {
      q = q.eq('structure_id', structureId);
    }
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async createDepartment(
    structureId: string,
    name: string,
    beschrijving?: string | null
  ): Promise<Department> {
    const { data, error } = await getSupabase()
      .from('departments')
      .insert({ structure_id: structureId, name, beschrijving: beschrijving ?? null })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateDepartment(id: string, name: string, beschrijving?: string | null): Promise<Department> {
    const { data, error } = await getSupabase()
      .from('departments')
      .update({ name, beschrijving: beschrijving ?? null })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteDepartment(id: string): Promise<void> {
    const { error } = await getSupabase().from('departments').delete().eq('id', id);
    if (error) throw error;
  },

  async listRanks(): Promise<Rank[]> {
    const { data, error } = await getSupabase()
      .from('ranks')
      .select('*')
      .order('sort_order')
      .order('rang');
    if (error) throw error;
    return data ?? [];
  },

  async createRank(rang: string, afkorting: string): Promise<Rank> {
    const { data, error } = await getSupabase()
      .from('ranks')
      .insert({
        rang: rang.trim(),
        afkorting: afkorting.trim(),
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateRank(id: string, rang: string, afkorting: string): Promise<Rank> {
    const { data, error } = await getSupabase()
      .from('ranks')
      .update({
        rang: rang.trim(),
        afkorting: afkorting.trim(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteRank(id: string): Promise<void> {
    const { error } = await getSupabase().from('ranks').delete().eq('id', id);
    if (error) throw error;
  },

  async moveRank(id: string, direction: 'up' | 'down'): Promise<void> {
    const { error } = await getSupabase().rpc('move_rank', {
      p_rank_id: id,
      p_direction: direction,
    });
    if (error) throw error;
  },

  /**
   * Import structures and departments from CSV.
   * CSV format: structuur,structuurbeschrijving,afdeling,afdelingbeschrijving (header row required)
   * structuurbeschrijving and afdelingbeschrijving are optional.
   */
  async importFromCsv(csvContent: string): Promise<{ structures: number; departments: number }> {
    const lines = csvContent.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      throw new Error('CSV moet minimaal een header en één datarij bevatten.');
    }

    const header = lines[0].toLowerCase();
    const sep = header.includes(';') ? ';' : ',';
    const cols = lines[0].split(sep).map((c) => c.trim().toLowerCase());

    const structuurIdx = cols.findIndex((c) => c === 'structuur' || c === 'structure');
    const afdelingIdx = cols.findIndex((c) => c === 'afdeling' || c === 'department');
    const structuurBeschrijvingIdx = cols.findIndex(
      (c) => c === 'structuurbeschrijving' || c === 'structure_description'
    );
    const afdelingBeschrijvingIdx = cols.findIndex(
      (c) => c === 'afdelingbeschrijving' || c === 'department_description'
    );

    if (structuurIdx < 0 || afdelingIdx < 0) {
      throw new Error('CSV moet kolommen "structuur" en "afdeling" bevatten.');
    }

    const existingStructures = await this.listStructures();
    const structureMap = new Map<string, { id: string; beschrijving?: string }>();
    for (const s of existingStructures) {
      structureMap.set(s.name.toLowerCase(), { id: s.id, beschrijving: s.beschrijving ?? undefined });
    }

    let structuresCreated = 0;
    let departmentsCreated = 0;

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(sep).map((p) => p.trim());
      const structuur = parts[structuurIdx]?.trim();
      const afdeling = parts[afdelingIdx]?.trim();
      const structuurBeschrijving =
        structuurBeschrijvingIdx >= 0 ? parts[structuurBeschrijvingIdx]?.trim() || undefined : undefined;
      const afdelingBeschrijving =
        afdelingBeschrijvingIdx >= 0 ? parts[afdelingBeschrijvingIdx]?.trim() || undefined : undefined;

      if (!structuur) continue;

      let entry = structureMap.get(structuur.toLowerCase());
      if (!entry) {
        const created = await this.createStructure(structuur, structuurBeschrijving);
        entry = { id: created.id };
        structureMap.set(structuur.toLowerCase(), entry);
        structuresCreated++;
      }

      if (afdeling) {
        await this.createDepartment(entry.id, afdeling, afdelingBeschrijving);
        departmentsCreated++;
      }
    }

    return { structures: structuresCreated, departments: departmentsCreated };
  },
};
