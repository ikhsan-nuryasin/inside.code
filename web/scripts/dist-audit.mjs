import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.cwd(), 'dist');
const required = ['index.html','manifest.webmanifest','sw.js','icons/icon-192.png','icons/icon-512.png'];
if (!fs.existsSync(dist)) {
  console.error('DIST AUDIT FAIL: dist/ does not exist. Run npm run build first.');
  process.exit(1);
}
const missing = required.filter((f) => !fs.existsSync(path.join(dist, f)));
const assetsDir = path.join(dist, 'assets');
const hasAssets = fs.existsSync(assetsDir) && fs.readdirSync(assetsDir).length > 0;
if (missing.length || !hasAssets) {
  console.error('DIST AUDIT FAIL');
  missing.forEach((f) => console.error(`Missing: ${f}`));
  if (!hasAssets) console.error('Missing/empty dist/assets directory');
  process.exit(1);
}
console.log('DIST AUDIT PASS');
console.log(`Files in dist: ${fs.readdirSync(dist, {recursive:true}).length}`);
