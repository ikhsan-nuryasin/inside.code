import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const templatesDir = join(root, 'email-templates');
const projectRef = process.env.PROJECT_REF || 'nxjwctumtkgcyghuzfwm';
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN belum di-set. Gunakan Management API token, bukan publishable key/service key.');
  process.exit(1);
}

const files = {
  confirmation: ['Confirm sign up — Verifikasi email Inside Code', 'confirmation.html'],
  recovery: ['Reset password — Inside Code', 'recovery.html'],
  magic_link: ['Link masuk — Inside Code', 'magic_link.html'],
  email_change: ['Konfirmasi email baru — Inside Code', 'email_change.html'],
  invite: ['Undangan Inside Code', 'invite.html'],
  reauthentication: ['Kode verifikasi Inside Code — {{ .Token }}', 'reauthentication.html'],
};

const payload = {};
for (const [type, [subject, file]] of Object.entries(files)) {
  payload[`mailer_subjects_${type}`] = subject;
  payload[`mailer_templates_${type}_content`] = await readFile(resolve(templatesDir, file), 'utf8');
}

const response = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/config/auth`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});

const body = await response.text();
if (!response.ok) {
  console.error(`Gagal mengubah template Auth. HTTP ${response.status}.`);
  console.error(body.slice(0, 1200));
  process.exit(1);
}

console.log(`Supabase Auth email templates berhasil diperbarui untuk project ${projectRef}.`);
console.log('Template: confirmation, recovery, magic_link, email_change, invite, reauthentication.');
