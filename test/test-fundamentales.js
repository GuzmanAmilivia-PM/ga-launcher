// Arnés de los indicadores del detalle de una posición (V14, 26/08/2026).
// El backend decide QUÉ indicadores tienen sentido para cada tipo de activo y
// manda los textos resueltos; acá se prueba el PINTADO y el CABLEADO:
//   - que cada dato caiga donde va y el contexto histórico se vea;
//   - que un símbolo sin cobertura MUESTRE el motivo en vez de quedar vacío;
//   - que cerrar el detalle mientras el pedido viaja no escriba sobre un nodo
//     muerto (el bug clásico de esta clase de carga diferida);
//   - que el símbolo se pida UNA vez por sesión (caché en memoria).
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var codigo = ruta.bloque(html,
  '// ---------- Indicadores del detalle (V14) ----------',
  '// ---------- Principales posiciones (Inicio) ----------');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

var FICHA = {
  ok: true, symbol: 'MSFT', clase: 'accion', claseLabel: 'Individual stocks',
  indicadores: [
    { nombre: 'EV / EBITDA', valor: '19.6x', contexto: 'vs 23.2x median (10y)' },
    { nombre: 'P/E', valor: '27.7x', contexto: 'vs 34.9x median (10y)' },
    { nombre: 'Return on invested capital', valor: '26.5%', contexto: 'above ~15% is strong' },
    { nombre: 'Net margin', valor: '40.3%', contexto: null }
  ],
  estimaciones: {
    forwardPE: '22.9x', forwardPEG: '1.34',
    proximoReporte: { fecha: '2026-10-28', cuando: 'after close', epsEstimado: '3.55', ventasEstimadas: '75.8B' },
    consenso: { compra: 64, mantener: 5, venta: 0, periodo: '2026-08-01' }
  },
  notas: []
};

