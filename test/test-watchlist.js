// Arnés de la Watchlist (27/08/2026): la pestaña nueva de la barra.
// Lo que custodia: que la lista pinte lo que el Worker manda (precio null =
// guion, no un cero), que la campanita diga la verdad (armada en acento,
// disparada en verde), que quitar y guardar alerta llamen al backend con lo
// que corresponde, y que el "+" del buscador no ofrezca agregar lo que ya
// está. El push NO se prueba acá: no hay navegador (pushSoportado da falso
// y el estado lo dice) — el circuito real se prueba con el botón de
// notificación de prueba en el teléfono.
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var codigo = ruta.bloque(html,
  '// ---------- Watchlist (pestana de la barra) ----------',
  '// Ojito de privacidad');
var codigoBuscador = ruta.bloque(html,
  '// ---------- Buscador de tickers (lupa) ----------',
  '// Watchlist con alertas de precio');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

// --- DOM de mentira, con filas que recuerdan lo que les colgaron ---
function montar() {
  var estado = { elems: {}, llamadas: [], creados: [] };
  function nuevoElem(id) {
    var el = {
      id: id, style: {}, innerHTML: '', textContent: '', value: '',
      disabled: false, className: '', hijos: [],
      appendChild: function (h) { this.hijos.push(h); h.parentNode = this; return h; },
      insertBefore: function (h, ref) { this.hijos.push(h); h.parentNode = this; return h; },
      removeChild: function (h) {},
      addEventListener: function () {},
      classList: { add: function () {}, remove: function () {}, toggle: function () {} },
      // Desde el 27/08/2026 la fila tiene panel deslizable: renderWatchlist
      // busca sus piezas por selector, asi que el DOM de mentira devuelve una
      // pieza DISTINTA por selector (antes devolvia siempre la misma lista y
      // los dos onclick se pisaban).
      querySelector: function (sel) {
        if (!this._piezas) this._piezas = {};
        if (!this._piezas[sel]) {
          this._piezas[sel] = {
            sel: sel, disabled: false, style: {}, className: '',
            addEventListener: function () {}, offsetWidth: 148
          };
        }
        return this._piezas[sel];
      },
      querySelectorAll: function () { return []; },
      scrollIntoView: function () {}
    };
    return el;
  }
  function elem(id) {
    if (!estado.elems[id]) estado.elems[id] = nuevoElem(id);
    return estado.elems[id];
  }
  // El shim de mentira: registra cada llamada y contesta lo configurado.
  var respuestas = { getWatchlist: { ok: true, items: [] } };
  function mkRun(oks, fails) {
    var api = {
      withSuccessHandler: function (f) { return mkRun(oks.concat(f), fails); },
      withFailureHandler: function (f) { return mkRun(oks, fails.concat(f)); }
    };
    ['getWatchlist', 'quitarWatchlist', 'alertaWatchlist', 'agregarWatchlist', 'registrarPush', 'probarPush'].forEach(function (n) {
      api[n] = function (args) {
        estado.llamadas.push({ fn: n, args: args });
        var r = respuestas[n] !== undefined ? respuestas[n] : { ok: true };
        oks.forEach(function (f) { f(r); });
      };
    });
    return api;
  }
  var ctx = {
    document: {
      getElementById: function (id) { return elem(id); },
      createElement: function (tag) { var e = nuevoElem('_' + tag + estado.creados.length); estado.creados.push(e); return e; }
    },
    window: {},
    navigator: {},
    localStorage: { getItem: function () { return null; }, setItem: function () {} },
    atob: function (s) { return ''; },
    Uint8Array: Uint8Array,
    cacheLeer: function () { return null; },
    cacheGuardar: function () {},
    errorEnVista: function () {},
    esc: function (s) { return String(s); },
    fmt: function (n) { return 'USD ' + n; },
    fmtNum: function (n) { return String(n); },
    signoPct: function (v, d) { return (v >= 0 ? '+' : '') + v.toFixed(d) + '%'; },
    msgErr: function (e, s) { return s + ' fallo'; },
    // Las DOS piezas que la watchlist comparte con la tarjeta de Posiciones
    // (viven en graficos.js, que carga antes). Acá van sellos que dejan ver
    // con qué se las llamó: si algún día la watchlist dejara de reusarlas y
    // se copiara el HTML, estos asserts se caen.
    sparkSvg: function (serie, w, h) {
      return '<svg data-serie="' + (serie || []).join(',') + '" width="' + w + '" height="' + h + '"></svg>';
    },
    celdaInstrumentoHtml: function (h) {
      return '<span class="holdcell" data-identidad="' + h.symbol + '"><span class="sym">' + h.symbol +
        '</span><span class="desc">' + (h.nombre || '') + '</span></span>';
    },
    engancharLogos: function () {},
    // Las dos piezas del detalle de una posición: acá se anota a quién se las
    // pidió, para exigir que la watchlist REUSE el mismo detalle.
    cargarFundamentales: function (sym, caja) { estado.fundamentalesDe = sym; if (caja) caja.marcado = true; },
    crearTvWidget: function (caja, sym) { estado.graficoDe = sym; },
    google: { script: { run: mkRun([], []) } }
  };
  var nombres = Object.keys(ctx);
  var fn = new Function(nombres.join(','), codigo +
    '\nreturn { renderWatchlist: renderWatchlist, wlTiene: wlTiene, cargarWatchlist: cargarWatchlist, wlMandarAlerta: wlMandarAlerta, pintarEstadoPush: pintarEstadoPush, wlToggleDetalle: wlToggleDetalle, wlToggleForm: wlToggleForm };');
  estado.api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));
  estado.elem = elem;
  estado.respuestas = respuestas;
  estado.ctx = ctx;
  return estado;
}

