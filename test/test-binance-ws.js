// bnbLeerSaldos contra un Binance de mentira con la FORMA REAL del protocolo
// WebSocket (9/09/2026): el id del pedido solo admite ^[a-zA-Z0-9-_]{1,36}$
// (si no, -1135 con id null), una clave desconocida vuelve -2015, y despues
// de CUALQUIER error Binance corta la conexion con 1008. En v178 el id llevaba
// el nombre del metodo con punto ('ga-account.status-...') y la lectura moria
// como "did not respond (timed out)".
var vm = require('vm');
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var asserts = 0, fallos = 0;
function ok(cond, msg) { asserts++; if (!cond) { fallos++; console.log('  FALLA: ' + msg); } else console.log('  ok   ' + msg); }

var src = (html.match(/function bnbCostoPromedio\(trades\) \{[\s\S]*?\n\}/) || [''])[0] + '\n' +
  (html.match(/var BNB_SIN_COSTO = [^;]*;/) || [''])[0] + '\n' +
  (html.match(/function bnbLeerSaldos\(cb, fail\) \{[\s\S]*?\n\}\nvar bnbEnCurso = false;/) || [''])[0].replace(/\nvar bnbEnCurso = false;$/, '');
ok(/function bnbLeerSaldos/.test(src) && /function bnbCostoPromedio/.test(src), 'encuentro bnbLeerSaldos y bnbCostoPromedio');

var ID_OK = /^[a-zA-Z0-9-_]{1,36}$/;
var TRADES = {
  ETHUSDT: [{ time: 1, isBuyer: true, qty: '1', quoteQty: '2000', price: '2000', commission: '0', commissionAsset: 'BNB' }]
};
// Un Binance de mentira. `esc` describe el escenario: clave valida, saldos, y
// si un par de myTrades falla.
function binanceFalso(esc) {
  var registro = { ids: [], metodos: [], cerrado: null, conexiones: 0 };
  function WS(url) {
    var self = this;
    registro.conexiones++;
    this.readyState = 0;
    setTimeout(function () { self.readyState = 1; if (self.onopen) self.onopen(); }, 2);
    this.send = function (txt) {
      var m = JSON.parse(txt);
      registro.ids.push(m.id); registro.metodos.push(m.method);
      var resp;
      if (!ID_OK.test(String(m.id))) {
        resp = { id: null, status: 400, error: { code: -1135, msg: "Invalid 'id' in JSON request; expected an integer, a string matching '^[a-zA-Z0-9-_]{1,36}$', or null." } };
      } else if (m.params.apiKey !== esc.clave) {
        resp = { id: m.id, status: 401, error: { code: -2015, msg: 'Invalid API-key, IP, or permissions for action.' } };
      } else if (m.method === 'account.status') {
        resp = { id: m.id, status: 200, result: { balances: esc.saldos } };
      } else if (m.method === 'myTrades') {
        if (TRADES[m.params.symbol]) resp = { id: m.id, status: 200, result: TRADES[m.params.symbol] };
        else resp = { id: m.id, status: 400, error: { code: -1121, msg: 'Invalid symbol.' } };
      } else {
        resp = { id: m.id, status: 400, error: { code: -1002, msg: 'Unsupported method.' } };
      }
      setTimeout(function () {
        if (self.readyState !== 1) return;
        if (self.onmessage) self.onmessage({ data: JSON.stringify(resp) });
        if (resp.error) {
          self.readyState = 3; registro.cerrado = 1008;
          setTimeout(function () { if (self.onclose) self.onclose({ code: 1008, reason: 'disconnected' }); }, 1);
        }
      }, 2);
    };
    this.close = function () { this.readyState = 3; };
  }
  return { WS: WS, registro: registro };
}
function correr(esc) {
  var b = binanceFalso(esc);
  var ctx = {
    WebSocket: b.WS, setTimeout: setTimeout, clearTimeout: clearTimeout, Date: Date, Math: Math, JSON: JSON,
    Object: Object, String: String, Number: Number, parseFloat: parseFloat, Error: Error, Promise: Promise, console: console,
    bnbConfig: function () { return { key: 'GOOD', secret: 's' }; },
    bnbFirmar: function () { return Promise.resolve('firma'); }
  };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  return new Promise(function (res) {
    ctx.bnbLeerSaldos(function (saldos) { res({ saldos: saldos, reg: b.registro }); },
                      function (err) { res({ err: err, reg: b.registro }); });
  });
}

