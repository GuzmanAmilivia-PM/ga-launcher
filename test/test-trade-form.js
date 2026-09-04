// Arnés del formulario de Trade (comprar / vender) de ga-launcher.
// La auditoría del 31/08/2026 lo señaló como el hueco #1 de la PWA: el cash
// tenía su arnés (test-cash-form) y la operación de MÁS dinero no tenía
// ninguno — un validarForm roto o el toggle compra/venta invertido habrían
// llegado al backend en verde. Espejo de test-cash-form.js.
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var codigo = ruta.bloque(html,
  '// ---------- Trade ----------',
  '// ---------- Operaciones (compras y ventas) ----------');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

function montar(respuesta) {
  var estado = { elems: {}, enviado: null };
  function nuevoElem(id) {
    var el = {
      id: id, style: {}, options: [], textContent: '', disabled: false,
      className: '', open: true, _value: '', _html: '',
      appendChild: function (o) {
        this.options.push(o);
        if (this.options.length === 1) this._value = o.value;
      },
      addEventListener: function () {},
      scrollIntoView: function () {}
    };
    Object.defineProperty(el, 'value', {
      get: function () { return this._value; },
      set: function (v) { this._value = v; }
    });
    Object.defineProperty(el, 'innerHTML', {
      get: function () { return this._html; },
      set: function (v) { this._html = v; if (v === '') { this.options = []; this._value = ''; } }
    });
    return el;
  }
  function elem(id) {
    if (!estado.elems[id]) estado.elems[id] = nuevoElem(id);
    return estado.elems[id];
  }
  var ctx = {
    document: {
      getElementById: function (id) { return elem(id); },
      createElement: function () { return { value: '', textContent: '' }; }
    },
    ACCOUNTS: [
      { key: 'CS', nombre: 'Charles Schwab' },
      { key: 'IB', nombre: 'Interactive Brokers' },
      { key: 'BNB', nombre: 'Binance' },
      { key: 'ITAU', nombre: 'Itau Assets' }
    ],
    nombrePlataforma: function (n) { return n === 'Interactive Brokers' ? 'IBKR' : n; },
    esc: function (s) { return String(s); },
    lastData: null,
    loadData: function () { estado.recargas = (estado.recargas || 0) + 1; },
    cargarOperaciones: function () {},
    google: { script: { run: (function () {
      function mk() {
        var oks = [], fails = [];
        var api = {
          withSuccessHandler: function (f) { oks.push(f); return api; },
          withFailureHandler: function (f) { fails.push(f); return api; },
          registrarOperacion: function (f) {
            estado.enviado = f;
            var r = respuesta || { ok: true, resumen: { cuenta: f.cuenta, tipo: f.tipo, symbol: f.symbol, qty: f.qty, precio: f.precio }, mensajes: [] };
            oks.forEach(function (h) { h(r); });
          }
        };
        return api;
      }
      return {
        withSuccessHandler: function (f) { return mk().withSuccessHandler(f); },
        withFailureHandler: function (f) { return mk().withFailureHandler(f); }
      };
    })() } }
  };
  var nombres = Object.keys(ctx);
  var fn = new Function(nombres.join(','), codigo +
    '\nreturn { buildTradeForm: buildTradeForm, leerForm: leerForm, validarForm: validarForm, setTipo: setTipo };');
  estado.api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));
  estado.elem = elem;
  return estado;
}

function values(sel) { return sel.options.map(function (o) { return o.value; }).join('|'); }

console.log('\nA) el selector de cuentas: las 4 operables, con sus etiquetas');
var m = montar();
m.api.buildTradeForm();
ok(values(m.elem('tCuenta')) === 'CS|IB|BNB|ITAU', 'las 4 cuentas (' + values(m.elem('tCuenta')) + ')');
ok(m.elem('tCuenta').options.some(function (o) { return o.textContent === 'IBKR'; }), 'IBKR se muestra con su etiqueta');

