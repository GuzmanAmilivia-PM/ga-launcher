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
var pedidosAnual = [];
var vistas = [];
var respuestaPendiente = null;
var sandbox = {
  document: { getElementById: function (id) {
    if (id === 'rendToggle') return /id="rendToggle"/.test(elemento('rendBody').innerHTML) ? elemento('rendToggle') : null;
    return (id === 'accRend' || id === 'rendBody' || id === 'rendChart' || /^ran/.test(id)) ? elemento(id) : null;
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
    getRendimientoCuenta: function (args) { pedidos.push(args); respuestaPendiente = { ok: this._ok, fail: this._fail }; },
    getRendimientoAnual: function (args) { pedidosAnual.push(args); respuestaPendiente = { ok: this._ok, fail: this._fail }; }
  } } }
};
var cuerpo = src + '\nreturn { cargarAnual: cargarRendAnual, elegirSerie: ranElegir,render: renderRendimiento, mostrar: mostrarRendimiento, medibles: rendRangosMedibles, setDatos: function (d) { rendDatos = d; }, setRango: function (r) { rendRango = r; }, rango: function () { return rendRango; }, abierto: function () { return rendAbierto; } };';
// El cache local (paneles.js), de mentira: `guardados` hace de localStorage y
// `marcas` anota que aviso quedo a la vista. montarApi() es una app recien
// abierta: ranDatos arranca en null, como al abrir la app en el telefono.
var guardados = {};
var marcas = {};
function montarApi() {
  return new Function('document', 'esc', 'mask', 'signoPct', 'fmtUsdEnt', 'fechaCortaMs', 'apISOaMs', 'msgErr', 'msgBackend', 'colorAcento', 'acentoRgba', 'buildChartOptions', 'Chart', 'google', 'nombrePlataforma', 'setView',
    'cacheLeer', 'cacheGuardar', 'marcaActualizando', 'limpiarMarca', cuerpo)(
    sandbox.document, sandbox.esc, sandbox.mask, sandbox.signoPct, sandbox.fmtUsdEnt, sandbox.fechaCortaMs, sandbox.apISOaMs, sandbox.msgErr, sandbox.msgBackend, sandbox.colorAcento, sandbox.acentoRgba, sandbox.buildChartOptions, sandbox.Chart, sandbox.google,
    function (n) { return n; }, function (v) { vistas.push(v); },
    function (clave) { return guardados[clave] || null; },
    function (clave, data) { guardados[clave] = { t: 1234, data: data }; },
    function (id, cuando) { marcas[id] = cuando; },
    function (id) { delete marcas[id]; });
}
var api = montarApi();

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

