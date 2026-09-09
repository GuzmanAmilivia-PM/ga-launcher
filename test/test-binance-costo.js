// El precio medio de compra desde el historial de Binance (8/09/2026).
var vm = require('vm');
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var asserts = 0, fallos = 0;
function ok(cond, msg) { asserts++; if (!cond) { fallos++; console.log('  FALLA: ' + msg); } else console.log('  ok   ' + msg); }
function casi(a, b, msg) { ok(Math.abs(a - b) < 1e-6, msg + ' (dio ' + a + ')'); }

var src = (html.match(/function bnbCostoPromedio\(trades\) \{[\s\S]*?\n\}/) || [''])[0] + '\n' + (html.match(/var BNB_SIN_COSTO = [^;]*;/) || [''])[0];
ok(/function bnbCostoPromedio/.test(src), 'encuentro bnbCostoPromedio');
var ctx = { Number: Number, parseFloat: parseFloat, Math: Math, String: String, Object: Object };
vm.createContext(ctx); vm.runInContext(src, ctx);

// Dos compras a distinto precio: promedio ponderado.
var r = ctx.bnbCostoPromedio([
  { time: 1, isBuyer: true, qty: '0.01', quoteQty: '500', price: '50000', commission: '0', commissionAsset: 'BNB' },
  { time: 2, isBuyer: true, qty: '0.01', quoteQty: '700', price: '70000', commission: '0', commissionAsset: 'BNB' }
]);
casi(r.costoUnitario, 60000, 'dos compras de 0,01 a 50k y 70k: promedio 60k');
casi(r.qty, 0.02, 'cantidad operada 0,02');
// Una venta se lleva su parte del costo y no mueve el promedio.
r = ctx.bnbCostoPromedio([
  { time: 1, isBuyer: true, qty: '0.01', quoteQty: '500', price: '50000' },
  { time: 2, isBuyer: true, qty: '0.01', quoteQty: '700', price: '70000' },
  { time: 3, isBuyer: false, qty: '0.005', quoteQty: '400', price: '80000' }
]);
casi(r.costoUnitario, 60000, 'vender 0,005 a 80k no cambia el promedio de lo que queda');
casi(r.qty, 0.015, 'queda 0,015');
// El orden llega mezclado: se ordena por tiempo (la venta antes de la compra no puede vender lo que no hay).
r = ctx.bnbCostoPromedio([
  { time: 3, isBuyer: false, qty: '0.005', quoteQty: '400', price: '80000' },
  { time: 1, isBuyer: true, qty: '0.01', quoteQty: '500', price: '50000' }
]);
casi(r.qty, 0.005, 'ordenado por tiempo: compra 0,01, vende 0,005');
// La comision en la propia cripto resta cantidad recibida.
r = ctx.bnbCostoPromedio([{ time: 1, isBuyer: true, qty: '1', quoteQty: '100', price: '100', commission: '0.001', commissionAsset: 'ETH' }]);
casi(r.qty, 0.999, 'comision en ETH: se recibieron 0,999');
casi(r.costoUnitario, 100 / 0.999, 'y el costo unitario sube en proporcion');
// Sin quoteQty se usa qty x price; sin trades, null.
r = ctx.bnbCostoPromedio([{ time: 1, isBuyer: true, qty: '2', price: '10' }]);
casi(r.costoUnitario, 10, 'sin quoteQty, qty x price');
ok(ctx.bnbCostoPromedio([]).costoUnitario === null, 'sin operaciones: null, no un cero');
ok(ctx.bnbCostoPromedio([{ time: 1, isBuyer: false, qty: '1', quoteQty: '10', price: '10' }]).costoUnitario === null, 'solo ventas: null');
ok(ctx.BNB_SIN_COSTO.indexOf('USDT') !== -1, 'USDT no lleva precio de compra');
// El flujo pide los trades por el mismo socket: la funcion existe y pide myTrades.
ok(/pedir\('myTrades', \{ symbol: s\.symbol \+ 'USDT', limit: 1000 \}/.test(html), 'bnbLeerSaldos pide myTrades por simbolo con la misma clave');
// 9/09/2026: con una clave que no reconoce, Binance cierra el socket sin
// contestar; antes se leia como "did not respond (timed out)".
ok(/ws\.onclose = function \(ev\) \{\r?\nif \(done\) return;\r?\nterminar\(new Error\('Binance closed the connection without answering/.test(html), 'el cierre del socket sin respuesta se informa como clave no reconocida');
ok(/it does not recognize this API key\. In Binance/.test(html), 'y dice que revisar en Binance');
ok(/PRIVATE KEY\|BEGIN \/\.test\(k \+ s\)/.test(html) && /needs a <b>System generated<\/b> key/.test(html), 'al guardar, una clave PEM (Self-generated) se rechaza con la explicacion');
ok(/costoParcial = true/.test(html), 'y marca el promedio parcial cuando lo operado no llega al saldo');

console.log(asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
