// Arnés del análisis POR PERFIL (26/08/2026, ítem V12): la tarjeta resumen de
// Portfolio, la página Analysis (detalle + perfil + test de 6 preguntas) y el
// contrato con el backend (fns 'analisis' y 'perfil_set'). El backend manda
// todo resuelto —textos de chequeos, perfil usado, clases y sectores—, así que
// lo que se prueba acá es el PINTADO y el CABLEADO: qué número cae dónde, qué
// se abre al tocar, y con qué argumentos viajan los pedidos.
var ruta = require('./_ruta');
var html = ruta.leerIndex();
// analisis.js entero: arranca en su encabezado y termina donde empieza el
// archivo siguiente en el orden de carga real (sincronizar.js).
var codigo = ruta.bloque(html,
  '// ---------- Analisis de la cartera ----------',
  '// Protocolo Binance, boton Sincronizar, Deshacer');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

// La respuesta v2 del backend: perfil, clases, sectores y núcleo viajan junto
// con lo de siempre (concentración, riesgo, chequeos y puntaje).
var RESPUESTA = {
  ok: true,
  perfil: { valor: 'moderate', label: 'Moderate', porDefecto: false, origen: 'test' },
  concentracion: { posiciones: 8, efectivas: 5.4, top5: 0.78 },
  nucleo: { pct: 0.62, satelites: 0.38 },
  clases: [
    { clase: 'etf_amplio', label: 'Broad index ETFs', valor: 5200, pct: 0.52 },
    { clase: 'accion', label: 'Individual stocks', valor: 2600, pct: 0.26 },
    { clase: 'cripto', label: 'Crypto', valor: 1200, pct: 0.12 },
    { clase: 'cash', label: 'Cash', valor: 1000, pct: 0.10 }
  ],
  sectores: {
    lista: [{ sector: 'Technology', pct: 0.41 }, { sector: 'Financials', pct: 0.13 }],
    cobertura: 0.84
  },
  riesgo: {
    volAnual: 0.183, drawdown: 0.264,
    // Fechas locales: la app las muestra en la zona del teléfono, no en UTC.
    drawdownDesde: new Date(2026, 1, 10).getTime(), drawdownHasta: new Date(2026, 3, 5).getTime(),
    // D9 (1/09/2026): donde estas HOY respecto del maximo, y hace cuanto. Lo
    // que la peor caida sola no contesta — puede haber sido hace ocho meses.
    ddActual: 0.0161, diasBajoAgua: 18,
    picoFecha: new Date(2026, 7, 14).getTime(), ventanaDias: 400
  },
  chequeos: [
    { clave: 'mayor', titulo: 'Largest single company', estado: 'riesgo', detalle: 'NVDA is 33.3% of what’s invested.', resta: 20 },
    { clave: 'sector', titulo: 'Largest sector exposure', estado: 'atencion', detalle: 'Technology adds up to 41% of your equity.', resta: 10 },
    { clave: 'cash', titulo: 'Cash cushion', estado: 'ok', detalle: 'Cash is 10% of the total.', resta: 0 }
  ],
  puntaje: 70, puntajeBase: 100, nivel: 'Acceptable'
};