var ITEMS = [
  { symbol: 'AAPL', nombre: 'Apple', precio: 231.4, cambioPct: 1.2, enVivo: true, spark: [200, 210, 205, 231.4],
    alerta: { precio: 250, direccion: 'sube', creada: 'x', disparada: null } },
  { symbol: 'VOO', nombre: 'Vanguard S&P 500', precio: 520, cambioPct: -0.4, enVivo: true, spark: [560, 540, 530, 520],
    alerta: { precio: 500, direccion: 'baja', creada: 'x', disparada: '2026-08-27T15:00:00Z' } },
  { symbol: 'NA9', nombre: 'Europea sin Finnhub', precio: null, cambioPct: null, enVivo: false, spark: null, alerta: null }
];
// Los dos casos de precio NO en vivo (27/08/2026): el proveedor frena por IP y
// la fila se sirve del ultimo dato conocido, diciendolo.
var ITEMS_RESPALDO = [
  { symbol: 'PLTR', nombre: 'Palantir', precio: 185.93, cambioPct: null, enVivo: false, precioDe: '2026-08-27', spark: [170, 177, 185.93], alerta: null },
  { symbol: 'SPCX', nombre: 'ETF del espacio', precio: 140.87, cambioPct: 0.89, enVivo: false, precioDe: 'ultimo', spark: null, alerta: null }
];

console.log('\nA) la lista pinta lo que el Worker manda');
var m = montar();
m.api.renderWatchlist({ ok: true, items: ITEMS });
var filas = m.elem('wlBody').hijos;
ok(filas.length === 3, '3 filas (' + filas.length + ')');
ok(/AAPL/.test(filas[0].innerHTML) && /231.4/.test(filas[0].innerHTML), 'simbolo y precio en la fila');
ok(/\+1.20%/.test(filas[0].innerHTML), 'el % del dia con su signo');
ok(/hit /.test(filas[1].innerHTML) && /500/.test(filas[1].innerHTML), 'la alerta que ya sono lo dice, con su objetivo');
ok(/alert /.test(filas[0].innerHTML) && /250/.test(filas[0].innerHTML), 'la armada muestra su objetivo bajo el precio');
// El boton de la alerta es un "+" desde el 27/08/2026 (Guzman: "no me gusta
// la campana"). La campana tenia el arco y el badajo; el + son dos rayas.
ok(!/6 0 0 1-12 0|10.2 20/.test(filas[0].innerHTML), 'ya no queda nada de la campana');
ok(/M12 5.5v13M5.5 12h13/.test(filas[0].innerHTML), 'el icono de la alerta es un +');

