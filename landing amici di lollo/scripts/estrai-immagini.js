// Estrae le immagini base64 dalla mail di proposta in public/img/
// Uso: node scripts/estrai-immagini.js "<percorso mail html>"
const fs = require('fs');
const path = require('path');

const src = process.argv[2];
if (!src) { console.error('Indica il percorso della mail HTML'); process.exit(1); }
const html = fs.readFileSync(src, 'utf8');
const names = ['logo', 'lucine', 'auto-fiocco', 'logo-footer'];
const re = /data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)/g;
const out = path.join(__dirname, '..', 'public', 'img');
let m, i = 0;
while ((m = re.exec(html))) {
  const ext = m[1] === 'jpeg' ? 'jpg' : 'png';
  const name = (names[i] || 'img-' + i) + '.' + ext;
  fs.writeFileSync(path.join(out, name), Buffer.from(m[2], 'base64'));
  console.log('Salvata', name);
  i++;
}
