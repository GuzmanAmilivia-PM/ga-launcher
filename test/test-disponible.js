// La tarjeta Available to invest, EJECUTADA (9/10/2026, auditoria).
//
// v245 la sumo sin ningun arnes que la corriera: cuatro mutaciones de la
// auditoria (pintar los PESOS como dolares, sumar `grupo` en vez de `total`,
// un mes que la lista de aportes no cubre en 0 en vez de "—", el orden
// invertido) dejaban la suite en verde. Aca corre la app ENTERA (_entorno.js)
// con un google.script.run de mentira y el payload con la forma que arma el
// Worker (business/Facturacion.js), cruzada contra ese fuente. Tambien lo que
// la auditoria encontro roto: un {ok:false} (la app de facturacion que no
// contesta) borraba los meses guardados, y con los aportes caidos la columna
// Invested quedaba en "…" para siempre. Numeros INVENTADOS (repo publico).
var fs = require('fs');
var path = require('path');
var entorno = require('./_entorno');
var ruta = require('./_ruta');

// La historia pasa en octubre de 2026 (test/_reloj.js).
require('./_reloj').fijarReloj('2026-10-09T15:00:00Z');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

// El payload como lo devuelve getDisponibleFacturacion: meses en orden, con
// pesos y dolares DISTINTOS a proposito (40 pesos por dolar).
function mes(m, usd, estimado) { return { mes: m, pesos: usd * 40, usd: usd, estimado: !!estimado }; }
var PAYLOAD = { ok: true, anio: 2026, cotizacionUsd: 40.25, gastosTotal: 50000,
  meses: [mes(1, 1100), mes(2, 1200), mes(3, 1300), mes(9, 900), mes(10, 1000, true)] };

function montar(storage) {
  var c = entorno.cargar(Object.assign({ ga_token: 'x' }, storage || {}));
  var g = c.ambito;
  var elems = {};
  g.document.getElementById = function (id) {
    if (!elems[id]) { var e = entorno.elemento(); e.id = id; e.style = {}; e.innerHTML = ''; e.textContent = ''; elems[id] = e; }
    return elems[id];
  };
  var pedidos = [];
  function run() {
    var okF = null, failF = null;
    var o = new Proxy({}, { get: function (t, k) {
      if (k === 'withSuccessHandler') return function (f) { okF = f; return o; };
      if (k === 'withFailureHandler') return function (f) { failF = f; return o; };
      return function (arg) { pedidos.push({ fn: k, arg: arg, ok: function (r) { okF(r); }, fail: function (e) { failF(e); } }); };
    } });
    return o;
  }
  g.google = { script: { get run() { return run(); } } };
  return { c: c, g: g, el: function (id) { return g.document.getElementById(id); }, pedidos: pedidos,
    ultimo: function (fn) { var p = pedidos.filter(function (x) { return x.fn === fn; }); return p[p.length - 1]; } };
}
// Las filas de la tarjeta, en el orden en que se pintan: [mes, libre, invertido].
function filas(body) {
  var out = [], re = /<div class="disprow( disptot)?"><span>([^<]*)<\/span>(<b[^>]*>.*?<\/b>)(<b[^>]*>.*?<\/b>)<\/div>/g, m;
  while ((m = re.exec(body)) !== null) {
    out.push([m[2], m[3].replace(/<[^>]+>/g, ''), m[4].replace(/<[^>]+>/g, '')]);
  }
  return out;
}
function deEntidades(s) { return String(s).replace(/&mdash;/g, '—').replace(/&hellip;/g, '…').replace(/&asymp;/g, '≈'); }

var m = montar();
ok(m.c.errores.length === 0, 'la app carga entera' + (m.c.errores.length ? ': ' + m.c.errores.join(' | ') : ''));

console.log('\nA) el contrato con el Worker, leido del fuente de Facturacion.js');
var WORKER = process.env.GA_WORKER || path.join(ruta.RUTA, '..', 'ga-portfolio-worker');
var fuenteFact = path.join(WORKER, 'src', 'business', 'Facturacion.js');
if (fs.existsSync(fuenteFact)) {
  var f = fs.readFileSync(fuenteFact, 'utf8');
  ['anio:', 'cotizacionUsd:', 'meses:', 'mes:', 'usd:', 'estimado:', 'ok: true'].forEach(function (campo) {
    ok(f.indexOf(campo) !== -1, 'getDisponibleFacturacion devuelve ' + campo.replace(':', ''));
  });
} else {
  console.log('  (sin el clon del worker en ' + WORKER + ': me salteo el cruce)');
}

