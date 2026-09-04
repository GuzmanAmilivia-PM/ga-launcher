// Cuantiza un icono opaco a 256 colores (median cut, sin dithering) y lo// escribe como PNG indexado. Nacio el 4/09/2026 para icon-512.png: el RGBA// que saca logo.js pesa 113 KB y ya estaba optimo sin perdida (4.532// colores); con paleta queda en 53 KB con un error maximo de 6/255 por// canal, que no se ve. Imprime antes/despues y el error para decidir.// Uso: node scripts/cuantizar-icono.js icon-512.png icon-512.png// OJO: logo.js --aplicar vuelve a escribir el icono en RGBA; correr esto// despues.
const fs = require('fs'), zlib = require('zlib');
const src = fs.readFileSync(require('path').join(__dirname, 'logo.js'), 'utf8');
const bloque = src.slice(src.indexOf('// ---------- PNG: leer'), src.indexOf('// ---------- operaciones'));
const png = new Function('fs', 'zlib', bloque + '; return { leerPNG, chunk, crc32 };')(fs, zlib);

const [entrada, salida] = process.argv.slice(2);
const im = png.leerPNG(entrada);
const N = im.W * im.H;
const px = [];
for (let i = 0; i < N; i++) px.push([im.px[i * 4], im.px[i * 4 + 1], im.px[i * 4 + 2]]);
if (Array.from({ length: N }, (_, i) => im.px[i * 4 + 3]).some(a => a !== 255)) throw new Error('hay transparencia: este script es solo para iconos opacos');

// median cut
function rango(caja) {
  const min = [255, 255, 255], max = [0, 0, 0];
  for (const p of caja) for (let c = 0; c < 3; c++) { if (p[c] < min[c]) min[c] = p[c]; if (p[c] > max[c]) max[c] = p[c]; }
  const d = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const canal = d.indexOf(Math.max(...d));
  return { canal, ancho: d[canal] };
}
let cajas = [px.slice()];
while (cajas.length < 256) {
  let mejor = -1, mejorAncho = -1;
  cajas.forEach((c, i) => { if (c.length < 2) return; const r = rango(c); if (r.ancho > mejorAncho) { mejorAncho = r.ancho; mejor = i; } });
  if (mejor < 0 || mejorAncho === 0) break;
  const caja = cajas[mejor], canal = rango(caja).canal;
  caja.sort((a, b) => a[canal] - b[canal]);
  const mitad = caja.length >> 1;
  cajas.splice(mejor, 1, caja.slice(0, mitad), caja.slice(mitad));
}
const paleta = cajas.map(c => { const s = [0, 0, 0]; for (const p of c) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; } return s.map(v => Math.round(v / c.length)); });
// asignacion: color mas cercano (cache por color exacto)
const cache = new Map();
function indice(p) {
  const k = (p[0] << 16) | (p[1] << 8) | p[2];
  if (cache.has(k)) return cache.get(k);
  let mejor = 0, md = Infinity;
  for (let i = 0; i < paleta.length; i++) { const q = paleta[i]; const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (d < md) { md = d; mejor = i; } }
  cache.set(k, mejor); return mejor;
}
let maxErr = 0, sumErr = 0;
const idx = Buffer.alloc(N);
for (let i = 0; i < N; i++) {
  const j = indice(px[i]); idx[i] = j;
  const q = paleta[j];
  const e = Math.max(Math.abs(px[i][0] - q[0]), Math.abs(px[i][1] - q[1]), Math.abs(px[i][2] - q[2]));
  if (e > maxErr) maxErr = e; sumErr += e;
}
// PNG indexado: filtro 0 por fila (paleta chica comprime sola); tambien filtro 1 (sub) y se queda el mas chico
function armar(filtro) {
  const raw = Buffer.alloc(im.H * (im.W + 1));
  for (let y = 0; y < im.H; y++) {
    raw[y * (im.W + 1)] = filtro;
    for (let x = 0; x < im.W; x++) {
      const v = idx[y * im.W + x];
      raw[y * (im.W + 1) + 1 + x] = filtro === 1 && x > 0 ? (v - idx[y * im.W + x - 1]) & 255 : v;
    }
  }
  return zlib.deflateSync(raw, { level: 9 });
}
const a = armar(0), b = armar(1);
const idat = a.length <= b.length ? a : b;
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(im.W, 0); ihdr.writeUInt32BE(im.H, 4); ihdr[8] = 8; ihdr[9] = 3;
const plte = Buffer.from(paleta.flat());
const out = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), png.chunk('IHDR', ihdr), png.chunk('PLTE', plte), png.chunk('IDAT', idat), png.chunk('IEND', Buffer.alloc(0))]);
fs.writeFileSync(salida, out);
console.log(JSON.stringify({ colores: paleta.length, antes: fs.statSync(entrada).size, despues: out.length, errorMax: maxErr, errorMedio: +(sumErr / N).toFixed(3) }));
