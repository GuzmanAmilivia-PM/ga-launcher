// Arnés de D7: contribución al retorno (1/09/2026).
//
// El bloque existe porque DOS listas que la gente confunde no son la misma.
// Con la cartera real de Guzmán: VOO es lo que más movió su retorno (+13,8
// puntos) y no aparece entre los cinco que más subieron; OMF subió 68,9% y
// aportó 0,39 puntos, o sea nada. Una posición chica que se duplica se
// siente enorme y no mueve la aguja.
//
// Lo que este arnés custodia:
//  - Que la contribución se mida sobre el COSTO total, para que las
//    contribuciones SUMEN el retorno de la cartera. Sobre el valor de hoy no
//    sumarían nada interpretable, y el error no se ve en pantalla.
//  - Que el cash y lo que no tiene precio de compra queden afuera, y que la
//    cobertura se declare.
//  - Que la frase que compara las dos listas solo aparezca cuando de verdad
//    las encabezan papeles distintos.
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var codigo = ruta.bloque(html,
  '// ---------- D7: contribucion al retorno (1/09/2026) ----------',
  '// Una fila con barra proporcional (clases y sectores del detalle).');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}
function casi(a, b, tol, msg) { ok(Math.abs(a - b) < (tol || 0.01), msg + '  (dio ' + a + ')'); }

// esFilaCash REAL de nucleo.js: con un doble de mentira el arnés probaría su
// propia idea de qué es cash, que es justo lo que no hay que duplicar.
var cashSrc = (html.match(/var SIMBOLOS_CASH = \[[^\]]*\];/) || [''])[0] + '\n' +
  (html.match(/function esFilaCash[\s\S]*?\n\}/) || [''])[0];
if (cashSrc.indexOf('function esFilaCash') === -1) {
  console.log('  FALLA: no encuentro esFilaCash/SIMBOLOS_CASH en nucleo.js'); process.exit(1);
}

var ctx = {
  Number: Number, isFinite: isFinite, Math: Math, String: String,
  esc: function (s) { return String(s === null || s === undefined ? '' : s); },
  fmt: function (n) { return 'US$ ' + Math.round(Number(n)).toLocaleString('en-US'); },
  signoPct: function (v, d) { return (v >= 0 ? '+' : '') + v.toFixed(d) + '%'; },
  anaPct: function (x, dec) {
    if (x === null || x === undefined || !isFinite(x)) return '—';
    return (Math.round(x * (dec === 1 ? 1000 : 100)) / (dec === 1 ? 10 : 1)).toFixed(dec === 1 ? 1 : 0) + '%';
  }
};
var nombres = Object.keys(ctx);
var fn = new Function(nombres.join(','), cashSrc + '\n' + codigo +
  '\nreturn { contribucionAlRetorno: contribucionAlRetorno, anaCtrHtml: anaCtrHtml };');
var api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));

// Una cartera chica donde el que más sube NO es el que más aporta: es
// exactamente el caso real de Guzmán, en miniatura.
var CARTERA = [
  { symbol: 'GRANDE', nombre: 'Posicion grande', tipo: 'etf', valor: 16000, base: 10000 },
  { symbol: 'CHICA', nombre: 'Posicion chica', tipo: 'accion', valor: 300, base: 100 }
];

console.log('\nA) la contribucion se mide sobre el COSTO, y por eso SUMA el retorno');
var c = api.contribucionAlRetorno(CARTERA);
// Costo total 10.100. GRANDE gana 6.000 -> 59,41 pts. CHICA gana 200 -> 1,98 pts.
casi(c.contribuyentes[0].ctr, 59.41, 0.02, 'GRANDE aporta 59,41 puntos');
casi(c.contribuyentes[1].ctr, 1.98, 0.02, 'CHICA aporta 1,98, aunque se haya triplicado');
casi(c.retornoTotal, 61.39, 0.02, 'y las dos SUMAN el retorno de la cartera: 6.200 sobre 10.100');
// Si se midiera sobre el valor de hoy, la suma no significaria nada — y en
// pantalla se veria igual de prolijo.
ok(Math.abs(c.retornoTotal - (6200 / 10100 * 100)) < 0.01,
  'el divisor es el costo invertido, no el valor actual');

console.log('\nB) las dos listas ordenan distinto, que es todo el punto');
ok(c.contribuyentes[0].symbol === 'GRANDE', 'por contribucion manda la grande');
ok(c.movidas[0].symbol === 'CHICA', 'por porcentaje manda la chica (+200%)');
casi(c.movidas[0].pct, 200, 0.01, 'la chica se triplico');