function montar() {
  var estado = { pedidos: [], perfiles: [], vistas: [], respuestaPerfil: null };
  var elems = {};
  function nuevoElem(id) {
    var el = { id: id, style: {}, className: '', hijos: [], _html: '', _listeners: {} };
    el.appendChild = function (o) { this.hijos.push(o); };
    el.addEventListener = function (ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); };
    el.disparar = function (ev, arg) { (this._listeners[ev] || []).forEach(function (f) { f(arg || { key: '' }); }); };
    // querySelectorAll de mentira: parsea los <button data-*> del html escrito
    // y devuelve objetos a los que el código real les cuelga su onclick — el
    // test los toca después vía el._botones. Alcanza para este arnés porque
    // los selectores del código son siempre 'button[data-algo]'.
    el._botones = {};
    el.querySelectorAll = function (sel) {
      var m = sel.match(/^button\[(data-[\w-]+)\]$/);
      if (!m) return [];
      var attr = m[1];
      var out = [];
      var re = /<button\b[^>]*>/g, tag;
      while ((tag = re.exec(this._html)) !== null) {
        var attrs = {};
        var re2 = /([\w-]+)="([^"]*)"/g, a;
        while ((a = re2.exec(tag[0])) !== null) attrs[a[1]] = a[2];
        if (attrs[attr] === undefined) continue;
        out.push({ _attrs: attrs, onclick: null, getAttribute: (function (mapa) { return function (n) { return mapa[n] === undefined ? null : mapa[n]; }; })(attrs) });
      }
      this._botones[attr] = out;
      return out;
    };
    Object.defineProperty(el, 'innerHTML', {
      get: function () { return this._html; },
      set: function (v) { this._html = v; this.hijos = []; this._botones = {}; }
    });
    return el;
  }
  function elem(id) {
    if (!elems[id]) elems[id] = nuevoElem(id);
    return elems[id];
  }
  var ctx = {
    document: { getElementById: function (id) { return elem(id); } },
    // El payload del Inicio, que la pagina lee del global. Lo usa D7
    // (contribucion al retorno): el costo por posicion no viaja en el
    // payload del analisis, solo en este. Dos posiciones bastan para que el
    // bloque se dibuje; lo que calcula lo prueba test-contribucion.js.
    lastData: {
      posiciones: [
        { symbol: 'GRANDE', nombre: 'Posicion grande', tipo: 'etf', valor: 16000, base: 10000 },
        { symbol: 'CHICA', nombre: 'Posicion chica', tipo: 'accion', valor: 300, base: 100 }
      ]
    },
    esc: function (s) { return String(s); },
    fmt: function (n) { return 'US$ ' + Math.round(Number(n)).toLocaleString('en-US'); },
    signoPct: function (v, d) { return (v >= 0 ? '+' : '') + Number(v).toFixed(d) + '%'; },
    msgBackend: function () { return 'Error del backend.'; },
    msgErr: function (err) { return String((err && err.message) || err); },
    nombrePlataforma: function (n) { return String(n || ''); },
    setView: function (v) { estado.vistas.push(v); },
    cargarConCache: function (cfg) {
      estado.cfg = cfg;
      cfg.pedir(function (r) { cfg.render(r); }, function () {});
    },
    google: { script: { run: (function () {
      function mk() {
        var oks = [], fails = [];
        var api = {
          withSuccessHandler: function (f) { oks.push(f); return api; },
          withFailureHandler: function (f) { fails.push(f); return api; },
          getAnalisis: function (args) {
            estado.pedidos.push(args);
            oks.forEach(function (f) { f(RESPUESTA); });
          },
          guardarPerfil: function (args) {
            estado.perfiles.push(args);
            var r = estado.respuestaPerfil || { ok: true, perfil: args.perfil };
            oks.forEach(function (f) { f(r); });
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
  // esFilaCash va REAL, no como doble: "qué es cash" es una regla de negocio
  // que tiene que coincidir con la del Worker, y un doble probaría la idea
  // que tiene el arnés en vez de la que corre. `fmt` y `signoPct` en cambio
  // son formateadores y quedan como dobles en `ctx` — el real arrastra la
  // maquinaria de ocultar montos, que no tiene nada que ver con esto.
  var deNucleo = ['var SIMBOLOS_CASH = \\[[^\\]]*\\];', 'function esFilaCash[\\s\\S]*?\\n\\}']
    .map(function (re) {
      var m = html.match(new RegExp(re));
      if (!m) { console.log('  FALLA: no encuentro en nucleo.js: ' + re); process.exit(1); }
      return m[0];
    }).join('\n');
  var fn = new Function(nombres.join(','),
    deNucleo + '\n' + codigo + '\nreturn { render: renderAnalisis, renderDetalle: renderAnalisisDetalle, cargar: cargarAnalisis, ' +
    'cargarDetalle: cargarAnalisisDetalle, cargado: function () { return anaCargado; }, ' +
    'anaDesgloseHtml: anaDesgloseHtml, sugerido: anaPerfilSugerido, ' +
    'abrirTest: function () { anxTestAbierto = true; anxRespuestas = [0,0,0,0,0,0]; renderPerfilCard(anaUltima); } };');
  estado.api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));
  estado.elem = elem;
  return estado;
}

console.log('\nA) la tarjeta RESUMEN: puntaje, perfil, numeros duros y semaforo compacto');
var m = montar();
m.api.render(RESPUESTA);
var h = m.elem('anaBody').innerHTML;
ok(/Acceptable/.test(h) && /70\/100/.test(h), 'nivel y puntaje');
ok(/class="anabarra"><i style="width:70%/.test(h), 'la barra del puntaje mide lo que dice el puntaje');
ok(/Measured against your <b>Moderate<\/b> profile/.test(h), 'dice contra que perfil se midio');
ok(/Positions<\/span><b>8<\/b>/.test(h), 'cantidad de posiciones');
ok(/equivalent to 5\.4 pairs/.test(h), 'posiciones efectivas (1/HHI) explicadas');
ok(/Top 5<\/span><b>78\.0%/.test(h), 'top 5 en porcentaje');
ok(/Volatility<\/span><b>18\.3%/.test(h), 'volatilidad anualizada');
ok(/Worst drawdown<\/span><b>26\.4%/.test(h), 'peor caida');
ok(/3 checks against your profile: 1 risk, 1 to watch, 1 ok/.test(h), 'el semaforo resumido cuenta bien');

// [DADOS VUELTA 26/08/2026] La lista completa de chequeos y el desglose del
// puntaje se MUDARON a la pagina Analysis: la tarjeta es un resumen que se
// toca. Estos asserts fijan que no vuelvan a la tarjeta por accidente.
console.log('\nB) la tarjeta ya NO pinta el detalle: eso vive en la pagina Analysis');
ok(!/anachk/.test(h), 'la lista de chequeos no esta en la tarjeta');
ok(!/anadesglose/.test(h) && !/Starting point/.test(h), 'el desglose del puntaje tampoco');
ok(/Tap for the full analysis/.test(h), 'y la tarjeta invita a abrir el detalle');

console.log('\nC) navegacion: la tarjeta y su titulo abren la pagina Analysis');
m.elem('anaBody').onclick();
ok(m.vistas[m.vistas.length - 1] === 'analisis', 'tocar el cuerpo de la tarjeta -> setView(analisis)');
m.elem('anaTitulo').disparar('click');
ok(m.vistas[m.vistas.length - 1] === 'analisis', 'tocar el titulo -> setView(analisis)');
m.elem('anxBack').onclick();
ok(m.vistas[m.vistas.length - 1] === 'portafolio', 'Back -> setView(portafolio)');
ok(/var VIEWS = \[[^\]]*'analisis'/.test(html), 'la vista esta en VIEWS (setView la puede mostrar y esconder)');
ok(/name === 'analisis' \? 'portafolio'/.test(html), 'en la barra queda encendida Portfolio, como Posiciones con Inicio');

console.log('\nD) la pagina Analysis: desglose abierto, clases, sectores y chequeos');
m.api.renderDetalle(RESPUESTA);
var hd = m.elem('anxBody').innerHTML;
ok(/Acceptable/.test(hd) && /70\/100/.test(hd), 'el mismo puntaje que la tarjeta');
ok(/anadesglose/.test(hd) && /Starting point/.test(hd) && /70\/100/.test(hd), 'el desglose del puntaje, SIEMPRE abierto');
ok(/What you hold/.test(hd) && /Broad index ETFs/.test(hd) && /52\.0%/.test(hd), 'las clases finas con su porcentaje');
ok(/class="pista"><i style="width:52%/.test(hd), 'la barra de cada clase es proporcional');
ok(/Core \(broad index \+ dividend ETFs\): 62\.0%/.test(hd), 'la linea del nucleo');
ok(/Sectors, looking inside each ETF/.test(hd) && /Technology/.test(hd) && /41\.0%/.test(hd), 'los sectores con look-through');
ok(/Measured over the 84\.0% of your equity/.test(hd), 'con cobertura parcial, se dice sobre cuanto se midio');
ok(/anachk riesgo/.test(hd) && /anachk atencion/.test(hd) && /anachk ok/.test(hd), 'los tres estados pintan su color');
ok(/Largest single company/.test(hd) && /NVDA is 33\.3%/.test(hd), 'titulo y detalle salen tal cual del backend');
ok(/10\/02\/2026/.test(hd) && /05\/04\/2026/.test(hd), 'las fechas de la peor caida, en dd/mm/aaaa');
// D9: la peor caida ya no viaja sola. Lo que detalla el bloque lo prueba
// test-caida.js; aca solo se verifica que la pagina lo INCLUYA — si alguien
// saca la llamada, las fechas de arriba seguirian pasando y el bloque
// desapareceria sin que nada se ponga en rojo.
ok(/Distance from your high/.test(hd), 'la pagina incluye el bloque de distancia al maximo');
ok(/18 days below it/.test(hd), 'con los dias bajo el agua, que es lo que la peor caida no dice');
ok(/not a buy or sell recommendation/.test(hd), 'queda dicho que no es una recomendacion');

console.log('\nE) la tarjeta del perfil: estado actual, eleccion directa y recarga');
var hp = m.elem('anxPerfilBody').innerHTML;
ok(/Your profile: <b>Moderate<\/b>/.test(hp) && /from your test/.test(hp), 'dice el perfil vigente y de donde salio');
ok(/data-perfil="conservative"/.test(hp) && /data-perfil="aggressive"/.test(hp), 'los tres perfiles se pueden elegir directo');
ok(/active-acento/.test(hp) && !/active-compra/.test(hp), 'el elegido usa active-acento (la clase de Trades es SOLO de Trades)');
var botones = m.elem('anxPerfilBody')._botones['data-perfil'];
var antesPedidos = m.pedidos.length;
botones.filter(function (b) { return b.getAttribute('data-perfil') === 'aggressive'; })[0].onclick();
ok(m.perfiles.length === 1 && m.perfiles[0].perfil === 'aggressive' && m.perfiles[0].origen === 'manual',
  'elegir directo llama perfil_set con origen manual');
ok(m.pedidos.length === antesPedidos + 1 && m.pedidos[m.pedidos.length - 1].forzar === true,
  'y tras guardar se recalcula el analisis con forzar (el backend ya invalido su cache)');

console.log('\nF) el test de 6 preguntas: la capacidad le pone el techo a la disposicion');
ok(m.api.sugerido([3, 3, 3, 3, 3, 3]) === 'aggressive', 'todo al maximo -> agresivo');
ok(m.api.sugerido([1, 3, 3, 3, 3, 3]) === 'conservative',
  'plata que se necesita en <3 anios -> conservador AUNQUE la disposicion sea maxima (regla CFA)');
ok(m.api.sugerido([3, 3, 3, 1, 1, 2]) === 'conservative', 'disposicion baja -> conservador aunque haya capacidad');
ok(m.api.sugerido([2, 3, 3, 3, 2, 2]) === 'moderate', 'mezcla razonable -> moderado');

console.log('\nG) el flujo del test: contestar todo, ver la sugerencia, guardar con su rastro');
m.api.abrirTest();
var ht = m.elem('anxPerfilBody').innerHTML;
ok(/When do you expect to need most of this money\?/.test(ht) && /What is the main goal/.test(ht), 'las 6 preguntas se pintan');
ok(!/data-guardar/.test(ht), 'sin contestar todo, NO hay botones de guardar');
for (var q = 0; q < 6; q++) {
  var ops = m.elem('anxPerfilBody')._botones['data-q'] || m.elem('anxPerfilBody').querySelectorAll('button[data-q]');
  ops.filter(function (b) { return b.getAttribute('data-q') === String(q); })[2].onclick(); // siempre la 3ra opcion
}
ht = m.elem('anxPerfilBody').innerHTML;
ok(/Suggested for your answers: <b>Aggressive<\/b>/.test(ht), 'contestado todo, aparece la sugerencia');
ok(/data-guardar="conservative"/.test(ht), 'y se puede pisar la sugerencia con otro perfil (es su decision)');
var guardarBtns = m.elem('anxPerfilBody')._botones['data-guardar'] || m.elem('anxPerfilBody').querySelectorAll('button[data-guardar]');
guardarBtns.filter(function (b) { return b.getAttribute('data-guardar') === 'aggressive'; })[0].onclick();
var ultimo = m.perfiles[m.perfiles.length - 1];
ok(ultimo.perfil === 'aggressive' && ultimo.origen === 'test' && ultimo.sugerido === 'aggressive',
  'guardar desde el test viaja con origen test y la sugerencia');
ok(Array.isArray(ultimo.respuestas) && ultimo.respuestas.join(',') === '3,3,3,3,3,3',
  'y con las respuestas, para poder revisar de donde salio');

console.log('\nH) sin perfil guardado: la tarjeta y la pagina invitan a hacer el test');
var m2 = montar();
var SIN = JSON.parse(JSON.stringify(RESPUESTA));
SIN.perfil = { valor: 'moderate', label: 'Moderate', porDefecto: true, origen: null };
m2.api.render(SIN);
ok(/No investor profile set yet/.test(m2.elem('anaBody').innerHTML), 'la tarjeta dice que corre con el de defecto');
m2.api.renderDetalle(SIN);
ok(/You haven’t set a profile yet/.test(m2.elem('anxPerfilBody').innerHTML) && /Take the test/.test(m2.elem('anxPerfilBody').innerHTML),
  'la pagina ofrece el test');

console.log('\nI) respuestas viejas del cache (sin los campos nuevos) no rompen nada');
var VIEJA = {
  ok: true, puntaje: 70, nivel: 'Acceptable',
  concentracion: { posiciones: 8, efectivas: 5.4, top5: 0.78 },
  riesgo: { volAnual: null, drawdown: null },
  chequeos: []
};
m2.api.render(VIEJA);
ok(/70\/100/.test(m2.elem('anaBody').innerHTML), 'la tarjeta pinta sin perfil ni clases');
m2.api.renderDetalle(VIEJA);
var hv = m2.elem('anxBody').innerHTML;
ok(/70\/100/.test(hv) && !/What you hold/.test(hv) && !/Sectors,/.test(hv),
  'el detalle omite las secciones cuyo dato no llego, sin inventar');
ok(/Volatility<\/span><b>—/.test(hv) && /not enough history/.test(hv), 'sin historial, guion y explicacion');

console.log('\nJ) la carga y el boton de actualizar');
m = montar();
m.api.cargar(false);
ok(m.pedidos.length === 1 && m.pedidos[0].forzar === false, 'pide el analisis al entrar');
ok(m.cfg.clave === 'ga_cache_ana' && m.cfg.bodyId === 'anaBody', 'usa su propio cache local');
ok(/70\/100/.test(m.elem('anxBody').innerHTML), 'CADA respuesta pinta tambien la pagina Analysis (nunca desincronizadas)');
m.elem('anaRefreshBtn').onclick();
ok(m.pedidos.length === 2 && m.pedidos[1].forzar === true, 'el boton de la tarjeta fuerza el recalculo');
m.elem('anxRefreshBtn').onclick();
ok(m.pedidos.length === 3 && m.pedidos[2].forzar === true, 'el de la pagina Analysis tambien');
m.api.render({ ok: false, mensajes: ['x'] });
ok(/Error del backend/.test(m.elem('anaBody').innerHTML), 'una respuesta con error se muestra, no rompe');
ok(m.api.cargado() === false, 'el ok:false resetea anaCargado: la proxima visita reintenta sola');

console.log('\nZ) el desglose explica el puntaje y la cuenta CIERRA');
var m3 = montar();
var R2 = JSON.parse(JSON.stringify(RESPUESTA));
var d = m3.api.anaDesgloseHtml(R2);
ok(d.indexOf('Starting point') !== -1 && d.indexOf('>100<') !== -1, 'dice desde cuanto arranca');
ok(/&minus;20/.test(d) && /&minus;10/.test(d), 'muestra el descuento de cada chequeo flojo');
ok(d.indexOf('70/100') !== -1, 'y el total al que se llega');
R2.chequeos.forEach(function (q) {
  ok(d.indexOf(q.titulo) !== -1, 'aparece el chequeo "' + q.titulo + '"');
  ok(d.indexOf(q.detalle) !== -1, 'con SU comentario, que es lo que se pidio');
});
ok(/anadesg-fila riesgo/.test(d) && /anadesg-fila atencion/.test(d),
  'cada fila lleva su color de semaforo, igual que los chequeos');
ok(d.indexOf('This is our mistake') === -1, 'la cuenta cierra: base menos descuentos da el puntaje mostrado');
var R3 = JSON.parse(JSON.stringify(R2));
R3.puntaje = 55;   // a proposito, incoherente con los descuentos
ok(m3.api.anaDesgloseHtml(R3).indexOf('This is our mistake') !== -1,
  'y si NO cerrara, lo dice en vez de mostrar dos numeros distintos sin explicacion');
var R4 = JSON.parse(JSON.stringify(RESPUESTA));
delete R4.puntajeBase;
R4.chequeos.forEach(function (q) { delete q.resta; });
var d4 = m3.api.anaDesgloseHtml(R4);
ok(/updated/.test(d4) && !/Starting point/.test(d4),
  'sin el dato del backend avisa, en vez de calcular una cuenta inventada');
ok(/not a buy or sell recommendation/i.test(d), 'aclara que no es una recomendacion de compra ni venta');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
