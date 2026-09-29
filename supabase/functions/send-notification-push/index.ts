import { createAdminClient, getAuthenticatedUserId, isWebhookSecret, sendNotificationToUser } from '../_shared/push.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-student-hub-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const admin = createAdminClient();

  try {
    const payload = await req.json();

    if (isWebhookSecret(req)) {
      if (payload?.type !== 'INSERT' || payload?.table !== 'notifications' || payload?.schema !== 'public' || !payload?.record?.user_id) {
        return json({ error: 'INVALID_WEBHOOK_PAYLOAD' }, 400);
      }
      const result = await sendNotificationToUser(admin, payload.record);
      return json({ ok: true, mode: 'webhook', ...result });
    }

    const userId = await getAuthenticatedUserId(admin, req);
    if (!userId) return json({ error: 'UNAUTHORIZED' }, 401);

    if (payload?.action !== 'test') return json({ error: 'FORBIDDEN' }, 403);

    const notification = {
      id: `test-${crypto.randomUUID()}`,
      user_id: userId,
      notification_type: 'system',
      title: 'Student Hub berhasil terhubung',
      body: 'Ini adalah notifikasi tes. Push notification aktif di perangkat ini.',
      data: { url: '#/notifications', system: true },
    };
    const result = await sendNotificationToUser(admin, notification, userId);
    return json({ ok: true, mode: 'test', ...result });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
