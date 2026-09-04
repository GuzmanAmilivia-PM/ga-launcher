// Arnés del formulario de Banking (depositar / retirar) de ga-launcher.
// El caso que lo motivó: BTG (ex HSBC) vive solo como fila del resumen, no
// estaba en el selector de cuentas y no había forma de agregarle cash.
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var codigo = ruta.bloque(html,
  '// ---------- Retirar / Depositar liquidez ----------',
  '// ---------- Tema (oscuro / claro) ----------');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

function montar() {
  var estado = { elems: {}, enviado: null };
  function nuevoElem(id) {
    var el = {
      id: id, style: {}, options: [], textContent: '', disabled: false,
      _value: '', _html: '',
      appendChild: function (o) {
        this.options.push(o);
        if (this.options.length === 1) this._value = o.value;
      },
      scrollIntoView: function () {}
    };
    Object.defineProperty(el, 'value', {
      get: function () { return this._value; },
      set: function (v) { this._value = v; }
    });
    // innerHTML = '' es como se vacía el select: también se van las opciones.
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
    accountByName: function (n) {
      var m = ['charles schwab', 'interactive brokers', 'binance', 'itau assets'];
      return m.indexOf(String(n).toLowerCase()) !== -1 ? { key: 'X' } : null;
    },
    esc: function (s) { return String(s); },
    mask: function (s) { return s; },
    loadData: function () {},
    google: { script: { run: (function () {
      function mk() {
        var oks = [];
        var api = {
          withSuccessHandler: function (f) { oks.push(f); return api; },
          withFailureHandler: function () { return api; },
          registrarMovimientoCash: function (mov) {
            estado.enviado = mov;
            oks.forEach(function (f) { f({ ok: true, resumen: { cuenta: mov.cuenta, tipo: mov.tipo, monto: mov.monto } }); });
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
  var fn = new Function(nombres.join(','), codigo + '\nreturn { buildCashForm: buildCashForm };');
  estado.api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));
  estado.elem = elem;
  return estado;
}

function values(sel) { return sel.options.map(function (o) { return o.value; }).join('|'); }
function textos(sel) { return sel.options.map(function (o) { return o.textContent; }).join('|'); }

var CUENTAS = [
  { nombre: 'Charles Schwab' }, { nombre: 'Interactive Brokers' },
  { nombre: 'Binance' }, { nombre: 'BTG' }, { nombre: 'Itau Assets' }
];

console.log('\nA) sin datos todavía: solo las cuentas con hoja propia');
var m = montar();
m.api.buildCashForm();
ok(values(m.elem('cashCuenta')) === 'CS|IB|BNB|ITAU', 'las 4 de siempre (' + values(m.elem('cashCuenta')) + ')');

console.log('\nB) con los datos del resumen: aparecen las plataformas sin hoja');
m.api.buildCashForm(CUENTAS);
var sel = m.elem('cashCuenta');
ok(sel.options.length === 5, '5 opciones (' + sel.options.length + ')');
ok(values(sel) === 'CS|IB|BNB|ITAU|BTG', 'BTG viaja por NOMBRE, las otras por key (' + values(sel) + ')');
ok(/IBKR/.test(textos(sel)), 'los nombres se muestran con la etiqueta de la app');

console.log('\nC) depositar en BTG manda el nombre al backend');
sel.value = 'BTG';
m.elem('cashMonto').value = '100';
m.elem('btnDepositar').onclick();
m.elem('cashConfirmar').onclick.call(m.elem('cashConfirmar'));
ok(m.enviado && m.enviado.cuenta === 'BTG', 'cuenta = BTG (' + (m.enviado && m.enviado.cuenta) + ')');
ok(m.enviado.tipo === 'deposito' && m.enviado.monto === 100, 'deposito de 100');
ok(/logged/.test(m.elem('cashResultado').innerHTML), 'confirma en pantalla');

console.log('\nD) al repintar la lista no se pierde lo elegido');
m.api.buildCashForm(CUENTAS);
ok(m.elem('cashCuenta').value === 'BTG', 'sigue elegido BTG (' + m.elem('cashCuenta').value + ')');
m.api.buildCashForm([{ nombre: 'Charles Schwab' }]);
ok(m.elem('cashCuenta').value === 'CS', 'si BTG desaparece, queda la primera y NUNCA vacío (' + m.elem('cashCuenta').value + ')');

console.log('\nE) monto inválido no llega al backend');
m = montar();
m.api.buildCashForm(CUENTAS);
m.elem('cashMonto').value = '-3';
m.elem('cashConfirmar').onclick.call(m.elem('cashConfirmar'));
ok(m.enviado === null, 'no se envió nada');
ok(/inv/i.test(m.elem('cashResultado').innerHTML), 'avisa monto inválido');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
