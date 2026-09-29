import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(new URL('..', import.meta.url).pathname);
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const errors=[];
const pkg=JSON.parse(read('package.json'));
if(!/^1\.8\.1$/.test(pkg.version)) errors.push(`package version expected 1.8.1, got ${pkg.version}`);
if(pkg.scripts?.typecheck!=='tsc -p tsconfig.app.json --noEmit') errors.push('typecheck script must compile tsconfig.app.json directly');
const sw=read('public/sw.js');
if(!sw.includes(`student-hub-v${pkg.version}-security-push`)) errors.push(`service-worker cache is not v${pkg.version}-security-push`);
const repo=read('src/lib/repository.ts');
for(const needle of ['cacheRemoveByPrefixes','invalidateClassCache','splitQueuedPayload','applyQueuedMatch']) if(!repo.includes(needle)) errors.push(`repository missing ${needle}`);
const router=read('src/lib/router.ts');
if(!router.includes("query.get('tab')") || !router.includes("query.get('item')")) errors.push('class deep-link query parsing missing');
const calendar=read('src/pages/CalendarPage.tsx');
if(calendar.indexOf('const selectedDayNumber') > calendar.indexOf('const grouped')) errors.push('calendar uses selectedWeekday before declaration');
if(!calendar.includes('selectedEvents')) errors.push('calendar selected date events missing');
const app=fs.readdirSync(path.join(root,'src'),{withFileTypes:true});
function walk(dir,files=[]){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p,files);else if(/\.(ts|tsx)$/.test(e.name))files.push(p);}return files;}
const sourceFiles=walk(path.join(root,'src'));
for(const file of sourceFiles){const t=fs.readFileSync(file,'utf8');if(/\bwindow\.(alert|confirm|prompt)\s*\(/.test(t))errors.push(`native dialog in ${path.relative(root,file)}`);}
const dialog=read('src/components/DialogHost.tsx');
if(!dialog.includes('currentRef')) errors.push('DialogHost queue guard missing currentRef');
const search=read('src/pages/SearchPage.tsx');
if(/<button[\s\S]*<Button/.test(search)) errors.push('possible nested button in SearchPage');
if(errors.length){console.error(`QUALITY AUDIT FAILED (${errors.length})`);for(const e of errors)console.error(`- ${e}`);process.exit(1)}
console.log(`QUALITY AUDIT PASS — ${sourceFiles.length} TS/TSX source files checked.`);
