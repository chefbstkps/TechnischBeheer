import { getSupabase } from '../lib/supabase';
import type { Part } from '../types/database';

export const PartsService = {
  async list(): Promise<Part[]> {
    const { data, error } = await getSupabase()
      .from('parts')
      .select('*')
      .order('name');
    if (error) throw error;
    return data ?? [];
  },

  async create(name: string, beschrijving?: string | null, prijs?: number | null): Promise<Part> {
    const { data, error } = await getSupabase()
      .from('parts')
      .insert({ name, beschrijving: beschrijving ?? null, prijs: prijs ?? null })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, name: string, beschrijving?: string | null, prijs?: number | null): Promise<Part> {
    const { data, error } = await getSupabase()
      .from('parts')
      .update({ name, beschrijving: beschrijving ?? null, prijs: prijs ?? null })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await getSupabase().from('parts').delete().eq('id', id);
    if (error) throw error;
  },
};
