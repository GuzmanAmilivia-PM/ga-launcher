// Comportamiento de la pantalla de arranque con bloqueo local (biometria/clave).
// Es la pantalla que dejo a Guzman afuera de su app tres veces seguidas, asi
// que va cubierta: se evaluan JUNTOS el bloque de nucleo.js que manda sobre el
// splash y todo seguridad.js, con un DOM de mentira que recuerda cada id.
//
// Reglas que se prueban (las que pidio Guzman el 16/08/2026):
//   - UNA sola pantalla de arranque: el splash ES el bloqueo, no se va hasta
//     que se entra, y la clave de la API no se apila encima.
//   - La biometria manda: la clave local no se ofrece hasta que el Face ID
//     falla, y despues de varios fallos se pasa sola.
//   - Ninguna falla puede dejarte afuera: siempre hay salida de emergencia.
var ruta = require('./_ruta');
var fs = require('fs');
var path = require('path');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

var html = ruta.leerIndex();
// El bloque de nucleo.js que gobierna el splash (appBloqueada, hideSplash,
// mostrarLock y la cola de la clave vencida).
var NUCLEO = ruta.bloque(html, '// El splash es AHORA la unica pantalla de arranque', 'function apiCall');
// GA_CACHES (la lista unica de caches con datos) vive en paneles.js y
// confirmarDosToques en nucleo.js: se extraen las definiciones REALES para
// que el test vigile las de verdad.
var GA_CACHES_SRC = (fs.readFileSync(path.join(ruta.RUTA, 'js', 'paneles.js'), 'utf8')
  .match(/var GA_CACHES = \[[^\]]*\];/) || [''])[0];
var DOS_TOQUES_SRC = (html.match(/function confirmarDosToques[\s\S]*?\n\}/) || [''])[0];
var SEG = GA_CACHES_SRC + '\n' + DOS_TOQUES_SRC + '\n' + fs.readFileSync(path.join(ruta.RUTA, 'js', 'seguridad.js'), 'utf8');

// --- DOM de mentira: un objeto por id, con listeners que se pueden disparar ---
function elemento(id) {
  return {
    id: id, style: {}, textContent: '', innerHTML: '', value: '', disabled: false,
    _l: {},
    classList: {
      _c: {},
      add: function (c) { this._c[c] = true; },
      remove: function (c) { delete this._c[c]; },
      contains: function (c) { return !!this._c[c]; }
    },
    addEventListener: function (t, fn) { (this._l[t] = this._l[t] || []).push(fn); },
    disparar: function (t, ev) { (this._l[t] || []).forEach(function (fn) { fn(ev); }); },
    focus: function () {}, click: function () { if (this.onclick) this.onclick(); }
  };
}

