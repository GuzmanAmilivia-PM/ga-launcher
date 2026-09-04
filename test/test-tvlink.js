// Arnés del ancla "abrir en TradingView" sobre el mini-widget (29-30/08/2026).
// El widget va en un iframe de otro origen: el toque no puede llegarle con
// intencion nuestra, asi que crearTvWidget pone un ancla transparente encima
// que lleva directo al grafico web completo del mismo ticker.
//
// HISTORIA: la primera version (29/08) intentaba antes abrir la app nativa
// via su esquema privado (tradingview://) y caia al link web si nadie
// contestaba en ~1s. Se probo en el telefono el 29-30/08: la app SI abria,
// pero TradingView no documenta el formato del parametro en ningun lado y
// ningun formato probado la llevaba al ticker pedido — abria siempre en la
// pantalla general (la watchlist), lo que ademas rompia el respaldo web: al
// tomar la pantalla la app, `document.hidden` se ponia true y el codigo
// pensaba que ya habia terminado bien, dejando a Guzman sin ver NUNCA el
// ticker que toco. Se saco el intento de app entero (30/08/2026, PWA
// `1.8.133`): ir directo al link web es mas simple y siempre acierta.
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var codigo = ruta.bloque(html,
  '// ---------- Detalle desplegable por activo + grafico TradingView ----------',
  '// ---------- Retirar / Depositar liquidez ----------');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

function nodo(tag) {
  var n = {
    tag: tag, children: [], style: {}, atributos: {}, listeners: {},
    setAttribute: function (k, v) { n.atributos[k] = v; },
    addEventListener: function (ev, fn) { n.listeners[ev] = fn; },
    appendChild: function (c) { n.children.push(c); return c; }
  };
  return n;
}

var ctx = {
  document: { createElement: function (t) { return nodo(t); } },
  esTemaClaro: function () { return false; },
  encodeURIComponent: encodeURIComponent,
  JSON: JSON, Number: Number, String: String, isFinite: isFinite, Math: Math
};
var fn = new Function(Object.keys(ctx).join(','), codigo + '\nreturn crearTvWidget;');
var crearTvWidget = fn.apply(null, Object.keys(ctx).map(function (k) { return ctx[k]; }));

console.log('\nA) el ancla cubre el widget y apunta al MISMO ticker');
var caja = nodo('div');
crearTvWidget(caja, 'QQQ');
ok(caja.children.length === 2, 'iframe + ancla (=' + caja.children.length + ')');
var fr = caja.children[0], a = caja.children[1];
ok(fr.tag === 'iframe' && fr.src.indexOf('mini-symbol-overview') !== -1, 'el widget sigue siendo el iframe aislado de siempre');
ok(a.tag === 'a' && a.href === 'https://www.tradingview.com/chart/?symbol=QQQ', 'el ancla lleva al grafico web del mismo simbolo');
ok(a.target === '_blank' && a.rel === 'noopener', 'en pestana nueva y sin opener');
ok(/position:absolute/.test(a.style.cssText) && caja.style.position === 'relative',
  'tapa el widget entero (absolute sobre el contenedor relative)');
ok(!a.listeners.click, 'sin click enganchado: es un link real, el HTML solo ya alcanza');
ok((a.atributos['aria-label'] || '').indexOf('TradingView') !== -1, 'accesible: el ancla dice a donde va');

console.log('\nB) cripto: el simbolo compuesto viaja entero y escapado');
var caja2 = nodo('div');
crearTvWidget(caja2, 'BINANCE:BTCUSDT');
var a2 = caja2.children[1];
ok(a2.href === 'https://www.tradingview.com/chart/?symbol=BINANCE%3ABTCUSDT',
  'los dos puntos del BINANCE: van escapados en la URL');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
