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
// 94/90 × (96.5−2.5)/94 × 100/96.5 = 1,0444 × 1,0 × 1,0363 = +8,23%
var esperado = (94000 / 90000) * ((96500 - 2500) / 94000) * (100000 / 96500) * 100 - 100;
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
// Índice: 100 → 110 = +10%. Limpio +8,23% → −1,8 pp.
ok(/−1\.8 pp vs S&P 500/.test(elems.vsBench.textContent), 'el vs S&P compara el encadenado contra el índice desde el mismo cierre: ' + elems.vsBench.textContent);
var difTarjeta = c.pct - c.idxPct;
ok(Math.abs(difTarjeta - (-1.77)) < 0.01, 'y la tarjeta del año da la misma diferencia (' + difTarjeta.toFixed(2) + ' pp)');

console.log('\nD) sin un punto del año anterior, el YTD cae al 1 de enero (no se inventa una base)');
g.fullSerie = [{ fecha: ene30, valor: 94000 }, { fecha: hoy, valor: 100000 }];
var ytd2 = g.filterSerie('ytd');
ok(ytd2.length === 2 && ytd2[0].fecha === ene30, 'arranca en el primer dato del año');
ok(g.comparacionAnual() === null, 'y la tarjeta del año no se dibuja: no hay cierre con qué comparar');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
