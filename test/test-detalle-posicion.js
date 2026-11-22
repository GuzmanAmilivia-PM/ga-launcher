// El detalle de una posicion (bucle de mejora, vuelta 2, 22/11/2026). Dos
// cosas de toggleDetalle (tablero.js):
//   1) al abrir una fila de ABAJO, el resultado y la grafica quedaban tapados
//      por la barra inferior: ahora se desplaza la pagina, y solo si hace falta;
//   2) el titular de una perdida mezclaba dos signos ("−USD 125,000 -45.5%").
// No hay navegador: un DOM de mentira informa posiciones como lo haria
// getBoundingClientRect en un iPhone de 812 px de alto, con la barra inferior
// arrancando en y=745. Los numeros son inventados.
var fs = require('fs');
var path = require('path');
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var codigo = ruta.bloque(html,
  '// ---------- Detalle desplegable por activo + grafico TradingView ----------',
  '// ---------- Indicadores del detalle (V14) ----------');
var nucleo = fs.readFileSync(path.join(ruta.RUTA, 'js', 'nucleo.js'), 'utf8');
var tablero = fs.readFileSync(path.join(ruta.RUTA, 'js', 'tablero.js'), 'utf8');
function sacar(src, re) { var m = src.match(re); if (!m) { console.log('  FALLA: no encuentro ' + re); process.exit(1); } return m[0]; }

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

// Las piezas de formato de VERDAD (nucleo.js y tablero.js), con el ojito abierto.
var fmt = new Function('montosOcultos', sacar(nucleo, /function fmt\(n\) \{[\s\S]*?\n\}/) + '\nreturn fmt;')(false);
var fmtSigno = new Function('fmt', sacar(nucleo, /function fmtSigno\(n\)[^\n]*/) + '\nreturn fmtSigno;')(fmt);
var signoPct = new Function(sacar(nucleo, /function signoPct\(v, dec\)[^\n]*/) + '\nreturn signoPct;')();
var fmtNum = new Function(sacar(nucleo, /function fmtNum\(n\) \{[\s\S]*?\n\}/) + '\nreturn fmtNum;')();
var fmtCant = new Function('mask', sacar(nucleo, /function fmtCant\(n\) \{[\s\S]*?\n\}/) + '\nreturn fmtCant;')(function (s) { return s; });
var gananciaUsd = new Function(sacar(tablero, /function gananciaUsd\(p\)[\s\S]*?\n\}/) + '\nreturn gananciaUsd;')();

// ---- El DOM de mentira, con posiciones ----
// La fila mide 48 px; debajo, el detalle: 14 px de relleno, el resultado (60)
// y, 12 px mas abajo, la grafica (190, la altura de .tvwrap).
var ALTO = 812, NAV_TOP = 745;
function rect(top, alto) { return { top: top, bottom: top + alto, height: alto, left: 0, right: 375, width: 375 }; }
function nodo(tag) {
  var n = {
    tag: tag, children: [], parentNode: null, style: {}, className: '', colSpan: 0, _html: '',
    setAttribute: function () {}, addEventListener: function () {},
    appendChild: function (c) { c.parentNode = n; n.children.push(c); return c; },
    removeChild: function (c) { var i = n.children.indexOf(c); if (i !== -1) n.children.splice(i, 1); c.parentNode = null; return c; },
    insertBefore: function (c, ref) { c.parentNode = n; var i = ref ? n.children.indexOf(ref) : -1; if (i === -1) n.children.push(c); else n.children.splice(i, 0, c); return c; },
    querySelector: function (sel) {
      // El td del detalle: devuelve las piezas con su posicion, calculada
      // desde la fila que esta justo arriba.
      var det = n.parentNode, cont = det && det.parentNode;
      var fila = cont ? cont.children[cont.children.indexOf(det) - 1] : null;
      var y = fila ? fila._top + 48 + 14 : 0;
      var hayRes = n._html.indexOf('class="detres"') !== -1;
      if (sel === '.detres') return hayRes ? { style: {}, getBoundingClientRect: function () { return rect(y, 60); } } : null;
      if (sel === '.tvwrap') {
        var top = y + (hayRes ? 60 + 12 : 0);
        n._tv = n._tv || { style: {}, appendChild: function () {}, getBoundingClientRect: function () { return rect(top, 190); } };
        return n._tv;
      }
      return { style: {} };
    }
  };
  Object.defineProperty(n, 'innerHTML', { get: function () { return n._html; }, set: function (v) { n._html = v; } });
  Object.defineProperty(n, 'nextSibling', { get: function () { if (!n.parentNode) return null; var s = n.parentNode.children; return s[s.indexOf(n) + 1] || null; } });
  return n;
}
function filaEn(top) {
  var tr = nodo('tr');
  tr._top = top;
  tr.children = [nodo('td'), nodo('td'), nodo('td')];
  tr.getBoundingClientRect = function () { return rect(top, 48); };
  return tr;
}

