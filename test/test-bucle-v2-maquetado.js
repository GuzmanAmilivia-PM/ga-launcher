// Tres cambios de maquetado de la vuelta 2 del bucle de mejora (22/11/2026).
//
//  A) Los controles del grafico del Inicio en UN renglon: $ / %, los ocho
//     rangos y el boton de pantalla completa (eran tres renglones y el "2Y"
//     quedaba cortado en el borde).
//  B) La leyenda de Allocation en el telefono envuelve en vez de apilarse
//     siempre: una linea por cuenta cuando entra, y si no entra el bloque
//     "% | monto" baja entero.
//  C) En la tabla de la cuenta, el % de ganancia no toca el mini-grafico.
//
// ALCANCE: no hay navegador. Una prueba de texto no prueba que algo entre en
// pantalla (BUCLE.md, vuelta 1), asi que A rehace la cuenta de anchos desde las
// reglas reales del CSS con anchos de letra GENEROSOS (bold, por encima de lo
// que miden SF Pro y Manrope), y exige un margen. El verificador mide despues
// en la pantalla de verdad.
var fs = require('fs');
var path = require('path');
var ruta = require('./_ruta');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

var cssCrudo = fs.readFileSync(path.join(ruta.RUTA, 'css', 'estilos.css'), 'utf8');
var css = cssCrudo.replace(/\/\*[\s\S]*?\*\//g, '');
var html = fs.readFileSync(ruta.INDEX, 'utf8');
var nucleo = fs.readFileSync(path.join(ruta.RUTA, 'js', 'nucleo.js'), 'utf8');
var graficos = fs.readFileSync(path.join(ruta.RUTA, 'js', 'graficos.js'), 'utf8');

// Parser chico: reglas {sel, decl, media}, igual que test-toque-y-campos.js.
function reglas(txt, media) {
  var out = [], i = 0;
  while (i < txt.length) {
    var a = txt.indexOf('{', i);
    if (a < 0) break;
    var sel = txt.slice(i, a).trim();
    if (/^@/.test(sel)) {
      var prof = 1, j = a + 1;
      while (j < txt.length && prof) { if (txt[j] === '{') prof++; else if (txt[j] === '}') prof--; j++; }
      if (/^@media/.test(sel)) out = out.concat(reglas(txt.slice(a + 1, j - 1), sel));
      i = j;
      continue;
    }
    var b = txt.indexOf('}', a);
    out.push({ sel: sel.replace(/\s+/g, ' '), decl: txt.slice(a + 1, b), media: media || null });
    i = b + 1;
  }
  return out;
}
var R = reglas(css);
function decl(regla, prop) {
  var m = regla.decl.match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)'));
  return m ? m[1].trim() : null;
}
function px(v) { var m = String(v || '').match(/^(-?\d+(?:\.\d+)?)px$/); return m ? Number(m[1]) : null; }
function conSelector(sel, media) {
  return R.filter(function (r) {
    return (media === undefined || r.media === media) && r.sel.split(',').some(function (s) { return s.trim() === sel; });
  });
}
// Ultimo valor declarado de `prop` para `sel` (fuera de @media salvo que se pida uno).
function val(sel, prop, media) {
  var v = null;
  conSelector(sel, media === undefined ? null : media).forEach(function (r) { var d = decl(r, prop); if (d !== null) v = d; });
  return v;
}
// padding: "a b" o "a" → [vertical, horizontal]
function padH(v) {
  var p = String(v || '').trim().split(/\s+/).map(px);
  if (!p.length || p[0] === null) return null;
  return p.length === 1 ? p[0] : p[1];
}

console.log('\nA) los controles del grafico del Inicio, en un solo renglon');
var bloque = (html.match(/<div class="evocontrols" id="evoControls"[\s\S]*?\n<\/div>/) || [''])[0];
var fila = (bloque.match(/<div class="evorow">([\s\S]*?)<\/div>\s*$/m) || [])[1] || '';
ok(fila !== '', 'los tres controles van en UN contenedor (.evorow) dentro de #evoControls');
var iModo = fila.indexOf('id="modoBar"'), iRang = fila.indexOf('id="rangeBar"'), iAmp = fila.indexOf('id="evoAmpliarBtn"');
ok(iModo !== -1 && iRang > iModo && iAmp > iRang, 'en ese orden: $ / %, los rangos y el ⛶ al final (' + iModo + ', ' + iRang + ', ' + iAmp + ')');
ok(bloque.indexOf('id="evoNota"') !== -1 && bloque.indexOf('id="evoNota"') < bloque.indexOf('class="evorow"'),
  'la nota queda afuera de la fila, arriba, a todo el ancho');
