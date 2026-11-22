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
// La tarjeta compacta (9/09/2026): el boton vive al lado del titulo, y desde
// que se pide el cuerpo se abre a todo el ancho (clase podfull).
ok(podBody.className === 'podfull', 'al pedir, el cuerpo pasa a todo el ancho (podfull)');
ok(run.estado.pedido && run.estado.pedido.forzar === false, 'primer pedido: forzar:false');

console.log('\nC) exito: reproductor con el audio del backend + el guion escapado + Regenerate');
run.estado.onOk({ ok: true, guion: 'Hola, buenas tardes. <b>Test</b> & mas', audioBase64: 'QUJD', mime: 'audio/mpeg' });
ok(podBody.innerHTML.indexOf('data:audio/mpeg;base64,QUJD') !== -1, 'el audio va como data: URI con el base64 que mando el backend');
ok(podBody.innerHTML.indexOf('&lt;b&gt;Test&lt;/b&gt; &amp; mas') !== -1, 'el guion se escapa (no es HTML de confianza)');
// Bucle de mejora, vuelta 3 (22/11/2026): el guion va plegado en un
// <details> cerrado y el audio queda afuera, a la vista.
var plegado = /<details class="rannota"><summary>Script<\/summary>([\s\S]*?)<\/details>/.exec(podBody.innerHTML);
ok(!!plegado && plegado[1].indexOf('&lt;b&gt;Test&lt;/b&gt; &amp; mas') !== -1, 'el guion (escapado) va dentro de <details><summary>Script');
ok(!/<details[^>]*\bopen\b/.test(podBody.innerHTML), 'el <details> del guion arranca cerrado (sin open)');
ok(!!plegado && plegado[1].indexOf('<audio') === -1 && podBody.innerHTML.indexOf('<audio') < podBody.innerHTML.indexOf('<details'), 'el audio queda fuera del plegado, antes del guion');
ok(typeof btn._onclick === 'function', 'Regenerate queda enganchado');
ok(/class="ghostbtn mini" id="podcastRegen"/.test(podBody.innerHTML), 'Regenerate es el boton chico, como el de generar');

console.log('\nD) Regenerate pide con forzar:true');
btn._onclick();
ok(run.estado.pedido && run.estado.pedido.forzar === true, 'el reintento pide forzar:true');

console.log('\nE) error del backend: mensaje + boton para reintentar (sin forzar)');
run.estado.onOk({ ok: false, mensajes: ['El modelo declinó armar el guion.'] });
ok(podBody.innerHTML.indexOf('El modelo declinó armar el guion.') !== -1, 'muestra el mensaje del backend');
ok(/class="ghostbtn mini" id="podcastBtn">Generate<\/button>/.test(podBody.innerHTML), 'y el boton para reintentar es el chico, con el mismo texto que el de index.html');
btn._onclick();
ok(run.estado.pedido && run.estado.pedido.forzar === false, 'el reintento tras un error NO hereda el forzar de antes');

console.log('\nF) sin clave de Anthropic: aviso especifico, no el mensaje crudo del backend');
run.estado.onOk({ ok: false, sinClave: true, mensajes: ['Falta configurar tu clave de Anthropic en Configuración → IA Insights.'] });
ok(podBody.innerHTML.indexOf('AI Insights') !== -1, 'el aviso manda a configurar la clave, en vez de repetir el texto del backend');
// La pagina se llama Connections desde el 24/09/2026 (v231): ningun texto de
// trade.js puede seguir mandando a "Configuration →" (vuelta 3, 22/11/2026).
ok(podBody.innerHTML.indexOf('Connections → AI Insights') !== -1, 'el aviso nombra la pagina de hoy: Connections → AI Insights');
var tradeJs = require('fs').readFileSync(require('path').join(ruta.RUTA, 'js', 'trade.js'), 'utf8');
ok(tradeJs.indexOf('Configuration →') === -1, 'no queda "Configuration →" en js/trade.js');

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

