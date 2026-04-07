const asar = require('@electron/asar');
const path = require('path');
const asarPath = 'C:/Users/User/AppData/Local/Programs/Bruno/resources/app.asar';

function extract(relPath) {
  const p = relPath.split('/').join(path.sep);
  try { return asar.extractFile(asarPath, p).toString(); } catch(e) { return null; }
}

const wpa = extract('node_modules/@lydell/node-pty/windowsPtyAgent.js');
console.log('windowsPtyAgent.js requireBinary calls:');
(wpa || '').split('\n').filter(l => l.includes('requireBinary') || l.includes('require(')).forEach(l => console.log(l.trim()));
