import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.1';

type ImportCategory = 'schedule' | 'assignment' | 'material' | 'announcement' | 'other';

type ImportItem = {
  kind?: ImportCategory;
  sourceKey?: string;
  title?: string;
  sourceUrl?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  dueAt?: string | null;
  subject?: string | null;
  room?: string | null;
  data?: Record<string, unknown>;
};

type ImportBody = {
  token: string;
  sourceUrl: string;
  pageTitle?: string;
  category?: ImportCategory;
  items?: ImportItem[];
  payload?: Record<string, unknown>;
};

const MAX_BODY_BYTES = 256 * 1024;
const MAX_ITEMS = 100;
const ALLOWED_CATEGORIES = new Set<ImportCategory>([
  'schedule',
  'assignment',
  'material',
  'announcement',
  'other',
]);

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && origin.startsWith('chrome-extension://')
      ? origin
      : '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };
}

function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(origin),
  });
}

function cleanText(value: unknown, max = 500) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.slice(0, max);
}

function validIsoOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const text = cleanText(value, 80);
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeUrl(value: unknown) {
  const url = new URL(String(value));
  if (url.protocol !== 'https:') throw new Error('sourceUrl must use HTTPS');
  if (url.hostname !== 'elearning.bsi.ac.id') throw new Error('sourceUrl must be elearning.bsi.ac.id');
  return url.toString().slice(0, 2000);
}

function normalizeCategory(value: unknown): ImportCategory {
  const category = String(value ?? 'other') as ImportCategory;
  return ALLOWED_CATEGORIES.has(category) ? category : 'other';
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);

  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (contentLength > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413, origin);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'server_misconfigured' }, 500, origin);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await req.json() as Partial<ImportBody>;
    const token = cleanText(body.token, 128);
    if (!/^[A-Fa-f0-9]{64}$/.test(token)) return json({ error: 'invalid_token' }, 401, origin);

    const sourceUrl = normalizeUrl(body.sourceUrl);
    const category = normalizeCategory(body.category);
    const pageTitle = cleanText(body.pageTitle, 300) || null;
    const items = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : [];
    const payload = body.payload && typeof body.payload === 'object' ? body.payload : {};

    const tokenHash = await sha256Hex(token);
    const nowIso = new Date().toISOString();

    // Atomically claim the token. Only one concurrent request can update an
    // unused, non-expired row matching this exact hash.
    const { data: tokenRow, error: tokenClaimError } = await admin
      .from('mybest_import_tokens')
      .update({ used_at: nowIso })
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .gt('expires_at', nowIso)
      .select('id,user_id,expires_at,used_at')
      .maybeSingle();

    if (tokenClaimError) throw tokenClaimError;

    if (!tokenRow) {
      return json({ error: 'token_expired_or_used' }, 401, origin);
    }

    const userId = tokenRow.user_id as string;
    const normalizedPayload = {
      pageTitle,
      sourceUrl,
      category,
      items,
      payload,
      importedAt: nowIso,
    };
    const checksum = await sha256Hex(JSON.stringify(normalizedPayload));

    const { data: document, error: documentError } = await admin
      .from('mybest_sync_documents')
      .upsert({
        user_id: userId,
        source_url: sourceUrl,
        page_title: pageTitle,
        category,
        checksum,
        payload: normalizedPayload,
        captured_at: nowIso,
        updated_at: nowIso,
      }, { onConflict: 'user_id,source_url,checksum' })
      .select('id')
      .single();

    if (documentError) throw documentError;

    const rows = items
      .map((item, index) => {
        const kind = normalizeCategory(item.kind ?? category);
        const title = cleanText(item.title, 500) || `${pageTitle || 'MyBest'} #${index + 1}`;
        const sourceKey = cleanText(item.sourceKey, 300) || `${checksum}:${index}`;
        const itemSourceUrl = item.sourceUrl ? normalizeUrl(item.sourceUrl) : sourceUrl;
        return {
          user_id: userId,
          document_id: document.id,
          kind,
          source_key: sourceKey,
          title,
          source_url: itemSourceUrl,
          starts_at: validIsoOrNull(item.startsAt),
          ends_at: validIsoOrNull(item.endsAt),
          due_at: validIsoOrNull(item.dueAt),
          subject: cleanText(item.subject, 300) || null,
          room: cleanText(item.room, 200) || null,
          data: item.data && typeof item.data === 'object' ? item.data : {},
          captured_at: nowIso,
          updated_at: nowIso,
        };
      });

    if (rows.length) {
      const { error: itemsError } = await admin
        .from('mybest_sync_items')
        .upsert(rows, { onConflict: 'user_id,kind,source_key' });

      if (itemsError) throw itemsError;
    }

    const { error: runError } = await admin
      .from('mybest_sync_runs')
      .insert({
        user_id: userId,
        status: 'success',
        source_url: sourceUrl,
        imported_documents: 1,
        imported_items: rows.length,
      });

    if (runError) throw runError;

    return json({
      ok: true,
      documentId: document.id,
      importedItems: rows.length,
      category,
    }, 200, origin);
  } catch (error) {
    console.error('mybest-import failed', error);
    return json({ error: 'import_failed' }, 400, origin);
  }
});
