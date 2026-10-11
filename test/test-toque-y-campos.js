// Campos de 16 px y areas de toque de 44 px (9/10/2026, auditoria).
//
// Dos cosas que el telefono castiga:
//  - Safari en iOS agranda la pagina al enfocar un campo de letra de menos de
//    16 px, y la deja agrandada. Habia campos de 15 px (Trades, Banking, el
//    buscador, la alerta, editar precio) y los del corte de BTG, sin ninguna
//    regla, en los 13,33 del navegador.
//  - Apple pide 44 px de toque. Quedaban por debajo POSITIONS › (15 de alto),
//    la linea vs S&P (16), See more (32), las pastillas BTG/Itaú (33), ↻ ⛶ y ▾
//    (25x24) y Save/Cancel de BTG (31).
//
// ALCANCE: como el arnes de A4 (test-inicio-ux.js, D), esto LEE el CSS real y
// hace la cuenta: no hay navegador para medir. Los tamaños del dibujo son los
// medidos en Chromium a 393 px por la auditoria (uso.md); la capa invisible
// (::after / ::before) tiene que sumar lo que falta para 44.
var fs = require('fs');
var path = require('path');
var ruta = require('./_ruta');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

// Un parser chico de verdad (no una regex por caso): reglas {sel, decl, media}.
var css = fs.readFileSync(path.join(ruta.RUTA, 'css', 'estilos.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
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
    out.push({ sel: sel, decl: txt.slice(a + 1, b), media: media || null });
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
// Las reglas de TELEFONO (fuera de @media de escritorio) cuyo selector incluye `sel`.
function deTelefono(sel) {
  return R.filter(function (r) { return !r.media && r.sel.split(',').some(function (s) { return s.trim() === sel; }); });
}
function valor(sel, prop) {
  var v = null;
  deTelefono(sel).forEach(function (r) { var d = decl(r, prop); if (d !== null) v = d; });
  return v;
}

console.log('\nA) ningun campo por debajo de 16 px');
var global = R.filter(function (r) { return !r.media && /^input, select, textarea$/.test(r.sel); });
ok(global.length === 1 && px(decl(global[0], 'font-size')) >= 16, 'hay un piso de 16 px para input, select y textarea');
var chicas = [];
R.forEach(function (r) {
  var esCampo = r.sel.split(',').some(function (s) { return /(^|[\s>+~])(input|select|textarea)\b/.test(s.trim()); });
  var fz = decl(r, 'font-size');
  if (esCampo && fz !== null && !(px(fz) >= 16)) chicas.push(r.sel + ' → ' + fz);
});
ok(chicas.length === 0, 'ninguna regla de campos pone menos de 16 px' + (chicas.length ? ': ' + chicas.join(' | ') : ''));
var vp = (fs.readFileSync(ruta.INDEX, 'utf8').match(/<meta name="viewport" content="([^"]*)"/) || [])[1] || '';
ok(vp && !/maximum-scale|user-scalable/.test(vp), 'y el zoom no se deshabilita: el viewport sigue siendo ' + vp);

console.log('\nB) el formulario del corte de BTG tiene el estilo de los de la app');
var btgIn = '#accBtgForm input:not([type="checkbox"])';
ok(px(valor(btgIn, 'font-size')) >= 16, 'sus campos en 16 px: ' + valor(btgIn, 'font-size'));
ok(!!valor(btgIn, 'border') && !!valor(btgIn, 'background') && !!valor(btgIn, 'padding'), 'con el borde, el fondo y el relleno de .detedit-form (no el blanco del navegador)');
ok(valor(btgIn, 'width') === '100%' && px(valor(btgIn, 'min-height')) >= 44, 'a lo ancho y de 44 px de alto (median 177x21)');
ok(/column/.test(valor('#accBtgForm .detgrid label', 'flex-direction') || ''), 'la etiqueta arriba del campo, alineados');
ok(!!valor('html.light #accBtgForm input:not([type="checkbox"])', 'background'), 'y en el tema claro tambien');

console.log('\nC) areas de toque de 44 px (dibujo medido + capa)');
// [selector del dueño, selector de la capa, alto medido, ancho medido o null]
var CASOS = [
  ['#posTitulo', '#posTitulo::after', 15, null, 'POSITIONS ›'],
  ['.vsbench', '.vsbench:not(:empty)::before', 16, null, 'la linea vs S&P'],
  ['.morebtn', '.morebtn::after', 32, null, 'See more'],
  ['.depositpick .pillbtn', '.depositpick .pillbtn::after', 33, null, 'las pastillas BTG / Itaú'],
  ['.expandbtn', '.expandbtn::after', 24, 25, '↻ ⛶ ▾ (sueltos)'],
  ['.detedit-botones button', '.detedit-botones button::after', 31, null, 'Save / Cancel de BTG']
];
function lado(sel, l) { var v = px(valor(sel, l)); return v === null ? null : -v; }
CASOS.forEach(function (c) {
  ok(valor(c[0], 'position') === 'relative' || (c[0] === '.morebtn' && /relative/.test(valor('.morebtn', 'position'))), c[4] + ': el dueño tiene position: relative (si no, la capa se va a otro lado)');
  ok(valor(c[1], 'content') !== null && valor(c[1], 'position') === 'absolute', c[4] + ': la capa existe y es absoluta');
  var alto = c[2] + (lado(c[1], 'top') || 0) + (lado(c[1], 'bottom') || 0);
  ok(alto >= 44, c[4] + ': ' + alto + ' px de alto (el dibujo sigue en ' + c[2] + ')');
  if (c[3]) {
    var ancho = c[3] + (lado(c[1], 'left') || 0) + (lado(c[1], 'right') || 0);
    ok(ancho >= 44, c[4] + ': ' + ancho + ' px de ancho');
  }
});
// Los de a dos y el de al lado de los rangos: siguen llegando a 44 sin pisar al vecino.
var par = '.expandbtn + .expandbtn::after';
ok(lado(par, 'left') <= 4 && 25 + lado(par, 'left') + lado(par, 'right') >= 44, '↻ ⛶ juntos: el segundo no crece sobre el primero (' + lado(par, 'left') + ' px) y llega a ' + (25 + lado(par, 'left') + lado(par, 'right')));
var junto = '.evocontrols .expandbtn::after';
ok(lado(junto, 'left') < 8 && 25 + lado(junto, 'left') + lado(junto, 'right') >= 44, '⛶ al lado de los rangos no tapa el ultimo (gap de 8, crece ' + lado(junto, 'left') + ') y llega a ' + (25 + lado(junto, 'left') + lado(junto, 'right')));
ok(valor('#evoChartBox', 'z-index') !== null, 'el grafico abierto queda ENCIMA de la capa de la linea vs S&P');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
