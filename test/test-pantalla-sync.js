// Arnés de pantallaSync (js/brokers.js) — el conductor único de las tres
// pantallas de sincronización, que antes eran tres copias. Evalúa brokers.js
// entero con stubs y maneja las pantallas por sus botones, como el usuario.
var ruta = require('./_ruta');
var fs = require('fs');
var path = require('path');

var codigo = fs.readFileSync(path.join(ruta.RUTA, 'js', 'brokers.js'), 'utf8');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

function montar(cfg) {
  var estado = { llamadas: [], confirms: [], loadData: 0, refrescosEstado: [], elems: {} };
  function elemento(id) {
    if (!estado.elems[id]) {
      estado.elems[id] = {
        id: id, innerHTML: '', textContent: '', value: '', disabled: false,
        style: {}, onclick: null,
        addEventListener: function () {}, setAttribute: function () {}, getAttribute: function () { return null; },
        classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
        querySelectorAll: function () { return []; }, appendChild: function () {}
      };
    }
    return estado.elems[id];
  }
  var ctx = {
    document: {
      getElementById: elemento,
      querySelectorAll: function () { return []; },
      createElement: function () { return elemento('_tmp' + Math.random()); },
      addEventListener: function () {}
    },
    localStorage: { getItem: function () { return null; }, setItem: function (k) { estado.guardados = estado.guardados || []; estado.guardados.push(k); }, removeItem: function () {} },
    esc: function (s) { return String(s); },
    msgErr: function (err, sujeto) { return sujeto + ': sin red'; },
    setView: function () {},
    loadData: function () { estado.loadData++; },
    window: { confirm: function (m) { estado.confirms.push(m); return cfg.confirmar !== false; } },
    syncTodoEnCurso: false,
    prepararBNB: function () { estado.refrescosEstado.push('bnb'); },
    __stubLeerSaldos: function (okCb, failCb) {
      estado.llamadas.push('leerSaldos');
      if (cfg.leerFalla) return void setImmediate(failCb);
      setImmediate(function () { okCb([{ symbol: 'BTC', qty: 1 }]); });
    },
    google: {
      script: {
        run: (function () {
          function mk() {
            var oks = [], fails = [];
            var api = {
              withSuccessHandler: function (f) { oks.push(f); return api; },
              withFailureHandler: function (f) { fails.push(f); return api; }
            };
            ['sincronizarIBKR', 'sincronizarCS', 'sincronizarBNB', 'estadoIBKR', 'estadoCS', 'guardarConfigIBKR', 'guardarConfigCS', 'portalCS'].forEach(function (fn) {
              api[fn] = function (args) {
                estado.llamadas.push({ fn: fn, args: args });
                var r = (cfg.respuestas || {})[fn];
                setImmediate(function () {
                  if (r === 'FALLA') fails.forEach(function (f) { f(new Error('sin red')); });
                  else if (r !== undefined) oks.forEach(function (f) { f(r); });
                });
              };
            });
            return api;
          }
          return { withSuccessHandler: function (f) { return mk().withSuccessHandler(f); },
                   withFailureHandler: function (f) { return mk().withFailureHandler(f); } };
        })()
      }
    }
  };
  ctx.window.confirm = ctx.window.confirm;
  // Constante compartida con sincronizar.js (el umbral de Earn, E6): el
  // auto-stub de abajo solo cubre LLAMADAS, no variables.
  ctx.BNB_CERRADAS_FRENO = 2;
  // stubs automaticos para lo demas que brokers.js use de otros archivos
  var propias = {}, m, re = /function (\w+)/g;
  while ((m = re.exec(codigo)) !== null) propias[m[1]] = true;
  var re2 = /(\w+)\s*\(/g;
  while ((m = re2.exec(codigo)) !== null) {
    var n = m[1];
    if (!(n in ctx) && !propias[n] && !/^(if|for|while|switch|catch|function|return|typeof|new|String|Number|Date|Math|JSON|Object|Array|Boolean|parseInt|parseFloat|isFinite|isNaN|encodeURIComponent|decodeURIComponent|Promise|WebSocket|TextEncoder|Uint8Array|crypto|btoa|atob|confirm|RegExp|Error)$/.test(n)) {
      ctx[n] = function () {};
    }
  }
  ctx.Date = Date; ctx.JSON = JSON; ctx.Math = Math;
  var nombres = Object.keys(ctx);
  // brokers.js declara SU PROPIO bnbLeerSaldos (el lector real por WebSocket):
  // se reasigna DESPUES de evaluar para que la pantalla use el stub.
  var fn = new Function(nombres.join(','), codigo + '\nbnbLeerSaldos = __stubLeerSaldos;');
  fn.apply(null, nombres.map(function (nm) { return ctx[nm]; }));
  estado.click = function (id) { var e = estado.elems[id]; if (e && e.onclick) e.onclick.call(e); };
  return estado;
}

function esperar() { return new Promise(function (r) { setTimeout(r, 80); }); }

(async function () {
  console.log('\nA) IBKR: comparar sin cambios');
  var m = montar({ respuestas: { sincronizarIBKR: { ok: true, cambios: [], mensajes: [], posicionesBroker: 10 } } });
  m.click('ibkrVerCambios');
  await esperar();
  var llamada = m.llamadas.find(function (l) { return l.fn === 'sincronizarIBKR'; });
  ok(llamada && llamada.args.dryRun === true, 'compara con dryRun');
  ok(/already matches IBKR \(10 positions\)/.test(m.elems.ibkrCambios.innerHTML), 'muestra "ya coincide" con el total');
  ok(m.elems.ibkrAplicar.style.display === 'none', 'sin cambios no ofrece Aplicar');

  console.log('\nB) IBKR: cambios y aplicar');
  m = montar({ respuestas: { sincronizarIBKR: { ok: true, cambios: [{ tipo: 'qty', symbol: 'VOO', antes: 33, despues: 34 }], mensajes: [], posicionesBroker: 10 } } });
  m.click('ibkrVerCambios');
  await esperar();
  ok(/VOO.*33.*34/.test(m.elems.ibkrCambios.innerHTML.replace(/<[^>]*>/g, '')), 'lista el cambio de cantidad');
  ok(m.elems.ibkrAplicar.style.display === '', 'ofrece Aplicar');
  m.click('ibkrAplicar');
  await esperar();
  var aplicada = m.llamadas.filter(function (l) { return l.fn === 'sincronizarIBKR'; })[1];
  ok(aplicada && aplicada.args.dryRun === false, 'aplica de verdad');
  ok(m.confirms.length === 0, 'sin parcial no molesta con confirmacion');
  ok(m.loadData === 1, 'recarga la app tras aplicar');
  ok(/Done\. The IB sheet/.test(m.elems.ibkrSyncResultado.innerHTML), 'confirma el exito');

  console.log('\nC) Schwab: reporte parcial pide confirmacion y manda forzar');
  m = montar({ confirmar: true, respuestas: { sincronizarCS: { ok: true, parcial: true, cambios: [{ tipo: 'cerrada', symbol: 'QQQ', antes: 21, despues: 0 }], mensajes: ['OJO'], posicionesBroker: 1 } } });
  m.click('csVerCambios');
  await esperar();
  m.click('csAplicar');
  await esperar();
  ok(m.confirms.length === 1 && /Schwab/.test(m.confirms[0]), 'pregunta antes de aplicar un parcial');
  var aplicadaCS = m.llamadas.filter(function (l) { return l.fn === 'sincronizarCS'; })[1];
  ok(aplicadaCS && aplicadaCS.args.forzar === true, 'y manda forzar tras el si');

  console.log('\nD) Schwab: cancelar la confirmacion NO manda nada (auditoria 31/08/2026)');
  // Antes cancelar igual disparaba correr(false, false): un pedido que el
  // backend rechazaba, y la UI borraba la lista de cambios y pintaba el
  // rechazo como error rojo por haber elegido "no".
  m = montar({ confirmar: false, respuestas: { sincronizarCS: { ok: true, parcial: true, cambios: [{ tipo: 'cerrada', symbol: 'QQQ', antes: 21, despues: 0 }], mensajes: [], posicionesBroker: 1 } } });
  m.click('csVerCambios');
  await esperar();
  m.click('csAplicar');
  await esperar();
  ok(m.confirms.length === 1, 'la confirmacion se pregunto');
  var aplicadaCS2 = m.llamadas.filter(function (l) { return l.fn === 'sincronizarCS'; })[1];
  ok(aplicadaCS2 === undefined, 'y tras el NO, ningun pedido de aplicacion viaja');

  console.log('\nE) Binance: lee saldos en el telefono y los reusa al aplicar');
  m = montar({ respuestas: { sincronizarBNB: { ok: true, cambios: [{ tipo: 'qty', symbol: 'BTC', antes: 0.03, despues: 1 }], mensajes: [], saldosBinance: 1 } } });
  m.click('bnbVerCambios');
  await esperar();
  ok(m.llamadas[0] === 'leerSaldos', 'primero lee los saldos en el dispositivo');
  m.click('bnbAplicar');
  await esperar();
  var aplicadaBNB = m.llamadas.filter(function (l) { return l.fn === 'sincronizarBNB'; })[1];
  ok(aplicadaBNB && aplicadaBNB.args.dryRun === false, 'aplica con los saldos ya leidos');
  ok(aplicadaBNB.args.balances && aplicadaBNB.args.balances.length === 1, 'sin volver a leer');
  ok((m.guardados || []).indexOf('ga_bnb_ultima') !== -1, 'deja la marca de ultima sincronizacion');

  console.log('\nF) Binance: ahora tambien confirma los parciales (antes solo avisaba)');
  m = montar({ confirmar: true, respuestas: { sincronizarBNB: { ok: true, parcial: true, cambios: [{ tipo: 'cerrada', symbol: 'ETH', antes: 0.88, despues: 0 }, { tipo: 'cerrada', symbol: 'BTC', antes: 0.03, despues: 0 }], mensajes: [], saldosBinance: 1 } } });
  m.click('bnbVerCambios');
  await esperar();
  ok(/spot/.test(m.elems.bnbCambios.innerHTML), 'la pista de Earn sigue presente');
  m.click('bnbAplicar');
  await esperar();
  ok(m.confirms.length === 1 && /Binance/.test(m.confirms[0]), 'pide confirmacion');
  var aplicadaBNB2 = m.llamadas.filter(function (l) { return l.fn === 'sincronizarBNB'; })[1];
  ok(aplicadaBNB2 && aplicadaBNB2.args.forzar === true, 'y manda forzar');

  console.log('\nG) errores: el candado se suelta siempre');
  m = montar({ respuestas: { sincronizarIBKR: 'FALLA' } });
  m.click('ibkrVerCambios');
  await esperar();
  ok(/sin red/.test(m.elems.ibkrSyncResultado.innerHTML), 'muestra el error');
  m.click('ibkrVerCambios'); // si el candado quedo trabado, esta no corre
  await esperar();
  ok(m.llamadas.filter(function (l) { return l.fn === 'sincronizarIBKR'; }).length === 2, 'se puede reintentar (candado suelto)');

  console.log('\nI) el conductor unico de guardar credenciales (E6)');
  m = montar({ respuestas: { guardarConfigIBKR: { ok: true, mensajes: ['Consulta de actividad configurada.'] }, estadoIBKR: { configurada: false } } });
  m.click('ibkrGuardar');
  await esperar();
  ok(m.llamadas.some(function (l) { return l.fn === 'guardarConfigIBKR'; }), 'guarda via el conductor');
  ok(/tmsg ok/.test(m.elems.ibkrKeyResultado.innerHTML) && /Connection saved/.test(m.elems.ibkrKeyResultado.innerHTML), 'exito con su mensaje propio');
  ok(/actividad configurada/.test(m.elems.ibkrKeyResultado.innerHTML), 'los mensajes extra del backend NO se pierden');
  ok(m.llamadas.some(function (l) { return l.fn === 'estadoIBKR'; }), 'refresca el estado tras guardar');
  ok(m.elems.ibkrGuardar.disabled === false, 'el boton vuelve a habilitarse');
  m = montar({ respuestas: { guardarConfigCS: { ok: false, mensajes: ['El clientId no parece válido.'] } } });
  m.click('csGuardar');
  await esperar();
  ok(/tmsg err/.test(m.elems.csKeyResultado.innerHTML) && /clientId/.test(m.elems.csKeyResultado.innerHTML), 'un rechazo muestra el motivo');
  ok(m.elems.csGuardar.disabled === false, 'y el boton no queda muerto');

  console.log('\nH) el cambio de costo (V4bis) se muestra como "precio compra"');
  m = montar({ respuestas: { sincronizarCS: { ok: true, cambios: [{ tipo: 'costo', symbol: 'VOO', antes: 431.9, despues: 455.2 }, { tipo: 'costo', symbol: 'QQQ', antes: null, despues: 404.68 }], mensajes: [] } } });
  m.click('csVerCambios');
  await esperar();
  var textoCosto = m.elems.csCambios.innerHTML.replace(/<[^>]*>/g, '');
  ok(/VOO.?buy price 431\.9 .*455\.2/.test(textoCosto), 'VOO: precio compra 431.9 -> 455.2');
  ok(m.elems.csCambios.innerHTML.indexOf('buy price &mdash;') !== -1, 'sin costo previo muestra el guion, no un 0');

  console.log('\nJ) msgErr: texto plano y sin copias (auditoria 19/08/2026)');
  // La implementacion REAL, extraida de brokers.js: casi todos los llamadores
  // la pasan por esc(), y una entidad HTML quedaba visible como texto literal.
  var srcMsgErr = (codigo.match(/function msgErr[\s\S]*?\n\}/) || [''])[0];
  ok(srcMsgErr !== '', 'msgErr existe en brokers.js');
  var msgErrReal = new Function(srcMsgErr + '\nreturn msgErr;')();
  ok(msgErrReal(new Error('se cayo la red'), 'El buscador') === 'se cayo la red', 'un error comun pasa tal cual');
  var traducido = msgErrReal(new Error('unknown_fn: buscarTicker'), 'The search');
  ok(traducido.indexOf('The search will be active') === 0 && traducido.indexOf('next update') !== -1, 'unknown_fn se traduce con el sujeto');
  ok(traducido.indexOf('&') === -1, 'texto plano: sin entidades HTML (los llamadores escapan con esc)');
  // El buscador delega en msgErr: era el quinto traductor copiado a mano.
  var srcBuscador = fs.readFileSync(path.join(ruta.RUTA, 'js', 'buscador.js'), 'utf8');
  ok(srcBuscador.indexOf("msgErr(err, 'The search')") !== -1, 'buscador.js delega en msgErr');
  ok(srcBuscador.indexOf("indexOf('unknown_fn')") === -1, 'y ya no tiene traductor propio');

  console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
  process.exit(fallos ? 1 : 0);
})();
