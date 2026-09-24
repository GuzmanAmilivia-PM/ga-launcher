// Arnés de la experiencia de uso del teléfono (auditoría general del
// 23/09/2026, sección "Experiencia de uso"). Corre con la app cargada ENTERA
// (_entorno.js), así que toca las funciones reales en el orden real: render()
// de arranque.js, avisoFlotante de nucleo.js, las páginas de vistas.js.
//
// Lo que custodia:
//   A) el Inicio pide la lista de aportes si no llegó (punto 16): sin ella el
//      "pp vs S&P" se esconde a propósito, y con el arranque liviano no
//      llegaba nunca;
//   B) el aviso flotante (punto 12): lo bueno se va solo, un error o una
//      advertencia quedan hasta que se tocan;
//   C) Banking abre la página de cada cuenta (punto 17: Itaú y BTG solo se
//      alcanzaban desde la torta);
//   D) lo que se ve en el HTML: "Back" es un botón y Settings tiene uno, los
//      rangos en inglés, "Fixed deposit" en BTG y las áreas de toque.
var entorno = require('./_entorno');
var ruta = require('./_ruta');
var html = ruta.leerIndex();

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

// Un payload mínimo con la forma del de getPortfolioData (Datos.js del worker).
function payload() {
  var hoy = Date.now();
  return {
    total: 1000, liquidez: 100, liquidezPct: 0.1,
    cuentas: [
      { nombre: 'Interactive Brokers', valor: 600, liquido: 10 },
      { nombre: 'Itau', valor: 300, liquido: 80 },
      { nombre: 'BTG', valor: 100, liquido: 10 },
      { nombre: 'Cuenta rara', valor: 0, liquido: 0 }
    ],
    posiciones: [{ symbol: 'VOO', tipo: 'etf', valor: 900, cambioDia: 1, precioActual: 500, precioCompra: 400, qty: 1.8 }],
    topHoldings: [], sparks: {}, bench: null, serieGrupo: null,
    serie: [{ fecha: hoy - 86400000, valor: 990 }, { fecha: hoy, valor: 1000 }],
    actualizado: hoy, avisosSync: []
  };
}

function montar(conClave) {
  var c = entorno.cargar({});
  var g = c.ambito;
  var elems = {};
  g.document.getElementById = function (id) {
    if (!elems[id]) {
      var e = entorno.elemento();
      e.id = id;
      e.hidden = false;
      // Las otras pantallas, cerradas: render() repinta las que estan a la
      // vista, y este DOM no tiene canvas.
      if (/^view-/.test(id)) e.style.display = 'none';
      // La lista de Banking guarda sus filas para poder tocarlas.
      if (id === 'cashList') { e.filas = []; e.appendChild = function (r) { e.filas.push(r); return r; }; }
      elems[id] = e;
    }
    return elems[id];
  };
  g.document.createElement = function () { var e = entorno.elemento(); return e; };
  if (conClave) g.localStorage.setItem('ga_token', 'x');
  var timers = [];
  g.setTimeout = function (f, ms) { timers.push({ f: f, ms: ms }); return timers.length; };
  g.clearTimeout = function (n) { if (timers[n - 1]) timers[n - 1].f = null; };
  var espias = { aportes: 0, cuentas: [] };
  g.cargarAportes = function () { espias.aportes++; g.apoCargado = true; };
  g.pedirNoticias = function () {};
  g.showAccount = function (acc, desde) { espias.cuentas.push([acc && acc.key, desde]); };
  return { c: c, g: g, el: function (id) { return g.document.getElementById(id); }, timers: timers, espias: espias,
    correrTimers: function () { timers.splice(0).forEach(function (t) { if (t.f) t.f(); }); } };
}

console.log('\nA) el Inicio pide los aportes si no llegaron (punto 16)');
var m = montar(true);
ok(m.c.errores.length === 0, 'la app carga entera' + (m.c.errores.length ? ': ' + m.c.errores.join(' | ') : ''));
m.g.apoCargado = false;
m.g.render(payload());
ok(!/could not be rendered/.test(m.el('autoAviso').innerHTML), 'render() termina entero (no cae en su catch)');
ok(m.espias.aportes === 0, 'no en el mismo instante: primero se pinta (no compite con el arranque)');
m.correrTimers();
ok(m.espias.aportes === 1, 'despues de pintar, se piden: ' + m.espias.aportes);
m.g.render(payload());
m.correrTimers();
ok(m.espias.aportes === 1, 'y una sola vez: el sondeo del minuto no los vuelve a pedir (' + m.espias.aportes + ')');

m = montar(true);
m.g.apoCargado = true;   // llegaron con los extras, o se deslizo al panel
m.g.render(payload());
m.correrTimers();
ok(m.espias.aportes === 0, 'si ya estaban, no se piden de nuevo');

m = montar(false);
m.g.apoCargado = false;
m.g.render(payload());
m.correrTimers();
ok(m.espias.aportes === 0, 'sin clave guardada no se pide nada (volveria con "auth")');

