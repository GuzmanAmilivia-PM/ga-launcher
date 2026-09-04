// Arnés de D8: lo que NO tiene precio de hoy queda fuera del cambio diario
// y se declara aparte (31/08/2026).
//
// Fidelity separa "Today's Change" de "Change in Securities Not Priced
// Today". Acá no se puede copiar literal: de lo que no cotizó hoy no sabemos
// NADA, ni siquiera cuánto se movió. Así que la versión honesta es sacarlo
// del cálculo y decir cuánta plata quedó afuera.
//
// Este arnés EJECUTA la aritmética en vez de mirar el texto del código, que
// es la única forma de notar un divisor mal puesto: el bug que corrige D8
// —dividir por la cartera entera mientras el numerador solo suma lo medido—
// no cambia ni una palabra de la pantalla, solo achica el porcentaje.
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var codigo = ruta.bloque(html,
  '// D8 (31/08/2026). Fidelity separa',
  '// ---------- Detalle desplegable por activo + grafico TradingView ----------');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}
function casi(a, b, tol, msg) { ok(Math.abs(a - b) < (tol || 0.01), msg + '  (dio ' + a + ')'); }

// Se inyecta la esFilaCash REAL de nucleo.js: con un doble de mentira el
// arnés probaría su propia idea de qué es cash, que es justo lo que no hay
// que duplicar.
var cashSrc = (html.match(/var SIMBOLOS_CASH = \[[^\]]*\];/) || [''])[0] + '\n' +
  (html.match(/function esFilaCash[\s\S]*?\n\}/) || [''])[0];
if (cashSrc.indexOf('function esFilaCash') === -1) {
  console.log('  FALLA: no encuentro esFilaCash/SIMBOLOS_CASH en nucleo.js'); process.exit(1);
}

var pintado = '';
var ctx = {
  Number: Number, isFinite: isFinite, Math: Math, String: String,
  document: { getElementById: function (id) { return id === 'kpiStrip' ? { set innerHTML(v) { pintado = v; }, get innerHTML() { return pintado; } } : null; } },
  esc: function (s) { return String(s === null || s === undefined ? '' : s); },
  fmt: function (n) { return 'US$ ' + Math.round(Number(n)).toLocaleString('en-US'); },
  signoPct: function (v, d) { return (v >= 0 ? '+' : '') + v.toFixed(d) + '%'; }
};
var nombres = Object.keys(ctx);
var fn = new Function(nombres.join(','), cashSrc + '\n' + codigo +
  '\nreturn { calcularKpis: calcularKpis, pintarKpis: pintarKpis };');
var api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));

console.log('\nA) el porcentaje se mide contra lo que SE MIDIO, no contra la cartera entera');
// Dos posiciones de 1.000 que subieron 10% (ayer valian ~909 cada una), mas
// 8.000 de un valor sin precio de hoy. El cambio en plata es ~182.
// El divisor honesto es lo medido (1.818), no la cartera (10.000).
var k = api.calcularKpis({
  total: 10000,
  posiciones: [
    { symbol: 'A', tipo: 'accion', valor: 1000, cambioDia: 10 },
    { symbol: 'B', tipo: 'accion', valor: 1000, cambioDia: 10 },
    { symbol: 'C', tipo: 'accion', valor: 8000, cambioDia: null }
  ]
});
casi(k.diaUsd, 181.82, 0.02, 'el monto solo suma lo que tiene precio');
casi(k.diaPct, 10, 0.02, 'el % dice 10%: es lo que de verdad se movio la parte medida');
ok(k.diaPct > 9, 'y NO ~1,8%, que es lo que daba dividiendo por la cartera entera ' +
  '(eso afirma que lo no cotizado se movio 0%)');
casi(k.valorSinPrecio, 8000, 0.01, 'declara los 8.000 que quedaron afuera');
casi(k.pctSinPrecio, 80, 0.01, 'y que son el 80% de la cartera');
ok(k.sinPrecio === 1, 'cuenta una sola posicion sin precio');

console.log('\nB) el cash NO es un dato faltante: no cotiza porque no se mueve');
k = api.calcularKpis({
  total: 3000,
  posiciones: [
    { symbol: 'A', tipo: 'accion', valor: 1000, cambioDia: 10 },
    { symbol: 'USDT', tipo: 'cash', valor: 2000, cambioDia: null }
  ]
});
ok(k.sinPrecio === 0, 'el cash no se cuenta como posicion sin precio');
casi(k.valorSinPrecio, 0, 0.01, 'ni suma plata al monto excluido');
// El cash SI entra en el divisor, y ahi no hay contradiccion: de verdad se
// movio 0%. Ayer: 909 (la accion) + 2.000 (el cash) = 2.909. 90,91/2.909.
casi(k.diaPct, 3.13, 0.02, 'pero SI entra en el divisor: de verdad se movio 0%');