console.log('\nB) validarForm rechaza lo inválido ANTES de tocar el backend');
ok(m.api.validarForm({ symbol: '', qty: 1, precio: 1 }).length === 1, 'sin ticker');
ok(m.api.validarForm({ symbol: 'voo!', qty: 1, precio: 1 }).length === 1, 'ticker con caracteres raros');
ok(m.api.validarForm({ symbol: 'VOO', qty: 0, precio: 1 }).length === 1, 'cantidad cero');
ok(m.api.validarForm({ symbol: 'VOO', qty: -2, precio: 1 }).length === 1, 'cantidad negativa');
ok(m.api.validarForm({ symbol: 'VOO', qty: NaN, precio: 1 }).length === 1, 'cantidad vacía (NaN)');
ok(m.api.validarForm({ symbol: 'VOO', qty: 1, precio: 0 }).length === 1, 'precio cero');
ok(m.api.validarForm({ symbol: 'BRK-B', qty: 1, precio: 100 }).length === 0, 'BRK-B con guión es válido');

console.log('\nC) Revisar con datos inválidos NO abre la confirmación');
m = montar();
m.api.buildTradeForm();
m.elem('tSymbol').value = 'VOO';
m.elem('tQty').value = '';
m.elem('tPrecio').value = '700';
m.elem('tRevisar').onclick.call(m.elem('tRevisar'));
ok(/Invalid/.test(m.elem('tResultado').innerHTML), 'avisa qué está mal');
ok(m.elem('tConfirmWrap').style.display !== '', 'la confirmación no se abre');
ok(m.enviado === null, 'y nada viaja al backend');

console.log('\nD) el flujo bueno: Revisar muestra el monto y Confirmar manda LO MISMO');
m = montar();
m.api.buildTradeForm();
m.elem('tSymbol').value = 'voo';
m.elem('tQty').value = '3';
m.elem('tPrecio').value = '700.50';
m.elem('tRevisar').onclick.call(m.elem('tRevisar'));
ok(/BUY/.test(m.elem('tConfirmTxt').innerHTML), 'dice que es una COMPRA (el tipo por omisión)');
ok(/2,101\.5/.test(m.elem('tConfirmTxt').innerHTML), 'el monto está calculado: 3 × 700.50 = 2,101.5');
ok(m.elem('tConfirmWrap').style.display === '', 'la confirmación se abre');
m.elem('tConfirmar').onclick.call(m.elem('tConfirmar'));
ok(m.enviado && m.enviado.symbol === 'VOO', 'el ticker viaja normalizado a mayúsculas (' + (m.enviado && m.enviado.symbol) + ')');
ok(m.enviado.tipo === 'compra' && m.enviado.qty === 3 && m.enviado.precio === 700.5, 'compra, 3 unidades, al precio escrito');
ok(m.enviado.cuenta === 'CS', 'en la cuenta elegida (' + m.enviado.cuenta + ')');
ok(/Logged/.test(m.elem('tResultado').innerHTML), 'confirma en pantalla');
ok(m.elem('tSymbol').value === '' && m.elem('tQty').value === '', 'y el formulario queda limpio');

console.log('\nE) el toggle a VENTA viaja como venta (el bug que este arnés vino a impedir)');
m = montar();
m.api.buildTradeForm();
m.api.setTipo('venta');
m.elem('tSymbol').value = 'VOO';
m.elem('tQty').value = '2';
m.elem('tPrecio').value = '700';
m.elem('tRevisar').onclick.call(m.elem('tRevisar'));
ok(/SELL/.test(m.elem('tConfirmTxt').innerHTML), 'la confirmación dice SELL');
m.elem('tConfirmar').onclick.call(m.elem('tConfirmar'));
ok(m.enviado && m.enviado.tipo === 'venta', 'y el backend recibe tipo venta (' + (m.enviado && m.enviado.tipo) + ')');

console.log('\nF) una respuesta ok:false pinta el motivo, no un éxito');
m = montar({ ok: false, mensajes: ['No hay suficiente VOO para vender.'] });
m.api.buildTradeForm();
m.elem('tSymbol').value = 'VOO';
m.elem('tQty').value = '999';
m.elem('tPrecio').value = '700';
m.elem('tRevisar').onclick.call(m.elem('tRevisar'));
m.elem('tConfirmar').onclick.call(m.elem('tConfirmar'));
ok(/No hay suficiente/.test(m.elem('tResultado').innerHTML), 'el mensaje del backend se muestra');
ok(!/Logged/.test(m.elem('tResultado').innerHTML), 'y no se canta victoria');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
