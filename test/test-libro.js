// La pagina Tax book (24/09/2026, A27): el libro fiscal de un año.
//
// EJECUTA js/libro.js con un DOM de mentira y un payload con la forma que
// produce el Worker (business/Libro.js), y cruza cada campo contra ese fuente.
// Numeros INVENTADOS (el repo es publico).
var fs = require('fs');
var path = require('path');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

var RUTA = process.env.GA_LAUNCHER || path.join(__dirname, '..');
var src = fs.readFileSync(path.join(RUTA, 'js', 'libro.js'), 'utf8');
var html = fs.readFileSync(path.join(RUTA, 'index.html'), 'utf8');
var vistasSrc = fs.readFileSync(path.join(RUTA, 'js', 'vistas.js'), 'utf8');
var WORKER = process.env.GA_WORKER || path.join(RUTA, '..', 'ga-portfolio-worker');
var fuenteWorker = fs.existsSync(path.join(WORKER, 'src', 'business', 'Libro.js'))
  ? fs.readFileSync(path.join(WORKER, 'src', 'business', 'Libro.js'), 'utf8') : null;

var elementos = {}, botonesAnio = [];
function elemento(id) {
  if (!elementos[id]) {
    elementos[id] = {
      id: id, innerHTML: '', onclick: null,
      querySelectorAll: function (sel) {
        if (sel !== '[data-anio]') return [];
        botonesAnio = [];
        var re = /data-anio="(\d+)"/g, m;
        while ((m = re.exec(this.innerHTML)) !== null) {
          (function (a) {
            var b = { getAttribute: function () { return a; }, addEventListener: function (ev, fn) { b.click = fn; } };
            botonesAnio.push(b);
          })(m[1]);
        }
        return botonesAnio;
      }
    };
  }
  return elementos[id];
}
var pedidos = [], pendientes = [], vueltas = [], ocultos = false;
var google = { script: { run: {
  withSuccessHandler: function (f) { this._ok = f; return this; },
  withFailureHandler: function (f) { this._fail = f; return this; },
  getLibroFiscal: function (a) { pedidos.push(a); pendientes.push({ ok: this._ok, fail: this._fail }); }
} } };
var api = new Function('document', 'esc', 'fmtUsd', 'msgErr', 'msgBackend', 'volver', 'google', 'Blob', 'URL',
  src + '\nreturn { cargar: cargarLibro, csv: libCsvTexto, anio: function () { return libAnio; } };')(
  { getElementById: function (id) { return /^lib/.test(id) ? elemento(id) : null; } },
  function (s) { return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); },
  function (n) { return ocultos ? '****' : 'US$ ' + Number(n).toFixed(2); },
  function (e) { return 'ERR ' + (e && e.message); },
  function (r) { return (r && r.mensajes || ['could not load']).join(' '); },
  function (v) { vueltas.push(v); },
  google, function () {}, {});

function anioPayload(anio, extra) {
  return Object.assign({
    ok: true, anio: anio, enCurso: anio === 2026, anios: [2026, 2025],
    registro: [{ broker: 'IBKR', desde: '2025-02-18', guardadoDesde: '2026-09-24' }],
    brokers: [
      { broker: 'IBKR', dividendos: 32, retenciones: -4.5, neto: 27.5, ventas: 1, importeVentas: 800, resultado: 120, ventasSinResultado: 0 },
      { broker: 'Schwab', dividendos: 50, retenciones: 0, neto: 50, ventas: 0, importeVentas: 0, resultado: 0, ventasSinResultado: 0 }
    ],
    simbolos: [
      { broker: 'Schwab', symbol: 'VOO', dividendos: 50, retenciones: 0, neto: 50, moneda: 'USD' },
      { broker: 'IBKR', symbol: 'ASML', dividendos: 22, retenciones: -3.3, neto: 18.7, moneda: 'EUR' }
    ],
    ventas: [
      { fecha: '2026-04-10', broker: 'IBKR', symbol: 'MSFT', qty: 2, precio: 400, moneda: 'USD', importe: 800, resultado: 120, comision: -1, fuente: 'broker', resultadoFuente: 'broker' },
      { fecha: '2026-07-01', broker: 'Binance', symbol: 'ETH', qty: 0.1, precio: 3000, moneda: 'USD', importe: 300, resultado: null, comision: null, fuente: 'app' }
    ],
    totales: { dividendos: 82, retenciones: -4.5, neto: 77.5, importeVentas: 1100, resultado: 120 },
    avisos: ['Sales without a realized result: the broker did not report it (or the sale was registered in the app), so only the proceeds are shown.']
  }, extra || {});
}

console.log('\nA) la forma del Worker');
if (fuenteWorker) {
  ['anio', 'anios', 'registro', 'brokers', 'simbolos', 'ventas', 'totales', 'avisos', 'enCurso', 'dividendos', 'retenciones', 'neto',
    'importeVentas', 'resultado', 'importe', 'fuente', 'desde', 'ingresos', 'resultadoFuente'].forEach(function (c) {
    ok(new RegExp('\\b' + c + ':').test(fuenteWorker) || new RegExp('\\.' + c + ' =').test(fuenteWorker), "el Worker escribe '" + c + "'");
  });
} else console.log('  (sin el repo del Worker al lado: se saltea el cruce)');