console.log('\nA1) la fila se ve limpia: sin botones a la vista, como una de Posiciones');
// Pedido de Guzman (27/08/2026 noche): "que no aparezca el + ni la x, solo si
// con el dedo deslizo... sino que se vea como las principales posiciones".
// Las acciones EXISTEN en el DOM (un lector de pantalla las alcanza) pero
// viven en un panel aparte, debajo del contenido.
ok(/class="wl-desliza"/.test(filas[0].innerHTML), 'el contenido va en su capa deslizable');
ok(/class="wl-acciones"/.test(filas[0].innerHTML), 'y las acciones en un panel aparte');
var iCont = filas[0].innerHTML.indexOf('wl-desliza');
var iAcc = filas[0].innerHTML.indexOf('wl-acciones');
ok(iCont !== -1 && iAcc > iCont, 'las acciones van DESPUES del contenido: quedan debajo, no entre medio');
ok(!/class="wl-btn"/.test(filas[0].innerHTML), 'ya no hay botones sueltos en la fila');
// La identidad es la MISMA pieza del Inicio y de Posiciones, no una copia.
ok(/data-identidad="AAPL"/.test(filas[0].innerHTML), 'usa celdaInstrumentoHtml (logo + simbolo + descripcion)');
ok(/wl-accion alerta/.test(filas[0].innerHTML) && /wl-accion quitar/.test(filas[0].innerHTML),
   'las dos acciones del panel: alerta y quitar');
ok(/aria-label="Price alert for AAPL"/.test(filas[0].innerHTML) &&
   /aria-label="Remove AAPL/.test(filas[0].innerHTML),
   'y cada una dice de que simbolo es (sin gesto, un lector de pantalla igual llega)');
ok(/&mdash;/.test(filas[2].innerHTML), 'sin precio: guion, jamas un cero inventado');
ok(!/null/.test(filas[2].innerHTML), 'y la palabra null no se filtra a la pantalla');

console.log('\nA2) el mini-grafico del mes, el mismo de Posiciones');
ok(/data-serie="200,210,205,231.4"/.test(filas[0].innerHTML), 'dibuja la serie que mando el backend, en su orden');
ok(/class="wl-spark"/.test(filas[0].innerHTML), 'dentro de su celda propia');
// Sin serie NO se dibuja nada: la celda queda vacia y la fila no cambia de
// alto. Una linea plana inventada seria peor que el hueco — diria "este mes
// no se movio" de un simbolo del que no sabemos nada.
ok(/class="wl-spark"><\/div>/.test(filas[2].innerHTML), 'sin serie: la celda queda vacia, no una linea plana');
ok(!/data-serie/.test(filas[2].innerHTML), 'y no se llama al dibujo con una serie vacia');

console.log('\nA3) el precio que no es de ahora se muestra, y se dice que no lo es');
// Reporte de Guzman (27/08/2026): "a veces no aparece el valor". Antes, cuando
// el proveedor frenaba, la fila mostraba un guion. Ahora muestra el ultimo
// dato conocido con una marca — el numero sirve, presentarlo como actual no.
var mR = montar();
mR.api.renderWatchlist({ ok: true, items: ITEMS_RESPALDO });
var filasR = mR.elem('wlBody').hijos;
ok(/185.93/.test(filasR[0].innerHTML), 'el precio de respaldo SE MUESTRA, no un guion');
ok(/at close/.test(filasR[0].innerHTML), 'y dice que es el cierre cuando viene con fecha');
ok(!/%/.test(filasR[0].innerHTML.split('wl-precio')[1] || ''), 'sin % del dia: ese dato no se conoce');
ok(/last known/.test(filasR[1].innerHTML), 'el ultimo precio conocido lo dice de otra forma');
ok(!/\+0.89%/.test(filasR[1].innerHTML), 'y tampoco muestra su % viejo como si fuera de hoy');

console.log('\nA4) tocar una fila abre el detalle del activo, como en Posiciones');
// Pedido de Guzman (27/08/2026): "si las clickeo tienen que abrir su pagina
// con sus datos como en las posiciones". El detalle REUSA las dos piezas de
// graficos.js —cargarFundamentales y crearTvWidget—, no una copia parecida.
var mD = montar();
mD.api.renderWatchlist({ ok: true, items: ITEMS });
var filasD = mD.elem('wlBody').hijos;
mD.api.wlToggleDetalle(ITEMS[0], filasD[0]);
ok(mD.fundamentalesDe === 'AAPL', 'pide los indicadores del simbolo tocado (' + mD.fundamentalesDe + ')');
ok(mD.graficoDe === 'AAPL', 'y su grafico');
var panel = mD.creados.filter(function (e) { return /wl-detalle/.test(e.className || ''); });
ok(panel.length === 1, 'se despliega UN panel de detalle');
ok(/detfund/.test(panel[0].innerHTML) && /tvwrap/.test(panel[0].innerHTML), 'con las mismas cajas que el detalle de una posicion');
// Los numeros de una POSICION no van: en la watchlist no tenes el activo.
ok(!/Average price|Cost basis/.test(panel[0].innerHTML),
   'y SIN precio medio ni costo: esas celdas vacias serian una promesa incumplida');

