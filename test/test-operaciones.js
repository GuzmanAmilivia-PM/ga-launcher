// Arnés de la lista de operaciones (compras y ventas) de la vista Trade.
// Lo que se prueba de verdad es el FILTRADO: la lista viaja entera del backend
// una sola vez y los botones de rango y de tipo filtran en el teléfono.
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var codigo = ruta.bloque(html,
  '// ---------- Operaciones (compras y ventas) ----------',
  '// ---------- Noticias ----------');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

var hoy = new Date();
function iso(d) {
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
// Fechas relativas a hoy, para que el escenario no caduque con el calendario.
var HACE_5D = iso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 5));
var ESTE_ANIO_ENE = hoy.getFullYear() + '-01-02';
var ANIO_PASADO = (hoy.getFullYear() - 1) + '-06-15';

var DATOS = {
  ok: true,
  avisos: ['IBKR: la consulta de actividad no trae operaciones. Marcale la sección "Trades" en el portal de IBKR.'],
  operaciones: [
    { fecha: HACE_5D, cuenta: 'Charles Schwab', symbol: 'VOO', tipo: 'compra', qty: 2, precio: 500, monto: 1000, origen: 'broker' },
    { fecha: HACE_5D, cuenta: 'Interactive Brokers', symbol: 'NA9', tipo: 'venta', qty: 3, precio: 20, monto: 60, origen: 'broker' },
    { fecha: ESTE_ANIO_ENE, cuenta: 'Binance', symbol: 'BTC', tipo: 'compra', qty: 0.01, precio: 60000, monto: 600, origen: 'manual' },
    { fecha: ANIO_PASADO, cuenta: 'Itau Assets', symbol: 'AAPL', tipo: 'venta', qty: 5, precio: 180, monto: 900, origen: 'manual' }
  ]
};
// En enero la fecha "hace 3 meses" cae en el año anterior: el rango 3m tapa a
// YTD y el assert de "3m muestra menos" no aplicaría.
var ENERO = hoy.getMonth() === 0;

