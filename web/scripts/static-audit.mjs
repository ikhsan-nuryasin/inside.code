import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let ts;
try { ts = require('typescript'); } catch { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js'); }

const root = path.resolve(new URL('..', import.meta.url).pathname);
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'),'utf8'));
const src = path.join(root, 'src');
const files = [];
function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,entry.name);
    if(entry.isDirectory()) walk(p);
    else if(/\.(ts|tsx)$/.test(entry.name)) files.push(p);
  }
}
walk(src);
let parseErrors=0;
for(const file of files){
  const text=fs.readFileSync(file,'utf8');
  const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
  for(const d of sf.parseDiagnostics){
    parseErrors++;
    console.error(`${path.relative(root,file)}: ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`);
  }
}
const all=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
const forbidden=[
  /\battendance\b/i,/\babsen(si)?\b/i,/\bpresensi\b/i,
  /create_class/i,/join_class_by_code/i,/createClass\s*\(/i,/joinClass\s*\(/i
];
const violations=forbidden.filter(re=>re.test(all)).map(String);
const classPage=fs.readFileSync(path.join(src,'pages','ClassesPage.tsx'),'utf8');
if(/create\s*class|buat\s+kelas|join\s*class|gabung\s+dengan\s+kelas/i.test(classPage)) violations.push('class client create/join UI');
const sw=fs.readFileSync(path.join(root,'public','sw.js'),'utf8');
if(!sw.includes(`student-hub-v${pkg.version}-security-push`)) violations.push('stale service-worker cache version');
if(!sw.includes('/icon.svg') || !sw.includes('/icons/icon.svg')) violations.push('incorrect service-worker icon path');
if(parseErrors || violations.length){
  console.error(`STATIC AUDIT FAILED: parseErrors=${parseErrors}; violations=${violations.join(', ')}`);
  process.exit(1);
}
console.log(`STATIC AUDIT PASS — ${files.length} TS/TSX files, 0 parse errors, product freeze checks passed.`);
