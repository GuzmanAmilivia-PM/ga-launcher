// La DOBLE LINEA entre ETFs y acciones (14/09/2026).
//
// Pedido de Guzman: "Que haya una doble linea entre etfs y acciones, en los
// portfolios de charles Schwab ahi si pone etfs y acciones separados tambien,
// en IBKR no hay etfs pero si hubiera tambien".
//
// Reemplaza a los rotulos ETFs/Stocks que se fueron el 13/09 del Inicio: el
// corte que marcaban sigue estando, dicho con una raya en vez de una palabra.
//
// Este arnes EJECUTA los dos renders con un DOM de mentira y las
// implementaciones REALES de los helpers, en vez de mirar el texto escrito.
// La leccion es del mismo dia: el arnes de las fuentes EXIGIA la ruta rota
// porque miraba como estaba escrita la regla en vez de lo que hacia, y por eso
// la app cargo ocho dias con la tipografia del sistema sin que nada se pusiera
// rojo.
var ruta = require('./_ruta');
var html = ruta.leerIndex();

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}
function fuente(nombre, regex) {
  var m = html.match(regex);
  if (!m) { console.log('  FALLA: no encuentro ' + nombre); process.exit(1); }
  return m[0];
}

// ---- las implementaciones REALES que los dos bloques usan ----
var preambulo = 'var montosOcultos = false;\nvar sparksPorSym = {};\n' +
  fuente('esc', /function esc\(s\) \{[\s\S]*?\n\}/) + '\n' +
  fuente('fmt', /function fmt\(n\) \{[\s\S]*?\n\}/) + '\n' +
  fuente('fmtNum', /function fmtNum\(n\) \{[\s\S]*?\n\}/) + '\n' +
  fuente('signoPct', /function signoPct[^\n]*\}/) + '\n' +
  fuente('pctHtml', /function pctHtml[\s\S]*?\n\}/) + '\n' +
  fuente('SIMBOLOS_CASH', /var SIMBOLOS_CASH = \[[^\]]*\];/) + '\n' +
  fuente('esFilaCash', /function esFilaCash\(p\) \{[\s\S]*?\n\}/) + '\n' +
  fuente('tipoDe', /function tipoDe\(h\) \{[\s\S]*?\n\}/) + '\n' +
  fuente('ordenarPorTipo', /function ordenarPorTipo\(list\) \{[\s\S]*?\n\}/) + '\n' +
  fuente('logoUrl', /function logoUrl\(h\) \{[\s\S]*?\n\}/) + '\n' +
  fuente('celdaInstrumentoHtml', /function celdaInstrumentoHtml\(h, descHtml\) \{[\s\S]*?\n\}/) + '\n' +
  // sparkSvg va de MENTIRA, y es la unica: dibuja el mini-grafico, que en esta
  // prueba es decorado — lo juzgan test-posiciones y test-vista-posiciones.
  // (Tampoco se puede extraer con el patron de siempre: su cuerpo tiene una
  // llave de cierre al principio de una linea y el recorte sale partido.)
  'function sparkSvg() { return "<svg></svg>"; }\n' +
  fuente('SPARK_W', /var SPARK_W = [^;]*;/) + '\n' +
  fuente('sparkDe', /function sparkDe\(h\) \{[\s\S]*?\n\}/) + '\n' +
  fuente('EXT_UMBRAL_PCT', /var EXT_UMBRAL_PCT = [^;]*;/) + '\n' +
  fuente('extHtml', /function extHtml\(p\) \{[\s\S]*?\n\}/) + '\n' +
  fuente('daychgHtml', /function daychgHtml\(p\) \{[\s\S]*?\n\}/) + '\n' +
  fuente('gananciaHtml', /function gananciaHtml\(p\) \{[\s\S]*?\n\}/) + '\n';

