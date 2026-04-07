const asar = require('@electron/asar');
const asarPath = 'C:/Users/User/AppData/Local/Programs/Bruno/resources/app.asar';
const rawList = asar.listPackage(asarPath);
const list = new Set(rawList.map(f => f.replace(/\\/g, '/')));

const pkg = require('./packages/bruno-electron/package.json');
const deps = Object.keys(pkg.dependencies || {});

console.log('=== Missing runtime deps (not in asar) ===');
const missing = deps.filter(d => {
  const p = '/node_modules/' + d;
  return ![...list].some(f => f.startsWith(p));
});
missing.forEach(d => console.log('MISSING:', d));
if (missing.length === 0) console.log('All deps present!');

console.log('\n=== Native .node files in asar (should be unpacked) ===');
rawList.filter(f => f.endsWith('.node')).forEach(f => console.log(f));
