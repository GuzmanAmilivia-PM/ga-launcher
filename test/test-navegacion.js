// Arnés del historial: volver deslizando (24/09/2026, auditoría general A7).
//
// El gesto de iOS de deslizar desde el borde izquierdo —lo más cómodo para el
// pulgar de un zurdo— no hacía nada: cambiar de pantalla no dejaba nada en el
// historial. Ahora cada pantalla secundaria deja su paso (vistas.js, "El
// historial"). Corre con la app cargada ENTERA (_entorno.js) y un historial
// de mentira con la forma del real: back() y go() se resuelven DESPUÉS, con un
// 'popstate' (history.__resolver()), como en el navegador.
//
// Lo que custodia:
//   A) al abrir, la raíz queda anotada;
//   B) una pantalla secundaria deja su paso, y el gesto (popstate) y el botón
//      "Back" vuelven a la misma pantalla sin que la pila crezca;
//   C) las cinco pestañas son raíces: no dejan paso, y tocar una desde una
//      secundaria vuelve el historial al principio;
//   D) el menú es un paso: el gesto lo cierra; un tile ocupa su lugar;
//   E) una cuenta vuelve a ESA cuenta, y con su pantalla de origen;
//   F) al volver se restaura cuánto habías bajado;
//   G) repintar no es navegar, y sin historial todo sigue andando.
var vm = require('vm');
var entorno = require('./_entorno');
var ruta = require('./_ruta');
var html = ruta.leerIndex();

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

// Un classList que de verdad guarda (el menú se abre y se cierra con una clase).
function claseReal() {
  var s = {};
  return {
    add: function (c) { s[c] = true; }, remove: function (c) { delete s[c]; },
    toggle: function (c, on) { var v = on === undefined ? !s[c] : !!on; if (v) s[c] = true; else delete s[c]; return v; },
    contains: function (c) { return !!s[c]; }
  };
}

function montar() {
  var c = entorno.cargar({});
  var g = c.ambito;
  var elems = {};
  // La app se cargó con el DOM permisivo del entorno; de acá en adelante cada
  // id es UN elemento que recuerda lo que se le hizo.
  g.document.getElementById = function (id) {
    if (!elems[id]) {
      var e = entorno.elemento();
      e.id = id;
      e.style = {};
      e.classList = claseReal();
      elems[id] = e;
    }
    return elems[id];
  };
  // Las pantallas arrancan cerradas salvo el Inicio, como en el index.html.
  ['view-inicio'].forEach(function (id) { g.document.getElementById(id).style.display = ''; });
  var timers = [];
  g.setTimeout = function (f) { timers.push(f); return timers.length; };
  var scrolls = [];
  g.scrollTo = function (x, y) { scrolls.push(y); g.scrollY = y; };
  // Lo que las pantallas piden al entrar no importa acá: se apaga.
  ['renderPortafolio', 'cargarAnalisis', 'renderPosiciones', 'cargarAnalisisDetalle', 'pintarDiseno',
   'pintarSaludApp', 'cargarPlataformas', 'cargarEstadoIA', 'cargarEstadoFinnhub', 'cargarBackups',
   'cargarWatchlist', 'cargarEstadoIBKR', 'prepararBNB', 'cargarEstadoCS', 'cargarRendAnual', 'prepararIA',
   'prepararSeguridad', 'cargarResultados', 'pedirNoticias', 'cargarOperaciones', 'mostrarRendimiento',
   'restaurarVistaCuenta', 'itauParar', 'mostrarBtg'].forEach(function (f) { g[f] = function () {}; });
  // El backend no contesta nada: cualquier pedido queda en el aire (lo que
  // se prueba es la navegacion, no los datos de cada pantalla).
  var run = new Proxy({}, { get: function (t, k) {
    return (k === 'withSuccessHandler' || k === 'withFailureHandler') ? function () { return run; } : function () {};
  } });
  g.google = { script: { run: run } };
  return {
    c: c, g: g, h: g.history, el: g.document.getElementById, scrolls: scrolls,
    timers: function () { timers.splice(0).forEach(function (f) { f(); }); },
    vista: function () { return vm.runInContext('currentView', g); },
    estado: function () { return g.history.state || {}; }
  };
}

console.log('\nA) al abrir, la raiz queda anotada');
var m = montar();
ok(m.c.errores.length === 0, 'la app carga entera' + (m.c.errores.length ? ': ' + m.c.errores.join(' | ') : ''));
ok(m.estado().ga === 1 && m.estado().v === 'inicio' && m.estado().p === 0, 'la entrada de arranque es el Inicio, profundidad 0: ' + JSON.stringify(m.estado()));
ok(m.h.scrollRestoration === 'manual', 'el scroll lo restaura la app, no el navegador');
ok(m.h.length === 1, 'y no agrega nada: una sola entrada');

