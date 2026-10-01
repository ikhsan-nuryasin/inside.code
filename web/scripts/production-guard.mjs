import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readEnvFile(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return {};
  const out = {};
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

const fileEnv = {
  // Base .env is required for the local production check.
  // Local/mode-specific files override it in the same direction as Vite.
  ...readEnvFile('.env'),
  ...readEnvFile('.env.local'),
  ...readEnvFile('.env.production'),
  ...readEnvFile('.env.production.local'),
};
const env = { ...fileEnv, ...process.env };
const mode = String(env.VITE_DEMO_MODE ?? '').trim().toLowerCase();
const url = String(env.VITE_SUPABASE_URL ?? '').trim();
const key = String(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
const vapid = String(env.VITE_VAPID_PUBLIC_KEY ?? '').trim();
const captchaRequired = String(env.VITE_CAPTCHA_REQUIRED ?? '').trim().toLowerCase();
const turnstileSiteKey = String(env.VITE_TURNSTILE_SITE_KEY ?? '').trim();

if (mode !== 'false') {
  console.error('PRODUCTION GUARD FAIL: VITE_DEMO_MODE must be explicitly set to false for a production build.');
  process.exit(1);
}
if (!/^https:\/\/[A-Za-z0-9.-]+\.supabase\.co(?:\/.*)?$/.test(url)) {
  console.error('PRODUCTION GUARD FAIL: VITE_SUPABASE_URL must be a valid HTTPS Supabase project URL.');
  process.exit(1);
}
if (!key || /service_role|sb_secret_/i.test(key)) {
  console.error('PRODUCTION GUARD FAIL: only a Supabase publishable client key may be used in the browser build.');
  process.exit(1);
}
if (!vapid || /YOUR_VAPID_PUBLIC_KEY/i.test(vapid)) {
  console.error('PRODUCTION GUARD FAIL: VITE_VAPID_PUBLIC_KEY must be configured for system push notifications.');
  process.exit(1);
}
if (captchaRequired !== 'true') {
  console.error('PRODUCTION GUARD FAIL: VITE_CAPTCHA_REQUIRED must be explicitly set to true for a production build.');
  process.exit(1);
}
if (!turnstileSiteKey || /YOUR_TURNSTILE_SITE_KEY/i.test(turnstileSiteKey)) {
  console.error('PRODUCTION GUARD FAIL: VITE_TURNSTILE_SITE_KEY must be configured for a production build.');
  process.exit(1);
}

console.log('PRODUCTION GUARD PASS');
console.log('Demo mode: false');
console.log('Supabase URL: configured');
console.log('Publishable key: configured');
console.log('Web Push VAPID public key: configured');
console.log('CAPTCHA: required + Turnstile site key configured');