function montar() {
  var estado = { pedidos: [], respuesta: FICHA, handlers: [] };
  function nuevoElem() {
    var el = { style: {}, className: '', _html: '', parentNode: { nodo: true } };
    Object.defineProperty(el, 'innerHTML', {
      get: function () { return this._html; }, set: function (v) { this._html = v; }
    });
    return el;
  }
  var ctx = {
    esc: function (s) {
      return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    msgErr: function (err) { return 'ERR:' + ((err && err.message) || err); },
    msgBackend: function (r) { return ((r && r.mensajes) || ['sin datos']).join(' '); },
    ajustarAlturaDeck: function () { estado.ajusto = true; },
    google: { script: { run: (function () {
      function mk() {
        var oks = [], fails = [];
        var api = {
          withSuccessHandler: function (f) { oks.push(f); return api; },
          withFailureHandler: function (f) { fails.push(f); return api; },
          getFundamentales: function (args) {
            estado.pedidos.push(args);
            // El disparo se guarda para poder ejecutarlo DESPUES: asi se puede
            // simular que el detalle se cerro mientras el pedido viajaba.
            estado.handlers.push({ ok: oks, fail: fails });
            if (!estado.diferido) oks.forEach(function (f) { f(estado.respuesta); });
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
  var fn = new Function(nombres.join(','),
    codigo + '\nreturn { cargar: cargarFundamentales, pintar: pintarFundamentales, cache: function () { return fundCache; } };');
  estado.api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));
  estado.nuevoElem = nuevoElem;
  return estado;
}

console.log('\nA) los indicadores, con su contexto historico');
var m = montar();
var caja = m.nuevoElem();
m.api.cargar('MSFT', caja);
var h = caja.innerHTML;
ok(/EV \/ EBITDA/.test(h) && /19\.6x/.test(h), 'el multiplo y su valor');
ok(/vs 23\.2x median \(10y\)/.test(h), 'y la mediana de SU historia, que es lo que le da sentido');
ok(/Return on invested capital/.test(h) && /26\.5%/.test(h), 'el retorno sobre capital');
ok(/Net margin<\/span><b>40\.3%<\/b><\/div>/.test(h), 'un indicador sin contexto no deja un <em> vacio');
ok((h.match(/detfund-fila/g) || []).length === 7, 'cuatro indicadores + tres filas de estimaciones');

console.log('\nB) lo que se espera hacia adelante');
ok(/Looking forward/.test(h), 'la seccion existe');
ok(/Forward P\/E<\/span><b>22\.9x/.test(h) && /forward PEG 1\.34/.test(h), 'PER y PEG a futuro');
ok(/Next earnings/.test(h) && /2026-10-28/.test(h) && /after close/.test(h), 'la proxima fecha de resultados');
ok(/EPS 3\.55 expected/.test(h) && /revenue 75\.8B/.test(h), 'con lo que se espera de beneficio y ventas');
ok(/64 buy · 5 hold · 0 sell/.test(h), 'el consenso de analistas');
ok(/not a suggestion from this app/.test(h), 'aclarando que es de terceros: la app describe, no recomienda');
// LO QUE NO DEBE APARECER NUNCA: un BPA estimado calculado dividiendo el
// precio por el PER futuro. La sonda mostro que da +288% en CNSWF.
ok(!/implied|derived|estimated EPS growth/i.test(h), 'ningun numero despejado a mano del forward PE');

console.log('\nC) un simbolo sin cobertura dice POR QUE, no queda en blanco');
var m2 = montar();
m2.respuesta = { ok: false, mensajes: ['No fundamentals available for NA9: the free data plan covers US-listed companies only.'] };
var caja2 = m2.nuevoElem();
m2.api.cargar('NA9', caja2);
ok(/US-listed companies only/.test(caja2.innerHTML), 'se muestra el motivo del backend');
ok(!/detfund-fila/.test(caja2.innerHTML), 'y no se dibuja una tabla vacia');

console.log('\nD) un ETF: sin fundamentales propios, con su explicacion');
var m3 = montar();
m3.respuesta = {
  ok: true, symbol: 'VOO', clase: 'etf_amplio', indicadores: [], estimaciones: {},
  notas: ['ETFs have no fundamentals of their own: they are read by what they hold.']
};
var caja3 = m3.nuevoElem();
m3.api.cargar('VOO', caja3);
ok(/no fundamentals of their own/.test(caja3.innerHTML), 'la nota se pinta');
ok(!/detfund-tabla/.test(caja3.innerHTML) && !/Looking forward/.test(caja3.innerHTML),
  'sin indicadores ni estimaciones no se dibujan las secciones');

console.log('\nE) cerrar el detalle mientras el pedido viaja no rompe nada');
var m4 = montar();
m4.diferido = true;
var caja4 = m4.nuevoElem();
m4.api.cargar('MSFT', caja4);
ok(/Loading indicators/.test(caja4.innerHTML), 'mientras carga lo dice');
caja4.parentNode = null;              // el usuario cerro el detalle
m4.handlers[0].ok.forEach(function (f) { f(FICHA); });
ok(/Loading indicators/.test(caja4.innerHTML),
  'la respuesta que llega tarde NO escribe sobre un nodo que ya no esta en la pagina');

console.log('\nF) el cache: un simbolo se pide UNA vez por sesion');
var m5 = montar();
var c1 = m5.nuevoElem(), c2 = m5.nuevoElem();
m5.api.cargar('MSFT', c1);
m5.api.cargar('MSFT', c2);
ok(m5.pedidos.length === 1, 'el segundo pedido sale del cache en memoria');
ok(/19\.6x/.test(c2.innerHTML), 'y pinta igual');
m5.api.cargar('GOOG', m5.nuevoElem());
ok(m5.pedidos.length === 2, 'otro simbolo si se pide');
ok(m5.pedidos[0].symbol === 'MSFT' && m5.pedidos[1].symbol === 'GOOG', 'cada uno con su simbolo');

console.log('\nG) el contenido del backend se ESCAPA');
var m6 = montar();
m6.respuesta = {
  ok: true, symbol: 'X', indicadores: [{ nombre: '<img src=x onerror=alert(1)>', valor: '<b>1</b>', contexto: null }],
  estimaciones: {}, notas: ['<script>robar()</script>']
};
var caja6 = m6.nuevoElem();
m6.api.cargar('X', caja6);
ok(caja6.innerHTML.indexOf('<img src=x') === -1 && /&lt;img/.test(caja6.innerHTML), 'el nombre se escapa');
ok(caja6.innerHTML.indexOf('<script>robar') === -1, 'la nota tambien');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