console.log('\nB) una pantalla secundaria deja su paso; el gesto y "Back" vuelven');
m.g.setView('posiciones');
ok(m.h.length === 2 && m.estado().v === 'posiciones' && m.estado().p === 1, 'Posiciones empuja su paso (p=1)');
// El gesto de iOS: el navegador va atras y avisa con popstate.
m.h.back(); m.h.__resolver();
ok(m.vista() === 'inicio', 'el gesto de volver deja el Inicio a la vista: ' + m.vista());
ok(m.h.__indice() === 0, 'y el historial queda en la raiz');
// Ahora con el boton "Back" de la pagina.
m.g.setView('posiciones');
ok(m.h.length === 2, 'volver a entrar no apila de mas (el paso anterior se reemplaza)');
m.g.volver('inicio');
ok(m.vista() === 'posiciones', 'el boton pide el atras al historial: la pantalla cambia cuando el historial avisa');
m.h.__resolver();
ok(m.vista() === 'inicio' && m.h.__indice() === 0, '"Back" hace lo mismo que el gesto');
// Dos niveles: Keys -> IBKR connection -> atras -> Keys.
m.g.setView('config'); m.g.setView('ibkr');
ok(m.estado().v === 'ibkr' && m.estado().p === 2, 'Keys y despues IBKR connection: dos pasos (p=2)');
m.g.volver('config'); m.h.__resolver();
ok(m.vista() === 'config' && m.estado().p === 1, 'volver desde IBKR connection deja Keys');
m.g.volver('inicio'); m.h.__resolver();
ok(m.vista() === 'inicio' && m.estado().p === 0, 'y otra vez, el Inicio');

console.log('\nC) las pestañas son raices: sin paso, y tocar una vuelve al principio');
m = montar();
m.g.setView('portafolio');
ok(m.h.length === 1 && m.estado().v === 'portafolio' && m.estado().p === 0, 'cambiar de pestaña NO empuja: la raiz pasa a ser Portfolio');
m.g.setView('analisis');
m.g.setView('trade');
ok(m.vista() === 'trade', 'tocar Trades desde Analysis muestra Trades en el acto');
m.h.__resolver();
ok(m.h.__indice() === 0 && m.estado().v === 'trade' && m.estado().p === 0, 'y el historial vuelve a la raiz, que ahora es Trades: ' + JSON.stringify(m.estado()));
ok(m.vista() === 'trade', 'sin que el aviso del historial le cambie la pantalla');
m.h.back(); m.h.__resolver();
ok(m.vista() === 'trade' && m.h.__indice() === 0, 'en una raiz el gesto no tiene a donde ir (no choca con el carrusel ni con la Watchlist)');

console.log('\nD) el menu es un paso: el gesto lo cierra, y un tile ocupa su lugar');
m = montar();
var menu = m.el('menuPanel');
m.g.toggleMenu(true);
ok(menu.classList.contains('open') && m.estado().menu === 1 && m.estado().p === 1, 'abrir el menu empuja su paso');
m.h.back(); m.h.__resolver();
ok(!menu.classList.contains('open') && m.vista() === 'inicio' && m.h.__indice() === 0, 'el gesto de volver cierra el menu y deja la pantalla de abajo');
// Un tile que abre otra pantalla: toggleMenu(false) + setView, en el mismo turno.
m.g.toggleMenu(true);
m.g.toggleMenu(false); m.g.setView('diseno');
m.timers(); m.h.__resolver();
ok(m.vista() === 'diseno' && m.estado().v === 'diseno' && !m.estado().menu && m.estado().p === 1, 'el tile Settings ocupa el paso del menu: ' + JSON.stringify(m.estado()));
m.h.back(); m.h.__resolver();
ok(m.vista() === 'inicio' && m.h.__indice() === 0, 'y volver desde Settings deja el Inicio, no el menu');
// Cerrado con su flecha (o al terminar el Sync): el paso se saca solo.
m.g.toggleMenu(true);
m.g.toggleMenu(false);
m.timers(); m.h.__resolver();
ok(m.h.__indice() === 0 && !m.estado().menu, 'cerrado con la flecha, su paso se saca: el proximo gesto no queda muerto');
// Un tile que va a una pestaña: el historial vuelve a la raiz.
m.g.toggleMenu(true);
m.g.toggleMenu(false); m.g.setView('trade');
m.timers(); m.h.__resolver();
ok(m.vista() === 'trade' && m.h.__indice() === 0 && m.estado().v === 'trade' && m.estado().p === 0, 'el tile Trades deja Trades como raiz');