console.log('\nF) la pagina Performance (22/09/2026): la cartera entera y cada broker, año por año');
var ANUAL = {
  ok: true, indice: { nombre: 'S&P 500', nota: 'SPY with dividends reinvested' },
  cartera: [{ anio: 2026, twr: 18.93, spy: 14.1, pp: 4.83, desde: Date.UTC(2025, 11, 30, 15), hasta: HOY, parcial: false, enCurso: true, valor: 123574, aportes: 13500 }],
  cuentas: [
    { cuenta: 'IB', nombre: 'Interactive Brokers', desde: Date.UTC(2023, 3, 11, 20), importado: { desde: '2023-04-11', fuente: 'ibkr_flex' }, anios: PAYLOAD.anios },
    { cuenta: 'CS', nombre: 'Charles Schwab', desde: Date.UTC(2025, 8, 24, 20), importado: null, anios: [PAYLOAD.anios[0]] }
  ],
  avisos: []
};
if (fuenteWorker) {
  ['cartera', 'cuentas', 'importado'].forEach(function (campo) {
    ok(fuenteWorker.indexOf(campo + ':') !== -1, "el Worker escribe '" + campo + "' en rendimiento_anual");
  });
}
api.cargarAnual(false);
ok(pedidosAnual.length === 1, 'abrir la pagina pide rendimiento_anual una vez');
respuestaPendiente.ok(ANUAL);
// Rediseño del 21/11/2026 (pedido de Guzman: "parece una pagina de excel...
// mas informacion en grande, menos texto chico, alguna grafica de barras").
// UNA tarjeta: selector de serie, el año mas nuevo en grande, barras por año.
// Los asserts de la tabla se dieron vuelta: en esta pagina ya no hay tabla.
var hc = elemento('ranCartera').innerHTML;
ok(hc.indexOf('<div class="ranhero"><div><b class="up">+18.9%</b><span>You</span></div><div><b>+14.1%</b><span>S&P 500</span></div></div>') !== -1, 'el titular: el año mas nuevo en grande, vos y el indice');
ok(hc.indexOf('2026 so far') !== -1 && hc.indexOf('<p class="ranveredicto up">+4.8 pp ahead of the S&P 500</p>') !== -1, 'dice que año es y el veredicto en puntos');
ok(hc.indexOf('rendtabla') === -1 && hc.indexOf('<td>') === -1, 'sin tabla: la pagina dejo de ser una planilla');
ok(hc.indexOf('class="ranbar yo" style="left:0.0%;width:100.0%"') !== -1 && hc.indexOf('class="ranbar ind" style="left:0.0%;width:74.5%"') !== -1, 'las barras del año: las dos sobre la MISMA escala (14.1 / 18.93 = 74.5%)');
ok(hc.indexOf('rantiles') === -1, 'con un solo año no hay resumen: seria repetir el titular');
ok(/<details class="rannota">/.test(hc) && /banks included, without deposits/.test(hc) && /a new year is added every January 1/.test(hc), 'la letra chica queda plegada, y dice que es TODO, sin depositos, y que cada año se suma solo');
ok((hc.match(/data-serie="/g) || []).length === 3 && hc.indexOf('data-serie="total">Total<') !== -1 && hc.indexOf('data-serie="c:IB">Interactive Brokers<') !== -1 && hc.indexOf('data-serie="c:CS">Charles Schwab<') !== -1, 'el selector: Total y un boton por broker con historia');
ok(/class="rangebtn active" data-serie="total"/.test(hc), 'arranca en Total');
api.elegirSerie('c:IB');
var hib = elemento('ranCartera').innerHTML;
ok(/class="rangebtn active" data-serie="c:IB"/.test(hib) && hib.indexOf('<b>2023</b> <em>from ') !== -1 && hib.indexOf('broker’s own records') !== -1, 'IBKR con sus años viejos, el año a medias dicho al lado y de donde salen');
ok(hib.indexOf('rantiles') !== -1 && /Ahead in<\/span><b>\d of \d<\/b>/.test(hib), 'con varios años aparece el resumen: cuantos le ganaron al indice');
api.elegirSerie('total');
ok(elemento('ranCartera').innerHTML === hc, 'volver a Total pinta lo mismo');
api.cargarAnual(true);
ok(pedidosAnual.length === 2 && pedidosAnual[1].forzar === true, 'el boton de refrescar pide sin cache');
respuestaPendiente.fail(new Error('red'));
ok(elemento('ranCartera').innerHTML === hc, 'un fallo de red con datos ya pintados no borra la pagina');
var vacio = { ok: true, indice: { nombre: 'S&P 500' }, cartera: [], cuentas: [], avisos: [] };
api.cargarAnual(true); respuestaPendiente.ok(vacio);
ok(/closes on December 31/.test(elemento('ranCartera').innerHTML), 'sin ningun año todavia lo dice, no deja la tarjeta vacia');

console.log('\nG) Performance pinta lo guardado en el telefono y refresca por atras (11/11/2026)');
ok(guardados.ga_cache_ran && guardados.ga_cache_ran.data === vacio, 'una respuesta sana queda guardada para la proxima apertura');
ok(/'ga_cache_ran'/.test((fs.readFileSync(path.join(RUTA,'js', 'paneles.js'), 'utf8').match(/var GA_CACHES = \[[^\]]*\]/) || [''])[0]), 'ga_cache_ran esta en GA_CACHES (el borrado de emergencia la recorre)');
ok(/id="ranAviso"/.test(fs.readFileSync(path.join(RUTA,'index.html'), 'utf8')), 'la pagina tiene donde decir de cuando es lo guardado');
// La app recien abierta, con los años de ayer guardados.
guardados = { ga_cache_ran: { t: 5678, data: ANUAL } };
marcas = {};
elemento('ranCartera').innerHTML = '';
var api2 = montarApi();
var antesAnual = pedidosAnual.length;
api2.cargarAnual(false);
ok(elemento('ranCartera').innerHTML === hc, 'al abrir se ven los años guardados, antes de que conteste el Worker');
ok(marcas.ranAviso === 5678, 'y dice de cuando son (Data from ... updating)');
ok(pedidosAnual.length === antesAnual + 1 && !pedidosAnual[pedidosAnual.length - 1].forzar, 'igual pide los frescos por atras, sin forzar');
respuestaPendiente.ok({ ok: false, mensajes: ['broker down'] });
ok(elemento('ranCartera').innerHTML === hc && guardados.ga_cache_ran.data === ANUAL, 'un ok:false no pisa lo que se ve ni lo guardado');
ok(marcas.ranAviso === undefined, 'y la marca de "updating" se va');
api2.cargarAnual(false);
var ANUAL2 = JSON.parse(JSON.stringify(ANUAL)); ANUAL2.cartera[0].twr = 20.5; ANUAL2.cartera[0].pp = 6.4;
respuestaPendiente.ok(ANUAL2);
ok(elemento('ranCartera').innerHTML.indexOf('+20.5%') !== -1 && guardados.ga_cache_ran.data === ANUAL2, 'la respuesta fresca reemplaza la pantalla y lo guardado');
// Los brokers JUNTOS (21/11/2026). Pedido de Guzman: un balance general
// aproximado de los años anteriores con lo que informan los brokers. La suma
// la hace el Worker (`brokers` en rendimiento_anual); aca se dibuja en su
// tarjeta, ANTES de las de cada broker, y dice por que es aproximada.
if (fuenteWorker) ok(fuenteWorker.indexOf('brokers: brokers') !== -1 && fuenteWorker.indexOf('cuentas: c.cuentas') !== -1, "el Worker escribe 'brokers' con sus cuentas en rendimiento_anual");
var ANUAL_B = JSON.parse(JSON.stringify(ANUAL));
ANUAL_B.brokers = {
  desde: Date.UTC(2022, 6, 26, 20),
  cuentas: [{ nombre: 'Binance', desde: Date.UTC(2022, 6, 26, 20) }, { nombre: 'Interactive Brokers', desde: Date.UTC(2023, 3, 11, 20) }],
  anios: [
    { anio: 2023, twr: 12.5, spy: 26.1, pp: -13.6, parcial: false, enCurso: false, con: ['Binance', 'Interactive Brokers'] },
    { anio: 2022, twr: -20, spy: -5.2, pp: -14.8, parcial: true, enCurso: false, desde: Date.UTC(2022, 6, 26, 20), con: ['Binance'] }
  ]
};
api2.cargarAnual(true); respuestaPendiente.ok(ANUAL_B);
// Desde el rediseño del 21/11/2026 son un boton del selector ("Brokers"), y
// ademas completan los años de Total anteriores a la app, MARCADOS.
var ht = elemento('ranCartera').innerHTML;
ok(ht.indexOf('data-serie="brokers">Brokers<') !== -1 && ht.indexOf('data-serie="total"') < ht.indexOf('data-serie="brokers"') && ht.indexOf('data-serie="brokers"') < ht.indexOf('data-serie="c:IB"'), 'el boton de los brokers juntos, entre Total y cada broker');
ok((ht.match(/class="rananio aprox"/g) || []).length === 2 && (ht.match(/<em>brokers only<\/em>/g) || []).length === 2, 'Total completa 2023 y 2022 con los brokers juntos, atenuados y dicho al lado');
ok(ht.indexOf('<div class="rananio"><div class="rananio-cab"><span><b>2026</b> <em>so far</em>') !== -1, 'el año de la cartera entera NO va marcado como aproximado');
ok(/Since 2022 &asymp;/.test(ht) && /Earlier years are your brokers added together, without the banks: approximate/.test(ht), 'el resumen y la letra chica de Total dicen que lo anterior es aproximado');
// 1.1893 * 1.125 * 0.80 = 1.0704 -> +7%; el indice 1.141 * 1.261 * 0.948 = 1.364 -> +36%
ok(/<b class="up">\+7%<\/b><em>Index \+36%<\/em>/.test(ht) && /Ahead in<\/span><b>1 of 3<\/b>/.test(ht) && /Best year<\/span><b class="up">\+19%<\/b><em>2026<\/em>/.test(ht), 'las tres cifras: los años encadenados contra el indice, cuantos le gano y el mejor');
ok(/class="ranbar yo" style="left:43\.4%;width:41\.1%"/.test(ht) && /class="ranbar yo" style="left:0\.0%;width:43\.4%"/.test(ht), 'un año negativo crece hacia la izquierda del MISMO cero (escala de -20 a 26.1)');
api2.elegirSerie('brokers');
var hb = elemento('ranCartera').innerHTML;
ok(/class="rangebtn active" data-serie="brokers"/.test(hb) && hb.indexOf('2023 so far') === -1 && hb.indexOf('<p class="detlbl ranlbl">2023</p>') !== -1, 'la serie de los brokers: su año mas nuevo en el titular');
ok(hb.indexOf('<p class="ranveredicto down">−13.6 pp behind the S&P 500</p>') !== -1, 'un año peor que el indice lo dice en rojo');
ok(hb.indexOf('rananio aprox') === -1 && /<b>2022<\/b> <em>from [A-Z][a-z]{2} \d+<\/em>/.test(hb), 'ahi no se atenua nada (toda la serie es la misma), y el año a medias dice desde cuando');
ok(/Approximate: Binance since [A-Z][a-z]{2} \d+, 2022, Interactive Brokers since [A-Z][a-z]{2} \d+, 2023/.test(hb), 'dice que es aproximado y desde cuando cuenta cada broker');
ok(/No banks, without deposits/.test(hb) && /keeps its last known value/.test(hb), 'y por que: sin bancos, y los dias sin dato arrastran el ultimo valor');
api2.cargarAnual(true); respuestaPendiente.ok(ANUAL);
var hs = elemento('ranCartera').innerHTML;
ok(hs.indexOf('data-serie="brokers"') === -1 && hs.indexOf('rananio aprox') === -1 && /class="rangebtn active" data-serie="total"/.test(hs), 'sin `brokers` en la respuesta (un Worker anterior, o una sola cuenta) el boton no aparece y se vuelve a Total');
ok(fs.readFileSync(path.join(RUTA, 'index.html'), 'utf8').indexOf('ranCuentas') === -1, 'las tarjetas apiladas por broker ya no existen en la pagina');
// Sin nada guardado y sin red: el error de siempre.
guardados = {}; marcas = {};
elemento('ranCartera').innerHTML = '';
var api3 = montarApi();
api3.cargarAnual(false);
ok(marcas.ranAviso === undefined, 'sin nada guardado no hay marca');
respuestaPendiente.fail(new Error('red'));
ok(/ERR red/.test(elemento('ranCartera').innerHTML), 'sin nada guardado, un fallo de red se dice');

console.log('\nH) la tarjeta de cada cuenta tambien pinta lo guardado (11/11/2026)');
var panelesSrc = (fs.readFileSync(path.join(RUTA, 'js', 'paneles.js'), 'utf8').match(/var GA_CACHES = \[[^\]]*\]/) || [''])[0];
ok(['IB', 'CS', 'BNB'].every(function (k) { return panelesSrc.indexOf("'ga_cache_rend_" + k + "'") !== -1; }), 'las tres claves por cuenta estan en GA_CACHES (el borrado de emergencia las recorre)');
ok(/id="rendAviso"/.test(fs.readFileSync(path.join(RUTA, 'index.html'), 'utf8')), 'la tarjeta tiene donde decir de cuando es lo guardado');
// Una respuesta sana se guarda con la clave de SU cuenta; la tardia de otra, no.
guardados = {}; marcas = {};
var api5 = montarApi();
api5.mostrar({ key: 'IB', nombre: 'Interactive Brokers' });
var respIB5 = respuestaPendiente;
api5.mostrar({ key: 'CS', nombre: 'Charles Schwab' });
respIB5.ok(PAYLOAD);
ok(guardados.ga_cache_rend_IB === undefined && guardados.ga_cache_rend_CS === undefined, 'la respuesta tardia de otra cuenta no se guarda');
respuestaPendiente.ok(SCHWAB);
ok(guardados.ga_cache_rend_CS && guardados.ga_cache_rend_CS.data === SCHWAB && guardados.ga_cache_rend_IB === undefined, 'una respuesta sana queda guardada con la clave de SU cuenta');
// La app recien abierta, con Schwab guardada de ayer.
guardados = { ga_cache_rend_CS: { t: 4321, data: SCHWAB } };
marcas = {};
elemento('rendBody').innerHTML = '';
var api4 = montarApi();
var antesCta = pedidos.length;
api4.mostrar({ key: 'CS', nombre: 'Charles Schwab' });
ok(/YTD vs S&P 500/.test(elemento('rendBody').innerHTML), 'al abrir Schwab se ve lo guardado, sin "Calculating..."');
ok(marcas.rendAviso === 4321, 'y dice de cuando es');
ok(pedidos.length === antesCta + 1 && pedidos[pedidos.length - 1].cuenta === 'CS', 'igual pide lo fresco por atras');
var conLoGuardado = elemento('rendBody').innerHTML;
respuestaPendiente.ok({ ok: false, mensajes: ['broker down'] });
ok(elemento('rendBody').innerHTML === conLoGuardado && guardados.ga_cache_rend_CS.data === SCHWAB && marcas.rendAviso === undefined, 'un ok:false no pisa lo que se ve ni lo guardado, y la marca se va');
// Lo guardado de una cuenta NO se pinta en otra.
api4.mostrar({ key: 'IB', nombre: 'Interactive Brokers' });
ok(/Calculating your history/.test(elemento('rendBody').innerHTML) && marcas.rendAviso === undefined, 'IBKR sin nada guardado: calcula, no muestra lo de Schwab');
// Una clave con los datos de OTRA cuenta (no deberia pasar) tampoco se pinta.
guardados.ga_cache_rend_BNB = { t: 1, data: SCHWAB };
api4.mostrar({ key: 'BNB', nombre: 'Binance' });
ok(/Calculating your history/.test(elemento('rendBody').innerHTML), 'una clave con datos de otra cuenta no se pinta');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