var SALDOS = [{ asset: 'ETH', free: '1', locked: '0' }, { asset: 'USDT', free: '100', locked: '0' }, { asset: 'FOO', free: '5', locked: '0' }];
(async function () {
  // A) clave valida: saldos con el precio medio de ETH, y todos los ids con la forma que Binance exige.
  var r = await correr({ clave: 'GOOD', saldos: SALDOS });
  ok(!r.err && r.saldos && r.saldos.length === 3, 'A) con la clave valida vuelven los tres saldos' + (r.err ? ' (dio: ' + r.err.message + ')' : ''));
  ok(r.reg.ids.every(function (id) { return ID_OK.test(String(id)); }), 'A) todos los ids cumplen ^[a-zA-Z0-9-_]{1,36}$ (fueron ' + r.reg.ids.join(', ') + ')');
  ok(r.reg.metodos[0] === 'account.status' && r.reg.metodos.indexOf('myTrades') > 0, 'A) pide account.status y despues myTrades');
  var eth = (r.saldos || []).filter(function (s) { return s.symbol === 'ETH'; })[0];
  ok(eth && eth.costoUnitario === 2000, 'A) ETH trae su precio medio (2000)');
  ok(!(r.saldos || []).some(function (s) { return s.symbol === 'USDT' && s.costoUnitario; }), 'A) USDT no lleva precio medio');
  // FOOUSDT no existe: Binance responde -1121 y CORTA. Los saldos ya leidos valen igual.
  ok(r.reg.cerrado === 1008, 'A) el par inexistente hizo que Binance cortara (1008)...');
  var foo = (r.saldos || []).filter(function (s) { return s.symbol === 'FOO'; })[0];
  ok(foo && !foo.costoUnitario, 'A) ...y FOO queda sin costo, sin tumbar la lectura');
  ok(eth && eth.costoInfo === '1 ops' && foo && /^error -1121 Invalid symbol/.test(foo.costoInfo), 'A) cada cripto lleva costoInfo: ETH "1 ops", FOO su error (fue ' + (foo && foo.costoInfo) + ')');

  // B) clave desconocida: -2015 y corte. El error nombra la clave, no el "timed out".
  r = await correr({ clave: 'OTRA', saldos: SALDOS });
  ok(r.err && /rejected the API key/.test(r.err.message), 'B) clave desconocida: "Binance rejected the API key" (dio: ' + (r.err ? r.err.message : 'ok?') + ')');
  ok(!/timed out/.test(r.err ? r.err.message : ''), 'B) y no "timed out"');

  // C) el par inexistente va PRIMERO: Binance corta. La app abre OTRA
  // conexion y sigue, asi ETH no pierde su costo por culpa de FOO.
  r = await correr({ clave: 'GOOD', saldos: [SALDOS[2], SALDOS[0], SALDOS[1]] });
  ok(!r.err && r.saldos && r.saldos.length === 3, 'C) corte a mitad de camino: vuelven los saldos leidos' + (r.err ? ' (dio: ' + r.err.message + ')' : ''));
  eth = (r.saldos || []).filter(function (s) { return s.symbol === 'ETH'; })[0];
  ok(eth && eth.costoUnitario === 2000, 'C) ETH conserva su costo: la app reabrio la conexion (fue ' + (eth && eth.costoUnitario) + ')');
  ok(r.reg.conexiones === 2, 'C) dos conexiones en total (fueron ' + r.reg.conexiones + ')');
  // C2) muchos pares malos: como mucho tres reconexiones, y despues se
  // devuelve lo que hay en vez de reintentar para siempre.
  r = await correr({ clave: 'GOOD', saldos: [{ asset: 'A1', free: '1' }, { asset: 'A2', free: '1' }, { asset: 'A3', free: '1' }, { asset: 'A4', free: '1' }, { asset: 'A5', free: '1' }, SALDOS[0]] });
  ok(!r.err && r.saldos && r.saldos.length === 6, 'C2) cinco pares malos: igual vuelven los saldos' + (r.err ? ' (dio: ' + r.err.message + ')' : ''));
  ok(r.reg.conexiones === 4, 'C2) tope de tres reconexiones (fueron ' + r.reg.conexiones + ')');

  console.log(asserts + ' asserts, ' + fallos + ' fallas');
  process.exit(fallos ? 1 : 0);
})();
