const asar = require('@electron/asar');
const path = require('path');

const asarPath = 'C:/Users/User/AppData/Local/Programs/Bruno/resources/app.asar';
const list = new Set(asar.listPackage(asarPath).map(f => f.replace(/\\/g, '/')));

// Find all package.json in node_modules (depth 2 or 3 for scoped)
const pkgJsons = [...list].filter(f => {
  const parts = f.split('/');
  const nmIdx = parts.lastIndexOf('node_modules');
  if (nmIdx < 0) return false;
  const depth = parts.length - nmIdx;
  return (depth === 3 || depth === 4) && parts[parts.length - 1] === 'package.json';
});

const broken = [];
for (const pkgPath of pkgJsons) {
  try {
    const content = asar.extractFile(asarPath, pkgPath.replace(/\//g, '\\')).toString();
    const pkg = JSON.parse(content);
    if (pkg.main) {
      const dir = pkgPath.replace(/\/package\.json$/, '');
      const mainRelative = pkg.main.replace(/^\.\//, '');
      const mainFile = dir + '/' + mainRelative;
      if (!list.has(mainFile)) {
        broken.push({ pkg: dir, main: pkg.main });
      }
    }
  } catch(e) {}
}

console.log('BROKEN packages (main file missing in asar):');
if (broken.length === 0) {
  console.log('None found!');
} else {
  broken.forEach(b => console.log(b.pkg, '->', b.main));
}
