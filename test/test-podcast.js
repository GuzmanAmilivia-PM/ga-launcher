// Arnés del podcast diario de noticias (30/08/2026, trade.js). Mismo patrón
// UX que analizarIA (ia.js): botón -> loadingtxt -> éxito/error, con
// reintento. El guion (Claude) y la voz (Google Cloud Text-to-Speech) los
// arma el backend; acá solo se prueba que la PWA pinte bien cada resultado.
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var codigo = ruta.bloque(html,
  '// ---------- Podcast diario de noticias (30/08/2026) ----------',
  '// ---------- Resultados de las empresas (V11) ----------');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

function nodo(tag) {
  var n = { tag: tag, atributos: {}, _html: '', _onclick: null,
    setAttribute: function (k, v) { n.atributos[k] = v; } };
  Object.defineProperty(n, 'innerHTML', {
    get: function () { return n._html; },
    set: function (v) { n._html = v; }
  });
  Object.defineProperty(n, 'onclick', {
    get: function () { return n._onclick; },
    set: function (v) { n._onclick = v; }
  });
  return n;
}

// UN solo par de nodos para toda la corrida: en el HTML real solo existe UN
// boton a la vez dentro de #podcastBody (Generate / Regenerate, nunca los
// dos juntos), asi que devolverlo por cualquiera de sus dos ids alcanza —
// evita el error de reemplazar el mock a mitad de un pedido en vuelo y que
// el resultado se pinte sobre un nodo que nadie mira.
var podBody = nodo('div');
var btn = nodo('button');

// El shim google.script.run: guarda el ultimo pedido y expone success/
// failure para que el test dispare la respuesta cuando quiera.
function mkRun() {
  var estado = { pedido: null, onOk: null, onFail: null };
  var api = {
    withSuccessHandler: function (f) { estado.onOk = f; return api; },
    withFailureHandler: function (f) { estado.onFail = f; return api; },
    getPodcast: function (args) { estado.pedido = args; }
  };
  return { api: api, estado: estado };
}

var run = mkRun();
var ctx = {
  document: { getElementById: function (id) {
    if (id === 'podcastBody') return podBody;
    if (id === 'podcastBtn' || id === 'podcastRegen') return btn;
    return null;
  } },
  google: { script: { run: run.api } },
  esc: function (s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); },
  msgBackend: function (r) { return ((r && r.mensajes) || ['could not sync']).join(' '); },
  msgErr: function (err, sujeto) { return (sujeto || 'Error') + ': ' + ((err && err.message) || err); }
};
var fn = new Function(Object.keys(ctx).join(','), codigo + '\nreturn { generarPodcast: generarPodcast };');
fn.apply(null, Object.keys(ctx).map(function (k) { return ctx[k]; }));

console.log('\nA) el boton de index.html queda enganchado SIN esperar al primer click');
ok(typeof btn._onclick === 'function', 'wirePodcastBtn corre al cargar el bloque, no recien al usarlo');

console.log('\nB) click -> estado de carga -> pedido sin forzar');
btn._onclick();
ok(/loadingtxt/.test(podBody.innerHTML), 'pinta el estado de carga de inmediato');
ok(run.estado.pedido && run.estado.pedido.forzar === false, 'primer pedido: forzar:false');

console.log('\nC) exito: reproductor con el audio del backend + el guion escapado + Regenerate');
run.estado.onOk({ ok: true, guion: 'Hola, buenas tardes. <b>Test</b> & mas', audioBase64: 'QUJD', mime: 'audio/mpeg' });
ok(podBody.innerHTML.indexOf('data:audio/mpeg;base64,QUJD') !== -1, 'el audio va como data: URI con el base64 que mando el backend');
ok(podBody.innerHTML.indexOf('&lt;b&gt;Test&lt;/b&gt; &amp; mas') !== -1, 'el guion se escapa (no es HTML de confianza)');
ok(typeof btn._onclick === 'function', 'Regenerate queda enganchado');

console.log('\nD) Regenerate pide con forzar:true');
btn._onclick();
ok(run.estado.pedido && run.estado.pedido.forzar === true, 'el reintento pide forzar:true');

console.log('\nE) error del backend: mensaje + boton para reintentar (sin forzar)');
run.estado.onOk({ ok: false, mensajes: ['El modelo declinó armar el guion.'] });
ok(podBody.innerHTML.indexOf('El modelo declinó armar el guion.') !== -1, 'muestra el mensaje del backend');
btn._onclick();
ok(run.estado.pedido && run.estado.pedido.forzar === false, 'el reintento tras un error NO hereda el forzar de antes');

console.log('\nF) sin clave de Anthropic: aviso especifico, no el mensaje crudo del backend');
run.estado.onOk({ ok: false, sinClave: true, mensajes: ['Falta configurar tu clave de Anthropic en Configuración → IA Insights.'] });
ok(podBody.innerHTML.indexOf('AI Insights') !== -1, 'el aviso manda a configurar la clave, en vez de repetir el texto del backend');

console.log('\nG) fallo de red: pasa por msgErr con el sujeto correcto, no un dump del error');
btn._onclick();
run.estado.onFail({ message: 'Load failed' });
ok(podBody.innerHTML.indexOf('The podcast') !== -1, 'usa msgErr con "The podcast" como sujeto');

console.log('\nH) reentrancia: un click mientras hay un pedido en vuelo no dispara otro');
var run2 = mkRun();
var podBody2 = nodo('div'), btn2 = nodo('button');
var ctx2 = Object.assign({}, ctx, {
  document: { getElementById: function (id) { return id === 'podcastBody' ? podBody2 : btn2; } },
  google: { script: { run: run2.api } }
});
var fn2 = new Function(Object.keys(ctx2).join(','), codigo + '\nreturn { generarPodcast: generarPodcast };');
var api2 = fn2.apply(null, Object.keys(ctx2).map(function (k) { return ctx2[k]; }));
api2.generarPodcast(false);
var pedidoUno = run2.estado.pedido;
api2.generarPodcast(false); // "otro click" mientras el primero sigue cargando
ok(run2.estado.pedido === pedidoUno, 'el segundo click no pisa/duplica el pedido en vuelo');
run2.estado.onOk({ ok: true, guion: 'listo', audioBase64: 'QQ==', mime: 'audio/mpeg' });
api2.generarPodcast(false);
ok(run2.estado.pedido !== pedidoUno, 'una vez resuelto el primero, un click nuevo SI pide de nuevo');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
