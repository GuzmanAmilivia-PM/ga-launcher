// La tarjeta "Sharp moves (24h)" de News, EJECUTADA (9/10/2026, auditoria).
//
// Decia "No position moved ±3% in the last 24h", y el push de movimientos
// bruscos usa el criterio de cada posicion (tres veces su movimiento normal,
// con piso): llegaba "VOO −2.7% today · About 3× its normal daily move" y al
// abrir News la tarjeta decia que nada se habia movido ±3 %. El Worker pasa a
// usar un solo criterio; la tarjeta deja de nombrar un umbral que no es el.
// Corre renderNoticias (js/trade.js) con la app entera (_entorno.js).
var entorno = require('./_entorno');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

var c = entorno.cargar({});
ok(c.errores.length === 0, 'la app carga entera' + (c.errores.length ? ': ' + c.errores.join(' | ') : ''));
var g = c.ambito;
var tarjetas = [];
var body = entorno.elemento();
body.appendChild = function (e) { tarjetas.push(e); return e; };
g.document.getElementById = function (id) { return id === 'noticiasBody' ? body : entorno.elemento(); };
g.document.createElement = function () { var e = entorno.elemento(); return e; };

g.renderNoticias({ bruscos: [], mercado: [{ titulo: 'Algo', link: 'https://example.com', fuente: 'X' }], macro: [] });
var primera = tarjetas[0] ? tarjetas[0].innerHTML : '';
ok(/Sharp moves \(24h\)/.test(primera), 'la primera tarjeta es la de movimientos bruscos');
ok(/No position moved sharply in the last 24h/.test(primera), 'sin bruscos, lo dice sin nombrar un umbral: ' + primera.replace(/<[^>]+>/g, ' ').trim());
ok(!/3%|plusmn/.test(primera), 'y ya no dice "±3%" (el push usa otro criterio)');

tarjetas = [];
g.renderNoticias({ bruscos: [{ symbol: 'VOO', nombre: 'Vanguard S&P 500', cambio: -2.7, noticias: [] }], mercado: [], macro: [] });
primera = tarjetas[0] ? tarjetas[0].innerHTML : '';
ok(/VOO/.test(primera) && /-2\.70%/.test(primera) && /class="down"/.test(primera), 'un brusco se lista con su % y en rojo');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
