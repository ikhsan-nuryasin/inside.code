import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = rel => fs.readFileSync(path.resolve(root, rel), 'utf8');
const exists = rel => fs.existsSync(path.resolve(root, rel));
const problems = [];

const auth = read('src/pages/AuthPage.tsx');
const captcha = read('src/lib/captcha.ts');
const widget = read('src/components/TurnstileCaptcha.tsx');
const app = read('src/App.tsx');
const shell = read('src/components/AppShell.tsx');
const security = read('src/pages/SecurityPage.tsx');
const mfa = read('src/pages/MfaChallengePage.tsx');
const guard = read('scripts/production-guard.mjs');

for (const rel of [
  'src/pages/AuthPage.tsx','src/lib/captcha.ts','src/lib/auth-guard.ts',
  'src/components/TurnstileCaptcha.tsx','src/pages/SecurityPage.tsx',
  'src/pages/MfaChallengePage.tsx','vercel.json','netlify.toml','public/_headers','public/.htaccess'
]) if (!exists(rel)) problems.push(`Missing security file: ${rel}`);

for (const token of ['TurnstileCaptcha','captchaToken','signInWithPassword','signUp','resetPasswordForEmail']) {
  if (!auth.includes(token)) problems.push(`Auth protection missing: ${token}`);
}
for (const token of ['CAPTCHA_REQUIRED','TURNSTILE_SITE_KEY','loadTurnstileScript','render']) {
  if (!captcha.includes(token) && !widget.includes(token)) problems.push(`CAPTCHA component missing: ${token}`);
}
if (!app.includes('MfaGateApp') || !app.includes('mfa.getAuthenticatorAssuranceLevel') || !app.includes('MfaChallengePage')) problems.push('MFA gate missing');
if (!security.includes('mfa.enroll') || !security.includes('mfa.unenroll')) problems.push('MFA management missing');
if (!mfa.includes('mfa.verify')) problems.push('MFA challenge verification missing');
if (!shell.includes("['security','Keamanan','shield']") || !shell.includes("case'shield'")) problems.push('Security navigation missing');
for (const rel of ['.env.example','.env.production.example']) {
  const v = read(rel);
  if (!v.includes('VITE_CAPTCHA_REQUIRED')) problems.push(`${rel} missing VITE_CAPTCHA_REQUIRED`);
  if (!v.includes('VITE_TURNSTILE_SITE_KEY')) problems.push(`${rel} missing VITE_TURNSTILE_SITE_KEY`);
}
if (!guard.includes('VITE_CAPTCHA_REQUIRED') || !guard.includes('VITE_TURNSTILE_SITE_KEY')) problems.push('Production guard does not require CAPTCHA');

const sourceRoot = path.resolve(root,'src');
const secretPattern = /(service[_-]?role|sb_secret|SUPABASE_SERVICE_ROLE_KEY|VITE_.*(SECRET|PRIVATE))/i;
function scan(dir){
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const full=path.join(dir,entry.name);
    if (entry.isDirectory()) scan(full);
    else if(/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      const text=fs.readFileSync(full,'utf8');
      if(secretPattern.test(text)) problems.push(`Potential client secret in source: ${path.relative(root,full)}`);
    }
  }
}
scan(sourceRoot);

const hostHeaders = [read('public/_headers'), read('public/.htaccess'), read('vercel.json'), read('netlify.toml')].join('\n');
for (const h of ['Strict-Transport-Security','X-Frame-Options','X-Content-Type-Options','Referrer-Policy','Content-Security-Policy']) {
  if (!hostHeaders.includes(h)) problems.push(`Security header missing across hosting config: ${h}`);
}
if (!hostHeaders.includes('challenges.cloudflare.com')) problems.push('Turnstile host not allowed in CSP/hosting headers');

if (problems.length) {
  console.error('SECURITY AUDIT FAIL');
  for (const p of problems) console.error('- '+p);
  process.exit(1);
}
console.log('SECURITY AUDIT PASS');
console.log('CAPTCHA + local auth guard + MFA gate + security navigation: present');
console.log('Production environment contract + secret scan + security headers: present');
