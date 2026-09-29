import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const DEMO_MODE = String(import.meta.env.VITE_DEMO_MODE ?? 'true').toLowerCase() === 'true';
export const AUTH_SECURITY_ENABLED = !DEMO_MODE;
export const SUPABASE_CONFIGURED = Boolean(url && key);

export const supabase: SupabaseClient | null = (!DEMO_MODE && SUPABASE_CONFIGURED) ? createClient(url as string, key as string, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;

export function requireSupabase(): SupabaseClient {
  if (DEMO_MODE) throw new Error('DEMO_MODE_ACTIVE');
  if (!supabase) throw new Error('Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY.');
  return supabase;
}
