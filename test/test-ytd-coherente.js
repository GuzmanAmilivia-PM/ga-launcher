// Arnés del "un solo YTD" (9/09/2026). Guzmán, con tres capturas: "en el
// crecimiento ytd y vs sp500 hay info con resultados diferentes, solo
// tendría que haber dos opciones: ytd completo o sin contemplar depósitos, y
// debería coincidir". Había cuatro cuentas: el YTD del Inicio arrancaba en el
// primer dato de enero (30/01), la tarjeta del año en el cierre del año
// anterior (30/12), el "vs S&P" del Inicio usaba una aproximación distinta
// del encadenado, y el backend arrancaba también en enero.
//
// Lo que custodia: sobre la MISMA serie, los tres cálculos de la app —el %
// del rango YTD, el "vs S&P" del Inicio y la tarjeta del año— arrancan del
// mismo punto y el "sin depósitos" es el mismo número. Corre con la app
// cargada entera (_entorno.js) para tocar las funciones reales de graficos.js.
var entorno = require('./_entorno');

// La historia de este arnés pasa el 2026-06-15 (23/09/2026): con el año de
// HOY se rompía solo en el cambio de año. Ver test/_reloj.js.
require('./_reloj').fijarReloj('2026-06-15T15:00:00Z');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

var cargado = entorno.cargar({});
ok(cargado.errores.length === 0, 'la app carga entera' + (cargado.errores.length ? ': ' + cargado.errores.join(' | ') : ''));
var g = cargado.ambito;
var elems = {};
g.document.getElementById = function (id) {
  if (!elems[id]) elems[id] = entorno.elemento();
  return elems[id];
};

function dia(y, m, d) { return new Date(y, m - 1, d).getTime(); }
var anio = new Date().getFullYear();
var cierre = dia(anio - 1, 12, 30), ene30 = dia(anio, 1, 30), feb15 = dia(anio, 2, 15), hoy = dia(anio, 3, 1);
// Cierre 90.000 → 94.000 → aporte de 2.500 el 15/02 (el tramo NO rinde) → 100.000.
g.fullSerie = [
  { fecha: cierre, valor: 90000 },
  { fecha: ene30, valor: 94000 },
  { fecha: feb15, valor: 96500 },
  { fecha: hoy, valor: 100000 }
];
g.currentTotal = 100000;
g.aplicarBench({ bench: { nombre: 'S&P 500', valores: [100, 104, 104, 110] } });
g.aplicarAportes({ lista: [{ fecha: anio + '-02-15', grupo: 2500, total: 2500 }], desde: (anio - 1) + '-12-01' });

console.log('A) el rango YTD arranca en el cierre del año anterior');
var ytd = g.filterSerie('ytd');
ok(ytd.length === 4 && ytd[0].fecha === cierre, 'incluye el último punto del año pasado como base (' + new Date(ytd[0].fecha).toDateString() + ')');

console.log('\nB) el "sin depósitos" es UNA cuenta, la encadenada');
// La regla del Worker (24/09/2026, auditoria A17): el aporte del 15/02 va al
// FIN de su dia, despues de la foto de ese dia (la de las 8:00, antes de los
// depositos): entra en el tramo 15/02 -> hoy.
// 94/90 × 96.5/94 × 100/(96.5+2.5) = 1,0444 × 1,0266 × 1,0101 = +8,31%
// (Con la medianoche daba +8,23 y el Worker +8,31: dos YTD distintos.)
var esperado = (94000 / 90000) * (96500 / 94000) * (100000 / (96500 + 2500)) * 100 - 100;
var t = g.twrEnRango(ytd);
ok(t && Math.abs(t.pct - esperado) < 0.001, 'twrEnRango encadena y descuenta el aporte de su tramo: ' + (t ? t.pct.toFixed(2) : '-') + '%');
ok(t && t.aportes === 2500, 'y cuenta el aporte del período');
var m = g.movimientoDelSaldo(ytd);
ok(m && Math.abs(m.mercadoPct - esperado) < 0.001, 'movimientoDelSaldo (el "vs S&P" del Inicio) da el MISMO %: ' + (m ? m.mercadoPct.toFixed(2) : '-') + '%');
var c = g.comparacionAnual();
ok(c && Math.abs(c.pct - esperado) < 0.001, 'comparacionAnual (la tarjeta del año en Portfolio) da el MISMO %: ' + (c ? c.pct.toFixed(2) : '-') + '%');
ok(c && c.desde === cierre, 'y arranca del mismo cierre');
ok(c && Math.abs(c.bruto - (100000 / 90000 * 100 - 100)) < 0.001, 'el bruto es el cambio del patrimonio desde ese cierre: +11,11%');

console.log('\nC) el YTD completo del Inicio y el vs S&P salen de la misma base');
g.currentRangeDias = 'ytd';
g.updateRangePct();
ok(/^\+11\.11%/.test(elems.rangePct.textContent), 'el % del rango YTD es el bruto desde el cierre: ' + elems.rangePct.textContent);
// Índice: 100 → 110 = +10%. Limpio +8,31% → −1,7 pp.
ok(/−1\.7 pp vs S&P 500/.test(elems.vsBench.textContent), 'el vs S&P compara el encadenado contra el índice desde el mismo cierre: ' + elems.vsBench.textContent);
var difTarjeta = c.pct - c.idxPct;
ok(Math.abs(difTarjeta - (esperado - 10)) < 0.01, 'y la tarjeta del año da la misma diferencia (' + difTarjeta.toFixed(2) + ' pp)');

