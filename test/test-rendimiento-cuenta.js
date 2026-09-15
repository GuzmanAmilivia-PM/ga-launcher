// El rendimiento historico por cuenta contra el SPY (V17, 15/09/2026).
//
// Este arnes EJECUTA js/rendimiento.js entero con un DOM de mentira y un
// payload con la forma que produce el Worker (business/Rendimiento.js), y
// ademas CRUZA cada nombre de campo que la pantalla lee contra el fuente del
// Worker: si alla se renombra `mismaPlata` o `diferenciaUsd`, esto se pone
// rojo antes de que el telefono muestre guiones. La leccion de las sondas con
// la forma inventada (22/08 y 14/09/2026).
var fs = require('fs');
var path = require('path');
var ruta = require('./_ruta');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

var RUTA = process.env.GA_LAUNCHER || path.join(__dirname, '..');
var src = fs.readFileSync(path.join(RUTA, 'js', 'rendimiento.js'), 'utf8');
var WORKER = process.env.GA_WORKER || path.join(RUTA, '..', 'ga-portfolio-worker');
var fuenteWorker = fs.existsSync(path.join(WORKER, 'src', 'business', 'Rendimiento.js'))
  ? fs.readFileSync(path.join(WORKER, 'src', 'business', 'Rendimiento.js'), 'utf8') : null;

// ---- el DOM de mentira: guarda innerHTML y devuelve elementos por id ----
var elementos = {};
function elemento(id) {
  if (elementos[id]) return elementos[id];
  var e = {
    id: id, hidden: false, innerHTML: '', textContent: '', style: {},
    addEventListener: function () {}, getAttribute: function (k) { return e.attrs && e.attrs[k]; },
    querySelectorAll: function (sel) {
      // Los botones del rango, sacados del HTML recien pintado.
      if (sel.indexOf('.rangebtn') === -1) return [];
      var out = [], re = /data-rango="([a-z0-9]+)"/g, m;
      while ((m = re.exec(e.innerHTML)) !== null) {
        (function (rango) {
          out.push({ attrs: { 'data-rango': rango }, getAttribute: function () { return rango; },
            addEventListener: function (ev, fn) { botones[rango] = fn; } });
        })(m[1]);
      }
      return out;
    }
  };
  elementos[id] = e;
  return e;
}
var botones = {};
var charts = [];
var pedidos = [];
var respuestaPendiente = null;
var sandbox = {
  document: { getElementById: function (id) { return (id === 'accRend' || id === 'rendBody' || id === 'rendChart') ? elemento(id) : null; } },
  esc: function (s) { return String(s); },
  mask: function (s) { return s; },
  signoPct: function (v, d) { return (v >= 0 ? '+' : '') + v.toFixed(d) + '%'; },
  fmtUsdEnt: function (n) { return 'US$ ' + Math.round(Number(n) || 0).toLocaleString('en-US'); },
  fechaCortaMs: function (ms) { var d = new Date(ms); return d.getDate() + '/' + (d.getMonth() + 1) + ' ' + d.getHours() + ':' + d.getMinutes(); },
  apISOaMs: function (s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).getTime(); },
  msgErr: function (e) { return 'ERR ' + (e && e.message); },
  msgBackend: function (r) { return (r && r.mensajes || ['could not load']).join(' '); },
  colorAcento: function () { return '#abcdef'; },
  acentoRgba: function (a) { return 'rgba(1,2,3,' + a + ')'; },
  buildChartOptions: function (pts) { return { pts: pts.length }; },
  Chart: function (canvas, cfg) { charts.push(cfg); this.destroy = function () {}; },
  google: { script: { run: {
    withSuccessHandler: function (ok) { this._ok = ok; return this; },
    withFailureHandler: function (fail) { this._fail = fail; return this; },
    getRendimientoCuenta: function (args) { pedidos.push(args); respuestaPendiente = { ok: this._ok, fail: this._fail }; }
  } } }
};
var cuerpo = src + '\nreturn { render: renderRendimiento, mostrar: mostrarRendimiento, setDatos: function (d) { rendDatos = d; }, setRango: function (r) { rendRango = r; }, rango: function () { return rendRango; } };';
var api = new Function('document', 'esc', 'mask', 'signoPct', 'fmtUsdEnt', 'fechaCortaMs', 'apISOaMs', 'msgErr', 'msgBackend', 'colorAcento', 'acentoRgba', 'buildChartOptions', 'Chart', 'google', cuerpo)(
  sandbox.document, sandbox.esc, sandbox.mask, sandbox.signoPct, sandbox.fmtUsdEnt, sandbox.fechaCortaMs, sandbox.apISOaMs, sandbox.msgErr, sandbox.msgBackend, sandbox.colorAcento, sandbox.acentoRgba, sandbox.buildChartOptions, sandbox.Chart, sandbox.google);

