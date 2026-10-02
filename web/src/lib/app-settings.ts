import { requireSupabase } from './supabase';

export type AppSettings = {
  id: number;
  app_name: string;
  short_name: string;
  tagline: string;
  login_title: string;
  login_description: string;
  primary_color: string;
  logo_url: string | null;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 1,
  app_name: 'Inside Code',
  short_name: 'Inside Code',
  tagline: 'Ruang kelas mahasiswa',
  login_title: 'Semua urusan kelas, masuk dari satu akun.',
  login_description: 'Login untuk mengakses tugas, jadwal, materi, forum, kelompok, kas, bantuan, dan Pesan Cepat.',
  primary_color: '#087cf9',
  logo_url: null,
};

const CACHE_KEY = 'inside-code-app-settings';

function safeParse(value: string | null): AppSettings | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<AppSettings>;
    if (!parsed || typeof parsed !== 'object') return null;
    const primary = typeof parsed.primary_color === 'string' && /^#[0-9a-fA-F]{6}$/.test(parsed.primary_color) ? parsed.primary_color : DEFAULT_APP_SETTINGS.primary_color;
    return { ...DEFAULT_APP_SETTINGS, ...parsed, primary_color: primary, id: 1 } as AppSettings;
  } catch { return null; }
}

export function getCachedAppSettings(): AppSettings {
  try { return safeParse(localStorage.getItem(CACHE_KEY)) ?? DEFAULT_APP_SETTINGS; } catch { return DEFAULT_APP_SETTINGS; }
}

export async function getAppSettings(): Promise<AppSettings> {
  const cached = getCachedAppSettings();

  try {
    const { data, error } = await requireSupabase().from('app_settings').select('id,app_name,short_name,tagline,login_title,login_description,primary_color,logo_url').eq('id', 1).maybeSingle();
    if (error) throw error;
    const merged = { ...DEFAULT_APP_SETTINGS, ...(data ?? {}), id: 1 } as AppSettings;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(merged)); } catch { /* cache is optional */ }
    applyAppBranding(merged);
    return merged;
  } catch {
    applyAppBranding(cached);
    return cached;
  }
}

export async function isSystemAdmin(): Promise<boolean> {

  try {
    const { data, error } = await requireSupabase().rpc('is_app_admin');
    if (error) throw error;
    return Boolean(data);
  } catch { return false; }
}

function assetPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = '/storage/v1/object/public/app-assets/';
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  try { return decodeURIComponent(url.slice(idx + marker.length)).replace(/^\/+/, ''); } catch { return null; }
}

async function deleteOldLogo(url: string | null | undefined, keepUrl?: string | null): Promise<void> {
  const oldPath = assetPathFromUrl(url);
  const newPath = assetPathFromUrl(keepUrl);
  if (!oldPath || oldPath === newPath) return;
  try { await requireSupabase().storage.from('app-assets').remove([oldPath]); } catch { /* cleanup is best effort */ }
}


export async function updateAppSettings(payload: Omit<AppSettings, 'id' | 'logo_url'> & { logo_url?: string | null }): Promise<AppSettings> {

  const client = requireSupabase();
  const { data: current, error: currentError } = await client.from('app_settings').select('logo_url').eq('id', 1).maybeSingle();
  if (currentError) throw currentError;
  const { data, error } = await client.from('app_settings').update({
    app_name: payload.app_name.trim(),
    short_name: payload.short_name.trim(),
    tagline: payload.tagline.trim(),
    login_title: payload.login_title.trim(),
    login_description: payload.login_description.trim(),
    primary_color: payload.primary_color.trim(),
    logo_url: payload.logo_url ?? null,
  }).eq('id', 1).select('id,app_name,short_name,tagline,login_title,login_description,primary_color,logo_url').single();
  if (error) throw error;
  const next = data as AppSettings;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch { /* optional */ }
  applyAppBranding(next);
  await deleteOldLogo(current?.logo_url, next.logo_url);
  return next;
}

export async function uploadAppLogo(file: File): Promise<string> {
  const allowed = new Set(['image/png', 'image/jpeg', 'image/webp']);
  if (!allowed.has(file.type)) throw new Error('Logo harus PNG, JPG, atau WEBP.');
  if (file.size > 2 * 1024 * 1024) throw new Error('Ukuran logo maksimal 2 MB.');

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `branding/logo-${crypto.randomUUID()}.${ext}`;
  const storage = requireSupabase().storage.from('app-assets');
  const { error } = await storage.upload(path, file, { upsert: false, contentType: file.type, cacheControl: '3600' });
  if (error) throw error;
  const { data } = storage.getPublicUrl(path);
  return data.publicUrl;
}

export function applyAppBranding(settings: AppSettings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (/^#[0-9a-fA-F]{6}$/.test(settings.primary_color)) root.style.setProperty('--blue', settings.primary_color);
  document.title = `${settings.app_name} — ${settings.tagline}`;
  const description = document.querySelector('meta[name="description"]');
  description?.setAttribute('content', `${settings.app_name} — ${settings.tagline}`);
  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme && /^#[0-9a-fA-F]{6}$/.test(settings.primary_color)) theme.setAttribute('content', settings.primary_color);
  const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (favicon) favicon.href = settings.logo_url || '/icon.svg';
  const appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (appleIcon) appleIcon.href = settings.logo_url || '/icons/icon-192.png';
}