console.log('\nB) el aviso flotante (punto 12)');
m = montar(true);
var af = m.el('avisoFlotante');
af.hidden = true;
m.g.avisoFlotante('&#10003; Logged', true);
ok(af.hidden === false && /Logged/.test(af.innerHTML), 'se muestra con el mensaje');
ok(/\bok\b/.test(af.className), 'marcado como bueno: ' + af.className);
var t = m.timers.filter(function (x) { return x.f; });
ok(t.length === 1 && t[0].ms === m.g.AVISO_FLOTANTE_MS, 'lo bueno se va solo, a los ' + (t[0] && t[0].ms) + ' ms');
m.correrTimers();
ok(af.hidden === true && af.innerHTML === '', 'y al vencer se esconde');

m.g.avisoFlotante('&#9888; Algo salio mal', false);
ok(af.hidden === false && /\berr\b/.test(af.className), 'un error se muestra marcado como error');
ok(m.timers.filter(function (x) { return x.f; }).length === 0, 'y NO se va solo: hay que leerlo');
m.g.cerrarAvisoFlotante();
ok(af.hidden === true, 'tocarlo lo cierra');

m.g.avisoFlotante('&#10003; Logged<br>&#9888; cash negativo', true, true);
ok(m.timers.filter(function (x) { return x.f; }).length === 0, 'un exito CON advertencias tampoco se va solo');

m.g.avisoFlotante('uno', true);
m.g.avisoFlotante('dos', false);
m.correrTimers();
ok(af.hidden === false && af.innerHTML === 'dos', 'un aviso nuevo cancela el reloj del anterior: el error no se lo lleva el vencimiento del exito');

console.log('\nC) Banking abre la pagina de cada cuenta (punto 17)');
m = montar(true);
m.g.apoCargado = true;
m.g.render(payload());
var filas = m.el('cashList').filas;
ok(filas.length === 4, 'una fila por cuenta: ' + filas.length);
var porNombre = {};
filas.forEach(function (f) { porNombre[(f.innerHTML.match(/<span>([^<]*)<\/span>/) || [])[1]] = f; });
ok(porNombre.IBKR && typeof porNombre.IBKR.onclick === 'function' && /clickable/.test(porNombre.IBKR.className), 'IBKR se toca');
porNombre.Itau.onclick();
ok(m.espias.cuentas.length === 1 && m.espias.cuentas[0][0] === 'ITAU' && m.espias.cuentas[0][1] === 'cash',
  'Itau abre SU pagina y volver regresa a Banking: ' + JSON.stringify(m.espias.cuentas));
porNombre.BTG.onclick();
ok(m.espias.cuentas[1] && m.espias.cuentas[1][0] === 'BTG', 'BTG tambien');
ok(porNombre['Cuenta rara'] && !porNombre['Cuenta rara'].onclick && !/clickable/.test(porNombre['Cuenta rara'].className),
  'una cuenta sin pagina no promete un toque que no lleva a ningun lado');

console.log('\nD) lo que se ve en el HTML y el CSS');
// ALCANCE: esto mira el HTML y el CSS ESCRITOS, no los mide. La medida real
// de las areas de toque se hizo en el navegador y esta en HISTORIAL.md.
var spans = html.match(/<span class="backlink"/g) || [];
var botones = html.match(/<button type="button" class="backlink" id="\w+">/g) || [];
ok(spans.length === 0, '"Back" ya no es un <span> (sin teclado ni lector de pantalla)');
ok(botones.length >= 13, 'es un <button>, en todas las paginas: ' + botones.length);
var iDis = html.indexOf('<div id="view-diseno"'), iDisFin = html.indexOf('<p class="viewtitle">Settings</p>');
ok(iDis !== -1 && html.slice(iDis, iDisFin).indexOf('id="disBack"') !== -1, 'Settings tiene su volver (era la unica pagina del menu sin el)');
ok(/getElementById\('disBack'\)\.onclick/.test(html), 'y esta conectado');
ok(!m.g.RANGES.some(function (r) { return /^\d[SA]$/.test(r.key); }), 'los rangos en ingles: ' + m.g.RANGES.map(function (r) { return r.key; }).join(' '));
ok(/Fixed deposit USD<\/span><input id="btgPfUsd"/.test(html) && /Fixed deposit UYU<\/span><input id="btgPfUyu"/.test(html),
  'en BTG el plazo fijo se llama "Fixed deposit": "Deposit" ya es poner plata');
