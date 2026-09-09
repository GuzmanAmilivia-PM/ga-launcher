// El detalle de una cuenta con el diseno del Inicio (8/09/2026).
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var asserts = 0, fallos = 0;
function ok(cond, msg) { asserts++; if (!cond) { fallos++; console.log('  FALLA: ' + msg); } else console.log('  ok   ' + msg); }

var src = (html.match(/function renderAccount\(acc, data\) \{[\s\S]*?\n\}\n/) || [''])[0];
ok(!!src, 'encuentro renderAccount');
ok(/celdaInstrumentoHtml\(h, esc\(fmt\(h\.valor\)\) \+ gananciaHtml\(h\)\)/.test(src), 'la fila lleva el logo con las iniciales de respaldo, y abajo del simbolo el valor en dolares con la ganancia acumulada');
ok(/class="col-spark">' \+ sparkDe\(h\)/.test(src), 'y el mini-grafico del mes');
ok(/daychgHtml\(h\) \+ esc\(fmtNum\(h\.precioActual\)\) \+ compra/.test(src), 'el % del dia arriba del precio, y el precio medio de compra debajo');
ok(/class="pcmini">avg /.test(src), 'el precio medio va en chico, como "avg"');
ok(/if \(esFilaCash\(h\)\) return;/.test(src), 'las filas de cash (USDT) no se listan: ya estan en Cash in account');
ok(/engancharLogos\(tr\)/.test(src), 'los logos que no cargan caen a las iniciales');
ok(/h\.cripto = true;/.test(src), 'en Binance las filas se marcan cripto para el logo y el tipo');
var thead = (html.match(/<tbody id="accBody">/) || []).index;
var tabla = html.slice(Math.max(0, thead - 400), thead);
ok(/<table class="holdtable holdhome">/.test(tabla), 'la tabla usa las clases del Inicio: tres columnas, sin cabecera visible');
ok(/<th class="col-spark">Month<\/th>/.test(tabla), 'con la columna del mes en el encabezado');
ok(/\.pcmini \{/.test(html) && /\.accval \.daychg \{ display: inline/.test(html), 'los estilos .pcmini y .accval existen (la ganancia va en linea)');
console.log(asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