function montar() {
  var estado = { elems: {}, botones: {}, pedidos: [] };
  function nuevoElem(id) {
    var el = {
      id: id, style: {}, className: '', hijos: [], _html: '',
      appendChild: function (o) { this.hijos.push(o); },
      removeAttribute: function () {}, setAttribute: function () {}
    };
    // innerHTML = '' vacía el contenedor: en el DOM real también se van los
    // hijos. Sin esto las filas se acumulaban render tras render.
    Object.defineProperty(el, 'innerHTML', {
      get: function () { return this._html; },
      set: function (v) { this._html = v; this.hijos = []; }
    });
    return el;
  }
  function elem(id) {
    if (!estado.elems[id]) estado.elems[id] = nuevoElem(id);
    return estado.elems[id];
  }
  // El texto de cada boton de filtro vive en su <b> interno.
  var etiquetas = { '#opsFiltroRango b': '', '#opsFiltroTipo b': '', '#opsFiltroTicker b': '' };
  var ctx = {
    document: {
      getElementById: function (id) { return elem(id); },
      createElement: function () { return nuevoElem(''); },
      querySelector: function (sel) {
        return {
          set textContent(v) { etiquetas[sel] = v; },
          get textContent() { return etiquetas[sel]; }
        };
      },
      querySelectorAll: function () { return []; }
    },
    esc: function (s) { return String(s); },
    mask: function (s) { return s; },
    fmt: function (n) { return 'USD ' + Math.round(Number(n) || 0).toLocaleString('en-US'); },
    nombrePlataforma: function (n) { return /interactive brokers/i.test(String(n)) ? 'IBKR' : String(n); },
    msgBackend: function () { return 'Error del backend.'; },
    opsCargadas: false,
    // El de verdad vive en paneles.js; acá solo interesa que pida y renderice.
    cargarConCache: function (cfg) {
      estado.cfg = cfg;
      if (cfg.limpiar) cfg.limpiar();
      cfg.pedir(function (r) { cfg.render(r); }, function () {});
    },
    google: { script: { run: (function () {
      function mk() {
        var oks = [];
        var api = {
          withSuccessHandler: function (f) { oks.push(f); return api; },
          withFailureHandler: function () { return api; },
          getOperaciones: function (args) {
            estado.pedidos.push(args);
            oks.forEach(function (f) { f(DATOS); });
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
    codigo + '\nreturn { render: renderOperaciones, cargar: cargarOperaciones, cargado: function () { return opsCargadas; } };');
  estado.api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));
  estado.elem = elem;
  estado.etiqueta = function (sel) { return etiquetas[sel]; };
  // Abre la pantallita de un filtro y elige una opcion por su texto, como el
  // dedo: boton -> lista de opciones -> tocar una.
  estado.elegir = function (filtro, texto) {
    elem(filtro).onclick();
    var opcion = elem('opsPickerOpts').hijos.filter(function (o) { return o.textContent === texto; })[0];
    if (!opcion) throw new Error('no hay opcion "' + texto + '" en ' + filtro);
    opcion.onclick();
  };
  estado.opciones = function (filtro) {
    elem(filtro).onclick();
    var txt = elem('opsPickerOpts').hijos.map(function (o) { return o.textContent; });
    elem('opsPickerClose').onclick();
    return txt;
  };
  return estado;
}

function filas(m) { return m.elem('opsBody').hijos.length; }
function textoFilas(m) {
  return m.elem('opsBody').hijos.map(function (h) { return h.innerHTML; }).join(' ');
}

console.log('\nA) por defecto: lo del año en curso, compras y ventas');
var m = montar();
m.api.render(DATOS);
ok(filas(m) === 3, 'YTD deja fuera la del año pasado (' + filas(m) + ' filas)');
ok(/AAPL/.test(textoFilas(m)) === false, 'la venta del año pasado no aparece');
ok(/1[.,]600/.test(m.elem('opsResumen').innerHTML), 'el resumen suma las compras (1000 + 600 = 1600)');
ok(/Trades/.test(m.elem('opsResumen').innerHTML) && />3</.test(m.elem('opsResumen').innerHTML), 'el resumen cuenta 3 trades');
ok(m.etiqueta('#opsFiltroRango b') === 'This year' && m.etiqueta('#opsFiltroTicker b') === 'All', 'los botones muestran lo elegido');
ok(/manual/.test(textoFilas(m)), 'la cargada a mano queda marcada');
ok(/IBKR/.test(textoFilas(m)), 'la cuenta se muestra con la etiqueta de la app');
ok(/Trades/.test(m.elem('opsAvisos').innerHTML), 'el aviso del backend se muestra');

console.log('\nB) el periodo se elige en la pantallita');
ok(m.opciones('opsFiltroRango').join('|') === 'This year|Last 3 months|Since inception', 'las tres opciones de periodo');
m.elegir('opsFiltroRango', 'Since inception');
ok(filas(m) === 4, 'todos los trades (' + filas(m) + ')');
ok(/AAPL/.test(textoFilas(m)), 'ahora sí aparece el del año pasado');
// El boton usa la etiqueta CORTA (a 375 px "Since inception" no entra).
ok(m.etiqueta('#opsFiltroRango b') === 'All', 'el boton refleja lo elegido, en corto');
ok(m.elem('opsPicker').style.display === 'none', 'la pantallita se cierra al elegir');
m.elegir('opsFiltroRango', 'Last 3 months');
ok(ENERO || filas(m) === 2, 'ultimos 3 meses: solo los de hace 5 dias (' + filas(m) + ')');
ok(m.pedidos.length === 0, 'cambiar de filtro NO vuelve a pedir datos al backend');

console.log('\nC) filtro por tipo y por ticker');
m.elegir('opsFiltroRango', 'Since inception');
m.elegir('opsFiltroTipo', 'Sells');
ok(filas(m) === 2, 'solo las ventas (' + filas(m) + ')');
ok(!/BUY/.test(textoFilas(m)), 'ninguna compra en la lista');
m.elegir('opsFiltroTipo', 'Buys');
ok(filas(m) === 2 && !/SELL/.test(textoFilas(m)), 'solo las compras');
m.elegir('opsFiltroTipo', 'All');
ok(m.opciones('opsFiltroTicker').join('|') === 'All|AAPL|BTC|NA9|VOO', 'los tickers salen de los datos, ordenados');
m.elegir('opsFiltroTicker', 'BTC');
ok(filas(m) === 1 && /BTC/.test(textoFilas(m)), 'solo el ticker elegido');
ok(/USD 600/.test(m.elem('opsResumen').innerHTML), 'el resumen acompaña al filtro de ticker (solo BTC: 600)');
// Un refresco puede traer datos donde ese ticker ya no esta: sin la guarda, la
// pantalla quedaba vacia y el filtro invisible.
m.api.render({ ok: true, operaciones: [DATOS.operaciones[0]], avisos: [] });
ok(m.etiqueta('#opsFiltroTicker b') === 'All' && filas(m) === 1, 'si el ticker elegido ya no existe, vuelve a Todos');

console.log('\nD) un filtro sin resultados avisa, no deja la pantalla vacía');
m.elegir('opsFiltroRango', 'This year');
m.api.render({ ok: true, operaciones: [DATOS.operaciones[3]], avisos: [] });
ok(/Nothing with these filters/.test(m.elem('opsBody').innerHTML), 'hay datos pero ninguno en el rango');
m.api.render({ ok: true, operaciones: [], avisos: [] });
ok(/No trades/.test(m.elem('opsBody').innerHTML), 'sin datos: estado vacío distinto');

console.log('\nE) la carga pide al backend y respeta el forzar');
m = montar();
m.api.cargar(true);
ok(m.pedidos.length === 1 && m.pedidos[0].forzar === true, 'pide con forzar:true');
ok(filas(m) === 3, 'y pinta la respuesta');
ok(m.cfg.clave === 'ga_cache_ops' && m.cfg.bodyId === 'opsBody', 'usa el cache local de operaciones');
// La actividad de los brokers vive 6 h en el cache del backend: sin este boton
// un cambio recien hecho en el broker no se puede ver hasta que venza.
m.elem('opsRefreshBtn').onclick();
ok(m.pedidos.length === 2 && m.pedidos[1].forzar === true, 'el boton de actualizar salta los dos caches');
// Auditoria 19/08/2026: dividendos y aportes reintentaban solos tras un
// ok:false y operaciones quedaba clavada en el error hasta refrescar a mano.
m.api.render({ ok: false, mensajes: ['x'] });
ok(/Error del backend/.test(m.elem('opsBody').innerHTML), 'una respuesta con error se muestra, no rompe');
ok(m.api.cargado() === false, 'el ok:false resetea opsCargadas: la proxima visita reintenta sola');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
