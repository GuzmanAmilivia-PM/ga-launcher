// El detalle de una cuenta con el diseno del Inicio (8/09/2026).
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var asserts = 0, fallos = 0;
function ok(cond, msg) { asserts++; if (!cond) { fallos++; console.log('  FALLA: ' + msg); } else console.log('  ok   ' + msg); }

var src = (html.match(/function renderAccount\(acc, data\) \{[\s\S]*?\n\}\n/) || [''])[0];
ok(!!src, 'encuentro renderAccount');
ok(/celdaInstrumentoHtml\(h\)/.test(src), 'la fila lleva el logo con las iniciales de respaldo, como el Inicio');
ok(/class="col-spark">' \+ sparkDe\(h\)/.test(src), 'y el mini-grafico del mes');
ok(/daychgHtml\(h\) \+ esc\(fmtNum\(h\.precioActual\)\) \+ compra/.test(src), 'el % del dia arriba del precio, y el precio medio de compra debajo');
ok(/class="pcmini">avg /.test(src), 'el precio medio va en chico, como "avg"');
ok(/gananciaHtml\(h\) \+ fmt\(h\.valor\)/.test(src), 'el valor en dolares con la ganancia arriba (el detalle de cuenta es un estado de cuenta: conserva el monto)');
ok(/engancharLogos\(tr\)/.test(src), 'los logos que no cargan caen a las iniciales');
ok(/h\.cripto = String\(h\.symbol\)\.toUpperCase\(\) !== 'USDT'/.test(src), 'en Binance las filas se marcan cripto para el logo y el tipo');
var thead = (html.match(/<tbody id="accBody">/) || []).index;
var tabla = html.slice(Math.max(0, thead - 400), thead);
ok(/<table class="holdtable postable">/.test(tabla), 'la tabla usa las clases del Inicio y de Posiciones');
ok(/<th class="col-spark">Month<\/th>/.test(tabla), 'con la columna del mes en el encabezado');
ok(/\.pcmini \{/.test(html), 'el estilo .pcmini existe');
console.log(asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