console.log('\nE) una cuenta vuelve a ESA cuenta, con su pantalla de origen');
m = montar();
m.g.setView('cash');
var itau = m.g.ACCOUNTS.filter(function (a) { return a.key === 'ITAU'; })[0];
var ib = m.g.ACCOUNTS.filter(function (a) { return a.key === 'IB'; })[0];
m.g.showAccount(itau, 'cash');
ok(m.estado().v === 'account' && m.estado().acc === 'ITAU' && m.estado().ret === 'cash' && m.estado().p === 2, 'la entrada anota la cuenta y a donde vuelve: ' + JSON.stringify(m.estado()));
m.g.showAccount(itau, 'cash');
ok(m.h.length === 3, 'refrescar la misma cuenta (despues de guardar algo) no apila un paso');
m.h.back(); m.h.__resolver();
ok(m.vista() === 'cash', 'volver desde Itau deja Banking');
// Y hacia adelante (el gesto desde el borde derecho) reabre ITAU, no otra.
var abiertas = [];
var showReal = m.g.showAccount;
m.g.showAccount = function (acc, desde) { abiertas.push(acc.key + '<' + desde); return showReal(acc, desde); };
m.g.lastAcc = ib;   // la ultima cuenta cargada fue otra
m.h.forward(); m.h.__resolver();
ok(abiertas[0] === 'ITAU<cash', 'hacia adelante vuelve a abrir Itau, con Banking como origen: ' + abiertas.join(','));
// De una cuenta a OTRA cuenta (las dos entradas son 'account'): volver tiene
// que reabrir la primera, aunque la pantalla visible ya sea 'account'.
m = montar();
var itau2 = m.g.ACCOUNTS.filter(function (a) { return a.key === 'ITAU'; })[0];
var ib2 = m.g.ACCOUNTS.filter(function (a) { return a.key === 'IB'; })[0];
m.g.setView('cash');
m.g.showAccount(itau2, 'cash');
m.g.showAccount(ib2, 'cash');
ok(m.h.length === 4 && m.estado().acc === 'IB', 'abrir otra cuenta desde una cuenta SI es navegar: su propio paso');
var reabiertas = [];
var showReal2 = m.g.showAccount;
m.g.showAccount = function (acc, desde) { reabiertas.push(acc.key); return showReal2(acc, desde); };
m.h.back(); m.h.__resolver();
ok(reabiertas[0] === 'ITAU', 'volver desde IBKR reabre Itau, no se queda en IBKR: ' + reabiertas.join(','));

console.log('\nF) al volver, la pantalla queda donde la dejaste');
m = montar();
m.g.setView('portafolio');
m.g.scrollY = 640;
m.g.setView('analisis');
m.g.scrollY = 0;
m.h.back(); m.h.__resolver();
ok(m.vista() === 'portafolio' && m.scrolls[m.scrolls.length - 1] === 640, 'volver de Analysis a Portfolio restaura el scroll (640): ' + m.scrolls.slice(-2).join(','));

console.log('\nG) repintar no es navegar; y sin historial todo sigue andando');
m = montar();
m.g.setView('posiciones'); m.g.setView('posiciones');
ok(m.h.length === 2, 'setView de la misma pantalla dos veces: un solo paso');
m = montar();
m.g.history = undefined;   // un navegador sin la API
m.g.setView('diseno');
m.g.volver('inicio');
ok(m.vista() === 'inicio', 'sin historial, "Back" va a su destino de siempre');
// Todos los "Back" de la app pasan por volver(): si uno llamara a setView
// directo, apilaria un paso nuevo en vez de volver, y el gesto siguiente iria
// "para adelante". ALCANCE: mira el codigo escrito.
var backs = html.match(/(\w+Back'\)\.onclick = function \(\) \{[^}]*\})|(back\.onclick = function \(\) \{[^}]*\})/g) || [];
var malos = backs.filter(function (b) { return !/menuBack/.test(b) && !/volver\(/.test(b); });
ok(backs.length >= 14 && malos.length === 0, 'los ' + backs.length + ' botones "Back" usan volver()' + (malos.length ? ': ' + malos.join(' | ') : ''));
ok(/navTabPendiente = name; history\.go\(-p\)/.test(html), 'tocar una pestaña desde lo profundo vuelve el historial entero (go(-p)), no un paso');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
