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

// El almacenamiento del telefono, de mentira (vuelta 2, 22/11/2026). Se puede
// pasar el MISMO a dos montajes: eso es "cerrar y reabrir la app" (la cache en
// memoria nace vacia, lo guardado sigue).
function almacenNuevo() {
  var datos = {};
  return {
    datos: datos,
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(datos, k) ? datos[k] : null; },
    setItem: function (k, v) { datos[k] = String(v); },
    removeItem: function (k) { delete datos[k]; }
  };
}
function montar(ls) {
  var estado = { pedidos: [], respuesta: FICHA, handlers: [], ls: ls || almacenNuevo() };
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
    localStorage: estado.ls,
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

console.log('\nH) la ficha CURADA de un ETF (14/09/2026): fecha y fuente siempre, vieja atenuada, top holdings');
// El payload TAL CUAL lo arma fichaEtf (EtfValuacion.js, Worker) para SMH.
var FICHA_ETF = {
  ok: true, symbol: 'SMH', clase: 'etf_sector', claseLabel: 'Sector ETFs',
  etf: {
    manda: 'P/S vs. history; P/E only alongside',
    porque: 'Cyclical: at the peak of the cycle earnings are inflated and the P/E looks reasonable.',
    asOf: '2026-09-14', fuente: 'stockanalysis.com', actualizado: '2026-09-14', dias: 6, viejo: false,
    tenencias: { total: 26, top: [{ s: 'NVDA', peso: 22.1 }, { s: 'TSM', peso: 9.75 }], top10Pct: null, fuente: 'stockanalysis.com', fecha: '2026-09-14' }
  },
  indicadores: [
    { nombre: 'P/E (trailing)', valor: '42.5x', contexto: 'historical range not loaded' },
    { nombre: 'P/S', valor: 'not loaded', contexto: null }
  ],
  estimaciones: {},
  notas: ['Cyclical sector: P/E is unreliable at cycle extremes; read P/S and margins vs. history.']
};
var m7 = montar();
var caja7 = m7.nuevoElem();
m7.api.pintar(FICHA_ETF, caja7);
var h7 = caja7.innerHTML;
ok(/What to read here/.test(h7) && /P\/S vs\. history/.test(h7), 'arranca por que multiplo manda para ESTE fondo');
// La linea de CABECERA exacta (la de las tenencias tambien dice "as of", asi que
// un assert suelto pasaria con la cabecera borrada).
ok(/<p class="detfund-asof">as of 2026-09-14, source stockanalysis\.com<\/p>/.test(h7), 'la fecha y la fuente van a la vista, arriba: son datos a mano');
ok(/42\.5x/.test(h7) && /historical range not loaded/.test(h7), 'el PER con su contexto honesto');
ok(/>not loaded</.test(h7), 'lo que no se vio dice "not loaded", no un numero');
ok(/Top holdings/.test(h7) && /NVDA<\/span><b>22\.10%/.test(h7) && /TSM<\/span><b>9\.75%/.test(h7), 'el top 5 con sus pesos');
ok(/26 holdings · as of 2026-09-14/.test(h7), 'y cuantas tenencias tiene, con fecha');
ok(!/top 10 =/.test(h7), 'el peso del top 10 no se vio: no se escribe');
ok(/Cyclical sector/.test(h7), 'el aviso ciclico llega como nota');
ok(!/detfund-viejo/.test(h7), 'a los 6 dias nada se atenua');

// La misma ficha, VIEJA: se atenua entera y dice cuantos dias tiene.
var VIEJA = JSON.parse(JSON.stringify(FICHA_ETF));
VIEJA.etf.viejo = true; VIEJA.etf.dias = 120;
VIEJA.notas.push('ETF valuation data is 120 days old (loaded 2026-09-14): read it as history, not as today.');
var caja8 = m7.nuevoElem();
m7.api.pintar(VIEJA, caja8);
ok(/120 days old/.test(caja8.innerHTML), 'una ficha vieja dice cuantos dias tiene arriba de todo');
ok((caja8.innerHTML.match(/detfund-viejo/g) || []).length >= 3 && /detfund-tabla detfund-viejo/.test(caja8.innerHTML),
   'y se atenua ENTERA: el "que leer", la tabla de indicadores y el top llevan la clase');

// Sin top cargado: se dice cuantas tenencias hay y que el top no esta.
var SIN_TOP = JSON.parse(JSON.stringify(FICHA_ETF));
SIN_TOP.etf.tenencias.top = null;
var caja9 = m7.nuevoElem();
m7.api.pintar(SIN_TOP, caja9);
ok(/26 holdings \(as of 2026-09-14, source stockanalysis\.com\) · top holdings not loaded/.test(caja9.innerHTML), 'sin top cargado no se inventa ninguna lista');

// Una accion comun NO trae `etf`: su ficha sigue igual que antes.
var caja10 = m7.nuevoElem();
m7.api.pintar(FICHA, caja10);
// (Desde el 24/11/2026 el consenso de una accion dice "as of <mes>": lo que no
// tiene que aparecer es la CABECERA de la ficha curada, no la frase suelta.)
ok(!/<p class="detfund-asof">as of/.test(caja10.innerHTML) && !/What to read here/.test(caja10.innerHTML), 'una accion no muestra nada de esto');

console.log('\nI) los indicadores abren con lo guardado en el telefono (bucle de mejora, vuelta 2, 22/11/2026)');
// La cache en memoria moria al cerrar la app: cada reapertura volvia a mostrar
// "Loading indicators...". Ahora la ultima respuesta sana queda en UNA clave
// (ga_cache_fund) con una lista por simbolo y tope.
function guardadoDe(ls) {
  try { var j = JSON.parse(ls.getItem('ga_cache_fund') || 'null'); return (j && Array.isArray(j.data)) ? j.data : []; }
  catch (e) { return []; }
}
// El primer indicador guardado de la entrada mas nueva, sin reventar si no hay.
function valorGuardado(ls) {
  var e = guardadoDe(ls)[0];
  return (e && e.data && e.data.indicadores && e.data.indicadores[0]) ? e.data.indicadores[0].valor : null;
}
var lsI = almacenNuevo();
var mI = montar(lsI);
mI.api.cargar('MSFT', mI.nuevoElem());
var gI = guardadoDe(lsI);
ok(gI.length === 1 && gI[0].s === 'MSFT' && gI[0].data && gI[0].data.indicadores.length === 4,
  '(a) la respuesta sana queda guardada por simbolo bajo ga_cache_fund');
ok(Object.keys(lsI.datos).length === 1, '(a) y es UNA sola clave, no una por simbolo');

// "Recien abierta": otro montaje (memoria vacia) con el MISMO almacenamiento,
// y el backend que todavia no contesto.
var mI2 = montar(lsI);
mI2.diferido = true;
var cajaI2 = mI2.nuevoElem();
mI2.api.cargar('MSFT', cajaI2);
ok(/19\.6x/.test(cajaI2.innerHTML) && !/Loading/.test(cajaI2.innerHTML),
  '(b) recien abierta pinta los indicadores guardados antes de que conteste el backend, sin "Loading"');
var FRESCA = JSON.parse(JSON.stringify(FICHA));
FRESCA.indicadores[0].valor = '21.4x';
ok(mI2.pedidos.length === 1 && mI2.pedidos[0].symbol === 'MSFT' && /19\.6x/.test(cajaI2.innerHTML),
  '(c) y pide lo fresco igual, por detras, con lo guardado ya a la vista');
mI2.handlers[0].ok.forEach(function (f) { f(FRESCA); });
ok(/21\.4x/.test(cajaI2.innerHTML) && valorGuardado(lsI) === '21.4x',
  '(c) lo fresco reemplaza lo pintado y lo guardado');

// Un ok:false (sin cobertura, plan gratis agotado...) NO pisa nada.
var mI3 = montar(lsI);
mI3.diferido = true;
var cajaI3 = mI3.nuevoElem();
mI3.api.cargar('MSFT', cajaI3);
mI3.handlers[0].ok.forEach(function (f) { f({ ok: false, mensajes: ['Data provider limit reached.'] }); });
ok(/21\.4x/.test(cajaI3.innerHTML) && !/limit reached/.test(cajaI3.innerHTML),
  '(d) un ok:false no borra lo pintado');
ok(guardadoDe(lsI).length === 1 && guardadoDe(lsI)[0].data.ok === true && valorGuardado(lsI) === '21.4x',
  '(d) ni pisa lo guardado');
// Un fallo de red tampoco.
var mI4 = montar(lsI);
mI4.diferido = true;
var cajaI4 = mI4.nuevoElem();
mI4.api.cargar('MSFT', cajaI4);
mI4.handlers[0].fail.forEach(function (f) { f(new Error('offline')); });
ok(/21\.4x/.test(cajaI4.innerHTML) && !/ERR:/.test(cajaI4.innerHTML) && guardadoDe(lsI).length === 1,
  '(d) y un fallo de red tampoco: lo pintado y lo guardado se quedan');

// El tope: 41 simbolos, el mas viejo (el primero) queda afuera.
var lsT = almacenNuevo();
var mT = montar(lsT);
for (var k = 1; k <= 41; k++) {
  mT.respuesta = { ok: true, symbol: 'S' + k, indicadores: [], estimaciones: {}, notas: [] };
  mT.api.cargar('S' + k, mT.nuevoElem());
}
var gT = guardadoDe(lsT);
var simbT = gT.map(function (e) { return e.s; });
ok(gT.length === 40, '(e) con 41 simbolos quedan 40 guardados (' + gT.length + ')');
ok(simbT.indexOf('S1') === -1 && simbT.indexOf('S2') !== -1 && simbT[0] === 'S41',
  '(e) el que queda afuera es el mas viejo, y el mas nuevo va primero');

console.log('\nJ) de que fecha es cada dato, y el aviso cuando el proveedor esta atrasado (24/11/2026)');
// El caso que lo destapo: el proveedor tenia los balances de una empresa
// hasta junio con el tercer trimestre publicado hacia semanas, y su PER a
// futuro llevaba dos meses sin moverse. La ficha lo mostraba como el de hoy.
// Los campos son los que manda el Worker (Fundamentales.js); los numeros son
// inventados con la forma del caso real.
var ATRASADA = JSON.parse(JSON.stringify(FICHA));
ATRASADA.datosAl = '2026-06-28';
ATRASADA.ultimoBalance = { periodo: '2026-09-30' };
ATRASADA.atrasado = true;
ATRASADA.estimaciones.forwardDesde = '2026-09-24';
ATRASADA.estimaciones.forwardDesdeExacto = true;
ATRASADA.estimaciones.forwardQuieto = true;
ATRASADA.estimaciones.forwardVencido = true;
ATRASADA.estimaciones.ultimoReporte = '2026-10-14';
var mJ = montar();
var cajaJ = mJ.nuevoElem();
mJ.api.pintar(ATRASADA, cajaJ);
var hJ = cajaJ.innerHTML;
ok(/<p class="detfund-aviso"><b>Out of date\.<\/b> These ratios use financial statements through 2026-06-28\. The quarter ended 2026-09-30 has already been reported/.test(hJ),
  'el aviso dice hasta que balance llegan los multiplos y cual ya se publico');
ok(hJ.indexOf('detfund-aviso') < hJ.indexOf('detfund-tabla'), 'y va ARRIBA de la tabla: se lee antes que el numero');
ok(/<div class="detfund-tabla detfund-viejo">/.test(hJ), 'la tabla se atenua, como la ficha vieja de un ETF');
ok(/27\.7x/.test(hJ), 'el numero del proveedor sigue a la vista: el atraso se avisa, no se tapa ni se corrige');
ok(!/financial statements through 2026-06-28, source Finnhub/.test(hJ), 'la fecha no se repite abajo cuando ya la dijo el aviso');
ok(/Forward P\/E<\/span><b class="detfund-viejo">22\.9x<\/b>/.test(hJ), 'el PER a futuro vencido se atenua');
ok(/<em class="detfund-alerta">Out of date: unchanged since 2026-09-24, before the last earnings report \(2026-10-14\)<\/em>/.test(hJ),
  'y dice desde cuando no cambia y que es anterior al ultimo balance');
ok(/<em>forward PEG 1\.34<\/em>/.test(hJ), 'el PEG sigue en su renglon');
ok(/as of 2026-08-01 · what other analysts publish/.test(hJ), 'el consenso dice de que mes es');

// Al dia: la fecha va chica, debajo de la tabla, y nada se atenua.
var AL_DIA = JSON.parse(JSON.stringify(FICHA));
AL_DIA.datosAl = '2026-09-30';
AL_DIA.ultimoBalance = { periodo: '2026-09-30' };
AL_DIA.atrasado = false;
AL_DIA.estimaciones.forwardDesde = '2026-11-03';
AL_DIA.estimaciones.forwardDesdeExacto = true;
AL_DIA.estimaciones.forwardQuieto = true;
AL_DIA.estimaciones.ultimoReporte = '2026-10-28';
var cajaJ2 = mJ.nuevoElem();
mJ.api.pintar(AL_DIA, cajaJ2);
var hJ2 = cajaJ2.innerHTML;
ok(/<p class="detfund-asof">financial statements through 2026-09-30, source Finnhub<\/p>/.test(hJ2), 'al dia: la fecha de los balances, discreta, debajo de la tabla');
ok(!/detfund-aviso/.test(hJ2) && !/detfund-viejo/.test(hJ2) && !/Out of date/.test(hJ2), 'sin aviso y sin atenuar');
ok(/<em>unchanged since 2026-11-03<\/em>/.test(hJ2), 'un PER a futuro quieto pero posterior al balance: la fecha, sin alarma');

// "Por lo menos desde": el registro nacio ese dia y no se sabe cuanto llevaba.
var COTA = JSON.parse(JSON.stringify(AL_DIA));
COTA.estimaciones.forwardDesdeExacto = false;
var cajaJ3 = mJ.nuevoElem();
mJ.api.pintar(COTA, cajaJ3);
ok(/unchanged since at least 2026-11-03/.test(cajaJ3.innerHTML), 'una cota se dice como cota');

// Uno que se mueve todos los dias no lleva fecha: seria ruido.
var VIVO = JSON.parse(JSON.stringify(AL_DIA));
VIVO.estimaciones.forwardDesde = '2026-11-24';
delete VIVO.estimaciones.forwardQuieto;
var cajaJ4 = mJ.nuevoElem();
mJ.api.pintar(VIVO, cajaJ4);
ok(!/unchanged since/.test(cajaJ4.innerHTML), 'el que cambia todos los dias no dice nada');

// Una ficha guardada en el telefono ANTES del cambio (sin los campos nuevos)
// se pinta como siempre: ni fecha inventada ni aviso.
var cajaJ5 = mJ.nuevoElem();
mJ.api.pintar(FICHA, cajaJ5);
ok(!/financial statements through/.test(cajaJ5.innerHTML) && !/detfund-aviso/.test(cajaJ5.innerHTML) && !/unchanged since/.test(cajaJ5.innerHTML),
  'una ficha anterior al cambio no muestra ninguna fecha que no tiene');
// Marcada atrasada pero sin las dos fechas: no se afirma un atraso a medias.
var RARA = JSON.parse(JSON.stringify(FICHA));
RARA.atrasado = true;
var cajaJ6 = mJ.nuevoElem();
mJ.api.pintar(RARA, cajaJ6);
ok(!/detfund-aviso/.test(cajaJ6.innerHTML) && !/detfund-viejo/.test(cajaJ6.innerHTML), 'sin las fechas no hay aviso');
// La ficha curada de un ETF no se toca: tiene su propia fecha.
var ETF_CON = JSON.parse(JSON.stringify(FICHA_ETF));
ETF_CON.datosAl = '2026-06-28'; ETF_CON.atrasado = true; ETF_CON.ultimoBalance = { periodo: '2026-09-30' };
var cajaJ7 = mJ.nuevoElem();
mJ.api.pintar(ETF_CON, cajaJ7);
ok(!/detfund-aviso/.test(cajaJ7.innerHTML) && !/financial statements through/.test(cajaJ7.innerHTML), 'un ETF sigue con su ficha curada, sin estos campos');
// Las fechas vienen del backend: tambien se escapan.
var MALA = JSON.parse(JSON.stringify(ATRASADA));
MALA.datosAl = '<img src=x>'; MALA.estimaciones.forwardDesde = '<i>x</i>';
var cajaJ8 = mJ.nuevoElem();
mJ.api.pintar(MALA, cajaJ8);
ok(cajaJ8.innerHTML.indexOf('<img src=x>') === -1 && cajaJ8.innerHTML.indexOf('<i>x</i>') === -1, 'las fechas del backend se escapan');
// Los estilos existen y no traen hexadecimales (regla de la paleta).
var cssJ = require('fs').readFileSync(require('path').join(ruta.RUTA, 'css', 'estilos.css'), 'utf8');
var reglaAviso = (cssJ.match(/\.detfund-aviso \{[^}]*\}/) || [''])[0];
ok(reglaAviso && /var\(--gold\)/.test(reglaAviso) && !/#[0-9a-f]{3,6}/i.test(reglaAviso), 'el aviso usa el acento vivo, sin colores fijos (mira la regla escrita, no mide pantalla)');
ok(/\.detfund-fila > em\.detfund-alerta \{[^}]*var\(--gold\)/.test(cssJ), 'y la alerta del PER a futuro tambien');

var panelesSrc = require('fs').readFileSync(require('path').join(ruta.RUTA, 'js', 'paneles.js'), 'utf8');
var listaCaches = (panelesSrc.match(/var GA_CACHES = \[[\s\S]*?\];/) || [''])[0];
ok(/'ga_cache_fund'/.test(listaCaches), '(f) ga_cache_fund esta en GA_CACHES: el borrado de emergencia la alcanza');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
