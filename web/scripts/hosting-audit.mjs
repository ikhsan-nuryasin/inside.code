import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'package.json',
  '.env.example',
  'public/manifest.webmanifest',
  'public/sw.js',
  'public/icon.svg',
  'public/icons/icon-192.png',
  'public/icons/icon-512.png',
  'vercel.json',
  'netlify.toml',
  'public/.htaccess',
  'public/_redirects',
  'public/_headers',
  'src/lib/push.ts',
  '.env.production.example',
];
const missing = required.filter((f) => !fs.existsSync(path.join(root, f)));
if (missing.length) {
  console.error('HOSTING AUDIT FAIL');
  missing.forEach((f) => console.error(`Missing: ${f}`));
  process.exit(1);
}

const source = fs.readFileSync(path.join(root, 'src/lib/supabase.ts'), 'utf8');
const env = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8'));
const secrets = /(service_role|sb_secret_|SUPABASE_SERVICE_ROLE|SUPABASE_SERVICE_KEY)/i;

const forbiddenSource = [];
for (const dir of ['src', 'public']) {
  const base = path.join(root, dir);
  if (!fs.existsSync(base)) continue;
  const files = fs.readdirSync(base, { recursive: true }).filter((f) => typeof f === 'string' && /\.(ts|tsx|js|mjs|html|json|css|md)$/.test(f));
  for (const f of files) {
    const full = path.join(base, f);
    const text = fs.readFileSync(full, 'utf8');
    if (secrets.test(text)) forbiddenSource.push(path.relative(root, full));
  }
}

const problems = [];
if (!env.includes('VITE_SUPABASE_PUBLISHABLE_KEY')) problems.push('.env.example lacks publishable key');
if (!env.includes('VITE_VAPID_PUBLIC_KEY')) problems.push('.env.example lacks VAPID public key');
if (env.includes('service_role')) problems.push('.env.example contains service_role');
if (!source.includes('VITE_SUPABASE_URL') || !source.includes('VITE_SUPABASE_PUBLISHABLE_KEY')) problems.push('Supabase client env contract missing');
const pushSource = fs.readFileSync(path.join(root, 'src/lib/push.ts'), 'utf8');
if (!pushSource.includes('PushManager') || !pushSource.includes('push_subscriptions')) problems.push('Web Push client contract missing');
if (manifest.display !== 'standalone') problems.push('PWA manifest display is not standalone');
if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) problems.push('PWA manifest icons incomplete');
if (forbiddenSource.length) problems.push(`secret-like text found in source: ${forbiddenSource.join(', ')}`);

if (problems.length) {
  console.error('HOSTING AUDIT FAIL');
  problems.forEach((p) => console.error(`- ${p}`));
  process.exit(1);
}

console.log('HOSTING AUDIT PASS');
console.log(`Required hosting files: ${required.length}`);
console.log('No client service-role/secret key detected');
console.log('PWA manifest: valid');
console.log('Web Push client: present');
