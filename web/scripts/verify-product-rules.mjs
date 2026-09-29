import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const src = join(root, 'src');
const sqlDir = join(root, '..', 'supabase', 'migrations');
const files = [];
function walk(dir){
  for(const name of readdirSync(dir)){
    const p=join(dir,name);
    if(statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
}
walk(src);
const source=files.filter(f=>/\.(ts|tsx)$/.test(f)).map(f=>readFileSync(f,'utf8')).join('\n');
const forbiddenSource=[/\battendance\b/i,/\babsen(si)?\b/i,/\bpresensi\b/i,/create_class/i,/join_class_by_code/i,/createClass\s*\(/i,/joinClass\s*\(/i];
const historicalDocsAllowed = true;
const sourceHits=[];
for(const re of forbiddenSource){ if(re.test(source)) sourceHits.push(String(re)); }
const classPage=readFileSync(join(src,'pages','ClassesPage.tsx'),'utf8');
if(/nav\([^)]*create|nav\([^)]*join/i.test(classPage)) sourceHits.push('class client create/join route');
if(sourceHits.length){
  console.error('PRODUCT RULE CHECK FAILED:', sourceHits.join(', '));
  process.exit(1);
}
const migrations=readdirSync(sqlDir).filter(x=>x.endsWith('.sql')).sort();
const latest=migrations.map(x=>readFileSync(join(sqlDir,x),'utf8')).join('\n');
if(!/013_remove_internal_attendance\.sql|attendance/i.test(migrations.join('\n'))){
  console.warn('No historical attendance migration detected; this is informational.');
}
if(!/ATTENDANCE_SCHEMA_STILL_PRESENT/.test(readFileSync(join(sqlDir,'014_phase1_authorization_hardening.sql'),'utf8'))){
  console.error('Missing attendance schema guard.'); process.exit(1);
}
console.log(`PRODUCT RULE CHECK PASS — ${files.length} source files inspected.`);
