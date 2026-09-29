import fs from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const errors = [];

const demo = read('src/lib/demo.ts');
for (const symbol of ['demoClassEvents', 'demoActivityLogs']) {
  if (!new RegExp(`export\\s+const\\s+${symbol}\\b`).test(demo)) errors.push(`missing demo export: ${symbol}`);
}

const repository = read('src/lib/repository.ts');
if (!repository.includes('const client = supabase;')) errors.push('Supabase realtime cleanup is not null-safe.');
if (!repository.includes('client.removeChannel(channel)')) errors.push('Realtime cleanup still references nullable supabase directly.');

const dashboard = read('src/pages/DashboardPage.tsx');
if (!dashboard.includes('p?.full_name')) errors.push('Dashboard profile null guard is missing.');

const classPage = read('src/pages/ClassPage.tsx');
const overview = classPage.slice(classPage.indexOf('function Overview('), classPage.indexOf('function TasksPanel('));
if (/openClassModule\(classId,/.test(overview)) errors.push('Overview still references out-of-scope classId.');

const randomizer = read('src/pages/RandomizerPage.tsx');
const wheelStart = randomizer.indexOf('function Wheel(');
const wheelEnd = randomizer.indexOf('\nexport function RandomizerPage', wheelStart);
const wheel = randomizer.slice(wheelStart, wheelEnd);
if (wheel.includes('activeClass') || wheel.includes('openClassModule(')) errors.push('Wheel component still references page-only activeClass/openClassModule.');
if (randomizer.includes("subtitle==='mode_placeholder'")) errors.push('obsolete mode_placeholder comparison remains.');

if (errors.length) {
  console.error(`BUILD FIX AUDIT FAIL (${errors.length})`);
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}
console.log('BUILD FIX AUDIT PASS');