function montar(opc) {
  opc = opc || {};
  var est = { scrolls: [] };
  var ctx = {
    document: {
      createElement: function (t) { return nodo(t); },
      querySelector: function (sel) {
        if (sel !== '.bottomnav') return null;
        return { getBoundingClientRect: function () { return opc.escritorio ? rect(0, ALTO) : rect(NAV_TOP, ALTO - NAV_TOP); } };
      },
      body: {}
    },
    window: {
      innerHeight: ALTO,
      scrollBy: function (o) { est.scrolls.push(o); },
      matchMedia: function (q) { return { matches: !!opc.menosMovimiento && /prefers-reduced-motion: reduce/.test(q) }; },
      getComputedStyle: function () { return { paddingTop: '0px' }; }
    },
    esc: function (s) { return String(s); },
    fmt: fmt, fmtSigno: fmtSigno, signoPct: signoPct, fmtNum: fmtNum, fmtCant: fmtCant, gananciaUsd: gananciaUsd,
    encodeURIComponent: encodeURIComponent, esTemaClaro: function () { return false; },
    cargarFundamentales: function () {},
    google: { script: { run: {} } }
  };
  var nombres = Object.keys(ctx);
  var api = new Function(nombres.join(','), codigo +
    '\nreturn { toggleDetalle: toggleDetalle, desplazo: (typeof desplazoDetalle === "function" ? desplazoDetalle : null) };')
    .apply(null, nombres.map(function (k) { return ctx[k]; }));
  est.api = api;
  return est;
}
var POS = { symbol: 'NVDA', precioCompra: 95, precioActual: 180, qty: 60, valor: 10800, cuenta: 'IB', gfTicker: 'NVDA', cripto: false };
function abrir(est, top, pos) {
  var cont = nodo('tbody');
  var tr = filaEn(top);
  cont.appendChild(tr);
  est.api.toggleDetalle(tr, pos || POS);
  return { cont: cont, tr: tr };
}

console.log('\nA) la decision, en una funcion pura: ¿hace falta desplazar y cuanto?');
var m0 = montar();
var d = m0.api.desplazo;
ok(typeof d === 'function', 'existe desplazoDetalle(filaTop, bloqueTop, bloqueFin, arriba, abajo)');
// Fila en y=700: resultado 762-822, grafica 834-1024; la zona visible es 8-745.
ok(d && d(700, 762, 1024, 8, 745) === 692, '(a) fila abajo: desplaza 692 px, lo que pone la fila arriba de todo (y=8)');
// Fila en y=100: resultado 162-222, grafica 234-424: entra entera.
ok(d && d(100, 162, 424, 8, 745) === 0, '(b) fila arriba: 0, no se mueve nada');
// Cae justo en el borde: entra, no se mueve.
ok(d && d(397, 459, 745, 8, 745) === 0, 'la grafica terminando justo sobre la barra cuenta como visible');
// Fila cortada por arriba pero con resultado y grafica a la vista: no se mueve.
ok(d && d(-40, 22, 284, 8, 745) === 0, 'la fila cortada por arriba no importa si resultado y grafica se ven');
// Con el resultado tambien cortado por arriba: se trae la fila para abajo.
ok(d && d(-100, -38, 224, 8, 745) === -108, 'con el resultado cortado por ARRIBA, la fila vuelve a la vista (-108)');
ok(d && d(NaN, 1, 2, 8, 745) === 0 && d(700, 762, 1024, 8, undefined) === 0, 'sin medidas validas no se mueve nada');