// ---- el payload, con la forma del Worker ----
var HOY = Date.now(), DIA = 86400000;
function rango(extra) {
  var serie = [];
  for (var i = 0; i < 12; i++) serie.push({ ts: HOY - (11 - i) * DIA, valor: 30000 + i * 100, spy: 30000 + i * 60 });
  return Object.assign({
    desde: HOY - 11 * DIA, hasta: HOY, dias: 12, parcial: false, desdeDisponible: HOY - 11 * DIA,
    base: 30000, valor: 31100, depositos: 1500, retiros: 250, neto: 1250,
    twr: { pct: 14.56, anualizado: null },
    mwr: { pct: 15.28, anualizado: null },
    spy: { pct: 12.17, anualizado: null, mismaPlata: { valor: 30890.5, pct: 4.1, mwr: { pct: 12.9, anualizado: null } }, diferenciaUsd: 209.5 },
    efectivo: { promedioPct: 4.2, desde: HOY - 5 * DIA, dias: 6 },
    serie: serie
  }, extra || {});
}
var PAYLOAD = {
  ok: true, cuenta: 'IB', nombre: 'Interactive Brokers',
  indice: { nombre: 'S&P 500', nota: 'SPY with dividends reinvested' },
  historia: { desde: HOY - 11 * DIA, hasta: HOY, puntos: 12, appDesde: '2026-08-17', importado: { desde: '2023-04-11', fuente: 'ibkr_flex' } },
  flujos: { desdeVivo: '2025-09-15', importadosDesde: '2023-04-11', cantidad: 9 },
  rangos: {
    ytd: rango(),
    '1a': rango({ twr: { pct: 32.22, anualizado: 32.22 }, mwr: { pct: 31.16, anualizado: 31.16 }, spy: { pct: 17.02, anualizado: 17.02, mismaPlata: { valor: 29000, pct: 3, mwr: { pct: 16.5, anualizado: 16.5 } }, diferenciaUsd: 2100 } }),
    '3a': { pocos: true, dias: 1, parcial: true, desdeDisponible: HOY - 11 * DIA },
    origen: rango({ parcial: true })
  },
  avisos: ['IBKR: falta la consulta de actividad.']
};

console.log('\nA) los nombres de campo que lee la pantalla existen en el Worker');
if (fuenteWorker) {
  ['rangos', 'indice', 'historia', 'appDesde', 'importado', 'avisos', 'pocos', 'parcial', 'desdeDisponible',
   'depositos', 'retiros', 'neto', 'base', 'valor', 'twr', 'mwr', 'anualizado', 'spy', 'mismaPlata', 'diferenciaUsd',
   'efectivo', 'promedioPct', 'serie', 'nota', 'nombre'].forEach(function (campo) {
    ok(fuenteWorker.indexOf(campo + ':') !== -1 || fuenteWorker.indexOf(campo + ' =') !== -1 || fuenteWorker.indexOf("'" + campo + "'") !== -1,
      "el Worker escribe el campo '" + campo + "'");
  });
  ok(/CUENTAS_PRIMERO|rendimiento_cuenta|getRendimientoCuenta/.test(fuenteWorker), 'la fn se llama getRendimientoCuenta alla');
  ok(/'IB'|IB:/.test(fuenteWorker) && /'CS'|CS:/.test(fuenteWorker), "el Worker conoce las claves 'IB' y 'CS' que manda la pantalla");
} else {
  console.log('  (sin el repo del Worker al lado: se saltea el cruce; GA_WORKER lo apunta)');
}