console.log('\nI) el informe semanal (22/11/2026): guion primero, la voz tramo por tramo, y el audio se arma en el telefono');
// El backend nuevo manda el guion partido en tramos y SIN audio; cada tramo se
// pide aparte (getPodcastAudio) y la app los pega en un blob.
var podBody3 = nodo('div'), btn3 = nodo('button');
var est3 = { guion: null, audios: [] };
function mkRun3(ok, fail) {
  return {
    withSuccessHandler: function (f) { return mkRun3(f, fail); },
    withFailureHandler: function (f) { return mkRun3(ok, f); },
    getPodcast: function (args) { est3.guion = { args: args, ok: ok, fail: fail }; },
    getPodcastAudio: function (args) { est3.audios.push({ args: args, ok: ok, fail: fail }); }
  };
}
var blobs = [], urls = 0, revocadas = 0;
var ctx3 = Object.assign({}, ctx, {
  document: { getElementById: function (id) { return id === 'podcastBody' ? podBody3 : btn3; } },
  google: { script: { run: mkRun3(null, null) } },
  atob: function (s) { return Buffer.from(s, 'base64').toString('binary'); },
  Blob: function (partes, opts) { this.partes = partes; this.type = opts && opts.type; blobs.push(this); },
  URL: { createObjectURL: function () { urls++; return 'blob:podcast-' + urls; }, revokeObjectURL: function () { revocadas++; } }
});
var fn3 = new Function(Object.keys(ctx3).join(','), codigo + '\nreturn { generarPodcast: generarPodcast };');
var api3 = fn3.apply(null, Object.keys(ctx3).map(function (k) { return ctx3[k]; }));
api3.generarPodcast(false);
est3.guion.ok({ ok: true, id: 'g1', nTramos: 3, palabras: 2250, guion: 'Valeria: Buenas.' });
ok(est3.audios.length === 2, 'pide los tramos de a DOS a la vez, no los tres de una: ' + est3.audios.length);
ok(est3.audios[0].args.i === 0 && est3.audios[1].args.i === 1 && est3.audios[0].args.id === 'g1', 'con su numero y el id del guion');
ok(/Recording the voices\.\.\. 0 of 3/.test(podBody3.innerHTML), 'dice cuantos tramos lleva grabados');
// Llegan desordenados: el 1 antes que el 0. El audio igual queda en orden.
est3.audios[1].ok({ ok: true, partes: [Buffer.from([2]).toString('base64')], motor: 'gemini' });
ok(est3.audios.length === 3 && est3.audios[2].args.i === 2, 'al terminar uno, pide el siguiente');
ok(/1 of 3/.test(podBody3.innerHTML), 'y avanza el progreso');
est3.audios[2].ok({ ok: true, partes: [Buffer.from([3]).toString('base64'), Buffer.from([4]).toString('base64')], motor: 'chirp' });
est3.audios[0].ok({ ok: true, partes: [Buffer.from([1]).toString('base64')], motor: 'gemini' });
ok(blobs.length === 1 && blobs[0].type === 'audio/mpeg', 'arma UN blob de audio');
ok(JSON.stringify(blobs[0].partes.map(function (u) { return Array.from(u); })) === '[[1],[2],[3],[4]]',
  'con los tramos en ORDEN aunque hayan llegado desordenados, y cada pedazo como bytes');
ok(podBody3.innerHTML.indexOf('src="blob:podcast-1"') !== -1, 'el reproductor usa el blob, no un data: gigante');
ok(/about 15 min/.test(podBody3.innerHTML), 'dice cuanto dura (2.250 palabras a 150 por minuto)');
ok(/Standard voices/.test(podBody3.innerHTML), 'si algun tramo salio con la voz de respaldo, lo avisa');
ok(/<details class="rannota"><summary>Script/.test(podBody3.innerHTML) && /id="podcastRegen"/.test(podBody3.innerHTML), 'guion plegado y Regenerate, como siempre');
// Regenerar libera el blob anterior.
btn3._onclick();
est3.guion.ok({ ok: true, id: 'g2', nTramos: 1, palabras: 100, guion: 'x' });
est3.audios[est3.audios.length - 1].ok({ ok: true, partes: [Buffer.from([9]).toString('base64')], motor: 'gemini' });
ok(revocadas === 1 && podBody3.innerHTML.indexOf('blob:podcast-2') !== -1, 'el audio anterior se libera de la memoria');
ok(!/Standard voices/.test(podBody3.innerHTML), 'con todo en voz natural no hay aviso');
// El blob tiene que poder reproducirse: la CSP de index.html no dejaba cargar
// audio desde blob: ("Media load rejected by URL safety check", corrida real
// del 22/11/2026). Sin esto, el reproductor aparece y no suena.
var csp = (/media-src ([^;]*);/.exec(html) || [])[1] || '';
ok(csp.indexOf('blob:') !== -1, 'la CSP deja reproducir el audio armado en el telefono (media-src con blob:): ' + csp);
// Un tramo que falla corta todo con su mensaje y deja reintentar.
btn3._onclick();
est3.guion.ok({ ok: true, id: 'g3', nTramos: 2, palabras: 300, guion: 'x' });
var n0 = est3.audios.length;
est3.audios[n0 - 2].ok({ ok: false, mensajes: ['El guion cambió mientras se grababa.'] });
ok(/El guion cambió/.test(podBody3.innerHTML) && /id="podcastBtn">Generate/.test(podBody3.innerHTML), 'un tramo fallido muestra el motivo y el boton para reintentar');
est3.audios[n0 - 1].ok({ ok: true, partes: ['QQ=='], motor: 'gemini' });
ok(/El guion cambió/.test(podBody3.innerHTML), 'y lo que llega despues del corte no pisa el error');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
