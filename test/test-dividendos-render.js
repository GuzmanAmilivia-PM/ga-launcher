// Arnés de renderDividendos ENTERA (9/09/2026), nacido de un bug publicado:
// en v191 se sacó el texto "Monthly average" y con él la variable `prom`,
// pero la línea del promedio del gráfico la seguía usando. ReferenceError a
// mitad de la función: los números de arriba se pintaban y el gráfico no,
// Guzmán vio "Swipe to load..." y una tarjeta vacía. Ningún arnés ejecutaba
// la función completa: test-cache-div la mockea, test-proyeccion prueba el
// bloque de abajo. Este la corre con la app cargada entera (_entorno.js),
// un Chart de mentira que guarda lo que le piden dibujar, y un DOM que
// devuelve el MISMO elemento por id (el de _entorno da uno nuevo por llamada,
// que alcanza para cargar pero no para leer lo escrito).
var entorno = require('./_entorno');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

var cargado = entorno.cargar({});
ok(cargado.errores.length === 0, 'la app carga entera' + (cargado.errores.length ? ': ' + cargado.errores.join(' | ') : ''));
var g = cargado.ambito;

// DOM con memoria: el mismo objeto para el mismo id.
var elems = {};
g.document.getElementById = function (id) {
  if (!elems[id]) elems[id] = entorno.elemento();
  return elems[id];
};
// El gráfico: se guarda la configuración pedida en vez de dibujar.
var charts = [];
g.Chart = function (canvas, cfg) { charts.push(cfg); return { destroy: function () {}, update: function () {} }; };
// La proyección se pide al backend desde adentro de renderDividendos: se
// anula para que este arnés pruebe SOLO el panel de dividendos.
g.cargarProyeccion = function () {};
g.renderProyeccion = function () {};

var meses = [];
var cobrados = [30, 31, 120, 22, 85, 118, 90, 25];
var proximos = [110, 42, 32, 100];
for (var i = 1; i <= 12; i++) {
  meses.push({ mes: i, cobrado: i <= 8 ? cobrados[i - 1] : 0, proximo: i > 8 ? proximos[i - 9] : 0 });
}
var payload = { ok: true, anio: 2026, totalCobrado: 538.38, totalProximo: 283.67, meses: meses, porBroker: {}, detalle: {} };

console.log('A) renderDividendos corre entera y dibuja');
var error = null;
try { g.renderDividendos(payload); } catch (e) { error = e; }
ok(!error, 'no tira' + (error ? ' — ' + error.message : ''));
ok(charts.length === 1, 'pide UN gráfico');
var datasets = (charts[0] && charts[0].data && charts[0].data.datasets) || [];
var etiquetas = datasets.map(function (d) { return d.label; });
ok(etiquetas.indexOf('Average') !== -1, 'con la línea del promedio: ' + etiquetas.join(', '));
var promedio = datasets.filter(function (d) { return d.label === 'Average'; })[0];
ok(promedio && promedio.data.length === 12 && promedio.data.every(function (v) { return Math.abs(v - 68.5) < 0.01; }),
  'y el promedio es total / 12 = 68.50 (el mismo número que antes se escribía)');

console.log('\nB) lo que se escribe arriba del gráfico');
ok(elems.divTotalAnio.textContent === 'US$ 822.05', 'el total del año: cobrado + a cobrar');
ok(/^Received: US\$ 538\.38 &middot; Upcoming: US\$ 283\.67$/.test(elems.divPromedio.innerHTML),
  'debajo, solo Received · Upcoming');
ok(elems.divPromedio.innerHTML.indexOf('Monthly average') === -1,
  'sin "Monthly average" (9/09/2026: es la línea del gráfico y volvía abajo como US$/mo)');
ok(elems.divChartBox.style.display === '', 'la caja del gráfico se muestra');
ok(!elems.divHint || elems.divHint.style.display !== '', 'la leyenda "Tap a bar..." no se enciende: ya no existe');

console.log('\nC) un payload con error no dibuja nada');
charts.length = 0;
g.renderDividendos({ ok: false, mensajes: ['sin conexion'] });
ok(charts.length === 0, 'sin gráfico');
ok(/sin conexion/.test(elems.divBody.innerHTML), 'y el mensaje del backend queda a la vista');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