// Monta el escenario y devuelve con que mirarlo.
function montar(store, bioGet, bioDispo, antes) {
  var els = {};
  var pedidos = [];      // cada llamada a navigator.credentials.get
  var timers = [];
  var ctx = {
    document: {
      getElementById: function (id) { return els[id] || (els[id] = elemento(id)); },
      addEventListener: function () {}
    },
    localStorage: {
      getItem: function (k) { return (k in store) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    setTimeout: function (fn) { timers.push(fn); return timers.length; },
    AbortController: function () { var self = this; this.signal = { abortado: false }; this.abort = function () { self.signal.abortado = true; }; },
    navigator: { credentials: {
      create: function () { return Promise.reject(new Error('no')); },
      get: function (o) { pedidos.push(o); return bioGet(o); }
    } },
    PublicKeyCredential: { isUserVerifyingPlatformAuthenticatorAvailable: function () { return Promise.resolve(bioDispo); } },
    isSecureContext: true,
    location: { hostname: 'guzmanamilivia-pm.github.io', reload: function () {} },
    crypto: {
      getRandomValues: function (a) { return a; },
      subtle: { digest: function () { return Promise.resolve(new Uint8Array(32).buffer); } }
    },
    btoa: function (s) { return Buffer.from(s, 'binary').toString('base64'); },
    atob: function (s) { return Buffer.from(s, 'base64').toString('binary'); },
    TextEncoder: TextEncoder,
    getApiToken: function () { return store.ga_token || ''; },
    setView: function () {},
    console: console,
    Promise: Promise, JSON: JSON, Math: Math, Object: Object, Array: Array, String: String,
    Number: Number, Boolean: Boolean, RegExp: RegExp, Error: Error, Uint8Array: Uint8Array,
    parseInt: parseInt, isFinite: isFinite
  };
  ctx.window = ctx;
  if (antes) antes(ctx);   // p. ej. dejar window.__bioArranque como lo deja el <head>
  var fn = new Function('__c', 'with (__c) {\n' + NUCLEO + '\n' + SEG + '\n' +
    '__c.__estado = function () { return { appBloqueada: appBloqueada, lockPendiente: lockPendiente }; };\n' +
    '__c.__mostrarLock = function (m) { return mostrarLock(m); };\n' +
    '__c.__hideSplash = function () { return hideSplash(); };\n}');
  fn(ctx);
  return {
    els: els, pedidos: pedidos, ctx: ctx,
    estado: function () { return ctx.__estado(); },
    correrTimers: function () { timers.splice(0).forEach(function (f) { f(); }); },
    el: function (id) { return els[id] || (els[id] = elemento(id)); }
  };
}
function tick() { return new Promise(function (res) { setImmediate(res); }); }
var SEC_BIO = JSON.stringify({ bio: 'AAAA' });
var SEC_BIO_PIN = JSON.stringify({ bio: 'AAAA', pin: 'hash-de-la-clave' });
var okBio = function () { return Promise.resolve({ id: 'AAAA' }); };
function falla(nombre) { return function () { var e = new Error('x'); e.name = nombre; return Promise.reject(e); }; }

(async function () {
  console.log('\nA) una sola pantalla: el bloqueo vive dentro del splash');
  var r = montar({ ga_token: 'tk', ga_sec: SEC_BIO }, okBio, true);
  ok(r.estado().appBloqueada === true, 'la app queda marcada como bloqueada');
  ok(r.el('splashLock').style.display === '', 'el bloqueo se muestra dentro del splash');
  ok(!r.el('seclock').style.display, 'ya no existe una segunda pantalla #seclock');
  r.ctx.__hideSplash();
  ok(r.el('splash').classList.contains('hide') === false, 'el splash NO se puede ocultar mientras pide entrar');

  console.log('\nB) arranca solo con Face ID, sin tocar nada');
  await tick();
  r.correrTimers();                      // el intento automatico (setTimeout 350)
  await tick();
  ok(r.pedidos.length === 1, 'pidio la biometria sola');
  ok(r.el('splashLock').style.display === 'none', 'entro sin tocar el boton');
  ok(r.estado().appBloqueada === false, 'la app deja de estar bloqueada');

  console.log('\nC) la clave de la API espera su turno (no se apila encima)');
  var r2 = montar({ ga_token: 'tk', ga_sec: SEC_BIO }, okBio, true);
  r2.ctx.__mostrarLock('Clave incorrecta o vencida.');   // la API contesta mientras esta bloqueada
  ok(r2.el('splashToken').style.display !== '', 'con el Face ID en pantalla, la clave NO aparece');
  ok(r2.estado().lockPendiente === 'Clave incorrecta o vencida.', 'queda encolada');
  await tick();
  r2.correrTimers();
  await tick();
  ok(r2.el('splashToken').style.display === '', 'aparece recien despues de desbloquear');
  ok(r2.el('lockErr').textContent === 'Clave incorrecta o vencida.', 'y dice por que la pide');

  console.log('\nD) el intento automatico rechazado no es un fallo del sensor (pero deja el motivo a la vista)');
  var r3 = montar({ ga_token: 'tk', ga_sec: SEC_BIO }, falla('NotAllowedError'), true);
  await tick();
  r3.correrTimers();
  await tick();
  ok(r3.el('secErr').textContent.indexOf('Tap anywhere') === 0 && r3.el('secErr').textContent.indexOf('NotAllowedError') !== -1,
    'invita a tocar y dice el motivo real del rechazo (desde el 14/09/2026, para no adivinar desde la PC)');
  // Decia "Tocá para desbloquear" — un cartel que aparecia SOLO despues del
  // intento automatico fallido, o sea que el boton cambiaba solo delante de
  // Guzmán y parecia que algo se habia colgado (reporte del 22/08/2026). Ahora
  // el texto es el mismo antes y despues; lo que se custodia es que nombre la
  // acción, no la palabra exacta.
  ok(/Face ID/.test(r3.el('secBioGo').textContent), 'el boton dice que hace: ' + r3.el('secBioGo').textContent);
  ok(r3.estado().appBloqueada === true, 'sigue bloqueada');
  var antes = r3.pedidos.length;
  r3.el('splash').disparar('click', { target: { id: 'splash' } });
  await tick();
  ok(r3.pedidos.length === antes + 1, 'un toque en cualquier parte reintenta');

  console.log('\nE) la clave local aparece SOLO cuando el Face ID falla');
  var r4 = montar({ ga_token: 'tk', ga_sec: SEC_BIO_PIN }, falla('NotAllowedError'), true);
  await tick();
  ok(r4.el('secPinWrap').style.display === 'none', 'al abrir no se ofrece la clave');
  ok(r4.el('secModo').style.display === 'none', 'ni el link "Usar la clave"');
  r4.el('secBioGo').click();             // fallo 1
  await tick();
  ok(r4.el('secModo').style.display === '', 'al primer fallo aparece el link a la clave');
  ok(r4.el('secPinWrap').style.display === 'none', 'pero la biometria sigue mandando');
  r4.el('secBioGo').click();             // fallo 2
  await tick();
  r4.el('secBioGo').click();             // fallo 3
  await tick();
  ok(r4.el('secPinWrap').style.display === '', 'al tercer fallo pasa a la clave solo');
  ok(/Didn.t recognize you/.test(r4.el('secErr').textContent), 'y explica por que');

  console.log('\nF) nadie queda afuera');
  ok(r4.el('secOlvide').style.display === '', 'la salida de emergencia esta siempre a la vista');
  var r5 = montar({ ga_token: 'tk', ga_sec: SEC_BIO }, okBio, false);   // sin sensor
  await tick();
  ok(/is not available/.test(r5.el('secErr').textContent), 'sin sensor y sin clave, avisa y deja la salida');
  var r6 = montar({ ga_token: 'tk', ga_sec: SEC_BIO_PIN }, okBio, false);
  await tick();
  ok(r6.el('secPinWrap').style.display === '', 'sin sensor pero con clave, ofrece la clave directo');

  console.log('\nF2) el borrado de emergencia no deja NINGUN dato financiero');
  // Hallazgo de auditoria (19/08/2026): "Olvide mi clave" prometia fallar
  // cerrado pero dejaba vivos ga_cache_ops (hasta 500 trades con montos) y
  // ga_cache_ana — nacieron despues de la lista de borrado. Ahora la lista
  // unica GA_CACHES (paneles.js) los cubre a todos.
  ok(GA_CACHES_SRC !== '', 'GA_CACHES existe en paneles.js (lista unica de caches)');
  var storeF2 = {
    ga_token: 'tk', ga_sec: SEC_BIO_PIN, ga_bnb: 'clave-binance', ga_bnb_ultima: 'ayer',
    ga_cache_data: '{"data":1}', ga_cache_div: '{"data":1}', ga_cache_apo: '{"data":1}',
    ga_cache_ops: '{"data":[500,"trades"]}', ga_cache_ana: '{"data":1}'
  };
  var rF2 = montar(storeF2, falla('NotAllowedError'), true);
  await tick();
  rF2.el('secOlvide').click();          // primer toque: pide confirmacion
  ok(Object.keys(storeF2).length === 9, 'el primer toque solo confirma, no borra');
  rF2.el('secOlvide').click();          // segundo toque: borra de verdad
  ['ga_sec', 'ga_token', 'ga_bnb', 'ga_bnb_ultima', 'ga_cache_data', 'ga_cache_div',
   'ga_cache_apo', 'ga_cache_ops', 'ga_cache_ana'].forEach(function (k) {
    ok(!(k in storeF2), 'borra ' + k);
  });

  console.log('\nG) una peticion colgada no tranca la pantalla');
  var r7 = montar({ ga_token: 'tk', ga_sec: SEC_BIO }, function () { return new Promise(function () {}); }, true);
  await tick();
  r7.correrTimers();
  await tick();
  ok(r7.pedidos[0].signal.abortado === false, 'queda una peticion viva');
  r7.el('secBioGo').click();
  await tick();
  ok(r7.pedidos[0].signal.abortado === true, 'tocar el boton aborta la anterior');
  ok(r7.pedidos.length === 2, 'y reintenta de cero');
  ok(r7.el('secBioGo').disabled === false, 'el boton nunca queda deshabilitado');

  console.log('\nG2) una hoja de Face ID abierta no se aborta con un toque perdido');
  // Reporte de Guzman (19/08/2026): Face ID aparecia DOS veces seguidas. El
  // toque de abrir la app caia sobre la pantalla de bloqueo con el intento
  // automatico ya en vuelo, y el intento nuevo abortaba la hoja y la reabria.
  var r7b = montar({ ga_token: 'tk', ga_sec: SEC_BIO }, function () { return new Promise(function () {}); }, true);
  await tick();
  r7b.correrTimers();       // el intento automatico queda en vuelo
  await tick();
  ok(r7b.pedidos.length === 1 && r7b.pedidos[0].signal.abortado === false, 'hay una hoja de Face ID abierta');
  r7b.el('splash').disparar('click', { target: { id: 'splash' } });
  await tick();
  ok(r7b.pedidos.length === 1 && r7b.pedidos[0].signal.abortado === false, 'un toque NO la aborta ni abre otra');
  // El orden inverso: el usuario toca ANTES de que dispare el automatico.
  var r7c = montar({ ga_token: 'tk', ga_sec: SEC_BIO }, function () { return new Promise(function () {}); }, true);
  await tick();
  r7c.el('splash').disparar('click', { target: { id: 'splash' } });   // gesto del usuario
  await tick();
  r7c.correrTimers();       // el automatico de los 350 ms llega despues
  await tick();
  ok(r7c.pedidos.length === 1 && r7c.pedidos[0].signal.abortado === false, 'el automatico tardio tampoco pisa el intento del gesto');
  // El boton sigue siendo la salida: SI aborta la hoja viva y reintenta.
  r7c.el('secBioGo').click();
  await tick();
  ok(r7c.pedidos.length === 2 && r7c.pedidos[0].signal.abortado === true, 'el boton Desbloquear conserva el poder de destrabar');


  console.log('\nG3) el intento automatico se repite en cada apertura, aunque lo rechacen');
  // Hasta el 14/09/2026 un NotAllowedError rapido del automatico se anotaba
  // (ga_bio_auto = '0') y no se volvia a intentar nunca en el dispositivo:
  // la regla era de iOS <= 17.3. Desde iOS 17.4 no hace falta gesto (Apple lo
  // cambio por un limitador de frecuencia), y esa marca era lo que le dejaba a
  // Guzman el boton en vez de Face ID directo.
  function rechazo(nombre) {
    return function () { var e = new Error('no'); e.name = nombre; return Promise.reject(e); };
  }
  var store8 = { ga_token: 'tk', ga_sec: SEC_BIO };
  var r8 = montar(store8, rechazo('NotAllowedError'), true);
  await tick();
  r8.correrTimers();        // el intento automatico corre y lo rechaza el sistema
  await tick(); await tick();
  ok(r8.pedidos.length === 1, 'la primera vez lo intenta solo');
  ok(!('ga_bio_auto' in store8), 'y el rechazo NO se anota: nada apaga las proximas aperturas');
  ok(r8.el('secErr').textContent.indexOf('NotAllowedError') !== -1,
    'el motivo del rechazo queda a la vista en la pantalla de bloqueo');
  ok(r8.el('secBioGo').textContent.indexOf('Face ID') !== -1,
    'el boton queda claro sobre que hace, en vez de "Toca para desbloquear"');

  // Segunda apertura en el MISMO dispositivo: vuelve a intentar solo.
  var r8b = montar(store8, rechazo('NotAllowedError'), true);
  await tick();
  r8b.correrTimers();
  await tick(); await tick();
  ok(r8b.pedidos.length === 1, 'la segunda vez TAMBIEN lo intenta solo');
  // Y el toque sigue funcionando igual, y limpia el motivo anterior.
  r8b.el('secBioGo').click();
  await tick();
  ok(r8b.pedidos.length === 2, 'y tocar sigue pidiendo la biometria normalmente');

  // La marca vieja grabada en el telefono se borra al arrancar y no frena nada.
  var store9 = { ga_token: 'tk', ga_sec: SEC_BIO, ga_bio_auto: '0' };
  var r9 = montar(store9, function () { return Promise.resolve({}); }, true);
  await tick();
  r9.correrTimers();
  await tick(); await tick();
  ok(!('ga_bio_auto' in store9), 'la marca ga_bio_auto vieja se borra al arrancar');
  ok(r9.pedidos.length === 1, 'y con la marca puesta igual intenta solo');
  ok(r9.estado().appBloqueada === false, 'y la app abre sin tocar nada');

  // Un rechazo por OTRO motivo tampoco apaga nada ni cuenta como fallo.
  var store10 = { ga_token: 'tk', ga_sec: SEC_BIO };
  var r10 = montar(store10, rechazo('InvalidStateError'), true);
  await tick();
  r10.correrTimers();
  await tick(); await tick();
  ok(!('ga_bio_auto' in store10), 'otro error distinto tampoco se anota');
  ok(r10.el('secErr').textContent.indexOf('InvalidStateError') !== -1, 'y su nombre queda a la vista');

  console.log('\nG4) el arranque adelantado del <head> se adopta, no se duplica (v215)');
  // index.html pide Face ID desde el <head> y deja la promesa en
  // window.__bioArranque. Si seguridad.js pidiera OTRA, iOS rechazaria una de
  // las dos: se adopta la que ya esta en vuelo.
  function conHead(promesa) {
    var ab = { abortado: false }; ab.abort = function () { ab.abortado = true; };
    var head = { promesa: promesa, abort: ab, t0: 1 };
    return { head: head, antes: function (ctx) { ctx.__bioArranque = head; } };
  }
  var resolverHead; var h1 = conHead(new Promise(function (res) { resolverHead = res; }));
  var r11 = montar({ ga_token: 'tk', ga_sec: SEC_BIO }, okBio, true, h1.antes);
  await tick();
  r11.correrTimers();
  await tick();
  ok(r11.pedidos.length === 0, 'el automatico NO pide una segunda: adopta la del head');
  ok(r11.ctx.__bioArranque === null, 'y la consume (no se adopta dos veces)');
  ok(r11.estado().appBloqueada === true, 'mientras la hoja de iOS esta abierta, sigue bloqueada');
  r11.el('splash').disparar('click', { target: { id: 'splash' } });
  await tick();
  ok(r11.pedidos.length === 0 && h1.head.abort.abortado === false, 'un toque perdido tampoco la aborta ni pide otra');
  resolverHead({ id: 'AAAA' });
  await tick(); await tick();
  ok(r11.estado().appBloqueada === false, 'cuando Face ID responde, la app abre');
  // El boton sigue siendo la salida de una peticion colgada: aborta la del head.
  var h2 = conHead(new Promise(function () {}));
  var r12 = montar({ ga_token: 'tk', ga_sec: SEC_BIO }, function () { return new Promise(function () {}); }, true, h2.antes);
  await tick();
  r12.correrTimers();
  await tick();
  r12.el('secBioGo').click();
  await tick();
  ok(h2.head.abort.abortado === true && r12.pedidos.length === 1, 'el boton aborta la del head y pide de cero');
  // Si la del head fue rechazada, no cuenta como fallo y deja el motivo a la vista.
  var eHead = new Error('no'); eHead.name = 'NotAllowedError';
  var h3 = conHead(Promise.reject(eHead)); h3.head.promesa.catch(function () {});
  var r13 = montar({ ga_token: 'tk', ga_sec: SEC_BIO }, okBio, true, h3.antes);
  await tick();
  r13.correrTimers();
  await tick(); await tick();
  ok(r13.pedidos.length === 0 && r13.el('secErr').textContent.indexOf('NotAllowedError') !== -1 && r13.estado().appBloqueada === true,
    'un rechazo de la del head se trata como el del automatico: motivo a la vista, sigue bloqueada, sin pedir otra');

  console.log('\nG5) la ventana de 12 horas: entro hace poco, no se vuelve a pedir (v216)');
  var H12 = 12 * 60 * 60 * 1000;
  // Al entrar se anota la hora.
  var store14 = { ga_token: 'tk', ga_sec: SEC_BIO };
  var r14 = montar(store14, okBio, true);
  await tick(); r14.correrTimers(); await tick();
  ok(r14.estado().appBloqueada === false && Math.abs(Date.now() - parseInt(store14.ga_desbloqueo, 10)) < 5000,
    'al entrar queda anotada la hora del ingreso (ga_desbloqueo)');
  // Con un ingreso reciente, abrir no pide nada: ni bloqueo ni Face ID.
  var store15 = { ga_token: 'tk', ga_sec: SEC_BIO, ga_desbloqueo: String(Date.now() - 60 * 1000) };
  var r15 = montar(store15, okBio, true);
  await tick(); r15.correrTimers(); await tick();
  ok(r15.estado().appBloqueada === false && r15.pedidos.length === 0 && r15.el('splashLock').style.display !== '',
    'entro hace 1 minuto: la app abre sin bloqueo y sin pedir la biometria');
  // Con la clave tambien: la ventana es del bloqueo, no de la biometria.
  var store15b = { ga_token: 'tk', ga_sec: JSON.stringify({ pin: 'h' }), ga_desbloqueo: String(Date.now() - 11 * 60 * 60 * 1000) };
  var r15b = montar(store15b, okBio, true);
  ok(r15b.estado().appBloqueada === false, 'con solo clave y 11 h desde el ingreso, tampoco pide');
  // Vencida la ventana, pide como siempre.
  var store16 = { ga_token: 'tk', ga_sec: SEC_BIO, ga_desbloqueo: String(Date.now() - H12 - 1000) };
  var r16 = montar(store16, okBio, true);
  ok(r16.estado().appBloqueada === true, 'a las 12 h y un segundo, vuelve a pedir');
  // Un reloj que fue para atras (hora anotada en el futuro) no vale.
  var store17 = { ga_token: 'tk', ga_sec: SEC_BIO, ga_desbloqueo: String(Date.now() + 60 * 60 * 1000) };
  var r17 = montar(store17, okBio, true);
  ok(r17.estado().appBloqueada === true, 'una hora anotada en el futuro no cuenta: pide igual');
  // Basura en la clave tampoco.
  var store18 = { ga_token: 'tk', ga_sec: SEC_BIO, ga_desbloqueo: 'ayer' };
  var r18 = montar(store18, okBio, true);
  ok(r18.estado().appBloqueada === true, 'un valor que no es un numero no abre nada');

  console.log('\nH) sin bloqueo configurado, el splash se va normal');
  var r8 = montar({ ga_token: 'tk' }, okBio, true);
  ok(r8.estado().appBloqueada === false, 'no se bloquea nada');
  r8.ctx.__hideSplash();
  ok(r8.el('splash').classList.contains('hide') === true, 'el splash se oculta');

  console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
  process.exit(fallos ? 1 : 0);
})();