// ---- DOM de mentira (el mismo de test-vista-posiciones) ----
function elemento(id) {
  var e = { id: id, style: {}, className: '', children: [], _html: '', hidden: false, colSpan: 0 };
  Object.defineProperty(e, 'innerHTML', {
    get: function () { return e._html; },
    set: function (v) { e._html = v; e.children.length = 0; }
  });
  Object.defineProperty(e, 'textContent', {
    get: function () { return e._txt || ''; },
    set: function (v) { e._txt = String(v); }
  });
  e.appendChild = function (c) { e.children.push(c); return c; };
  e.addEventListener = function (ev, fn) { e._ev = e._ev || {}; e._ev[ev] = fn; };
  e.querySelector = function () { return null; };
  return e;
}

function armarCtx(extra) {
  var els = {};
  var ctx = {
    document: {
      getElementById: function (id) { if (!els[id]) els[id] = elemento(id); return els[id]; },
      createElement: function () { return elemento(null); }
    },
    engancharLogos: function () {},
    toggleDetalle: function () {},
    Number: Number, isFinite: isFinite, String: String, Math: Math, Object: Object
  };
  for (var k in extra) ctx[k] = extra[k];
  ctx._els = els;
  return ctx;
}
function evaluar(ctx, codigo, devolver) {
  var nombres = Object.keys(ctx).filter(function (n) { return n !== '_els'; });
  var fn = new Function(nombres.join(','), preambulo + codigo + '\nreturn ' + devolver + ';');
  return fn.apply(null, nombres.map(function (n) { return ctx[n]; }));
}
// Las clases de cada fila pintada, en orden.
function clasesDe(tbody) {
  return tbody.children.map(function (f) { return f.className; });
}
// El simbolo de una fila, leido del HTML que de verdad se escribio.
function simboloDe(fila) {
  var m = fila.innerHTML.match(/class="sym"[^>]*>([A-Z0-9.\-]+)</);
  return m ? m[1] : '?';
}

// ===========================================================================
console.log('\nA) el detalle de una cuenta (Charles Schwab, IBKR, Binance)');
// ===========================================================================
var codigoCuenta = ruta.bloque(html,
  'function renderAccount(acc, data) {',
  '// ---------- Posiciones (la lista completa, desde el Inicio) ----------');

var ctxCuenta = armarCtx({
  lastAcc: null, lastAccData: null,
  // Itau tiene su propio bloque arriba de la tabla; en Schwab y IBKR no pinta
  // nada. El espia alcanza: lo que se prueba aca es la tabla.
  renderFondoItau: function () {},
  itauEsCuenta: function (acc) { return acc && acc.key === 'ITAU'; },
  comprasItauHtml: function () { return ''; },
  cambioDiaDe: function () { return null; }
});
var apiCuenta = evaluar(ctxCuenta, codigoCuenta, '{ renderAccount: renderAccount }');

// Charles Schwab tal como llega del Worker: por valor descendente, con los
// ETFs y las acciones MEZCLADOS y una fila de liquidez en el medio.
var schwab = {
  total: 72370, liquidez: 1947,
  posiciones: [
    { symbol: 'VOO', nombre: 'Vanguard S&P 500', tipo: 'etf', valor: 23593, qty: 33, precioActual: 715, precioCompra: 431.9 },
    { symbol: 'META', nombre: 'Meta Platforms', tipo: 'accion', valor: 16000, qty: 24, precioActual: 664, precioCompra: 300 },
    { symbol: 'QQQ', nombre: 'Invesco QQQ', tipo: 'etf', valor: 15373, qty: 21, precioActual: 732, precioCompra: 404.7 },
    { symbol: 'MSFT', nombre: 'Microsoft', tipo: 'accion', valor: 9000, qty: 18, precioActual: 509, precioCompra: 300 },
    { symbol: 'LIQUIDEZ', nombre: 'LIQUIDEZ', tipo: 'cash', valor: 1947, qty: null, precioActual: null, precioCompra: null }
  ]
};
apiCuenta.renderAccount({ key: 'CS', nombre: 'CS' }, schwab);
var filasCS = ctxCuenta._els.accBody.children;
var simbolosCS = filasCS.map(simboloDe);
var clasesCS = clasesDe(ctxCuenta._els.accBody);