ok(val('.evocontrols .evorow', 'display') === 'flex' && val('.evocontrols .evorow', 'flex-wrap') === 'nowrap',
  'la fila es flex y NO envuelve (el wrap de .evocontrols era lo que la partia en tres)');
// Acotado: las reglas nuevas viven bajo `.evocontrols .evorow` y `.rangebtn` a
// secas sigue como estaba (lo usan los rangos de la tarjeta de cuenta).
var nuevas = R.filter(function (r) { return /\.evorow/.test(r.sel); });
ok(nuevas.length >= 4 && nuevas.every(function (r) { return r.sel.split(',').every(function (s) { return /^\.evocontrols \.evorow\b/.test(s.trim()); }); }),
  'toda regla con .evorow arranca con ".evocontrols .evorow": ' + nuevas.map(function (r) { return r.sel; }).join(' | '));
var base = conSelector('.rangebtn', null);
ok(base.length === 1 && decl(base[0], 'padding') === '7px 13px' && decl(base[0], 'font-size') === '12.5px',
  '.rangebtn a secas no se redefinio: una sola regla, 7px 13px y 12.5px');
ok(val('.rangebar', 'overflow-x') === 'auto', 'la barra de rangos conserva su scroll (por si una pantalla mas angosta no los deja entrar)');
ok(val('.evocontrols .evorow .rangebar', 'scroll-snap-type') !== null && val('.evocontrols .evorow .rangebar .rangebtn', 'scroll-snap-align') === 'start',
  'y ese scroll se detiene al principio de un boton, no en el medio');
ok(px(val('.evocontrols .evorow .expandbtn', 'width')) !== null && /^0 0 /.test(val('.evocontrols .evorow .expandbtn', 'flex') || ''),
  'el ⛶ tiene ancho fijo y no se estira ni se encoge');
ok(/^1 1 /.test(val('.evocontrols .evorow .rangebar', 'flex') || '') && val('.evocontrols .evorow .modobar', 'gap') !== null,
  'los rangos ocupan el medio (crecen y ceden) y el $ / % queda compacto a la izquierda');

// La cuenta. Anchos de letra en em, bold, generosos a proposito.
var EM = { '0': .64, '1': .64, '2': .64, '3': .64, '5': .64, '6': .64, 'W': .98, 'M': .88, 'Y': .68, 'T': .62, 'D': .76, '$': .64, '%': .92 };
function anchoTexto(t, fz) { return t.split('').reduce(function (s, c) { return s + (EM[c] || .8) * fz; }, 0); }
var rangos = (nucleo.match(/var RANGES = \[([\s\S]*?)\];/) || [, ''])[1].match(/key: '([^']+)'/g).map(function (k) { return k.slice(6, -1); });
var modos = (graficos.match(/var EVO_MODOS = \[([\s\S]*?)\];/) || [, ''])[1].match(/key: '([^']+)'/g).map(function (k) { return k.slice(6, -1); });
ok(rangos.length === 8 && modos.length === 2, 'los botones salen del codigo: ' + rangos.join(' ') + ' y ' + modos.join(' / '));
var BORDE = 2; // 1px de cada lado (.rangebtn)
function grupo(etqs, sel, gapSel) {
  var fz = px(val(sel, 'font-size')) || px(val('.rangebtn', 'font-size'));
  var ph = padH(val(sel, 'padding')); if (ph === null) ph = padH(val('.rangebtn', 'padding'));
  var gap = px(val(gapSel, 'gap')); if (gap === null) gap = px(val(gapSel.replace('.evocontrols .evorow ', ''), 'gap'));
  var w = etqs.reduce(function (s, t) { return s + anchoTexto(t, fz) + 2 * ph + BORDE; }, 0) + gap * (etqs.length - 1);
  return { w: w, fz: fz, ph: ph, gap: gap };
}
var gR = grupo(rangos, '.evocontrols .evorow .rangebar .rangebtn', '.evocontrols .evorow .rangebar');
var gM = grupo(modos, '.evocontrols .evorow .modobar .rangebtn', '.evocontrols .evorow .modobar');
var wAmp = (px(val('.evocontrols .evorow .expandbtn', 'width')) || 99) + (px(val('.evocontrols .evorow .expandbtn', 'margin-left')) || 0);
var gapFila = px(val('.evocontrols .evorow', 'gap'));
var total = gR.w + gM.w + wAmp + 2 * (gapFila === null ? 8 : gapFila);
// 375 px menos 16 de cada lado (el padding de la tarjeta del Inicio en el
// telefono, que va a todo el ancho): 343 utiles. Margen: 8 px.
var UTIL = 375 - 2 * 16, MARGEN = 8;
console.log('        rangos ' + gR.w.toFixed(1) + ' (' + gR.fz + 'px, padding ' + gR.ph + ', gap ' + gR.gap + ') + $ / % ' + gM.w.toFixed(1) +
  ' + ⛶ ' + wAmp + ' + huecos ' + 2 * gapFila + ' = ' + total.toFixed(1) + ' de ' + UTIL);
