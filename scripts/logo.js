// Herramienta de logo: PNG adentro -> todas las piezas que usa la app.
// Sin dependencias (zlib de Node y nada mas). Sirve para:
//   node logo.js <origen.png>            genera las piezas en ./salida-logo/
//   node logo.js <origen.png> --aplicar  ademas las mete en ga-launcher
//
// Piezas:
//   marca.png        el simbolo dorado sobre transparente, RECORTADO al trazo
//                    (es el del splash: sin marco, sin margenes de sobra)
//   icono-180.png    ícono de la pantalla de inicio de iOS (apple-touch-icon)
//   icono-512.png    ícono del manifest / Android
//   icono-192.png    el redondito del menu y de la barra de arriba
//   favicon.png      64 px para la pestaña
var fs = require('fs'), zlib = require('zlib'), path = require('path');

// ---------- PNG: leer ----------
function leerPNG(archivo) {
  var b = fs.readFileSync(archivo);
  if (b.readUInt32BE(0) !== 0x89504E47) throw new Error(archivo + ' no es un PNG (guardalo como PNG).');
  var W = b.readUInt32BE(16), H = b.readUInt32BE(20), bits = b[24], tipo = b[25];
  if (bits !== 8 || (tipo !== 6 && tipo !== 2)) {
    throw new Error('PNG de ' + bits + ' bits tipo ' + tipo + ': solo manejo 8 bits RGB o RGBA.');
  }
  var canales = tipo === 6 ? 4 : 3, stride = W * canales, idat = [], p = 8;
  while (p < b.length) {
    var len = b.readUInt32BE(p), t = b.toString('ascii', p + 4, p + 8);
    if (t === 'IDAT') idat.push(b.slice(p + 8, p + 8 + len));
    p += 12 + len;
  }
  var raw = zlib.inflateSync(Buffer.concat(idat));
  var img = Buffer.alloc(W * H * 4), pos = 0, linea = Buffer.alloc(stride), previa = Buffer.alloc(stride);
  for (var y = 0; y < H; y++) {
    var f = raw[pos++];
    raw.copy(linea, 0, pos, pos + stride); pos += stride;
    for (var x = 0; x < stride; x++) {
      var a = x >= canales ? linea[x - canales] : 0, bb = previa[x], c = x >= canales ? previa[x - canales] : 0, v = linea[x], r;
      if (f === 0) r = v; else if (f === 1) r = v + a; else if (f === 2) r = v + bb;
      else if (f === 3) r = v + ((a + bb) >> 1);
      else { var q = a + bb - c, pa = Math.abs(q - a), pb = Math.abs(q - bb), pc = Math.abs(q - c); r = v + ((pa <= pb && pa <= pc) ? a : (pb <= pc ? bb : c)); }
      linea[x] = r & 255;
    }
    for (var x2 = 0; x2 < W; x2++) {
      var o = (y * W + x2) * 4, s = x2 * canales;
      img[o] = linea[s]; img[o + 1] = linea[s + 1]; img[o + 2] = linea[s + 2];
      img[o + 3] = canales === 4 ? linea[s + 3] : 255;
    }
    linea.copy(previa);
  }
  return { W: W, H: H, px: img };
}