console.log('\nC) sin nada que declarar, el aviso no aparece');
// Un aviso que esta siempre encendido se aprende a ignorar. Con el conteo
// viejo —que metia al cash entre los faltantes— nunca podia apagarse.
k = api.calcularKpis({
  total: 3000,
  posiciones: [
    { symbol: 'A', tipo: 'accion', valor: 1000, cambioDia: 1 },
    { symbol: 'USDT', tipo: 'cash', valor: 2000, cambioDia: null }
  ]
});
ok(k.sinPrecio === 0, 'cartera con todo cotizado + cash: nada que avisar');
api.pintarKpis({ total: 3000, liquidez: 2000, liquidezPct: 0.667, posiciones: [
  { symbol: 'A', tipo: 'accion', valor: 1000, cambioDia: 1 },
  { symbol: 'USDT', tipo: 'cash', valor: 2000, cambioDia: null }
] });
ok(pintado.indexOf('not priced today') === -1, 'y la tira no lo menciona');

console.log('\nD) con datos faltantes, la tira lo dice en PLATA');
api.pintarKpis({ total: 10000, liquidez: 0, liquidezPct: 0, posiciones: [
  { symbol: 'A', tipo: 'accion', valor: 1000, cambioDia: 10 },
  { symbol: 'C', tipo: 'accion', valor: 8000, cambioDia: null }
] });
ok(/excludes US\$ 8,000 not priced today/.test(pintado), 'nombra el monto excluido');
ok(/\(80\.0%\)/.test(pintado), 'y que porcion de la cartera es');
// El conteo de posiciones se saco a proposito: seis chicas y una grande se
// leen igual contadas y no son lo mismo.
ok(!/of 2 positions/.test(pintado), 'ya no cuenta posiciones');

console.log('\nE) el cash sin `tipo` (detalle de cuenta) tampoco cuenta como faltante');
// getAccountData devuelve la fila de la hoja SIN clasificar. Si la regla
// dependiera solo de `tipo`, el cash de Itau y el de Binance apareceria como
// "sin precio" en la pagina de su cuenta.
k = api.calcularKpis({
  total: 3000,
  posiciones: [
    { symbol: 'A', tipo: 'accion', valor: 1000, cambioDia: 10 },
    { symbol: 'LIQUIDEZ', valor: 2000, cambioDia: null }
  ]
});
ok(k.sinPrecio === 0, 'reconoce el cash por el simbolo cuando no viene el tipo');

console.log('\nF) casos de borde');
k = api.calcularKpis({ total: 0, posiciones: [] });
ok(k.diaUsd === null && k.diaPct === null, 'cartera vacia: guion, no un cero inventado');
ok(k.pctSinPrecio === null, 'y sin porcentaje de excluidos');

k = api.calcularKpis({
  total: 1000,
  posiciones: [{ symbol: 'A', tipo: 'accion', valor: 1000, cambioDia: null }]
});
ok(k.diaUsd === null, 'si NADA tiene precio, no se inventa un cambio');
casi(k.pctSinPrecio, 100, 0.01, 'y se declara el 100% excluido');

// Una caida del -100% dejaria ayer=0: dividir por eso da infinito.
k = api.calcularKpis({
  total: 100,
  posiciones: [{ symbol: 'A', tipo: 'accion', valor: 100, cambioDia: -100 }]
});
ok(k.diaUsd === null || isFinite(k.diaPct), 'un -100% no produce un infinito en pantalla');

// El resultado no realizado no se toca con D8: sigue midiendose sobre lo que
// tiene precio de compra, tenga o no variacion del dia.
k = api.calcularKpis({
  total: 2000,
  posiciones: [
    { symbol: 'A', tipo: 'accion', valor: 1200, base: 1000, cambioDia: null },
    { symbol: 'B', tipo: 'accion', valor: 800, base: 1000, cambioDia: 2 }
  ]
});
casi(k.noRealizado, 0, 0.01, 'el no realizado incluye lo que no cotizo hoy: su costo si se conoce');

console.log('\nG) el cash queda fuera del resultado no realizado (bug real, 31/08/2026)');
// Encontrado mirando la pantalla con datos reales, no en una prueba: la fila
// de ITAU (clasificada como cash) llega con `base` 239.974 contra un valor de
// 6.021 — esa columna no esta en dolares. Esa sola fila daba
// "Unrealized −USD 198.516 / −65,1%" cuando lo real es +USD 35.437 / +54,4%:
// el SIGNO estaba dado vuelta, no solo el monto. El cash no tiene resultado
// no realizado porque es plata, no algo comprado a un precio.
k = api.calcularKpis({
  total: 7000,
  posiciones: [
    { symbol: 'A', tipo: 'accion', valor: 1000, base: 800, cambioDia: 1 },
    { symbol: 'ITAU', tipo: 'cash', valor: 6000, base: 239974, cambioDia: null }
  ]
});
casi(k.noRealizado, 200, 0.01, 'la ganancia sale de la accion sola: +200');
casi(k.noRealizadoPct, 25, 0.01, 'y el % tambien: +25%');
ok(k.noRealizado > 0, 'no se da vuelta el signo por una base de cash en otra moneda');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
