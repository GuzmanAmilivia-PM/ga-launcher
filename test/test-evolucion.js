// Arnés del submuestreo y las etiquetas del gráfico de Evolución (02/09/2026).
//
// POR QUÉ EXISTE: Guzmán reportó que en YTD "tiene muchos puntos". Era un
// número, no una impresión: YTD son ~175 días hábiles en un gráfico de ~290px,
// o sea MENOS DE 2 PÍXELES por segmento. A esa densidad cada movimiento diario
// se dibuja como un diente y el conjunto se lee como ruido.
//
// LO QUE ESTE ARNÉS PROTEGE — y es lo que puede salir mal en silencio, porque
// un gráfico deformado no falla, se ve bien y miente:
//
//  1. Que NO se inventen valores. LTTB elige puntos REALES; un promedio móvil
//     se vería más lindo y sería un número que tu cartera nunca tuvo.
//  2. Que se conserven el pico y el pozo. Es la razón de usar LTTB en vez de
//     "uno cada N", que se saltea los extremos justo cuando son lo único que
//     importa mirar. Hay un assert que compara las dos estrategias.
//  3. Que el ÚLTIMO punto sobreviva siempre: es el valor de hoy.
//  4. Que el eje X diga el año cuando el rango cruza más de uno. "Jan" de 2024
//     y "Jan" de 2026 se leen igual, y ese es el error más caro de los tres.
var ruta = require('./_ruta');
var fs = require('fs');
var path = require('path');
var src = fs.readFileSync(path.join(ruta.RUTA, 'js', 'graficos.js'), 'utf8');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

// Las funciones se sacan por nombre del archivo real. Si alguna se renombra,
// esto explota en vez de pasar sin probar nada.
function extraer(nombre) {
  var ini = src.indexOf('function ' + nombre + '(');
  if (ini < 0) { console.log('  FALLA: no encontre ' + nombre); fallos++; asserts++; return null; }
  // El cuerpo termina en la primera llave de cierre pegada al margen.
  var cierre = String.fromCharCode(10) + '}';
  var fin = src.indexOf(cierre, ini);
  if (fin < 0) { console.log('  FALLA: no pude delimitar ' + nombre); fallos++; asserts++; return null; }
  return src.slice(ini, fin + 2);
}
var piezas = ['submuestrearLTTB', 'montoCorto', 'etiquetaFechaEje'].map(extraer);
if (piezas.some(function (p) { return !p; })) {
  console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
  process.exit(1);
}
var api = new Function(
  'var MS_DIA_EJE = 86400000;\n' + piezas.join('\n') +
  '\nreturn { lttb: submuestrearLTTB, montoCorto: montoCorto, eje: etiquetaFechaEje };')();

// Una serie con la forma de un YTD real: tendencia, ruido diario, y un pico y
// un pozo de verdad que NO se pueden perder.
var DIA = 86400000, T0 = 1767225600000;
var SERIE = [];
for (var i = 0; i < 175; i++) {
  var v = 95000 + i * 130 + Math.sin(i / 3) * 900;
  if (i === 60) v = 88000;
  if (i === 140) v = 124500;
  SERIE.push({ x: T0 + i * DIA, y: Math.round(v) });
}

console.log('\nA) el submuestreo recorta, y el punto de hoy nunca se pierde');
var out = api.lttb(SERIE, 72);
ok(out.length === 72, '175 puntos entran en el cupo de 72 (=' + out.length + ')');
ok(out[0].x === SERIE[0].x && out[0].y === SERIE[0].y, 'el primero se conserva');
var ult = SERIE[SERIE.length - 1];
ok(out[out.length - 1].x === ult.x && out[out.length - 1].y === ult.y,
  'y el ULTIMO tambien: es el valor de hoy, el que se compara con el total de arriba');
ok(out.every(function (p, k) { return k === 0 || p.x > out[k - 1].x; }), 'las fechas quedan en orden');

console.log('\nB) NO se inventa ni un valor: cada punto dibujado existio de verdad');
// Un promedio movil se veria mas lindo. Este grafico es el patrimonio de
// Guzman: un punto suavizado seria una plata que nunca tuvo.
var inventados = out.filter(function (p) {
  return !SERIE.some(function (q) { return q.x === p.x && q.y === p.y; });
});
ok(inventados.length === 0, 'cero puntos inventados (' + inventados.length + ')');