console.log('\nB) la tarjeta con los aportes cargados');
m = montar();
m.g.cargarAportes = function () {};          // la columna se arma a mano abajo
m.g.apoCargado = true;
m.g.cargarDisponible(false);
var pd = m.ultimo('getDisponibleFacturacion');
ok(!!pd, 'pide getDisponibleFacturacion');
// Aportes del año: en marzo entraron 500 a TODAS las cuentas (300 al grupo
// de los brokers: el resto quedo en BTG esperando). La lista cubre desde el
// 1/02: enero no se puede afirmar.
m.g.aportesLista = [
  { fecha: '2026-03-10', grupo: 300, total: 500 },
  { fecha: '2026-09-02', grupo: 200, total: 200 },
  { fecha: '2026-09-20', grupo: -50, total: -50 },
  { fecha: '2025-12-20', grupo: 999, total: 999 }    // otro año: no entra
];
m.g.aportesDesde = new Date(2026, 1, 1).getTime();
m.g.aportesRecibidos = true;
pd.ok(PAYLOAD);
var body = deEntidades(m.el('dispBody').innerHTML);
var fs1 = filas(body);
ok(fs1.length === 6, 'cinco meses y la fila del año: ' + fs1.map(function (x) { return x[0]; }).join(','));
ok(fs1.map(function (x) { return x[0]; }).join(',') === 'Oct,Sep,Mar,Feb,Jan,2026', 'el mes en curso arriba, el año abajo');
var oct = fs1[0], mar = fs1[2], ene = fs1[4], tot = fs1[5];
ok(/US\$ 1,000/.test(oct[1]) && !/40,000/.test(body), 'en DOLARES, no en pesos (octubre 1,000 y no 40,000): ' + oct[1]);
ok(/^≈/.test(oct[1]) && !/≈/.test(mar[1]), 'el mes estimado lleva ≈, el cargado no');
ok(/US\$ 500/.test(mar[2]), 'Invested de marzo es lo que entro a TODAS las cuentas (500), no al grupo (300): ' + mar[2]);
ok(/US\$ 150/.test(fs1[1][2]), 'septiembre neto de retiros (200 − 50): ' + fs1[1][2]);
ok(ene[2] === '—', 'enero, antes de lo que cubre la lista, dice — y no un cero: ' + ene[2]);
ok(fs1[3][2] === 'US$ 0', 'febrero, cubierto y sin movimientos, si es cero: ' + fs1[3][2]);
ok(/US\$ 5,500/.test(tot[1]) && /^≈/.test(tot[1]), 'el total libre del año (con ≈ porque hay un estimado): ' + tot[1]);
ok(/US\$ 650/.test(tot[2]), 'el total invertido del año: ' + tot[2]);
ok(/40\.25 pesos per dollar/.test(body), 'la cotizacion con punto decimal, como el resto en ingles');
ok(m.el('dispAnio').textContent === 2026 || m.el('dispAnio').textContent === '2026', 'el año en el titulo');

console.log('\nC) los aportes todavia no llegaron, o fallaron');
m = montar();
m.g.cargarAportes = function () {};
m.g.apoCargado = true;
m.g.aportesRecibidos = false;
m.g.cargarDisponible(false);
m.ultimo('getDisponibleFacturacion').ok(PAYLOAD);
body = deEntidades(m.el('dispBody').innerHTML);
ok(filas(body).every(function (x) { return x[2] === '…'; }), 'mientras cargan, Invested dice …');
// Ahora los aportes fallan de verdad (el pedido real de cargarAportes).
m = montar();
m.g.cargarDisponible(false);                  // sin aportes pide los aportes
var pa = m.ultimo('getAportes');
ok(!!pa, 'sin los aportes, la tarjeta los pide');
m.ultimo('getDisponibleFacturacion').ok(PAYLOAD);
pa.fail(new Error('No connection. Try again once you have signal.'));
body = deEntidades(m.el('dispBody').innerHTML);
ok(filas(body).every(function (x) { return x[2] === '—'; }), 'con los aportes caidos, Invested dice — (no el … de cargando): ' + filas(body).map(function (x) { return x[2]; }).join(','));
ok(/deposits could not be loaded/.test(body), 'y una linea lo explica');
// Un {ok:false} del Worker en los aportes, sin nada guardado: lo mismo.
m = montar();
m.g.cargarDisponible(false);
m.ultimo('getDisponibleFacturacion').ok(PAYLOAD);
m.ultimo('getAportes').ok({ ok: false, mensajes: ['A broker did not answer.'] });
body = deEntidades(m.el('dispBody').innerHTML);
ok(filas(body).every(function (x) { return x[2] === '—'; }), 'un {ok:false} de los aportes tambien deja —');

