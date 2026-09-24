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
// El velo de atras (A11, 24/09/2026): aparece con el menu y tocarlo lo cierra.
m = montar();
var velo = m.el('menuVelo');
m.g.toggleMenu(true);
ok(velo.hidden === false, 'con el menu abierto, el velo de atras esta');
velo.onclick();
ok(!m.el('menuPanel').classList.contains('open') && velo.hidden === true, 'tocar el velo cierra el menu y el velo se va');
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

console.log('\nH) el menu con el dedo: se abre desde el borde y se cierra deslizando (24/09/2026)');
// Pedido de Guzman: "que la ventana desplegable de inicio se pueda acceder y
// cerrar desplazando el dedo". Los toques se disparan por los oyentes REALES
// del documento (vistas.js los engancha al cargar).
function toque(mm, tipo, x, y) {
  var t = { clientX: x, clientY: y };
  mm.g.document.__disparar(tipo, { touches: tipo === 'touchend' ? [] : [t], changedTouches: [t] });
}
// El reloj de la app, a mano: el gesto distingue un arrastre lento de un golpe
// rapido (px por ms), y los toques de aca llegan todos en el mismo milisegundo.
function reloj(mm, ms) {
  vm.runInContext('if (typeof __t === "undefined") { var __t = 1000; Date.now = function () { return __t; }; } __t += ' + (ms || 0) + ';', mm.g);
}
function arrastre(mm, x0, x1, y, ms) {
  reloj(mm, 0);
  toque(mm, 'touchstart', x0, y || 300);
  reloj(mm, ms === undefined ? 400 : ms);
  toque(mm, 'touchmove', x0 + (x1 - x0) / 2, y || 300);
  toque(mm, 'touchmove', x1, y || 300);
}
m = montar();
var panelM = m.el('menuPanel');
panelM.offsetWidth = 375;
arrastre(m, 8, 160);
ok(/translateX\(-2\d\dpx\)/.test(panelM.style.transform) && panelM.style.transition === 'none', 'el panel sigue al dedo mientras arrastra: ' + panelM.style.transform);
toque(m, 'touchend', 160, 300);
ok(panelM.classList.contains('open'), 'desde el borde, pasado un tercio: se abre');
ok(panelM.style.transform === '' && panelM.style.transition === '', 'y el panel vuelve a su CSS (la transicion termina el recorrido)');
ok(m.estado().menu === 1, 'abierto con el dedo es un paso del historial, igual que con el logo');
// Cerrarlo deslizando hacia la izquierda.
arrastre(m, 300, 120);
toque(m, 'touchend', 120, 300);
m.timers(); m.h.__resolver();
ok(!panelM.classList.contains('open') && m.h.__indice() === 0, 'deslizando hacia la izquierda se cierra, y su paso se va');
// Un arrastre corto y lento vuelve a su lugar.
m = montar();
panelM = m.el('menuPanel'); panelM.offsetWidth = 375;
arrastre(m, 8, 70);
toque(m, 'touchend', 70, 300);
ok(!panelM.classList.contains('open') && panelM.style.transform === '', 'corto: no se abre y el panel vuelve');
// Lejos del borde no es el menu (es el carrusel, una fila, la pagina).
arrastre(m, 120, 330);
toque(m, 'touchend', 330, 300);
ok(!panelM.classList.contains('open') && panelM.style.transform === '', 'arrancando lejos del borde, el menu no se entera');
// Vertical es scroll.
toque(m, 'touchstart', 8, 300); toque(m, 'touchmove', 12, 400); toque(m, 'touchmove', 200, 420);
toque(m, 'touchend', 200, 420);
ok(!panelM.classList.contains('open') && panelM.style.transform === '', 'si el dedo arranca vertical, es scroll: el menu no se mueve');
// En una pantalla secundaria el borde es del gesto de volver de iOS.
m.g.setView('posiciones');
arrastre(m, 8, 250);
toque(m, 'touchend', 250, 300);
ok(!panelM.classList.contains('open'), 'en una secundaria (Positions) el borde es para volver, no abre el menu');
// Con la app bloqueada (Face ID), nada.
m = montar();
panelM = m.el('menuPanel'); panelM.offsetWidth = 375;
m.g.appBloqueada = true;
arrastre(m, 8, 250);
toque(m, 'touchend', 250, 300);
ok(!panelM.classList.contains('open'), 'con la app bloqueada no se abre');
// El carrusel del Inicio y las filas de la Watchlist le ceden el borde.
// ALCANCE: mira el codigo escrito (los dos gestos tienen sus propios arneses).
ok(/clientX <= MENU_BORDE_PX\) \{ x0 = null; return; \}/.test(html), 'el carrusel ignora un toque que arranca en el borde');
ok(/e\.clientX <= MENU_BORDE_PX\) \{ decidido = true; return; \}/.test(html), 'y las filas de la Watchlist tambien');

// Un golpe rapido y corto (60 px en 40 ms) alcanza.
m = montar();
panelM = m.el('menuPanel'); panelM.offsetWidth = 375;
arrastre(m, 8, 68, 300, 40);
toque(m, 'touchend', 68, 300);
ok(panelM.classList.contains('open'), 'un golpe rapido desde el borde abre aunque sea corto');

console.log('\nI) el teclado en la computadora (A11): Esc cierra, Enter abre la fila');
m = montar();
panelM = m.el('menuPanel');
m.g.toggleMenu(true);
m.g.document.__disparar('keydown', { key: 'Escape', target: {} });
ok(!panelM.classList.contains('open'), 'Esc cierra el menu');
var fila = { tabIndex: -1, attrs: {}, clicks: 0,
  setAttribute: function (k, v) { this.attrs[k] = v; }, getAttribute: function (k) { return this.attrs[k] === undefined ? null : this.attrs[k]; },
  click: function () { this.clicks++; } };
m.g.hacerTocable(fila);
ok(fila.tabIndex === 0 && fila.attrs.role === 'button', 'una fila tocable se alcanza con Tab y se anuncia como boton');
var prevenido = false;
m.g.document.__disparar('keydown', { key: 'Enter', target: fila, preventDefault: function () { prevenido = true; } });
ok(fila.clicks === 1 && prevenido, 'Enter la abre, como un toque');
m.g.document.__disparar('keydown', { key: ' ', target: fila, preventDefault: function () {} });
ok(fila.clicks === 2, 'y la barra espaciadora tambien');
m.g.document.__disparar('keydown', { key: 'Enter', target: { getAttribute: function () { return null; } } });
ok(fila.clicks === 2, 'Enter en otra cosa (un campo de texto) no hace nada raro');
// Donde se arman las filas que se tocan. ALCANCE: el codigo escrito.
['showAccount(c.acc, \'portafolio\'); }; if (typeof hacerTocable', 'showAccount(acc, \'cash\'); }; if (typeof hacerTocable']
  .forEach(function (s) { ok(html.indexOf(s) !== -1, 'la usa: ' + s.slice(0, 32)); });
ok((html.match(/hacerTocable\(tr\)/g) || []).length === 3, 'y las tres tablas de posiciones (Inicio, Positions, cada cuenta)');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