console.log('\nA5) un solo panel por vez: el detalle y la alerta no conviven');
mD.api.wlToggleForm(ITEMS[0], filasD[0]);
var forms = mD.creados.filter(function (e) { return /wl-alertform/.test(e.className || ''); });
ok(forms.length === 1, 'abrir la alerta despues del detalle deja un solo panel');
mD.api.wlToggleForm(ITEMS[0], filasD[0]);   // segundo toque en la misma: cierra
mD.api.wlToggleDetalle(ITEMS[1], filasD[1]);
ok(mD.fundamentalesDe === 'VOO', 'y tocar otra fila mueve el detalle a esa');

console.log('\nB) wlTiene dice la verdad (lo usa el + del buscador)');
ok(m.api.wlTiene('aapl') === true, 'lo tiene, aunque venga en minuscula');
ok(m.api.wlTiene('ZZZZ') === false, 'no lo tiene');

console.log('\nC) quitar llama al backend con el simbolo y recarga');
filas[0].querySelector('.wl-accion.quitar').onclick();
var quitada = m.llamadas.filter(function (l) { return l.fn === 'quitarWatchlist'; })[0];
ok(quitada && quitada.args.symbol === 'AAPL', 'quitarWatchlist({symbol:AAPL})');
ok(m.llamadas.some(function (l) { return l.fn === 'getWatchlist'; }), 'y tras quitar se recarga la lista');

console.log('\nD) guardar la alerta manda objetivo Y referencia (el precio de pantalla)');
m.llamadas.length = 0;
m.api.wlMandarAlerta('AAPL', 250, 231.4, { disabled: false });
var alerta = m.llamadas.filter(function (l) { return l.fn === 'alertaWatchlist'; })[0];
ok(alerta && alerta.args.precio === 250 && alerta.args.referencia === 231.4, 'alertaWatchlist({precio, referencia})');

console.log('\nE) lista vacia: invita, no muestra un error');
m = montar();
m.api.renderWatchlist({ ok: true, items: [] });
ok(/Nothing here yet/.test(m.elem('wlBody').innerHTML), 'el vacio explica como se agrega');

console.log('\nF) sin navegador con push, el estado lo dice (no finge)');
m.api.pintarEstadoPush();
ok(/cannot receive push/.test(m.elem('wlPushEstado').innerHTML), 'estado honesto sin PushManager');

console.log('\nG) el + del buscador no ofrece agregar lo que ya esta');
function fichaCon(wlTiene) {
  var ctx2 = {
    document: { getElementById: function () { return { onclick: null, addEventListener: function () {}, focus: function () {}, select: function () {}, value: '' }; } },
    busReturnView: 'inicio', currentView: 'inicio', setView: function () {},
    esc: function (s) { return String(s); },
    fmt: function (n) { return 'USD ' + n; },
    fmtNum: function (n) { return String(n); },
    signoPct: function (v, d) { return v + '%'; },
    msgErr: function () { return 'x'; },
    crearTvWidget: function () {},
    cargarWatchlist: function () {},
    wlTiene: wlTiene,
    google: { script: { run: { withSuccessHandler: function () { return this; }, withFailureHandler: function () { return this; } } } }
  };
  var nombres2 = Object.keys(ctx2);
  var fn2 = new Function(nombres2.join(','), codigoBuscador + '\nreturn fichaBuscarHtml;');
  return fn2.apply(null, nombres2.map(function (n) { return ctx2[n]; }));
}
var R = { symbol: 'AAPL', nombre: 'Apple', precio: 231.4 };
var htmlNuevo = fichaCon(function () { return false; })(R);
ok(/id="busAddWatch"/.test(htmlNuevo) && /Add to watchlist/.test(htmlNuevo), 'si no esta: boton + activo');
var htmlYa = fichaCon(function () { return true; })(R);
ok(/In watchlist/.test(htmlYa) && !/id="busAddWatch"/.test(htmlYa), 'si ya esta: lo dice, deshabilitado');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