console.log('\nB) abrir la pagina pide el año en curso y dibuja');
api.cargar(null, false);
ok(pedidos.length === 1 && JSON.stringify(pedidos[0]) === '{}', 'sin año elegido pide el del Worker (el en curso)');
pendientes.shift().ok(anioPayload(2026));
var h = elemento('libBody').innerHTML;
ok(/<button type="button" class="tipobtn active-acento" data-anio="2026">2026<\/button>/.test(h) && /data-anio="2025">2025</.test(h), 'los años con datos, el actual marcado');
ok(h.indexOf('US$ 77.50 <span class="desc">net dividends in 2026 so far</span>') !== -1, 'el titular: neto del año, en curso');
ok(h.indexOf('<tr><td>IBKR</td><td>US$ 32.00</td><td>US$ -4.50</td><td>US$ 27.50</td></tr>') !== -1, 'dividendos, retenido y neto por broker');
ok(h.indexOf('<tr class="libtotal"><td>Total</td><td>US$ 82.00</td>') !== -1, 'el total');
ok(h.indexOf('MSFT <em>IBKR</em><span class="libfecha">2026-04-10</span></td><td>US$ 800.00</td><td><b class="up">US$ 120.00</b></td>') !== -1, 'una venta con su fecha y su resultado');
ok(h.indexOf('ETH <em>Binance · app</em><span class="libfecha">2026-07-01</span></td><td>US$ 300.00</td><td>—</td>') !== -1, 'la venta registrada en la app, sin resultado: guion');
ok(/Dividends by holding \(2\)/.test(h) && h.indexOf('ASML <em>IBKR · EUR</em>') !== -1, 'el detalle por papel, con la moneda si no es USD');
ok(/Sales without a realized result/.test(h), 'los avisos del Worker');
ok(/A record, not a tax return/.test(h) && /kept IBKR since 2025-02-18/.test(h), 'dice que no es una declaracion y desde cuando guarda');
ok(elemento('libCsv').onclick !== null || /id="libCsv"/.test(h), 'el boton del CSV');
ok(!/ADR fees/.test(h), 'sin comisiones de ADR, no hay nota');
api.cargar(2026, true); pendientes.shift().ok(anioPayload(2026, {
  brokers: [{ broker: 'Schwab', dividendos: 50, retenciones: -15, gastos: -0.5, neto: 34.5 }],
  simbolos: [{ broker: 'Schwab', symbol: 'BABA', dividendos: 50, retenciones: -15, gastos: -0.5, neto: 34.5, moneda: 'USD' }],
  totales: { dividendos: 50, retenciones: -15, gastos: -0.5, neto: 34.5, importeVentas: 0, resultado: 0 } }));
var hg = elemento('libBody').innerHTML;
ok(hg.indexOf('<tr><td>Schwab</td><td>US$ 50.00</td><td>US$ -15.50</td><td>US$ 34.50</td></tr>') !== -1, 'Withheld suma la retencion y la comision del ADR');
ok(hg.indexOf('Withheld includes US$ -0.50 of ADR fees') !== -1, 'y lo dice');
ok(api.csv(anioPayload(2026, { simbolos: [{ broker: 'Schwab', symbol: 'BABA', dividendos: 50, retenciones: -15, gastos: -0.5, neto: 34.5, moneda: 'USD' }], ventas: [] })).split('\n')[1] === 'dividend,2026,,Schwab,BABA,USD,,50,-15,-0.5,34.5,,,broker,,', 'el CSV separa la comision');

console.log('\nC) cambiar de año, y la respuesta vieja que llega tarde');
botonesAnio.filter(function (b) { return b.getAttribute() === '2025'; })[0].click();
ok(pedidos[pedidos.length - 1].anio === 2025, 'tocar 2025 lo pide');
ok(/Loading 2025/.test(elemento('libBody').innerHTML), 'mientras tanto dice que carga');
api.cargar(2026, true);
var p2025 = pendientes.shift(), p2026 = pendientes.shift();
p2026.ok(anioPayload(2026));
p2025.ok(anioPayload(2025));
ok(/net dividends in 2026/.test(elemento('libBody').innerHTML), 'la respuesta de 2025 que llega tarde no pisa la de 2026');