console.log('\nC) el cash y lo que no tiene precio de compra quedan afuera');
c = api.contribucionAlRetorno([
  { symbol: 'A', tipo: 'accion', valor: 1200, base: 1000 },
  { symbol: 'USDT', tipo: 'cash', valor: 5000, base: 999999 },
  { symbol: 'ITAU', valor: 6000, base: 239974 },        // sin `tipo`, como en el detalle de cuenta
  { symbol: 'BTC', tipo: 'cripto', valor: 2000, base: null }
]);
ok(c.contribuyentes.length === 1, 'solo entra la que tiene costo conocido');
casi(c.retornoTotal, 20, 0.01, 'el retorno es +20%: la base disparatada del cash no lo toca');
ok(c.sinCosto.indexOf('BTC') !== -1, 'y la cripto sin costo queda NOMBRADA');
ok(c.sinCosto.indexOf('USDT') === -1 && c.sinCosto.indexOf('ITAU') === -1,
  'el cash no figura como "sin costo": no es un dato que falte');

console.log('\nD) lo que se dice en pantalla');
var h = api.anaCtrHtml(CARTERA);
ok(/What drove your return/.test(h), 'tiene su titulo');
ok(/Since you bought, not over the range above/.test(h),
  'aclara el periodo: es desde la compra, no del rango elegido arriba');
ok(/\+61\.4%/.test(h), 'y dice el retorno total que las contribuciones suman');
ok(/GRANDE<\/b> moved your return most/.test(h), 'nombra al que movio la aguja');
// Son PUNTOS porcentuales, no por ciento. La primera version escribia
// "+59.41% pts" —lo cazó mirar la pantalla, no una prueba— y eso no
// significa nada: contribucion y porcentaje son dos unidades distintas, que
// es justamente lo que este bloque existe para distinguir.
ok(/\+59\.41 pts/.test(h), 'la contribucion va en puntos, sin signo de porcentaje');
ok(!/% pts/.test(h), 'nunca aparece el hibrido "% pts"');
ok(/CHICA<\/b> moved more/.test(h), 'y al que mas subio');
ok(/Size decides, not percentage/.test(h), 'con la razon dicha, no sugerida');

console.log('\nE) cuando el mismo papel encabeza las dos, no se inventa una comparacion');
h = api.anaCtrHtml([
  { symbol: 'UNO', tipo: 'accion', valor: 2000, base: 1000 },
  { symbol: 'DOS', tipo: 'accion', valor: 1010, base: 1000 }
]);
ok(!/moved your return most/.test(h),
  'sin diferencia entre las dos listas, la frase sobra y no aparece');

console.log('\nF) la cobertura se declara, y solo cuando falta algo');
h = api.anaCtrHtml([
  { symbol: 'A', tipo: 'accion', valor: 1000, base: 800 },
  { symbol: 'BTC', tipo: 'cripto', valor: 2000, base: null }
]);
ok(/Measured over the/.test(h), 'con posiciones sin costo lo dice');
ok(/no cost for BTC/.test(h), 'y nombra cuales');
h = api.anaCtrHtml([{ symbol: 'A', tipo: 'accion', valor: 1000, base: 800 }]);
ok(!/Measured over the/.test(h), 'con todo cubierto no agrega ruido');

console.log('\nG) casos de borde');
ok(api.contribucionAlRetorno([]) === null, 'cartera vacia: no devuelve nada que pintar');
ok(api.anaCtrHtml([]) === '', 'y el bloque entero no se dibuja');
ok(api.contribucionAlRetorno([{ symbol: 'A', tipo: 'accion', valor: 100, base: 0 }]) === null,
  'costo cero no divide por cero');
var neg = api.contribucionAlRetorno([
  { symbol: 'MAL', tipo: 'accion', valor: 500, base: 1000 },
  { symbol: 'BIEN', tipo: 'accion', valor: 1100, base: 1000 }
]);
ok(neg.contribuyentes[0].symbol === 'MAL', 'una perdida grande encabeza: mueve la aguja igual');
ok(neg.contribuyentes[0].ctr < 0, 'y viaja con su signo');
casi(neg.retornoTotal, -20, 0.01, 'el retorno total es negativo cuando corresponde');

console.log('\nH) la interfaz va en INGLES (regla del proyecto)');
h = api.anaCtrHtml(CARTERA);
['Movieron', 'retorno', 'compra', 'cartera', 'Medido', 'puntos']
  .forEach(function (p) { ok(h.indexOf(p) === -1, 'no se colo "' + p + '"'); });

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