console.log('\nC) el pico y el pozo sobreviven — la razon de NO usar "uno cada N"');
var ys = SERIE.map(function (p) { return p.y; });
var yo = out.map(function (p) { return p.y; });
ok(Math.min.apply(null, yo) === Math.min.apply(null, ys), 'el pozo real se dibuja (88.000)');
ok(Math.max.apply(null, yo) === Math.max.apply(null, ys), 'el pico real se dibuja (124.500)');
// La comparacion que justifica la eleccion: la alternativa ingenua PIERDE el
// pico. Si algun dia alguien "simplifica" esto a un filtro por indice, este
// assert es el que explica por que no.
var paso = Math.ceil(SERIE.length / 72);
var cadaN = SERIE.filter(function (_, k) { return k % paso === 0; }).concat([ult]);
var yn = cadaN.map(function (p) { return p.y; });
ok(Math.max.apply(null, yn) !== Math.max.apply(null, ys),
  'y se comprueba que "uno cada ' + paso + '" SI lo perderia: por eso LTTB');

console.log('\nD) series que ya entran no se tocan');
var corta = SERIE.slice(0, 40);
ok(api.lttb(corta, 72) === corta, 'con menos puntos que el cupo devuelve el MISMO arreglo, sin trabajo');
ok(api.lttb(SERIE, 0).length === SERIE.length, 'un cupo invalido no recorta nada');
ok(api.lttb(SERIE, 2).length === SERIE.length, 'un cupo menor a 3 tampoco: no hay triangulo posible');
ok(api.lttb([], 72).length === 0, 'una serie vacia no explota');

console.log('\nE) el eje Y en corto, pero sin perder legibilidad abajo');
ok(api.montoCorto(120000) === '120K', '120000 -> 120K');
ok(api.montoCorto(80000) === '80K', '80000 -> 80K');
ok(api.montoCorto(1500000) === '1.5M', 'los millones llevan un decimal');
ok(api.montoCorto(12000000) === '12M', 'y de 10M para arriba, ninguno');
// Debajo de 10.000 el "K" con decimal es MENOS legible que el numero entero.
ok(api.montoCorto(9400) === '9,400', 'por debajo de 10.000 se escribe entero');
ok(api.montoCorto(0) === '0', 'el cero se escribe');
ok(api.montoCorto('x') === '', 'un valor invalido no imprime basura');

console.log('');
console.log('F) el eje X: la escala manda el formato, y los tres NO se confunden');
var d = T0 + 100 * DIA;
var corto = api.eje(d, T0, T0 + 20 * DIA);
var medio = api.eje(d, T0, T0 + 200 * DIA);
var largo = api.eje(d, T0, T0 + 1500 * DIA);
ok(/^[A-Z][a-z]{2} [0-9]{1,2}$/.test(corto), 'rango corto: mes y dia (' + corto + ')');
ok(/^[A-Z][a-z]{2}$/.test(medio), 'rango medio: solo el mes (' + medio + ')');
// EL QUE IMPORTA. Sin el anio, un Jan de 2024 y un Jan de 2026 se leen igual.
// Y con el anio PELADO (Apr 26) se confunde con el rango corto, que tambien
// escribe mes y numero: el apostrofo es lo unico que separa los dos formatos.
ok(/’[0-9]{2}$/.test(largo), 'varios anios: el anio se dice, con apostrofo (' + largo + ')');
ok(!/^[A-Z][a-z]{2} [0-9]{1,2}$/.test(largo), 'y NO puede leerse como una fecha del rango corto');

console.log('\nG) el cupo sale del ancho del lienzo, no de un numero clavado');
// El grafico del Inicio y el de pantalla completa son el MISMO codigo con
// anchos muy distintos: un cupo unico deja a uno ruidoso o al otro escalonado.
ok(/function cupoDePuntos/.test(src), 'existe cupoDePuntos');
ok(/getBoundingClientRect\(\)\.width/.test(src.match(/function cupoDePuntos[\s\S]*?\n\}/)[0]),
  'y mide el lienzo de verdad en vez de suponer un ancho');
ok(/submuestrearLTTB\(getFilteredDataPoints\(serie\), cupo\)/.test(src),
  'la cartera se submuestrea al dibujar');
ok(/submuestrearLTTB\(serieBench\(serie \|\| \[\]\), cupo \|\| 0\)/.test(src),
  'y el indice con el MISMO cupo: dos niveles de detalle harian parecer mas volatil a la curva mas densa');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