console.log('\nD) el ojito, el CSV, los fallos');
ocultos = true; api.cargar(2026, false);
ok(elemento('libBody').innerHTML.indexOf('US$ 82.00') === -1 && elemento('libBody').innerHTML.indexOf('****') !== -1, 'con el ojito cerrado no hay montos');
ocultos = false;
var csv = api.csv(anioPayload(2026, { simbolos: [{ broker: 'IBKR', symbol: 'A,B', dividendos: 1, retenciones: 0, neto: 1, moneda: 'USD' }] }));
var lineas = csv.trim().split('\n');
ok(lineas[0] === 'type,year,date,broker,symbol,currency,quantity,dividends_usd,withheld_usd,fees_usd,net_usd,proceeds_usd,result_usd,source,result_source,income_usd', 'el encabezado del CSV');
ok(lineas[1] === 'dividend,2026,,IBKR,"A,B",USD,,1,0,0,1,,,broker,,', 'un dividendo por papel, con la coma escapada');
ok(lineas[2] === 'sale,2026,2026-04-10,IBKR,MSFT,USD,2,,,,,800,120,broker,broker,', 'una venta del broker');
ok(lineas[3] === 'sale,2026,2026-07-01,Binance,ETH,USD,0.1,,,,,300,,app,,', 'la venta de la app, sin resultado');
api.cargar(2026, true); pendientes.shift().ok({ ok: false, mensajes: ['The tax book store is not available right now.'] });
ok(/not available right now/.test(elemento('libBody').innerHTML), 'un rechazo del Worker se muestra tal cual');
api.cargar(2026, true); pendientes.shift().fail(new Error('red'));
ok(/ERR red/.test(elemento('libBody').innerHTML), 'un fallo de red lo dice');

console.log('\nE) el menu, la vista y la vuelta');
ok(/<button class="mtile" id="mLibro">[\s\S]*?Tax book<\/button>/.test(html), 'el boton Tax book en el menu del costado');
ok(/<div id="view-libro" style="display:none">/.test(html) && /id="libBody"/.test(html) && /id="libBack"/.test(html), 'la vista con su cuerpo y su Back');
ok(/'exposicion', 'libro'\]/.test(vistasSrc) && /if \(name === 'libro'\) cargarLibro\(null, false\);/.test(vistasSrc), 'en VIEWS, y entrar la carga');
ok(/getElementById\('mLibro'\)\.onclick = function \(\) \{ toggleMenu\(false\); setView\('libro'\); \}/.test(vistasSrc), 'el boton abre la vista');
elemento('libBack').onclick();
ok(vueltas[0] === 'inicio', 'Back vuelve');

console.log('\nF) lo estimado y los premios (A33)');
api.cargar(2026, true); pendientes.shift().ok(anioPayload(2026, {
  ventas: [
    { fecha: '2026-03-01', broker: 'Binance', symbol: 'BTC', qty: 0.01, moneda: 'USD', importe: 700, resultado: 550, fuente: 'broker', resultadoFuente: 'costo promedio' },
    { fecha: '2026-04-10', broker: 'IBKR', symbol: 'MSFT', qty: 2, moneda: 'USD', importe: 800, resultado: 120, fuente: 'broker', resultadoFuente: 'broker' }
  ],
  ingresos: [{ broker: 'Binance', symbol: 'USDT', qty: 2.75, monto: 2.75 }, { broker: 'Binance', symbol: 'BTC', qty: 0.0001, monto: 6 }],
  totales: { dividendos: 82, retenciones: -4.5, neto: 77.5, importeVentas: 1500, resultado: 670, ingresos: 8.75 } }));
var he = elemento('libBody').innerHTML;
ok(he.indexOf('<b class="up">≈ US$ 550.00</b>') !== -1, 'lo estimado lleva ≈');
ok(he.indexOf('<b class="up">US$ 120.00</b>') !== -1, 'lo que informa el broker, sin ≈');
ok(/≈ estimated: the broker does not report it/.test(he), 'y se explica');
ok(he.indexOf('Crypto rewards') !== -1 && he.indexOf('US$ 8.75 <span class="desc">from Binance Earn and distributions') !== -1, 'los premios, aparte');
ok(/Rewards by asset \(2\)/.test(he) && he.indexOf('USDT <em>Binance</em></td><td>2.75</td><td>US$ 2.75</td>') !== -1, 'por activo, plegados');
var csvE = api.csv(anioPayload(2026, { simbolos: [], ventas: [{ fecha: '2026-03-01', broker: 'Binance', symbol: 'BTC', qty: 0.01, moneda: 'USD', importe: 700, resultado: 550, fuente: 'broker', resultadoFuente: 'costo promedio' }], ingresos: [{ broker: 'Binance', symbol: 'USDT', qty: 2.75, monto: 2.75 }] })).trim().split('\n');
ok(csvE[1] === 'sale,2026,2026-03-01,Binance,BTC,USD,0.01,,,,,700,550,broker,costo promedio,', 'el CSV dice de donde sale el resultado');
ok(csvE[2] === 'reward,2026,,Binance,USDT,USD,2.75,,,,,,,broker,,2.75', 'y trae los premios');
api.cargar(2026, true); pendientes.shift().ok(anioPayload(2026));
ok(elemento('libBody').innerHTML.indexOf('Crypto rewards') === -1 && elemento('libBody').innerHTML.indexOf('≈ estimated') === -1, 'sin premios ni estimados, nada de eso');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
