// El periodo de la pagina Performance (23/11/2026). Pedido de Guzman:
// "deberia de tener eleccion YTD, 1 AÑO, 2 AÑOS, 5 AÑOS, DESDE INICIO".
//
// Este arnes EJECUTA js/rendimiento.js con un DOM de mentira y un payload con
// la forma del Worker (rangos por serie), y CRUZA cada campo que la pantalla
// lee contra el fuente del Worker: si alla se renombra `spyAnual` o `corte`,
// se pone rojo aca antes de que el telefono muestre guiones.
var fs = require('fs');
var path = require('path');

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

var elementos = {};
var clics = { serie: {}, periodo: {} };
function elemento(id) {
  if (elementos[id]) return elementos[id];
  var e = {
    id: id, innerHTML: '', style: {},
    querySelectorAll: function (sel) {
      var attr = /data-serie/.test(sel) ? 'data-serie' : (/data-periodo/.test(sel) ? 'data-periodo' : null);
      if (!attr) return [];
      var out = [], re = new RegExp(attr + '="([^"]+)"', 'g'), m;
      while ((m = re.exec(e.innerHTML)) !== null) {
        (function (v) {
          out.push({ getAttribute: function () { return v; },
            addEventListener: function (ev, fn) { clics[attr === 'data-serie' ? 'serie' : 'periodo'][v] = function () { fn({ currentTarget: { getAttribute: function () { return v; } } }); }; } });
        })(m[1]);
      }
      return out;
    }
  };
  elementos[id] = e;
  return e;
}
var doc = { getElementById: function (id) { return /^ran/.test(id) ? elemento(id) : null; } };
var cuerpo = src + '\nreturn { render: renderRendAnual, setDatos: function (d) { ranDatos = d; }, periodo: function () { return ranPeriodo; } };';
var api = new Function('document', 'esc', 'mask', 'signoPct', 'fmtUsdEnt', 'fechaCortaMs', 'msgErr', 'msgBackend', 'google', 'volver',
  'cacheLeer', 'cacheGuardar', 'marcaActualizando', 'limpiarMarca', cuerpo)(
  doc, function (s) { return String(s); }, function (s) { return s; },
  function (v, d) { return (v >= 0 ? '+' : '') + v.toFixed(d) + '%'; },
  function (n) { return 'US$ ' + Math.round(n); }, function () { return ''; },
  function () { return 'ERR'; }, function () { return 'mal'; }, { script: { run: {} } }, function () {},
  function () { return null; }, function () {}, function () {}, function () {});

var DIA = 86400000, HOY = Date.now();
function x(twr, spy, extra) {
  return Object.assign({ twr: twr, anual: null, spy: spy, spyAnual: null, pp: Math.round((twr - spy) * 100) / 100,
    desde: HOY - 300 * DIA, hasta: HOY, parcial: false }, extra || {});
}
var payload = {
  ok: true, indice: { nombre: 'S&P 500', nota: 'SPY with dividends reinvested' },
  cartera: [{ anio: 2026, twr: 0.59, spy: 1.07, pp: -0.48, desde: HOY - 328 * DIA, hasta: HOY, parcial: true, enCurso: true }],
  brokers: null,
  cuentas: [{ cuenta: 'IB', nombre: 'Interactive Brokers', desde: HOY - 900 * DIA, importado: null,
    anios: [{ anio: 2026, twr: 4, spy: 1, pp: 3, enCurso: true }, { anio: 2025, twr: 10, spy: 17, pp: -7 }] }],
  rangos: {
    total: { ytd: x(0.59, 1.07), '1a': x(2.1, 3.2, { aprox: true, corte: HOY - 328 * DIA }), '2a': x(30.4, 25, { anual: 14.2, spyAnual: 11.8, aprox: true, corte: HOY - 328 * DIA }), '5a': null,
      origen: x(55, 60, { parcial: true, anual: 12.3, spyAnual: 13.1, aprox: true, corte: HOY - 328 * DIA }) },
    IB: { ytd: x(4, 1), '1a': x(5, 2), '2a': x(20, 30), '5a': x(40, 70, { parcial: true }), origen: x(40, 70) }
  },
  avisos: []
};

api.setDatos(payload);
api.render();
var h = elementos.ranCartera.innerHTML;
ok(/data-periodo="ytd"/.test(h) && /data-periodo="1a"/.test(h) && /data-periodo="2a"/.test(h) && /data-periodo="5a"/.test(h) && /data-periodo="origen"/.test(h),
  'las cinco burbujas: YTD, 1Y, 2Y, 5Y, All');
ok(/>YTD</.test(h) && />1Y</.test(h) && />2Y</.test(h) && />5Y</.test(h) && />All</.test(h), 'con sus etiquetas cortas');
ok(/data-periodo="ytd"[^>]*>|class="ranpill active" data-periodo="ytd"/.test(h) && /ranpill active" data-periodo="ytd"/.test(h), 'arranca en YTD');
ok(/data-periodo="5a" disabled/.test(h), 'un periodo sin dato queda apagado, no muestra guiones');
ok(h.indexOf('+0.6%') >= 0 && h.indexOf('+1.1%') >= 0, 'YTD de la cartera: vos +0,6 % contra el indice +1,1 %');
ok(/−0\.5/.test(h), 'la diferencia en puntos, con su signo: −0,5');
ok(/today /.test(h), 'dice hasta cuando: hoy, con la hora (en vivo)');
ok(h.indexOf('ranplot') >= 0 && h.indexOf('ranplot') < h.indexOf('ranPer'), 'la grafica de años sigue arriba; el periodo va debajo');

clics.periodo['2a']();
h = elementos.ranCartera.innerHTML;
ok(api.periodo() === '2a', 'tocar 2Y elige 2Y');
ok(h.indexOf('+30.4%') >= 0 && h.indexOf('+25.0%') >= 0, '2Y: +30,4 % contra +25,0 %');
ok(h.indexOf('+14.2%/yr') >= 0 && h.indexOf('+11.8%/yr') >= 0, 'mas de un año: tambien por año');
ok(/brokers only \(approx\.\)/.test(h), 'antes de la cartera entera son los brokers: lo dice');

clics.periodo.origen();
h = elementos.ranCartera.innerHTML;
ok(/all the history there is/.test(h), 'All con historia corta lo dice');

clics.serie['c:IB']();
h = elementos.ranCartera.innerHTML;
ok(api.periodo() === 'origen', 'cambiar de cuenta conserva el periodo');
ok(h.indexOf('+40.0%') >= 0 && h.indexOf('+70.0%') >= 0, 'IBKR desde el inicio: +40 % contra +70 %');
ok(!/data-periodo="5a" disabled/.test(h), 'IBKR si tiene 5Y');

// Un payload de antes (cache del telefono sin `rangos`): el resumen de siempre.
var viejo = JSON.parse(JSON.stringify(payload)); delete viejo.rangos;
api.setDatos(viejo); api.render();
h = elementos.ranCartera.innerHTML;
ok(!/data-periodo/.test(h) && /rantiles/.test(h), 'sin rangos (cache viejo) no rompe: el resumen de siempre');

// El cruce con el Worker: cada campo que la pantalla lee existe alla.
if (fuenteWorker) {
  ['twr:', 'anual:', 'spyAnual:', 'pp:', 'parcial:', 'aprox:', 'corte:', 'rangos:', "'2a'", 'origen'].forEach(function (k) {
    ok(fuenteWorker.indexOf(k) >= 0, 'el Worker produce ' + k);
  });
} else console.log('  (sin el fuente del Worker al lado: el cruce se saltea)');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
if (fallos) process.exit(1);
