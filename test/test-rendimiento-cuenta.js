// El rendimiento historico por cuenta contra el SPY (V17, 15/09/2026; la
// forma plegada del 16/09/2026).
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
var botones = {};
var toggle = null;
function elemento(id) {
  if (elementos[id]) return elementos[id];
  var e = {
    id: id, hidden: false, innerHTML: '', textContent: '', style: {},
    addEventListener: function (ev, fn) { if (id === 'rendToggle') toggle = fn; },
    getAttribute: function (k) { return e.attrs && e.attrs[k]; },
    querySelectorAll: function (sel) {
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
var charts = [];
var pedidos = [];
var respuestaPendiente = null;
var sandbox = {
  document: { getElementById: function (id) {
    if (id === 'rendToggle') return /id="rendToggle"/.test(elemento('rendBody').innerHTML) ? elemento('rendToggle') : null;
    return (id === 'accRend' || id === 'rendBody' || id === 'rendChart') ? elemento(id) : null;
  } },
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
var cuerpo = src + '\nreturn { render: renderRendimiento, mostrar: mostrarRendimiento, medibles: rendRangosMedibles, setDatos: function (d) { rendDatos = d; }, setRango: function (r) { rendRango = r; }, rango: function () { return rendRango; }, abierto: function () { return rendAbierto; } };';
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
    '1m': rango({ twr: { pct: 2.1, anualizado: null }, mwr: { pct: 2.0, anualizado: null } }),
    ytd: rango(),
    '1a': rango({ twr: { pct: 32.22, anualizado: 32.22 }, mwr: { pct: 31.16, anualizado: 31.16 }, spy: { pct: 17.02, anualizado: 17.02, mismaPlata: { valor: 29000, pct: 3, mwr: { pct: 16.5, anualizado: 16.5 } }, diferenciaUsd: 2100 } }),
    '5a': rango({ parcial: true }),
    origen: rango({ parcial: true })
  },
  anios: [
    { anio: 2026, parcial: false, enCurso: true, desde: HOY - 200 * DIA, hasta: HOY, twr: 14.56, mwr: 15.28, spy: 12.17, pp: 2.39, depositos: 0, retiros: 0 },
    { anio: 2025, parcial: false, enCurso: false, desde: HOY - 600 * DIA, hasta: HOY - 250 * DIA, twr: 18.2, mwr: 17.9, spy: 20.1, pp: -1.9, depositos: 0, retiros: 0 },
    { anio: 2023, parcial: true, enCurso: false, desde: Date.UTC(2023, 3, 11, 20), hasta: HOY - 900 * DIA, twr: 9.5, mwr: 9.1, spy: 15.3, pp: -5.8, depositos: 0, retiros: 0 }
  ],
  avisos: ['IBKR: falta la consulta de actividad.']
};

console.log('\nA) los nombres de campo que lee la pantalla existen en el Worker');
if (fuenteWorker) {
  ['rangos', 'indice', 'historia', 'appDesde', 'importado', 'avisos', 'pocos', 'parcial', 'desdeDisponible',
   'depositos', 'retiros', 'neto', 'base', 'valor', 'twr', 'mwr', 'anualizado', 'spy', 'mismaPlata', 'diferenciaUsd',
   'efectivo', 'promedioPct', 'serie', 'nota', 'nombre', 'anios', 'anio', 'enCurso', 'pp'].forEach(function (campo) {
    ok(fuenteWorker.indexOf(campo + ':') !== -1 || fuenteWorker.indexOf(campo + ' =') !== -1 || fuenteWorker.indexOf("'" + campo + "'") !== -1,
      "el Worker escribe el campo '" + campo + "'");
  });
  ['1m', 'ytd', '1a', '5a', 'origen'].forEach(function (k) {
    ok(new RegExp("['\"]?" + k + "['\"]?\\s*:").test(fuenteWorker), "el Worker calcula el rango '" + k + "'");
  });
  ok(/'IB'|IB:/.test(fuenteWorker) && /'CS'|CS:/.test(fuenteWorker), "el Worker conoce las claves 'IB' y 'CS' que manda la pantalla");
} else {
  console.log('  (sin el repo del Worker al lado: se saltea el cruce; GA_WORKER lo apunta)');
}

console.log('\nB) plegada: YTD contra el indice, el titular, la tabla minima, y nada mas');
api.setDatos(PAYLOAD); api.setRango('ytd'); charts = [];
api.render();
var html = elemento('rendBody').innerHTML;
ok(api.abierto() === false, 'arranca plegada');
ok(/<span class="detlbl">YTD vs S&P 500<\/span>/.test(html), 'la cabecera dice que rango se mira (YTD, el estandar) y contra que');
ok(/id="rendToggle"[^>]*aria-expanded="false"/.test(html), 'con el desplegable cerrado');
ok(/class="rendtitular"><b class="up">\+14\.6%<\/b> <span class="desc">you<\/span>[\s\S]*?<b class="up">\+12\.2%<\/b> <span class="desc">S&P 500<\/span> <span class="rendpp up">\+2\.4 pp<\/span>/.test(html), 'el titular: TWR vs el indice, con los puntos de diferencia');
ok(/<table class="rendtabla">/.test(html) && /<th>You<\/th><th>S&P 500<\/th>/.test(html), 'la tabla minima de dos columnas');
ok(/<td>Without deposits<\/td><td><b class="up">\+14\.6%<\/b><\/td><td><b class="up">\+12\.2%<\/b><\/td>/.test(html), 'fila 1: sin depositos (TWR vs indice), SIN anualizado plegada');
ok(/<td>With your money<\/td><td><b class="up">\+15\.3%<\/b><\/td><td><b class="up">\+12\.9%<\/b><\/td>/.test(html), 'fila 2: con tu plata (MWR vs el MWR de la misma plata en SPY)');
ok(/<td>Same money, today<\/td><td>US\$ 31,100<\/td><td>US\$ 30,891<\/td>/.test(html), 'fila 3: cuanto vale hoy cada una');
ok(/<td>Difference<\/td><td colspan="2"><b class="up">\+US\$ 210<\/b>/.test(html), 'fila 4: la diferencia en dolares');
ok(!/class="rangebar"/.test(html) && !/Deposits/.test(html) && !/rendChart/.test(html), 'plegada NO hay rangos, ni flujos, ni grafico');
ok(!/falta la consulta/.test(html), 'ni los avisos');
ok(!/Year by year/.test(html), 'ni el año por año');
ok(charts.length === 0, 'no se dibuja nada plegada');
ok(/Since /.test(html), 'pero si dice desde cuando');
ok(typeof toggle === 'function', 'el desplegable se engancha por addEventListener (nada inline)');

console.log('\nC) desplegada: los rangos MEDIBLES, los anualizados, los flujos, el efectivo y el grafico');
toggle();
html = elemento('rendBody').innerHTML;
ok(api.abierto() === true, 'tocar el desplegable la abre');
ok(/aria-expanded="true"/.test(html), 'y lo dice');
var rangos = (html.match(/data-rango="([a-z0-9]+)"/g) || []).map(function (s) { return s.replace(/data-rango="|"/g, ''); });
ok(rangos.join(',') === '1m,ytd,1a,origen', 'solo los rangos medibles + All: 5Y (parcial) no se ofrece (' + rangos.join(',') + ')');
ok(/class="rangebtn active" data-rango="ytd"/.test(html), 'YTD activo');
ok(/Deposits<\/span><b>US\$ 1,500/.test(html) && /Withdrawals<\/span><b>US\$ 250/.test(html) && /Net<\/span><b>US\$ 1,250/.test(html), 'depositos, retiros y neto');
ok(/Cash on average<\/span><b>4\.2%/.test(html) && /since /.test(html), 'el efectivo promedio, y desde cuando (6 de 12 dias lo saben)');
ok(/Index: SPY with dividends reinvested/.test(html), 'la nota dice que indice es (U1)');
ok(/comes from the broker/.test(html), 'y que la historia vieja viene del broker');
ok(/⚠|&#9888;/.test(html) && /falta la consulta/.test(html), 'los avisos del Worker se muestran (U2)');
ok(charts.length === 1 && charts[0].data.datasets.length === 2, 'el grafico tiene dos lineas: la cuenta y la misma plata en SPY');
ok(charts[0].data.datasets[0].data.length === 12 && charts[0].data.datasets[1].data.length === 12, 'con los 12 puntos cada una');
ok(charts[0].data.datasets[0].borderColor === '#abcdef' && charts[0].data.datasets[1].borderDash[0] === 5, 'la cuenta con el acento vivo, el indice punteado');
ok(!/a year/.test(html), 'un rango corto NO se anualiza (como PortfolioAnalyst)');
// Año por año (22/09/2026): desplegada, del mas nuevo al mas viejo.
ok(/Year by year, without deposits/.test(html), 'desplegada aparece el año por año');
var filasAnio = html.split('Year by year')[1] || '';
ok(filasAnio.indexOf('<td>2026*</td><td><b class="up">+14.6%</b></td><td><b class="up">+12.2%</b></td><td><span class="rendpp up">+2.4 pp</span>') !== -1, '2026 con su marca, vos, el indice y los puntos');
ok(filasAnio.indexOf('<td>2025</td>') !== -1 && filasAnio.indexOf('<span class="rendpp down">−1.9 pp</span>') !== -1, 'un año por debajo del indice va en rojo y con signo');
ok(filasAnio.indexOf('2026') < filasAnio.indexOf('2025') && filasAnio.indexOf('2025') < filasAnio.indexOf('2023'), 'del mas nuevo al mas viejo');
ok(filasAnio.indexOf('* 2026 is year to date; 2023 counts from ') !== -1, 'debajo dice que años son a medias');

console.log('\nD) el rango de un ano anualiza; el origen parcial lo dice; el 5Y no se puede elegir');
botones['1a']({ currentTarget: { getAttribute: function () { return '1a'; } } });
html = elemento('rendBody').innerHTML;
ok(api.rango() === '1a', 'tocar el boton cambia el rango');
ok(/1Y vs S&P 500/.test(html), 'y la cabecera lo dice');
ok(/\+32\.2%<\/b> <span class="rendsub">\+32\.2% a year/.test(html) && /\+17\.0% a year/.test(html), 'desplegada, el anualizado va al lado del numero');
api.setRango('origen'); api.render();
html = elemento('rendBody').innerHTML;
ok(/that is where the history starts/.test(html), 'el origen marcado parcial lo dice en la cara');
api.setRango('5a'); api.render();
ok(api.rango() === 'ytd', 'un rango que no es medible cae al estandar (YTD)');
api.setRango('1m'); api.render();
html = elemento('rendBody').innerHTML;
ok(/1M vs S&P 500/.test(html) && /\+2\.1%/.test(html), 'el ultimo mes es un rango');

console.log('\nE) Schwab: solo YTD y All, y los dos dicen desde cuando');
var SCHWAB = Object.assign({}, PAYLOAD, { cuenta: 'CS', nombre: 'Charles Schwab', historia: { desde: HOY - 11 * DIA, hasta: HOY, puntos: 12, appDesde: '2026-08-17', importado: null },
  rangos: { '1m': rango({ parcial: true }), ytd: rango({ parcial: true }), '1a': rango({ parcial: true }), '5a': rango({ parcial: true }), origen: rango({ parcial: false }) } });
ok(api.medibles(SCHWAB).map(function (r) { return r.key; }).join(',') === 'ytd,origen', 'con historia desde el 17/08, solo YTD (el estandar) y All');
api.setDatos(SCHWAB); api.setRango('ytd'); api.render();
html = elemento('rendBody').innerHTML;
ok(/YTD vs S&P 500/.test(html) && /that is where the history starts/.test(html), 'YTD parcial: dice que la historia arranca ahi');

console.log('\nF) sin historia, y con error del Worker');
api.setDatos({ ok: true, cuenta: 'CS', pocos: true, dias: 1, avisos: [] }); api.render();
ok(/History starts today/.test(elemento('rendBody').innerHTML), 'sin historia: "empieza hoy", sin numeros inventados');
api.setDatos({ ok: false, mensajes: ['That account has no performance screen.'] }); api.render();
ok(/no performance screen/.test(elemento('rendBody').innerHTML), 'un rechazo del Worker se muestra tal cual');

console.log('\nG) mostrarRendimiento: solo IBKR y Schwab, pliega al abrir, y la respuesta tardia de otra cuenta se descarta');
api.mostrar({ key: 'BTG', nombre: 'BTG' });
ok(elemento('accRend').hidden === true && pedidos.length === 0, 'BTG esconde la tarjeta y no pide nada');
api.mostrar({ key: 'ITAU', nombre: 'Itau Assets' });
ok(elemento('accRend').hidden === true && pedidos.length === 0, 'Itau tampoco');
api.mostrar({ key: 'IB', nombre: 'Interactive Brokers' });
ok(elemento('accRend').hidden === false && pedidos.length === 1 && pedidos[0].cuenta === 'IB', 'IBKR muestra la tarjeta y pide rendimiento_cuenta con su clave');
ok(api.abierto() === false && api.rango() === 'ytd', 'al abrir una cuenta vuelve plegada y en YTD');
ok(/Calculating your history/.test(elemento('rendBody').innerHTML), 'mientras tanto dice que esta calculando');
var respIB = respuestaPendiente;
api.mostrar({ key: 'CS', nombre: 'Charles Schwab' });
ok(pedidos.length === 2 && pedidos[1].cuenta === 'CS', 'Schwab pide la suya');
respIB.ok(PAYLOAD);   // llega tarde la de IBKR con Schwab abierta
ok(/Calculating your history/.test(elemento('rendBody').innerHTML), 'la respuesta tardia de IBKR NO se pinta bajo el titulo de Schwab');
respuestaPendiente.ok(SCHWAB);
ok(/YTD vs S&P 500/.test(elemento('rendBody').innerHTML), 'la de Schwab si');
// Binance se sumo el 22/09/2026 (pedido de Guzman); la clave es la del
// Worker (CUENTAS.BNB en Rendimiento.js).
api.mostrar({ key: 'BNB', nombre: 'Binance' });
ok(elemento('accRend').hidden === false && pedidos.length === 3 && pedidos[2].cuenta === 'BNB', 'Binance muestra la tarjeta y pide la suya');
ok(/BNB:/.test(fuenteWorker), "el Worker conoce la clave 'BNB'");

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
