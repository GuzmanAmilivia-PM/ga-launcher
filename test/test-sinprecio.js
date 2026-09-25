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
// de ITAU (clasificada como cash) llega con `base` en PESOS contra un valor en
// dolares — esa columna no esta en dolares. Esa sola fila daba un resultado no
// realizado negativo de decenas de miles cuando el real era positivo: el SIGNO
// estaba dado vuelta, no solo el monto. El cash no tiene resultado no
// realizado porque es plata, no algo comprado a un precio. (Numeros de abajo
// inventados.)
k = api.calcularKpis({
  total: 7000,
  posiciones: [
    { symbol: 'A', tipo: 'accion', valor: 1000, base: 800, cambioDia: 1 },
    { symbol: 'ITAU', tipo: 'cash', valor: 6000, base: 240000, cambioDia: null }
  ]
});
casi(k.noRealizado, 200, 0.01, 'la ganancia sale de la accion sola: +200');
casi(k.noRealizadoPct, 25, 0.01, 'y el % tambien: +25%');
ok(k.noRealizado > 0, 'no se da vuelta el signo por una base de cash en otra moneda');

console.log('\nH) el "hoy" del telefono (23/09/2026): el MISMO calculo, en un renglon');
// Auditoria general, punto 11: el cambio del dia estaba calculado y solo se
// veia desde 1100 px. pintarHoy lo pone en el renglon de arriba de Cash, con
// calcularKpis (el mismo que la tira del escritorio: no puede decir otra
// cosa) y la hora del dato.
function montarHoy() {
  var els = {};
  ['hoyLinea', 'hoyVal', 'hoyPct', 'hoyNota', 'hoyHora'].forEach(function (id) {
    els[id] = { id: id, hidden: true, textContent: '', className: '' };
  });
  var c2 = Object.assign({}, ctx, {
    document: { getElementById: function (id) { return els[id] || null; } },
    fmtSigno: function (n) { return (n >= 0 ? '+' : '−') + ctx.fmt(Math.abs(n)); }
  });
  var n2 = Object.keys(c2);
  var f2 = new Function(n2.join(','), cashSrc + '\n' + codigo +
    '\nreturn { pintarHoy: pintarHoy, horaDelDato: horaDelDato, textoHoraDato: textoHoraDato, VIEJO: ACTUALIZANDO_VIEJO_MS };');
  return { api: f2.apply(null, n2.map(function (n) { return c2[n]; })), els: els };
}
var mh = montarHoy();
var hoyMs = new Date(2026, 8, 23, 14, 32).getTime();
mh.api.pintarHoy({
  total: 10000, actualizado: Date.now(),
  posiciones: [
    { symbol: 'A', tipo: 'accion', valor: 1000, cambioDia: 10 },
    { symbol: 'B', tipo: 'accion', valor: 1000, cambioDia: 10 },
    { symbol: 'C', tipo: 'accion', valor: 8000, cambioDia: null }
  ]
});
ok(mh.els.hoyLinea.hidden === false, 'el renglon aparece');
ok(mh.els.hoyVal.textContent === '+US$ 182', 'el cambio en dolares, con su signo: ' + mh.els.hoyVal.textContent);
ok(mh.els.hoyPct.textContent === '+10.00%', 'el % contra lo medido (el mismo de la tira): ' + mh.els.hoyPct.textContent);
ok(mh.els.hoyVal.className === 'up' && mh.els.hoyPct.className === 'up', 'en verde');
ok(mh.els.hoyNota.hidden === false && /excludes US\$ 8,000 not priced today \(80\.0%\)/.test(mh.els.hoyNota.textContent),
  'lo que no tiene precio de hoy se dice en plata: ' + mh.els.hoyNota.textContent);
ok(/^· /.test(mh.els.hoyHora.textContent), 'y lleva la hora del dato: ' + mh.els.hoyHora.textContent);

mh = montarHoy();
mh.api.pintarHoy({ total: 1000, posiciones: [{ symbol: 'A', tipo: 'accion', valor: 1000, cambioDia: -2 }] });
ok(mh.els.hoyVal.className === 'down' && /^−/.test(mh.els.hoyVal.textContent), 'una baja en rojo y con su signo: ' + mh.els.hoyVal.textContent);
ok(mh.els.hoyNota.hidden === true, 'sin nada afuera, la nota no aparece (un aviso que esta siempre se aprende a ignorar)');
ok(mh.els.hoyHora.textContent === '', 'sin `actualizado`, no se inventa una hora');

mh = montarHoy();
mh.api.pintarHoy({ total: 1000, posiciones: [{ symbol: 'A', tipo: 'accion', valor: 1000, cambioDia: null }] });
ok(mh.els.hoyVal.textContent === '—' && /no daily data/.test(mh.els.hoyPct.textContent),
  'sin ningun dato del dia se dice, no se pinta un cero: ' + mh.els.hoyVal.textContent + ' ' + mh.els.hoyPct.textContent);
ok(mh.els.hoyNota.hidden === true, 'y la nota de "excluye" no aparece sobre un numero que no hay');

