import { getSupabase } from '../lib/supabase';
import type { Brand, Model } from '../types/database';

export interface CsvPreviewRow {
  merk: string;
  merkbeschrijving: string;
  model: string;
  modelbeschrijving: string;
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

  const merkIdx = colsLower.findIndex((c) => c === 'merk' || c === 'brand');
  const modelIdx = colsLower.findIndex((c) => c === 'model');
  const merkBeschrijvingIdx = colsLower.findIndex(
    (c) => c === 'merkbeschrijving' || c === 'brand_description'
  );
  const modelBeschrijvingIdx = colsLower.findIndex(
    (c) => c === 'modelbeschrijving' || c === 'model_description'
  );

  if (merkIdx < 0) {
    errors.push('Ontbrekende verplichte kolom: "merk".');
  }
  if (modelIdx < 0) {
    errors.push('Ontbrekende verplichte kolom: "model".');
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
    const merk = parts[merkIdx] ?? '';
    const model = parts[modelIdx] ?? '';
    const merkBeschrijving =
      merkBeschrijvingIdx >= 0 ? (parts[merkBeschrijvingIdx] ?? '').trim() : '';
    const modelBeschrijving =
      modelBeschrijvingIdx >= 0 ? (parts[modelBeschrijvingIdx] ?? '').trim() : '';

    if (parts.length < Math.max(merkIdx, modelIdx) + 1) {
      errors.push(
        `Rij ${lineNum}: onvoldoende kolommen (verwacht minimaal ${Math.max(merkIdx, modelIdx) + 1}, gevonden ${parts.length}).`
      );
      continue;
    }

    if (model && !merk.trim()) {
      errors.push(
        `Rij ${lineNum}: kolom "merk" is leeg, maar "model" heeft waarde "${model}". Elk model moet onder een merk vallen.`
      );
    }

    if (!merk.trim() && !model.trim()) {
      continue;
    }

    if (!merk.trim()) {
      errors.push(
        `Rij ${lineNum}: kolom "merk" is verplicht en mag niet leeg zijn${model ? ` (model "${model}" kan niet zonder merk)` : ''}.`
      );
      continue;
    }

    if (previewRows.length < maxPreview) {
      previewRows.push({
        merk: merk.trim(),
        merkbeschrijving: merkBeschrijving,
        model: model.trim(),
        modelbeschrijving: modelBeschrijving,
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

export const BrandsService = {
  async listBrands(): Promise<Brand[]> {
    const { data, error } = await getSupabase()
      .from('brands')
      .select('*')
      .order('name');
    if (error) throw error;
    return data ?? [];
  },

  async createBrand(name: string, beschrijving?: string | null): Promise<Brand> {
    const { data, error } = await getSupabase()
      .from('brands')
      .insert({ name, beschrijving: beschrijving ?? null })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateBrand(id: string, name: string, beschrijving?: string | null): Promise<Brand> {
    const { data, error } = await getSupabase()
      .from('brands')
      .update({ name, beschrijving: beschrijving ?? null })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteBrand(id: string): Promise<void> {
    const models = await this.listModels(id);
    for (const m of models) {
      await this.deleteModel(m.id);
    }
    const { error } = await getSupabase().from('brands').delete().eq('id', id);
    if (error) throw error;
  },

  async listModels(brandId?: string): Promise<Model[]> {
    let q = getSupabase().from('models').select('*').order('name');
    if (brandId) {
      q = q.eq('brand_id', brandId);
    }
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async createModel(
    brandId: string,
    name: string,
    beschrijving?: string | null
  ): Promise<Model> {
    const { data, error } = await getSupabase()
      .from('models')
      .insert({ brand_id: brandId, name, beschrijving: beschrijving ?? null })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateModel(id: string, name: string, beschrijving?: string | null): Promise<Model> {
    const { data, error } = await getSupabase()
      .from('models')
      .update({ name, beschrijving: beschrijving ?? null })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteModel(id: string): Promise<void> {
    const { error } = await getSupabase().from('models').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Import brands and models from CSV.
   * CSV format: merk,merkbeschrijving,model,modelbeschrijving (header row required)
   */
  async importFromCsv(csvContent: string): Promise<{ brands: number; models: number }> {
    const lines = csvContent.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      throw new Error('CSV moet minimaal een header en één datarij bevatten.');
    }

    const header = lines[0].toLowerCase();
    const sep = header.includes(';') ? ';' : ',';
    const cols = lines[0].split(sep).map((c) => c.trim().toLowerCase());

    const merkIdx = cols.findIndex((c) => c === 'merk' || c === 'brand');
    const modelIdx = cols.findIndex((c) => c === 'model');
    const merkBeschrijvingIdx = cols.findIndex(
      (c) => c === 'merkbeschrijving' || c === 'brand_description'
    );
    const modelBeschrijvingIdx = cols.findIndex(
      (c) => c === 'modelbeschrijving' || c === 'model_description'
    );

    if (merkIdx < 0 || modelIdx < 0) {
      throw new Error('CSV moet kolommen "merk" en "model" bevatten.');
    }

    const existingBrands = await this.listBrands();
    const brandMap = new Map<string, { id: string; beschrijving?: string }>();
    for (const b of existingBrands) {
      brandMap.set(b.name.toLowerCase(), { id: b.id, beschrijving: b.beschrijving ?? undefined });
    }

    let brandsCreated = 0;
    let modelsCreated = 0;

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(sep).map((p) => p.trim());
      const merk = parts[merkIdx]?.trim();
      const model = parts[modelIdx]?.trim();
      const merkBeschrijving =
        merkBeschrijvingIdx >= 0 ? parts[merkBeschrijvingIdx]?.trim() || undefined : undefined;
      const modelBeschrijving =
        modelBeschrijvingIdx >= 0 ? parts[modelBeschrijvingIdx]?.trim() || undefined : undefined;

      if (!merk) continue;

      let entry = brandMap.get(merk.toLowerCase());
      if (!entry) {
        const created = await this.createBrand(merk, merkBeschrijving);
        entry = { id: created.id };
        brandMap.set(merk.toLowerCase(), entry);
        brandsCreated++;
      }

      if (model) {
        await this.createModel(entry.id, model, modelBeschrijving);
        modelsCreated++;
      }
    }

    return { brands: brandsCreated, models: modelsCreated };
  },
};
