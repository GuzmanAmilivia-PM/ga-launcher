// Arnés de D9: distancia al máximo (1/09/2026).
//
// La peor caída ya estaba, pero sola no dice dónde estás HOY: se puede haber
// dado hace ocho meses y estar en máximos. Lo que este arnés custodia no es
// la resta —eso lo hace el backend— sino que la pantalla NO deje suponer dos
// cosas que no son ciertas:
//
//  1. Que sea una pérdida de inversión. La serie es el SALDO: un depósito
//     sube el techo y un retiro se ve como una caída.
//  2. Que el máximo sea el histórico. Es el de la ventana diaria de 400
//     días; más atrás la serie guarda un punto por mes.
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var codigo = ruta.bloque(html,
  '// ---------- D9: distancia al maximo (1/09/2026) ----------',
  '// ---------- D7: contribucion al retorno (1/09/2026) ----------');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

var ctx = {
  Number: Number, isFinite: isFinite, Math: Math, String: String,
  esc: function (s) { return String(s === null || s === undefined ? '' : s); },
  anaPct: function (x, dec) {
    if (x === null || x === undefined || !isFinite(x)) return '—';
    return (Math.round(x * (dec === 1 ? 1000 : 100)) / (dec === 1 ? 10 : 1)).toFixed(dec === 1 ? 1 : 0) + '%';
  },
  anaFecha: function (ms) {
    if (!ms) return '';
    var d = new Date(ms);
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
  },
  Date: Date
};
var nombres = Object.keys(ctx);
var fn = new Function(nombres.join(','), codigo + '\nreturn { anaCaidaHtml: anaCaidaHtml };');
var api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));

// Fechas LOCALES, no UTC: anaFecha las lee con getDate()/getMonth(), que son
// locales. Armadas en UTC, en Montevideo (UTC-3) el 14 se muestra como 13 y
// el test falla por la zona horaria, no por el codigo.
var PICO = new Date(2026, 7, 14).getTime();
// Los números reales del 1/09/2026: 1,61% por debajo, 18 días bajo el agua.
var REAL = {
  ddActual: 0.0161, diasBajoAgua: 18, picoFecha: PICO, ventanaDias: 400,
  drawdown: 0.046, drawdownDesde: new Date(2026, 0, 30).getTime(), drawdownHasta: new Date(2026, 2, 31).getTime()
};

console.log('\nA) hoy y la peor, una al lado de la otra');
var h = api.anaCaidaHtml(REAL);
ok(/Distance from your high/.test(h), 'tiene su titulo');
ok(/<span>Today<\/span><b class="down">&minus;1\.6%/.test(h), 'hoy: 1,6% por debajo, en rojo');
ok(/18 days below it/.test(h), 'y hace cuanto — la parte que la peor caida NO contesta');
ok(/<span>Worst<\/span><b class="down">&minus;4\.6%/.test(h), 'la peor sigue estando');
ok(/30\/01\/2026 &rarr; 31\/03\/2026/.test(h), 'con sus fechas');

console.log('\nB) los dos limites se DICEN, no se dejan suponer');
ok(/deposits raise the high and withdrawals look like a fall/.test(h),
  'avisa que sigue el SALDO: no es una perdida de inversion');
ok(/not the same as an investment loss/.test(h), 'y lo dice con esas palabras');
ok(/Measured over the last 400 days, not all time/.test(h),
  'y que el maximo es el de la ventana, no el historico');
ok(/highest balance was on 14\/08\/2026/.test(h), 'con la fecha del maximo');

console.log('\nC) estar EN el maximo es una noticia, no un dato faltante');
h = api.anaCaidaHtml({ ddActual: 0, diasBajoAgua: 0, picoFecha: PICO, ventanaDias: 400, drawdown: 0.046,
  drawdownDesde: new Date(2026, 0, 30).getTime(), drawdownHasta: new Date(2026, 2, 31).getTime() });
ok(/At its high/.test(h), 'se muestra "At its high", no un guion');
ok(/class="up"/.test(h), 'y en verde, no en rojo');
ok(/no gap to close/.test(h), 'sin inventar dias bajo el agua');
ok(!/0 days below it/.test(h), 'y sin la frase absurda "0 dias por debajo"');

console.log('\nD) singular y plural');
h = api.anaCaidaHtml({ ddActual: 0.005, diasBajoAgua: 1, picoFecha: PICO, ventanaDias: 400 });
ok(/1 day below it/.test(h) && !/1 days/.test(h), 'un dia va en singular');

console.log('\nE) sin el dato no se dibuja nada');
ok(api.anaCaidaHtml({}) === '', 'un backend viejo (sin ddActual) no pinta un bloque vacio');
ok(api.anaCaidaHtml({ ddActual: null }) === '', 'ni con el campo en null');
// Serie corta: hay actual pero nunca hubo una caida peor que la de hoy.
h = api.anaCaidaHtml({ ddActual: 0.02, diasBajoAgua: 3, picoFecha: PICO, ventanaDias: 400, drawdown: 0 });
ok(/Today/.test(h) && !/Worst/.test(h), 'sin peor caida registrada, esa celda no aparece');

console.log('\nF) la interfaz va en INGLES (regla del proyecto)');
h = api.anaCaidaHtml(REAL);
['maximo', 'caida', 'saldo', 'dias', 'Distancia', 'perdida']
  .forEach(function (p) { ok(h.indexOf(p) === -1, 'no se colo "' + p + '"'); });

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
