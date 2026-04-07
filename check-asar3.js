const asar = require('@electron/asar');
const path = require('path');
const asarPath = 'C:/Users/User/AppData/Local/Programs/Bruno/resources/app.asar';

function extract(relPath) {
  const p = relPath.split('/').join(path.sep);
  try {
    return asar.extractFile(asarPath, p).toString();
  } catch(e) {
    return null;
  }
}

// Check node-pty-win32-x64 package.json
const ptx64Pkg = extract('node_modules/@lydell/node-pty-win32-x64/package.json');
if (ptx64Pkg) {
  const pkg = JSON.parse(ptx64Pkg);
  console.log('@lydell/node-pty-win32-x64 main:', pkg.main || '(none)');
} else {
  console.log('@lydell/node-pty-win32-x64/package.json: NOT FOUND in asar');
}

// Check requireBinary.js
const rb = extract('node_modules/@lydell/node-pty/requireBinary.js');
if (rb) {
  console.log('\nrequireBinary.js:\n', rb);
} else {
  console.log('requireBinary.js: NOT FOUND');
}

// Check @lydell/node-pty package.json main
const ptyPkg = extract('node_modules/@lydell/node-pty/package.json');
if (ptyPkg) {
  const pkg = JSON.parse(ptyPkg);
  console.log('\n@lydell/node-pty main:', pkg.main || '(none)');
}