console.log('\nB) la pantalla con el payload completo, rango YTD');
api.setDatos(PAYLOAD); api.setRango('ytd'); charts = [];
api.render();
var html = elemento('rendBody').innerHTML;
ok(/data-rango="ytd"[^>]*>YTD/.test(html) || /class="rangebtn active" data-rango="ytd"/.test(html), 'los cuatro rangos, con YTD activo');
ok((html.match(/class="rangebtn/g) || []).length === 4, 'exactamente cuatro botones de rango');
ok(/With your money, on your dates/.test(html), 'la pregunta 1 tiene titulo');
ok(/<p class="detlbl">You<\/p><p class="capval up">\+15\.3%/.test(html), 'el MWR (15,28 → +15.3%) en "You": no el TWR');
ok(/Same money in S&amp;P 500|Same money in S&P 500/.test(html) && /\+12\.9%/.test(html), 'la misma plata en SPY muestra SU MWR (12,9)');
ok(/Difference<\/p><p class="capval up">\+US\$ 210/.test(html), 'la diferencia en dolares, redondeada y con signo');
ok(/Without deposits/.test(html) && /\+14\.6%/.test(html) && /\+12\.2%/.test(html), 'la pregunta 2: TWR 14,56 y el indice 12,17');
ok(/Deposits<\/span><b>US\$ 1,500/.test(html) && /Withdrawals<\/span><b>US\$ 250/.test(html) && /Net<\/span><b>US\$ 1,250/.test(html), 'depositos, retiros y neto');
ok(/Cash on average<\/span><b>4\.2%/.test(html) && /since /.test(html), 'el efectivo promedio, y desde cuando (6 de 12 dias lo saben)');
ok(!/a year/.test(html), 'un rango corto NO se anualiza (como PortfolioAnalyst)');
ok(/Index: SPY with dividends reinvested/.test(html), 'la nota dice que indice es (U1)');
ok(/comes from the broker/.test(html), 'y que la historia vieja viene del broker');
ok(/⚠|&#9888;/.test(html) && /falta la consulta/.test(html), 'los avisos del Worker se muestran (U2)');
ok(charts.length === 1 && charts[0].data.datasets.length === 2, 'el grafico tiene dos lineas: la cuenta y la misma plata en SPY');
ok(charts[0].data.datasets[0].data.length === 12 && charts[0].data.datasets[1].data.length === 12, 'con los 12 puntos cada una');
ok(charts[0].data.datasets[0].borderColor === '#abcdef' && charts[0].data.datasets[1].borderDash[0] === 5, 'la cuenta con el acento vivo, el indice punteado');
ok(typeof botones['1a'] === 'function', 'los botones se enganchan por addEventListener (nada inline)');

console.log('\nC) el rango de un ano anualiza, el de tres dice que no alcanza, el origen dice que es parcial');
botones['1a']({ currentTarget: { getAttribute: function () { return '1a'; } } });
html = elemento('rendBody').innerHTML;
ok(api.rango() === '1a', 'tocar el boton cambia el rango');
ok(/\+31\.2%[\s\S]*?\+31\.2% a year/.test(html) && /\+17\.0% a year/.test(html), 'el MWR y el indice anualizados aparecen debajo del numero');
api.setRango('3a'); api.render();
html = elemento('rendBody').innerHTML;
ok(/Not enough history in this range yet \(it starts /.test(html), 'tres anos: no alcanza, y dice desde cuando hay datos');
api.setRango('origen'); api.render();
html = elemento('rendBody').innerHTML;
ok(/asks for more history than there is/.test(html), 'el origen marcado parcial lo dice en la cara');

console.log('\nD) sin historia, y con error del Worker');
api.setDatos({ ok: true, cuenta: 'CS', pocos: true, dias: 1, avisos: [] }); api.render();
ok(/History starts today/.test(elemento('rendBody').innerHTML), 'sin historia: "empieza hoy", sin numeros inventados');
api.setDatos({ ok: false, mensajes: ['That account has no performance screen.'] }); api.render();
ok(/no performance screen/.test(elemento('rendBody').innerHTML), 'un rechazo del Worker se muestra tal cual');

console.log('\nE) mostrarRendimiento: solo IBKR y Schwab, y la respuesta tardia de otra cuenta se descarta');
api.mostrar({ key: 'BTG', nombre: 'BTG' });
ok(elemento('accRend').hidden === true && pedidos.length === 0, 'BTG esconde la tarjeta y no pide nada');
api.mostrar({ key: 'ITAU', nombre: 'Itau Assets' });
ok(elemento('accRend').hidden === true && pedidos.length === 0, 'Itau tampoco');
api.mostrar({ key: 'IB', nombre: 'Interactive Brokers' });
ok(elemento('accRend').hidden === false && pedidos.length === 1 && pedidos[0].cuenta === 'IB', 'IBKR muestra la tarjeta y pide rendimiento_cuenta con su clave');
ok(/Calculating your history/.test(elemento('rendBody').innerHTML), 'mientras tanto dice que esta calculando');
var respIB = respuestaPendiente;
api.mostrar({ key: 'CS', nombre: 'Charles Schwab' });
ok(pedidos.length === 2 && pedidos[1].cuenta === 'CS', 'Schwab pide la suya');
respIB.ok(PAYLOAD);   // llega tarde la de IBKR con Schwab abierta
ok(/Calculating your history/.test(elemento('rendBody').innerHTML), 'la respuesta tardia de IBKR NO se pinta bajo el titulo de Schwab');
respuestaPendiente.ok(Object.assign({}, PAYLOAD, { cuenta: 'CS', nombre: 'Charles Schwab' }));
ok(/With your money/.test(elemento('rendBody').innerHTML), 'la de Schwab si');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