ok(simbolosCS.join(',') === 'VOO,QQQ,META,MSFT',
   'los ETFs van primero y despues las acciones, aunque el Worker los mande mezclados (salio: ' + simbolosCS.join(',') + ')');
ok(simbolosCS.indexOf('LIQUIDEZ') === -1, 'la fila de liquidez no se lista: ya esta en "Cash in account"');
var cortesCS = clasesCS.filter(function (c) { return c.indexOf('corte-grupo') !== -1; });
ok(cortesCS.length === 1, 'hay UNA sola doble linea (salieron ' + cortesCS.length + ')');
ok(clasesCS[2].indexOf('corte-grupo') !== -1,
   'y cae arriba de la PRIMERA accion (META), no abajo del ultimo ETF');
ok(clasesCS[0].indexOf('corte-grupo') === -1, 'la primera fila de todas NO lleva linea: no abre un grupo nuevo, abre la tabla');
ok(clasesCS.every(function (c) { return c.indexOf('asset-row') !== -1; }), 'todas las filas siguen siendo asset-row (se puede tocar para abrir el detalle)');

// IBKR HOY no tiene ETFs: sin cambio de tipo no hay linea. El dia que compre
// uno, aparece sola — que es exactamente lo que pidio Guzman.
var ibkr = {
  total: 40000, liquidez: 500,
  posiciones: [
    { symbol: 'ASML', nombre: 'ASML Holding', tipo: 'accion', valor: 20000, qty: 12, precioActual: 1592, precioCompra: 900 },
    { symbol: 'OMF', nombre: 'OneMain', tipo: 'accion', valor: 12000, qty: 200, precioActual: 60, precioCompra: 45 }
  ]
};
apiCuenta.renderAccount({ key: 'IB', nombre: 'IB' }, ibkr);
var clasesIB = clasesDe(ctxCuenta._els.accBody);
ok(clasesIB.length === 2 && clasesIB.every(function (c) { return c.indexOf('corte-grupo') === -1; }),
   'IBKR, que hoy es todo acciones, no lleva ninguna doble linea');

ibkr.posiciones.unshift({ symbol: 'SMH', nombre: 'VanEck Semiconductor', tipo: 'etf', valor: 30000, qty: 55, precioActual: 545, precioCompra: 300 });
apiCuenta.renderAccount({ key: 'IB', nombre: 'IB' }, ibkr);
var clasesIB2 = clasesDe(ctxCuenta._els.accBody);
ok(clasesIB2.length === 3 && clasesIB2[1].indexOf('corte-grupo') !== -1 &&
   clasesIB2[0].indexOf('corte-grupo') === -1 && clasesIB2[2].indexOf('corte-grupo') === -1,
   'y el dia que IBKR tenga un ETF, la linea aparece sola en su sitio');

// ===========================================================================
console.log('\nB) el Inicio (Principales posiciones), plegado y expandido');
// ===========================================================================
// El Inicio esta repartido en dos bloques de tablero.js con el mini-grafico en
// el medio, y el segundo llega hasta el final del archivo: por eso el marcador
// de cierre es la primera linea de calor.js, el que carga despues. Si alguno se
// renombra, ruta.bloque avisa en vez de dejar pasar una prueba vacia.
var codigoInicio = ruta.bloque(html,
  '// ---------- Principales posiciones (Inicio) ----------',
  '// ---------- Mini-grafico por posicion (V6) ----------') + '\n' +
  fuente('filaHoldingHtml', /function filaHoldingHtml\(h\) \{[\s\S]*?\n\}/) + '\n' +
  ruta.bloque(html,
  '// ---------- Reparto de Principales posiciones ----------',
  '// El mapa de calor mensual (V5) y la tarjeta del anio');