console.log('\nB) toggleDetalle pide el desplazamiento solo cuando hace falta');
var m1 = montar();
var a1 = abrir(m1, 700);
ok(m1.scrolls.length === 1 && m1.scrolls[0].top === 692,
  '(a) fila en y=700 (Positions, ultima fila): se pide desplazar 692 px (' + JSON.stringify(m1.scrolls) + ')');
ok(m1.scrolls.length === 1 && m1.scrolls[0].behavior === 'smooth', 'suave');
m1.api.toggleDetalle(a1.tr, POS);   // el mismo toque cierra
ok(m1.scrolls.length === 1 && a1.cont.children.length === 1,
  '(c) al CERRAR el detalle no se pide ningun desplazamiento (sigue habiendo uno solo: el de abrir)');

var m2 = montar();
abrir(m2, 100);
ok(m0.api.desplazo && m2.scrolls.length === 0, '(b) fila en y=100: resultado y grafica ya se ven, no se pide nada');

var m3 = montar({ menosMovimiento: true });
abrir(m3, 700);
ok(m3.scrolls.length === 1 && m3.scrolls[0].behavior === 'auto', 'con prefers-reduced-motion el salto es directo, sin animar');

// Sin precio medio no hay resultado: lo que tiene que verse es la grafica.
var m4 = montar();
abrir(m4, 600, { symbol: 'VOO', precioActual: 500, qty: 3, valor: 1500, cuenta: 'CS', gfTicker: 'VOO' });
ok(m4.scrolls.length === 1 && m4.scrolls[0].top === 592, 'sin resultado, mide la grafica sola (' + JSON.stringify(m4.scrolls) + ')');

// En el escritorio la barra es una columna a la izquierda: no tapa abajo.
var m5 = montar({ escritorio: true });
abrir(m5, 500);   // grafica 634-824: pasa los 812 de la ventana
ok(m5.scrolls.length === 1 && m5.scrolls[0].top === 492, 'en el escritorio la zona llega hasta el borde de la ventana');
var m6 = montar({ escritorio: true });
abrir(m6, 450);   // grafica 584-774: en el telefono quedaria detras de la barra (745), aca no hay barra abajo
ok(m0.api.desplazo && m6.scrolls.length === 0, 'y ahi no se mueve lo que en el escritorio ya se ve');

console.log('\nC) un solo signo menos en el titular de una perdida');
var mS = montar();
var aS = abrir(mS, 100, { symbol: 'GOOG', precioCompra: 200, precioActual: 109, qty: 1373.6, valor: 149722, cuenta: 'CS', gfTicker: 'GOOG', cripto: false });
var td = aS.cont.children[1].children[0];
var tit = (td._html.match(/<div class="detres">[\s\S]*?<\/b><\/div>/) || [''])[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
var aU = abrir(mS, 100, POS);
var titU = (aU.cont.children[1].children[0]._html.match(/<div class="detres">[\s\S]*?<\/b><\/div>/) || [''])[0];
ok(/−USD [\d,]+ −45\.5%/.test(tit) && /\+USD 5,100/.test(titU) && /\+89\.5%/.test(titU),
  'el monto y el % llevan el MISMO menos tipografico: "' + tit + '" (y una ganancia sigue con sus dos "+")');
ok(tit.indexOf('-') === -1, 'y ningun guion como signo en el titular');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
