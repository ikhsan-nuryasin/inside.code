import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const required=[
  'src/lib/push.ts',
  'public/sw.js',
  '../supabase/migrations/021_notification_type_expansion.sql',
];
const problems=[];
for(const rel of required){if(!fs.existsSync(path.resolve(root,rel))) problems.push(`Missing: ${rel}`)}
const push=fs.readFileSync(path.join(root,'src/lib/push.ts'),'utf8');
const sw=fs.readFileSync(path.join(root,'public/sw.js'),'utf8');
if(!push.includes('pushManager.subscribe')) problems.push('pushManager.subscribe missing');
if(!push.includes('push_subscriptions')) problems.push('push subscription persistence missing');
if(!sw.includes("addEventListener(\"push\"")) problems.push('service worker push handler missing');
if(!sw.includes('showNotification')) problems.push('service worker notification display missing');
if(!sw.includes('notificationclick')) problems.push('notification click handler missing');
const migrationDir=path.resolve(root,'../supabase/migrations');
const migrations=fs.readdirSync(migrationDir).filter(x=>/^02[1-4]_.*\.sql$/.test(x));
if(migrations.length<3) problems.push('notification migrations 021-024 incomplete');
if(problems.length){console.error('PUSH AUDIT FAIL'); for(const p of problems) console.error('- '+p); process.exit(1)}
console.log('PUSH AUDIT PASS');
console.log(`Notification migrations: ${migrations.join(', ')}`);
console.log('Client subscription + service worker push + notification click: present');