var ctxInicio = armarCtx({});
var apiInicio = evaluar(ctxInicio, codigoInicio,
  '{ renderHoldings: renderHoldings, toggleHoldings: toggleHoldings }');

// Tres ETFs y tres acciones, como la cartera real de la captura.
var cartera = [
  { symbol: 'VOO', nombre: 'Vanguard S&P 500', tipo: 'etf', valor: 23593, qty: 33, precioActual: 701, precioCompra: 431.9 },
  { symbol: 'QQQ', nombre: 'Invesco QQQ', tipo: 'etf', valor: 15373, qty: 21, precioActual: 712, precioCompra: 404.7 },
  { symbol: 'SMH', nombre: 'VanEck Semiconductor', tipo: 'etf', valor: 9000, qty: 16, precioActual: 545, precioCompra: 300 },
  { symbol: 'ASML', nombre: 'ASML Holding', tipo: 'accion', valor: 8000, qty: 5, precioActual: 1592, precioCompra: 900 },
  { symbol: 'META', nombre: 'Meta Platforms', tipo: 'accion', valor: 7000, qty: 10, precioActual: 664, precioCompra: 300 },
  { symbol: 'MSFT', nombre: 'Microsoft', tipo: 'accion', valor: 6000, qty: 12, precioActual: 509, precioCompra: 300 }
];
apiInicio.renderHoldings(cartera);
var clasesPleg = clasesDe(ctxInicio._els.holdingsList);
var visiblesPleg = clasesPleg.filter(function (c) { return c.indexOf('hidden-row') === -1; });
ok(visiblesPleg.length === 3, 'plegada se ven los 3 ETFs (se ven ' + visiblesPleg.length + ')');
ok(clasesPleg.every(function (c) { return c.indexOf('corte-grupo') === -1; }),
   'PLEGADA no hay doble linea: si las acciones no se ven, una raya al final de la tabla no separaria nada');

apiInicio.toggleHoldings();
var clasesExp = clasesDe(ctxInicio._els.holdingsList);
var cortesExp = [];
clasesExp.forEach(function (c, i) { if (c.indexOf('corte-grupo') !== -1) cortesExp.push(i); });
ok(clasesExp.length === 6 && clasesExp.every(function (c) { return c.indexOf('hidden-row') === -1; }),
   'expandida se ven las 6');
ok(cortesExp.length === 1 && cortesExp[0] === 3,
   'y hay UNA doble linea, arriba de la primera accion (indices con linea: ' + JSON.stringify(cortesExp) + ')');

// ===========================================================================
console.log('\nC) la regla de estilo que la dibuja');
// ===========================================================================
var regla = (html.match(/tr\.asset-row\.corte-grupo[^\n]*\n?/) || [''])[0];
ok(!!regla, 'existe la regla .corte-grupo');
// Se mira lo que TIENE QUE valer, no el numero exacto: el estilo `double` (dos
// rayas, que es lo pedido) y un ancho de 3px o mas, porque por debajo de eso el
// navegador dibuja `double` como una sola raya y ademas empataria con el 1px de
// las filas comunes, que con border-collapse decide quien gana.
var anchoLinea = Number((regla.match(/border-top:\s*(\d+(?:\.\d+)?)px/) || [0, 0])[1]);
ok(/border-top:[^;]*\bdouble\b/.test(regla),
   'es una DOBLE linea de verdad (border-style double), no una mas gruesa: ' + regla.trim());
ok(anchoLinea >= 3,
   'y con ' + anchoLinea + 'px de ancho: por debajo de 3px `double` se dibuja como una sola raya');
// Con border-collapse el borde mas ancho gana: 3px pisa el 1px de la fila de
// arriba. Si alguien bajara el ancho a 1px, la linea de arriba empataria y la
// doble no se veria.
ok(/td \{[^}]*border-bottom: 1px solid var\(--border\)/.test(html),
   'las filas comunes siguen con su raya simple de 1px (la doble gana por ancho)');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
