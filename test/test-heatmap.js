// Arnés de D10: retornos mes a mes (1/09/2026).
//
// Lo que hace que estos números no mientan es restar los APORTES. Medido con
// los datos reales de Guzmán: junio daba **+0,56% en crudo y fue −0,81%** —el
// signo dado vuelta— y enero pasaba de +3,91% a +1,16%. Un heatmap sin esa
// resta pinta de verde un mes en el que perdió plata, que es la peor forma
// posible de equivocarse en una grilla que se lee de un vistazo.
//
// Y si la lista de aportes no está CARGADA (bandera aportesCargados), NO se
// dibuja nada: mostrar los crudos como si fueran retornos sería exactamente
// ese error. Cargada y vacía es otra cosa: sin aportes, el crudo ES el
// retorno, y se dibuja.
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var codigo = ruta.bloque(html,
  '// ---------- D10: retornos mes a mes (1/09/2026) ----------',
  '// ---------- D9: distancia al maximo (1/09/2026) ----------');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

var ctx = {
  Number: Number, isFinite: isFinite, Math: Math, String: String, Date: Date, Object: Object,
  parseInt: parseInt,
  esc: function (s) { return String(s === null || s === undefined ? '' : s); }
};
var nombres = Object.keys(ctx);
var fn = new Function(nombres.join(','), codigo +
  '\nreturn { retornosMensuales: retornosMensuales, anaHeatmapHtml: anaHeatmapHtml };');
var api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));

function cierre(anio, mes, valor) {
  // Ultimo dia del mes, en hora LOCAL: el codigo agrupa con getFullYear() y
  // getMonth(), que son locales. Armado en UTC, en Montevideo un cierre de
  // fin de mes cae en el mes anterior y el agrupado se corre entero.
  return { fecha: new Date(anio, mes, 0, 18, 0, 0).getTime(), valor: valor };
}

// Los números REALES del 1/09/2026, con los aportes de cada mes.
var SERIE = [
  cierre(2025, 12, 90867), cierre(2026, 1, 94418), cierre(2026, 2, 93618),
  cierre(2026, 3, 90082), cierre(2026, 4, 102572)
];
var APORTES = [
  { fecha: '2026-01-15', grupo: 2500 },
  { fecha: '2026-02-10', grupo: 1500 },
  { fecha: '2026-03-05', grupo: 1500 }
];

// Tercer argumento `cargados` (1/09/2026, tarde): la bandera aportesCargados
// de graficos.js, que distingue "todavia no se cargaron" de "no hubo ninguno".
console.log('\nA) los retornos van NETOS de aportes');
var c = api.retornosMensuales(SERIE, APORTES, true);
var porMes = {};
c.forEach(function (x) { porMes[x.mes] = x; });
// Enero: (94418 − 2500) / 90867 − 1 = +1,16%. En crudo daria +3,91%.
ok(Math.abs(porMes[1].pct - 1.16) < 0.02, 'enero: +1,16% neto, no el +3,91% crudo (dio ' + porMes[1].pct.toFixed(2) + ')');
ok(Math.abs(porMes[2].pct - (-2.44)) < 0.02, 'febrero: −2,44% (dio ' + porMes[2].pct.toFixed(2) + ')');
ok(Math.abs(porMes[3].pct - (-5.38)) < 0.02, 'marzo: −5,38% (dio ' + porMes[3].pct.toFixed(2) + ')');
// Abril sin aportes: crudo y neto coinciden.
ok(Math.abs(porMes[4].pct - 13.87) < 0.02, 'abril, sin aportes: +13,87% (dio ' + porMes[4].pct.toFixed(2) + ')');
ok(porMes[1].conAporte && porMes[2].conAporte && !porMes[4].conAporte, 'marca cuales tuvieron movimiento de plata');

console.log('\nB) el caso que justifica todo: el signo dado vuelta');
// Junio real: cierra 110500 desde 109885 con 1500 de aporte. Crudo +0,56%,
// neto −0,81%. Sin la resta, la grilla lo pinta VERDE.
var junio = api.retornosMensuales(
  [cierre(2026, 5, 109885), cierre(2026, 6, 110500)],
  [{ fecha: '2026-06-11', grupo: 1500 }], true
);
ok(junio[0].pct < 0, 'junio da NEGATIVO una vez restado el aporte (dio ' + junio[0].pct.toFixed(2) + ')');
ok(Math.abs(junio[0].pct - (-0.81)) < 0.02, 'y da −0,81%, no +0,56%');
var hJunio = api.anaHeatmapHtml(
  [cierre(2026, 5, 109885), cierre(2026, 6, 110500)],
  [{ fecha: '2026-06-11', grupo: 1500 }], true
);
ok(/239,68,68/.test(hJunio) && !/16,185,129/.test(hJunio), 'y la celda se pinta ROJA, no verde');

