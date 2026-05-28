const fs = require('fs');
const path = require('path');

const sessionDir = path.join(__dirname, '..', '.wwebjs_auth');
const cacheDir = path.join(__dirname, '..', '.wwebjs_cache');

for (const dir of [sessionDir, cacheDir]) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`Eliminado: ${dir}`);
  }
}

console.log('Sesión limpia. Al iniciar el bot vas a tener que escanear el QR de nuevo.');