ok(total <= UTIL - MARGEN, 'a 375 px entran todos en un renglon con ' + MARGEN + ' px de margen: ' + total.toFixed(1) + ' <= ' + (UTIL - MARGEN));
// El ⛶ al lado de los rangos: su capa de toque (left: -6px) no pisa el ultimo rango.
var capa = conSelector('.evocontrols .expandbtn::after', null)[0];
var izq = capa ? -px(decl(capa, 'left')) : 99;
ok(izq <= gapFila + (px(val('.evocontrols .evorow .expandbtn', 'margin-left')) || 0),
  'la capa de toque del ⛶ (crece ' + izq + ' px a la izquierda) no llega al ultimo rango');

console.log('\nB) la leyenda de Allocation en el telefono: una linea si entra');
var TEL = '@media (max-width: 560px)';
var filaTel = conSelector('.pierow', TEL);
ok(filaTel.length >= 1 && filaTel.every(function (r) { return decl(r, 'flex-direction') !== 'column'; }),
  'la regla del telefono ya no fuerza flex-direction: column');
ok(val('.pierow', 'flex-wrap', TEL) === 'wrap', 'la fila envuelve (flex-wrap: wrap): el bloque % | monto baja entero si no entra');
var nomTel = conSelector('.pierow .lname', TEL);
ok(nomTel.length >= 1 && val('.pierow .lname', 'overflow', TEL) !== 'hidden' && val('.pierow .lname', 'text-overflow', TEL) !== 'ellipsis' &&
   val('.pierow .lname', 'white-space', TEL) === 'normal',
  'el nombre, sin elipsis ni overflow hidden: nunca se recorta');
ok(val('.pierow .lpct', 'white-space', TEL) === 'nowrap' && val('.pierow .lpct', 'margin-left', TEL) === 'auto',
  '.lpct es nowrap (no se parte por dentro) y va pegado a la derecha');
ok(!/width:\s*\d/.test((conSelector('.pierow .lpct', TEL)[0] || { decl: '' }).decl + (filaTel[0] || { decl: '' }).decl),
  'sin anchos fijos en la fila ni en el bloque');
var vistas = fs.readFileSync(path.join(ruta.RUTA, 'js', 'vistas.js'), 'utf8');
ok(/'<span class="lpct">'[\s\S]{0,200}<span class="chev">&rsaquo;<\/span>' : ''\) \+ '<\/span>'/.test(vistas),
  'la flechita .chev vive dentro de .lpct: viaja con el bloque derecho');

console.log('\nC) en la tabla de la cuenta el % no toca el mini-grafico');
var reglaC = conSelector('#accTabla .holdtable .accval .daychg', TEL)[0];
ok(!!reglaC, 'hay una regla para el % del renglon de valor, acotada a #accTabla y al telefono');
var fzC = reglaC ? px(decl(reglaC, 'font-size')) : null;
var mlC = reglaC ? px(decl(reglaC, 'margin-left')) : null;
// "+123.35%" medía 58 px a 12,5 px (el caso limite, columna de 54 px).
// Peor caso: los 58 son solo el texto, y se suma el margen.
var necesita = fzC ? 58 * fzC / 12.5 + (mlC === null ? 3 : mlC) : 99;
ok(necesita <= 54 - 2, 'el % mas grande entra en los 54 px con aire: necesita ' + necesita.toFixed(1) + ' px (letra ' + fzC + ', margen ' + mlC + ')');
ok(R.filter(function (r) { return /\.accval \.daychg/.test(r.sel) && /font-size:\s*10\.5px/.test(r.decl); })
  .every(function (r) { return r.sel.indexOf('#accTabla') === 0; }),
  'y el achique no se derrama a Home ni a Positions (solo bajo #accTabla)');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