console.log('\nC) sin la lista de aportes CARGADA no se dibuja nada; cargada y vacia SI');
// La lista no viaja en el payload del Inicio: la pide el panel de Aportes.
// Si todavia no llego, los crudos NO se muestran como si fueran retornos.
// Pero "cargada y VACIA" es otra cosa: significa que no hubo aportes, y ahi
// el crudo ES el retorno — suprimirlo era esconder un dato valido
// (observacion de la re-auditoria del 1/09/2026).
ok(api.retornosMensuales(SERIE, [], false) === null, 'sin cargar no calcula');
ok(api.anaHeatmapHtml(SERIE, APORTES, false) === '', 'ni con lista a medias: manda la bandera, no el largo');
ok(api.retornosMensuales(SERIE, [], true) !== null, 'cargada y vacia SI calcula (sin aportes, crudo = neto)');
ok(/Month by month/.test(api.anaHeatmapHtml(SERIE, [], true)), 'y se dibuja');
ok(api.anaHeatmapHtml([], APORTES, true) === '', 'sin serie tampoco');
ok(api.retornosMensuales([cierre(2026, 4, 100)], APORTES, true) === null, 'con un solo mes no hay retorno que calcular');

console.log('\nC2) el mes en curso se declara a medias');
var hoyT = new Date();
var mesHoy = hoyT.getMonth() + 1, anioHoy = hoyT.getFullYear();
var mesPrevio = mesHoy === 1 ? 12 : mesHoy - 1;
var anioPrevio = mesHoy === 1 ? anioHoy - 1 : anioHoy;
var hCurso = api.anaHeatmapHtml(
  [cierre(anioPrevio, mesPrevio, 100000), { fecha: hoyT.getTime(), valor: 101000 }],
  [], true
);
ok(/still in progress/.test(hCurso), 'la nota del mes en curso aparece');
ok(!/still in progress/.test(api.anaHeatmapHtml(SERIE, APORTES, true)), 'y NO aparece cuando el ultimo mes es viejo');

console.log('\nD) la grilla dice cuanta historia hay, en vez de aparentar años');
var h = api.anaHeatmapHtml(SERIE, APORTES, true);
ok(/Month by month/.test(h), 'tiene su titulo');
ok(/there are 4 months/.test(h), 'dice cuantos meses hay, con el verbo en plural');
// "there is 9 months" fue la primera version: lo caza el arnes, no la vista.
ok(!/there is \d+ months/.test(h), 'y nunca dice "there is N months"');
var hUno = api.anaHeatmapHtml([cierre(2026, 4, 100000), cierre(2026, 5, 105000)], [{ fecha: '2025-01-01', grupo: 500 }], true);
ok(/there is 1 month here/.test(hUno), 'y con un solo mes va en singular');
ok(/not years yet/.test(h), 'y aclara que todavia no son años');
ok(/history starts Jan 2026/.test(h), 'con el mes en que arranca');
ok(/Net of deposits and withdrawals/.test(h), 'y que estan netos de aportes y retiros');
ok(/The dot marks months/.test(h), 'explica el punto de los meses con movimiento');

console.log('\nE) la forma de grilla: doce columnas aunque falten meses');
// 14: la esquina vacia + los doce meses + el rotulo del año de la fila.
ok((h.match(/<th>/g) || []).length === 14, 'un encabezado por mes, la esquina y el año (dio ' +
  (h.match(/<th>/g) || []).length + ')');
ok((h.match(/class="vacia"/g) || []).length === 8, 'los meses sin dato quedan vacios, no en cero (dio ' +
  (h.match(/class="vacia"/g) || []).length + ')');
// Un cero pintado seria "ese mes no se movio", que es una afirmacion.
ok(!/vacia[^>]*>0/.test(h), 'y un mes vacio no muestra 0.0');
ok(/<div class="heatwrap">/.test(h), 'va en su propio contenedor, que es el que se desplaza de costado');

console.log('\nF) sin aportes en ningun mes, el punto no se menciona');
h = api.anaHeatmapHtml([cierre(2026, 4, 100000), cierre(2026, 5, 105000)], [{ fecha: '2025-01-01', grupo: 500 }], true);
ok(!/The dot marks/.test(h), 'un aviso que aparece siempre se aprende a ignorar');

console.log('\nG) la interfaz va en INGLES (regla del proyecto)');
h = api.anaHeatmapHtml(SERIE, APORTES, true);
['Mes a mes', 'aportes', 'meses', 'historia', 'retiros']
  .forEach(function (p) { ok(h.indexOf(p) === -1, 'no se colo "' + p + '"'); });

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