// Todas las reglas que nombran `sel::after` sueltas (hay una compartida con
// content/position y una propia con las medidas).
function capa(sel) {
  var re = new RegExp(sel.replace('.', '\\.') + '::after \\{([^}]*)\\}', 'g'), mm, out = '';
  while ((mm = re.exec(html)) !== null) out += mm[1];
  return out;
}
function px(regla, lado) { var mm = regla.match(new RegExp(lado + ':\\s*(-?\\d+)px')); return mm ? -Number(mm[1]) : 0; }
// Alto de toque = alto del dibujo + lo que agranda la capa arriba y abajo.
// Los altos del dibujo son los medidos (21, 21, 18): la capa tiene que llegar
// a 44, lo que pide Apple.
[['.eyebtn', 21], ['.depositbtn', 21], ['.backlink', 18]].forEach(function (p) {
  var r = capa(p[0]);
  var alto = p[1] + px(r, 'top') + px(r, 'bottom');
  ok(alto >= 44, p[0] + ': el area de toque llega a ' + alto + ' px de alto (el dibujo sigue en ' + p[1] + ')');
});

console.log('\nE) "updating" al lado de la hora mientras se refresca (A6, 23/09/2026)');
m = montar(true);
m.g.apoCargado = true;
// El reloj de la APP (el del contexto de vm), no el de este proceso: con
// npm test a +100 dias (_futuro.js) el de aca esta adelantado y el de la app
// no, y "hace 10 minutos" quedaba en el futuro para la app.
var ahoraApp = require('vm').runInContext('Date.now()', m.g);
var viejoMs = ahoraApp - 10 * 60000;
var pl = payload(); pl.actualizado = viejoMs;
m.g.render(pl);
var pedidoOk = null, pedidoFail = null;
m.g.google = { script: { run: {
  withFailureHandler: function (f) { pedidoFail = f; return this; },
  withSuccessHandler: function (f) { pedidoOk = f; return this; },
  getPortfolioData: function () {}
} } };
m.g.loadData();
ok(/updating/.test(m.el('hoyHora').textContent), 'con el dato de hace 10 min y el pedido en camino, dice "updating": ' + m.el('hoyHora').textContent);
// La respuesta trae el MISMO dato viejo (el servidor sirve lo guardado): la
// marca se tiene que apagar igual. Con un dato fresco se apagaria sola por
// frescura y la prueba no diria nada del apagado.
var otraVieja = payload(); otraVieja.actualizado = viejoMs;
pedidoOk(otraVieja);
ok(!/updating/.test(m.el('hoyHora').textContent), 'al llegar la respuesta se apaga, aunque el dato siga viejo: ' + m.el('hoyHora').textContent);
m.g.loadData();
ok(/updating/.test(m.el('hoyHora').textContent), 'el pedido siguiente la vuelve a prender');
pedidoFail(new Error('sin red'));
ok(!/updating/.test(m.el('hoyHora').textContent), 'y si el pedido falla tambien se apaga (no queda "updating" para siempre)');

console.log('\nE2) cuando llegan los aportes, el mapa de calor se dibuja solo');
m = montar(true);
m.g.aportesCargados = false;
// Dos meses (el mapa necesita el cierre del anterior), con el reloj de la app.
var hoyApp = new (require('vm').runInContext('Date', m.g))();
m.g.fullSerie = [
  { fecha: new Date(hoyApp.getFullYear(), hoyApp.getMonth() - 1, 15).getTime(), valor: 990 },
  { fecha: hoyApp.getTime(), valor: 1000 }
];
m.g.renderMapaCalor();
ok(/Loading your deposits/.test(m.el('mapaCalor').innerHTML), 'sin la lista, el mapa la espera');
m.g.renderAportes({ ok: true, anio: 2026, aportes: 0, retiros: 0, neto: 0, lista: [], desde: '2025-09-01', crecimiento: null, cierresAnuales: [] });
ok(/mc-fila/.test(m.el('mapaCalor').innerHTML), 'renderAportes lo repinta en cuanto llega la lista');

console.log('\nF) la tarjeta del año dice la verdad sobre el indice, en ingles');
m = montar(true);
m.g.comparacionAnual = function () {
  return { pct: 5, idxPct: 4, idxNombre: 'S&P 500', desde: new Date(2025, 11, 30).getTime(), bruto: 8, aportes: 1000 };
};
m.g.renderAnual();
var anual = m.el('anualBody').innerHTML;
ok(/Your portfolio/.test(anual) && !/Tu cartera/.test(anual), 'el rotulo en ingles ("Tu cartera" se habia escapado)');
ok(!/doesn.t pay dividends/.test(anual), 'ya no afirma que el indice no paga dividendos (falso desde V17)');
ok(/dividends reinvested/.test(anual), 'dice que el indice cuenta sus dividendos reinvertidos, como las cuentas');

console.log('\nG) el banner "GA platforms ›" del menu lleva a algun lado (A7)');
// ALCANCE: el onclick se engancha AL CARGAR vistas.js, antes de que este
// arnes cambie el DOM de mentira; asi que se mira el codigo escrito.
ok(/getElementById\('mPlataformas'\)\.onclick = function \(\) \{ toggleMenu\(false\); setView\('config'\); \}/.test(html),
  'cierra el menu y abre las plataformas (Keys)');
ok(/<button type="button" class="menu-banner" id="mPlataformas">/.test(html), 'y es un <button> (teclado y lector de pantalla)');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