console.log('\nD) la app de facturacion no contesta: lo guardado NO se borra');
var guardado = JSON.stringify({ t: Date.now() - 3600000, data: PAYLOAD });
m = montar({ ga_cache_disp: guardado });
m.g.cargarAportes = function () {};
m.g.apoCargado = true;
m.g.cargarDisponible(false);
ok(/Oct/.test(m.el('dispBody').innerHTML), 'se pinta al instante lo guardado');
m.ultimo('getDisponibleFacturacion').ok({ ok: false, mensajes: ['The billing app did not answer. Try again in a minute.'] });
ok(/Oct/.test(m.el('dispBody').innerHTML) && !/did not answer/.test(m.el('dispBody').innerHTML), 'un {ok:false} no pisa los meses: ' + m.el('dispBody').innerHTML.slice(0, 60));
ok(/could not update/.test(m.el('dispCacheAviso').innerHTML), 'y dice "could not update"');
ok(!!m.g.localStorage.getItem('ga_cache_disp') && JSON.parse(m.g.localStorage.getItem('ga_cache_disp')).data.ok === true, 'el cache sigue siendo el bueno');
// Sin nada guardado, el error se dice.
m = montar();
m.g.cargarAportes = function () {};
m.g.apoCargado = true;
m.g.cargarDisponible(false);
m.ultimo('getDisponibleFacturacion').ok({ ok: false, mensajes: ['The billing app did not answer. Try again in a minute.'] });
ok(/did not answer/.test(m.el('dispBody').innerHTML), 'sin nada guardado, el error se dice');
// La lista vacia (año sin facturacion cargada).
m = montar();
m.g.cargarAportes = function () {};
m.g.apoCargado = true;
m.g.cargarDisponible(false);
m.ultimo('getDisponibleFacturacion').ok({ ok: true, anio: 2026, cotizacionUsd: 40, meses: [] });
ok(/No billing loaded for 2026/.test(m.el('dispBody').innerHTML), 'sin meses: "No billing loaded"');

console.log('\nE) lo mismo en Contributions y Dividends (cargarConCache)');
var APO_OK = { ok: true, anio: 2026, desde: '2026-02-01', lista: [{ fecha: '2026-03-10', grupo: 300, total: 500 }] };
m = montar({ ga_cache_apo: JSON.stringify({ t: Date.now() - 3600000, data: APO_OK }) });
m.g.cargarAportes(false);
var antes = m.el('apoBody').innerHTML;
m.ultimo('getAportes').ok({ ok: false, mensajes: ['A broker did not answer.'] });
ok(m.el('apoBody').innerHTML === antes && !/did not answer/.test(m.el('apoBody').innerHTML), 'Contributions: un {ok:false} no borra lo que se veia');
ok(/could not update/.test(m.el('apoCacheAviso').innerHTML), 'y lo marca "could not update"');
ok(m.g.aportesFallo === false, 'los aportes guardados siguen valiendo (aportesFallo en false)');
// El boton de refrescar saca lo pintado; si el pedido falla, vuelve lo guardado.
m.g.cargarAportes(true);
ok(/Calculating/.test(m.el('apoBody').innerHTML), 'refrescar muestra "calculando"');
m.ultimo('getAportes').fail(new Error('No connection. Try again once you have signal.'));
ok(m.el('apoBody').innerHTML === antes, 'y si falla, vuelve lo guardado en vez del error');
var DIV_OK = { ok: true, anio: 2026, total: 1234.5, meses: [], porSimbolo: [], cobros: [] };
m = montar({ ga_cache_div: JSON.stringify({ t: Date.now() - 3600000, data: DIV_OK }) });
// El grafico de barras no importa aca (no hay canvas).
m.g.Chart = function () { return { destroy: function () {}, update: function () {} }; };
m.g.cargarDividendos(false);
var antesDiv = m.el('divBody').innerHTML + m.el('divTotalAnio').textContent;
m.ultimo('getDividendos').ok({ ok: false, mensajes: ['Schwab did not answer.'] });
ok(m.el('divBody').innerHTML + m.el('divTotalAnio').textContent === antesDiv && !/did not answer/.test(m.el('divBody').innerHTML), 'Dividends: un {ok:false} tampoco borra lo que se veia');
ok(/could not update/.test(m.el('divCacheAviso').innerHTML), 'y lo marca');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