// ---------- PNG: escribir ----------
var TABLA = (function () { var t = []; for (var n = 0; n < 256; n++) { var c = n; for (var m = 0; m < 8; m++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
function crc32(buf) { var c = 0xFFFFFFFF; for (var n = 0; n < buf.length; n++) c = TABLA[(c ^ buf[n]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(tipo, datos) {
  var largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length, 0);
  var cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  var crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(cuerpo), 0);
  return Buffer.concat([largo, cuerpo, crc]);
}
// Elige el filtro de cada fila por la heuristica estandar de PNG (la suma de
// |valor| mas chica). Escribir todo con filtro 0 daba iconos de 110 KB para un
// dibujo de dos colores; asi bajan a una fraccion.
function filtrarFila(actual, previa, stride, bpp) {
  var mejor = null, mejorPeso = Infinity;
  for (var f = 0; f <= 4; f++) {
    var linea = Buffer.alloc(stride), peso = 0;
    for (var x = 0; x < stride; x++) {
      var a = x >= bpp ? actual[x - bpp] : 0, b = previa[x], c = x >= bpp ? previa[x - bpp] : 0, v = actual[x], r;
      if (f === 0) r = v;
      else if (f === 1) r = v - a;
      else if (f === 2) r = v - b;
      else if (f === 3) r = v - ((a + b) >> 1);
      else { var p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); r = v - ((pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c)); }
      linea[x] = r & 255;
      peso += linea[x] < 128 ? linea[x] : 256 - linea[x];
    }
    if (peso < mejorPeso) { mejorPeso = peso; mejor = { f: f, linea: linea }; }
  }
  return mejor;
}
function escribirPNG(im, archivo) {
  var stride = im.W * 4;
  // Dos candidatos: sin filtrar y con la heuristica. En dibujos planos como
  // este logo gana el sin filtrar (grandes zonas identicas comprimen solas) y
  // en fotos gana la heuristica: se prueban los dos y queda el mas chico.
  var plano = Buffer.alloc(im.H * (stride + 1));
  var filtrado = Buffer.alloc(im.H * (stride + 1));
  var previa = Buffer.alloc(stride);
  for (var y = 0; y < im.H; y++) {
    var actual = im.px.slice(y * stride, (y + 1) * stride);
    plano[y * (stride + 1)] = 0;
    actual.copy(plano, y * (stride + 1) + 1);
    var el = filtrarFila(actual, previa, stride, 4);
    filtrado[y * (stride + 1)] = el.f;
    el.linea.copy(filtrado, y * (stride + 1) + 1);
    previa = actual;
  }
  var a = zlib.deflateSync(plano, { level: 9 }), b = zlib.deflateSync(filtrado, { level: 9 });
  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(im.W, 0); ihdr.writeUInt32BE(im.H, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  var png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', a.length <= b.length ? a : b), chunk('IEND', Buffer.alloc(0))]);
  fs.writeFileSync(archivo, png);
  return png;
}

// ---------- operaciones ----------
// Promedio por caja: para achicar es lo correcto (y no hay dependencias).
function redimensionar(im, W2, H2) {
  var out = Buffer.alloc(W2 * H2 * 4);
  for (var y = 0; y < H2; y++) {
    var y0 = Math.floor(y * im.H / H2), y1 = Math.max(y0 + 1, Math.floor((y + 1) * im.H / H2));
    for (var x = 0; x < W2; x++) {
      var x0 = Math.floor(x * im.W / W2), x1 = Math.max(x0 + 1, Math.floor((x + 1) * im.W / W2));
      var r = 0, g = 0, b = 0, a = 0, n = 0;
      for (var yy = y0; yy < y1; yy++) for (var xx = x0; xx < x1; xx++) {
        var o = (yy * im.W + xx) * 4, al = im.px[o + 3] / 255;
        r += im.px[o] * al; g += im.px[o + 1] * al; b += im.px[o + 2] * al; a += im.px[o + 3]; n++;
      }
      var o2 = (y * W2 + x) * 4, suma = a / 255;
      out[o2] = suma ? Math.round(r / suma) : 0;
      out[o2 + 1] = suma ? Math.round(g / suma) : 0;
      out[o2 + 2] = suma ? Math.round(b / suma) : 0;
      out[o2 + 3] = Math.round(a / n);
    }
  }
  return { W: W2, H: H2, px: out };
}
// Deja el simbolo sobre transparente. El alfa sale de cuan DORADO es el pixel
// (R - B), no de su brillo: por brillo, un fondo blanco o un borde claro
// tambien pasarian (ya paso: quedaban dibujadas las esquinas del marco).
function recortarFondo(im, oro) {
  var ORO = oro || [254, 213, 7], rango = ORO[0] - ORO[2];
  var out = Buffer.alloc(im.W * im.H * 4);
  for (var n = 0; n < im.W * im.H; n++) {
    var o = n * 4;
    var cobertura = Math.max(0, Math.min(1, (im.px[o] - im.px[o + 2]) / rango));
    out[o] = ORO[0]; out[o + 1] = ORO[1]; out[o + 2] = ORO[2];
    out[o + 3] = Math.round(cobertura * im.px[o + 3]);
  }
  return { W: im.W, H: im.H, px: out };
}
// Caja que ocupa el trazo (lo no transparente).
function cajaDelTrazo(im) {
  var x0 = im.W, y0 = im.H, x1 = -1, y1 = -1;
  for (var y = 0; y < im.H; y++) for (var x = 0; x < im.W; x++) {
    if (im.px[(y * im.W + x) * 4 + 3] > 8) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) throw new Error('la imagen quedo vacia al recortar el fondo: ¿el simbolo no es dorado?');
  return { x0: x0, y0: y0, x1: x1, y1: y1 };
}
// Recorta CUALQUIER imagen al cuadrado que encierra esa caja, con margen. Sirve
// para el ícono: la caja se mide sobre la version transparente (donde esta el
// dorado) pero se recorta el original, que conserva su fondo negro.
function recortarComo(im, caja, margenPct) {
  var lado = Math.max(caja.x1 - caja.x0 + 1, caja.y1 - caja.y0 + 1);
  var margen = Math.round(lado * (margenPct || 0));
  var Lado = lado + margen * 2;
  var cx = Math.round((caja.x0 + caja.x1) / 2), cy = Math.round((caja.y0 + caja.y1) / 2);
  var ox = cx - Math.round(Lado / 2), oy = cy - Math.round(Lado / 2);
  var out = Buffer.alloc(Lado * Lado * 4);
  for (var y = 0; y < Lado; y++) for (var x = 0; x < Lado; x++) {
    var sx = ox + x, sy = oy + y;
    var o = (y * Lado + x) * 4;
    if (sx < 0 || sy < 0 || sx >= im.W || sy >= im.H) { out[o + 3] = 255; continue; } // fuera: negro opaco
    im.px.copy(out, o, (sy * im.W + sx) * 4, (sy * im.W + sx) * 4 + 4);
  }
  return { W: Lado, H: Lado, px: out };
}
// Recorta los bordes vacios y deja un margen parejo (en % del lado).
function recortarAlTrazo(im, margenPct) {
  var c = cajaDelTrazo(im);
  var x0 = c.x0, y0 = c.y0, x1 = c.x1, y1 = c.y1;
  var lado = Math.max(x1 - x0 + 1, y1 - y0 + 1);
  var margen = Math.round(lado * (margenPct || 0));
  var L = lado + margen * 2;
  var cx = Math.round((x0 + x1) / 2), cy = Math.round((y0 + y1) / 2);
  var ox = cx - Math.round(L / 2), oy = cy - Math.round(L / 2);
  var out = Buffer.alloc(L * L * 4);
  for (var y2 = 0; y2 < L; y2++) for (var x2 = 0; x2 < L; x2++) {
    var sx = ox + x2, sy = oy + y2;
    if (sx < 0 || sy < 0 || sx >= im.W || sy >= im.H) continue;
    im.px.copy(out, (y2 * L + x2) * 4, (sy * im.W + sx) * 4, (sy * im.W + sx) * 4 + 4);
  }
  return { W: L, H: L, px: out };
}
// Esquinas redondeadas (para el ícono del menu, que va con su caja).
function redondear(im, radioPct) {
  var r = im.W * (radioPct || 0.22), out = Buffer.from(im.px);
  for (var y = 0; y < im.H; y++) for (var x = 0; x < im.W; x++) {
    var dx = Math.max(r - x, x - (im.W - 1 - r), 0), dy = Math.max(r - y, y - (im.H - 1 - r), 0);
    if (dx <= 0 || dy <= 0) continue;
    var d = Math.sqrt(dx * dx + dy * dy);
    var alfa = Math.max(0, Math.min(1, r - d + 0.5));
    var o = (y * im.W + x) * 4;
    out[o + 3] = Math.round(out[o + 3] * alfa);
  }
  return { W: im.W, H: im.H, px: out };
}

// ---------- main ----------
module.exports = { leerPNG: leerPNG, escribirPNG: escribirPNG, redimensionar: redimensionar, recortarFondo: recortarFondo, recortarAlTrazo: recortarAlTrazo, recortarComo: recortarComo, cajaDelTrazo: cajaDelTrazo, redondear: redondear };
if (require.main === module) principal();
function principal() {
var origen = process.argv[2];
if (!origen) { console.error('uso: node logo.js <origen.png> [--aplicar]'); process.exit(1); }
var dir = path.join(__dirname, 'salida-logo');
if (!fs.existsSync(dir)) fs.mkdirSync(dir);
var im = leerPNG(origen);
console.log('origen: ' + im.W + 'x' + im.H);

var marca = recortarAlTrazo(recortarFondo(im), 0.04);
var marca256 = redimensionar(marca, 256, 256);
escribirPNG(marca256, path.join(dir, 'marca.png'));
console.log('marca.png       256x256 transparente, recortada al trazo (' + Math.round(fs.statSync(path.join(dir, 'marca.png')).size / 1024) + ' KB)');

// Para el ícono se recorta el original (con su fondo) al trazo + margen: el
// archivo del logo trae el simbolo chiquito en medio de un lienzo enorme, y
// sin esto el ícono del telefono queda casi todo fondo.
var cuadrado = recortarComo(im, cajaDelTrazo(recortarFondo(im)), 0.16);
[['icono-180.png', 180], ['icono-512.png', 512], ['icono-192.png', 192], ['favicon.png', 64]].forEach(function (par) {
  var chico = redimensionar(cuadrado, par[1], par[1]);
  if (par[0] === 'icono-192.png') chico = redondear(chico, 0.22);
  escribirPNG(chico, path.join(dir, par[0]));
  console.log(par[0] + (par[0].length < 14 ? '\t' : '') + '\t' + par[1] + 'x' + par[1] + ' (' + Math.round(fs.statSync(path.join(dir, par[0])).size / 1024) + ' KB)');
});

if (process.argv.indexOf('--aplicar') === -1) {
  console.log('\n(prueba: no toque ga-launcher. Agregá --aplicar para publicarlo)');
  process.exit(0);
}

// ---------- aplicar en la PWA ----------
var PWA = process.env.GA_LAUNCHER || path.join(__dirname, '..');
var b64marca = fs.readFileSync(path.join(dir, 'marca.png')).toString('base64');
var b64menu = fs.readFileSync(path.join(dir, 'icono-192.png')).toString('base64');
var lineas = fs.readFileSync(path.join(PWA, 'index.html'), 'utf8').split(/\r?\n/);
var iMarca = lineas.findIndex(function (l) { return l.indexOf('.splash-mark{') === 0; });
var iMenu = lineas.findIndex(function (l) { return l.indexOf('.galogo-img {') === 0; });
if (iMarca < 0 || iMenu < 0) throw new Error('no encontre .splash-mark / .galogo-img en index.html');
lineas[iMarca] = '.splash-mark{width:124px;height:124px;margin:0 auto 6px;background:url("data:image/png;base64,' + b64marca + '") center/contain no-repeat;}';
lineas[iMenu] = '.galogo-img { background-image: url("data:image/png;base64,' + b64menu + '"); background-size: cover; background-position: center; }';
fs.writeFileSync(path.join(PWA, 'index.html'), lineas.join('\n'));
fs.copyFileSync(path.join(dir, 'icono-180.png'), path.join(PWA, 'apple-touch-icon.png'));
fs.copyFileSync(path.join(dir, 'icono-512.png'), path.join(PWA, 'icon-512.png'));
fs.copyFileSync(path.join(dir, 'favicon.png'), path.join(PWA, 'favicon.png'));
console.log('\naplicado en ga-launcher: splash, logo del menu, apple-touch-icon, icon-512 y favicon.');
console.log('FALTA a mano: en el telefono, borrar el acceso de la pantalla de inicio y volver a agregarlo (iOS cachea el icono).');

}