// Lo que falta, solo cuando pesa (24/09/2026, Guzman: "no es minimalista a no
// ser que sea data importante"). Un 3% afuera no se dice; un 10%, si.
function carteraConAfuera(afuera) {
  return { total: 10000, actualizado: Date.now(), posiciones: [
    { symbol: 'A', tipo: 'accion', valor: 10000 - afuera, cambioDia: 1 },
    { symbol: 'F', tipo: 'fondo', valor: afuera, cambioDia: null }
  ] };
}
mh = montarHoy();
mh.api.pintarHoy(carteraConAfuera(300));
ok(mh.els.hoyNota.hidden === true && mh.els.hoyNota.textContent === '',
  'un 3% sin precio de hoy no enciende la nota: ' + mh.els.hoyNota.textContent);
ok(mh.els.hoyVal.textContent !== '—', 'y el cambio del dia se muestra igual');
mh = montarHoy();
mh.api.pintarHoy(carteraConAfuera(999));
ok(mh.els.hoyNota.hidden === true, 'justo debajo del umbral (9.99%), tampoco');
mh = montarHoy();
mh.api.pintarHoy(carteraConAfuera(1000));
ok(mh.els.hoyNota.hidden === false && /excludes US\$ 1,000 not priced today \(10\.0%\)/.test(mh.els.hoyNota.textContent),
  'desde el 10% se dice: ' + mh.els.hoyNota.textContent);
api.pintarKpis(Object.assign({ liquidez: 0, liquidezPct: 0 }, carteraConAfuera(300)));
ok(pintado.indexOf('not priced today') === -1, 'la tira del escritorio sigue la misma regla (3%: nada)');
api.pintarKpis(Object.assign({ liquidez: 0, liquidezPct: 0 }, carteraConAfuera(1000)));
ok(/excludes US\$ 1,000 not priced today \(10\.0%\)/.test(pintado), 'y al 10% lo dice');

// La hora: del mismo dia, solo la hora; de otro dia, con la fecha (un dato de
// ayer con la hora sola se leeria como de hoy).
ok(mh.api.horaDelDato(hoyMs, new Date(2026, 8, 23, 18, 0).getTime()) === '2:32 PM', 'mismo dia: ' + mh.api.horaDelDato(hoyMs, new Date(2026, 8, 23, 18, 0).getTime()));
ok(mh.api.horaDelDato(hoyMs, new Date(2026, 8, 24, 9, 0).getTime()) === 'Sep 23, 2:32 PM', 'otro dia, con la fecha: ' + mh.api.horaDelDato(hoyMs, new Date(2026, 8, 24, 9, 0).getTime()));
ok(mh.api.horaDelDato(null) === '' && mh.api.horaDelDato(0) === '', 'sin dato, nada');

// "· updating" (23/09/2026, A6): solo con un pedido en camino Y datos de mas
// de dos minutos. Con el sondeo de cada minuto, marcarlo siempre haria
// parpadear la palabra sobre datos frescos.
var ahoraH = new Date(2026, 8, 23, 14, 40).getTime();
ok(mh.api.textoHoraDato(hoyMs, true, ahoraH) === '· 2:32 PM · updating…', 'dato de hace 8 min + pedido en camino: dice que actualiza: ' + mh.api.textoHoraDato(hoyMs, true, ahoraH));
ok(mh.api.textoHoraDato(hoyMs, false, ahoraH) === '· 2:32 PM', 'sin pedido en camino, solo la hora');
ok(mh.api.textoHoraDato(ahoraH - 30000, true, ahoraH).indexOf('updating') === -1, 'dato de hace 30 s: no parpadea aunque haya un pedido');
ok(mh.api.textoHoraDato(null, true, ahoraH) === '· updating…', 'sin ningun dato todavia, solo "updating"');
ok(mh.api.textoHoraDato(null, false, ahoraH) === '', 'y sin pedido, nada');
ok(mh.api.VIEJO === 2 * 60000, 'el umbral es de dos minutos');
// Los precios del vigia en la primera apertura (25/09/2026): la hora es la de
// los precios, no la del armado, y dice "updating" aunque no haya un pedido
// en camino (el precio en vivo llega en el sondeo siguiente).
var tPrecios = Date.now() - 10 * 60000;
mh.api.pintarHoy({ total: 10000, actualizado: Date.now(), preciosDesde: tPrecios, posiciones: [{ symbol: 'A', tipo: 'accion', valor: 1000, cambioDia: 10 }] });
ok(mh.els.hoyHora.textContent === '· ' + mh.api.horaDelDato(tPrecios) + ' · updating…', 'con preciosDesde: su hora y updating: ' + mh.els.hoyHora.textContent);
mh.api.pintarHoy({ total: 10000, actualizado: Date.now(), preciosDesde: null, posiciones: [{ symbol: 'A', tipo: 'accion', valor: 1000, cambioDia: 10 }] });
ok(mh.els.hoyHora.textContent.indexOf('updating') === -1, 'con los precios en vivo, la marca se va sola');

// El renglon esta en el Inicio ARRIBA de Cash, lo pinta render(), y en
// escritorio se apaga (la tira ya lo muestra). ALCANCE: mira el codigo
// escrito, no la pantalla.
var iHoy = html.indexOf('id="hoyLinea"'), iCash = html.indexOf('id="liquidezVal"');
ok(iHoy !== -1 && iHoy < iCash, 'el renglon vive en el Inicio, arriba de Cash');
ok(/pintarKpis\(data\);\s*pintarHoy\(data\);/.test(html), 'render() lo pinta junto con la tira');
ok(/\.hoyline\[hidden\][^{]*\{\s*display:\s*none/.test(html), '`hidden` le gana a .cashline (display:flex)');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