console.log('\nD) sin un punto del año anterior, el YTD cae al 1 de enero (no se inventa una base)');
g.fullSerie = [{ fecha: ene30, valor: 94000 }, { fecha: hoy, valor: 100000 }];
var ytd2 = g.filterSerie('ytd');
ok(ytd2.length === 2 && ytd2[0].fecha === ene30, 'arranca en el primer dato del año');
ok(g.comparacionAnual() === null, 'y la tarjeta del año no se dibuja: no hay cierre con qué comparar');

console.log('\nE) un aporte el MISMO dia que la base no se cuenta como rendimiento (auditoria A17)');
// La base del 31/12 con un aporte fechado ese dia: la foto no dice si ya
// estaba adentro. La app lo dejaba afuera (flujos > base) y el aporte se leia
// como +10 %; el Worker saltea esa base. Mercado quieto: 0 %.
var dic31 = dia(anio - 1, 12, 31), ene2 = dia(anio, 1, 2), ene3 = dia(anio, 1, 3);
g.fullSerie = [{ fecha: dic31, valor: 100000 }, { fecha: ene2, valor: 110000 }, { fecha: ene3, valor: 110000 }];
g.aplicarAportes({ lista: [{ fecha: (anio - 1) + '-12-31', grupo: 10000, total: 10000 }], desde: (anio - 1) + '-12-01' });
var t3 = g.twrEnRango(g.fullSerie);
ok(t3 && Math.abs(t3.pct) < 1e-9, 'un aporte el dia de la base no es rendimiento: 0 %, no +10 % (' + (t3 ? t3.pct.toFixed(2) : '-') + '%)');
// La base de la TARDE que ya tiene el aporte adentro (una foto tomada despues
// del deposito): sin correr la base, el aporte se descontaba dos veces
// (110/(110+10) = −8,3 %). Se corre al primer dia sin aportes: 0 %.
var dic31tarde = new Date(anio - 1, 11, 31, 18, 0).getTime();
g.fullSerie = [{ fecha: dic31tarde, valor: 110000 }, { fecha: ene2, valor: 110000 }, { fecha: ene3, valor: 110000 }];
var t4 = g.twrEnRango(g.fullSerie);
ok(t4 && Math.abs(t4.pct) < 1e-9, 'una base de la tarde con el aporte adentro no lo cuenta dos veces: 0 %, no −8,3 % (' + (t4 ? t4.pct.toFixed(2) : '-') + '%)');

// F) EL MISMO numero que el Worker, con su funcion de verdad (24/09/2026).
// MEJORAS A17 pedia esto: el arnes comparaba la app consigo misma, y con un
// escalon plano no distinguia las dos convenciones.
(async function () {
  console.log('\nF) el Worker calcula lo mismo sobre la misma serie');
  var path = require('path'), url = require('url'), fs = require('fs');
  var rutaW = process.env.GA_WORKER || path.join(__dirname, '..', '..', 'ga-portfolio-worker');
  var bench = path.join(rutaW, 'src', 'business', 'Bench.js');
  if (!fs.existsSync(bench)) {
    console.log('  (sin el repo del Worker al lado: se saltea; GA_WORKER apunta a donde este)');
  } else {
    var W = await import(url.pathToFileURL(bench).href);
    var fin = function (ymd) { return W._msFinDeDia(ymd); };
    var r1 = W.crecimientoSinAportes(
      [{ ts: cierre, valor: 90000 }, { ts: ene30, valor: 94000 }, { ts: feb15, valor: 96500 }, { ts: hoy, valor: 100000 }],
      [{ ts: fin(anio + '-02-15'), monto: 2500 }], dia(anio, 1, 1));
    ok(r1 && Math.abs(r1.pct - esperado) < 0.01, 'el Worker da el mismo YTD sin depositos: ' + (r1 && r1.pct) + ' vs ' + esperado.toFixed(4));
    var r2 = W.crecimientoSinAportes(
      [{ ts: dic31, valor: 100000 }, { ts: ene2, valor: 110000 }, { ts: ene3, valor: 110000 }],
      [{ ts: fin((anio - 1) + '-12-31'), monto: 10000 }], dia(anio, 1, 1));
    ok(r2 && Math.abs(r2.pct - (t3 ? t3.pct : NaN)) < 0.01, 'y el mismo con el aporte del dia de la base: ' + (r2 && r2.pct));
    var r3 = W.crecimientoSinAportes(
      [{ ts: dic31tarde, valor: 110000 }, { ts: ene2, valor: 110000 }, { ts: ene3, valor: 110000 }],
      [{ ts: fin((anio - 1) + '-12-31'), monto: 10000 }], dia(anio, 1, 1));
    ok(r3 && Math.abs(r3.pct - (t4 ? t4.pct : NaN)) < 0.01, 'y el mismo con la base de la tarde: ' + (r3 && r3.pct));
  }
  console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
  process.exit(fallos ? 1 : 0);
})();
