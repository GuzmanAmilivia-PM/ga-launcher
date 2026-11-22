// Las notificaciones push del telefono, EJECUTADAS (9/10/2026, auditoria).
//
// Hasta hoy el telefono se suscribia solo al guardar una alerta de precio, y
// la tarjeta decia "Alerts will notify this phone" por un dato guardado
// (ga_push_ok) que nunca se borraba. Si iOS cambiaba la suscripcion, el Worker
// la borraba al primer 404/410 y la pantalla seguia diciendo que andaba; y
// desde v243 ese push es el UNICO recordatorio del corte de BTG del dia 7.
// Aca corre la seccion de push de js/watchlist.js con un navegador de mentira
// (serviceWorker.ready, pushManager, Notification) y un google.script.run que
// anota cada registrarPush.
var fs = require('fs');
var path = require('path');
var ruta = require('./_ruta');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

var wl = fs.readFileSync(path.join(ruta.RUTA, 'js', 'watchlist.js'), 'utf8');
var iVapid = wl.indexOf('var VAPID_PUBLIC =');
var ini = wl.indexOf('function wlB64aBytes(s) {');
var fin = wl.indexOf("document.getElementById('wlPushProbar').onclick");
if (iVapid < 0 || ini < 0 || fin < 0) { console.log('  FALLA: no encuentro la seccion de push en watchlist.js'); console.log('1 asserts, 1 fallas'); process.exit(1); }
var codigo = wl.slice(iVapid, wl.indexOf('\n', iVapid) + 1) + wl.slice(ini, fin);

function montar(cfg) {
  cfg = cfg || {};
  var est = { registros: [], suscripciones: 0, ahora: Date.UTC(2026, 9, 9, 15, 0, 0), store: Object.assign({}, cfg.storage || {}) };
  var elems = {};
  // La tarjeta de la Watchlist nace oculta en el index.html (vuelta 2 del bucle,
  // 22/11/2026): el mock arranca igual, asi "se ve" prueba que el codigo la
  // mostro y no que nadie la toco. La seccion G vigila que el HTML diga eso.
  elems.wlPushCard = { id: 'wlPushCard', innerHTML: '', style: { display: 'none' } };
  function el(id) {
    if (!elems[id]) elems[id] = { id: id, innerHTML: '', style: {}, disabled: false, onclick: null, click: function () { if (this.onclick) this.onclick(); } };
    return elems[id];
  }
  var sub = cfg.sub === undefined ? null : cfg.sub;   // la suscripcion que tiene el navegador
  est.subscribeFalla = !!cfg.subscribeFalla;
  var Notif = { permission: cfg.permiso || 'granted',
    requestPermission: function () { Notif.permission = cfg.respuestaPermiso || 'granted'; return Promise.resolve(Notif.permission); } };
  var reg = { pushManager: {
    getSubscription: function () { return Promise.resolve(sub); },
    subscribe: function () {
      if (est.subscribeFalla) return Promise.reject(new Error('NotAllowedError'));
      est.suscripciones++;
      sub = { toJSON: function () { return { endpoint: 'https://push.example/nueva', keys: {} }; } };
      return Promise.resolve(sub);
    } } };
  function D() { return arguments.length ? new (Function.prototype.bind.apply(Date, [null].concat([].slice.call(arguments))))() : new Date(est.ahora); }
  D.now = function () { return est.ahora; };
  var run = {
    _ok: null,
    withSuccessHandler: function (f) { run._ok = f; return run; },
    withFailureHandler: function () { return run; },
    registrarPush: function (a) { est.registros.push(a); var f = run._ok; if (f) f({ ok: true }); }
  };
  var ctx = {
    document: { getElementById: el },
    navigator: cfg.sinPush ? {} : { serviceWorker: { ready: Promise.resolve(reg) } },
    window: cfg.sinPush ? {} : { PushManager: function () {}, Notification: Notif },
    Notification: Notif,
    localStorage: {
      getItem: function (k) { return k in est.store ? est.store[k] : null; },
      setItem: function (k, v) { est.store[k] = String(v); },
      removeItem: function (k) { delete est.store[k]; }
    },
    atob: function (s) { return Buffer.from(s, 'base64').toString('binary'); },
    Uint8Array: Uint8Array, Promise: Promise, Date: D,
    getApiToken: function () { return cfg.sinClave ? '' : 'x'; },
    google: { script: { run: run } }
  };
  var nombres = Object.keys(ctx);
  var fn = new Function(nombres.join(','), codigo +
    '\nreturn { revisarPush: revisarPush, suscribirPush: suscribirPush, pintarEstadoPush: pintarEstadoPush };');
  est.api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));
  est.el = el;
  est.Notif = Notif;
  est.texto = function () { return el('wlPushEstado').innerHTML; };
  est.boton = function () { return el('wlPushActivar').style.display !== 'none'; };
  est.prueba = function () { return el('wlPushProbar').style.display !== 'none'; };
  est.tarjeta = function () { return el('wlPushCard').style.display !== 'none'; };
  est.ajustes = function () { return el('cfgPushEstado').innerHTML; };
  return est;
}
function espera() { return new Promise(function (r) { setTimeout(r, 10); }); }
var SUB = { toJSON: function () { return { endpoint: 'https://push.example/vieja', keys: {} }; } };

(async function () {
  console.log('\nA) con permiso y suscripcion viva: se re-registra, una vez por dia');
  var m = montar({ sub: SUB });
  // Como si un estado anterior la hubiera mostrado: "oculta" tiene que ser obra
  // del codigo, no el valor con que arranca el mock.
  m.el('wlPushCard').style.display = '';
  await m.api.revisarPush(); await espera();
  ok(m.registros.length === 1 && m.registros[0].sub.endpoint === 'https://push.example/vieja', 'al abrir se re-registra la suscripcion que tiene el navegador');
  ok(/price alerts, sharp moves in your positions, and the BTG reminder on the 7th/.test(m.texto()), 'el estado nombra los tres avisos: ' + m.texto());
  ok(m.prueba() && !m.boton(), 'con el boton de prueba, sin el de activar');
  ok(!m.tarjeta(), 'todo anda: la tarjeta de la Watchlist queda oculta');
  ok(/^On: this phone gets alerts even with the app closed\.$/.test(m.ajustes()), 'y Settings dice el estado en una linea corta: ' + m.ajustes());
  await m.api.revisarPush(); await espera();
  ok(m.registros.length === 1, 'otra apertura el mismo dia no vuelve a escribir en el Worker');
  m.ahora += 25 * 3600 * 1000;
  await m.api.revisarPush(); await espera();
  ok(m.registros.length === 2, 'al otro dia, si (el registro alla es un upsert)');

  console.log('\nB) el navegador perdio la suscripcion: se rehace sola');
  m = montar({ sub: null, storage: { ga_push_reg: String(Date.UTC(2026, 9, 9, 14, 0, 0)) } });
  await m.api.revisarPush(); await espera();
  ok(m.suscripciones === 1, 'sin suscripcion, se suscribe sin pedir nada');
  ok(m.registros.length === 1 && m.registros[0].sub.endpoint === 'https://push.example/nueva', 'y registra la NUEVA aunque hoy ya se haya registrado otra');
  ok(/This phone gets/.test(m.texto()), 'y la tarjeta queda en "funciona"');

  console.log('\nC) suscribir sin un toque falla: la tarjeta lo dice y ofrece el boton');
  m = montar({ sub: null, subscribeFalla: true, storage: { ga_push_ok: '1' } });
  await m.api.revisarPush(); await espera();
  ok(!/This phone gets/.test(m.texto()) && /not reaching this phone/.test(m.texto()), 'no dice que anda (la marca vieja ga_push_ok no manda): ' + m.texto());
  ok(m.boton() && !m.prueba(), 'muestra "Enable notifications" y no el de prueba');
  ok(m.tarjeta() && /Off on this phone/.test(m.ajustes()), 'la tarjeta de la Watchlist se ve (hay algo que hacer) y Settings no dice "On": ' + m.ajustes());
  ok(m.el('wlPushActivar') && m.store.ga_push_ok === undefined, 'la marca vieja se borra');
  m.subscribeFalla = false;
  m.el('wlPushActivar').click(); await espera(); await espera();
  ok(m.suscripciones === 1 && m.registros.length === 1 && /This phone gets/.test(m.texto()), 'el toque suscribe, registra y la tarjeta vuelve a "funciona"');
  ok(!m.tarjeta() && /^On:/.test(m.ajustes()) && m.prueba(), 'y entonces la tarjeta se va y Settings pasa a "On" con el boton de prueba');

  console.log('\nD) sin permiso todavia: el boton lo pide dentro del toque');
  m = montar({ permiso: 'default', sub: null });
  await m.api.revisarPush(); await espera();
  ok(m.suscripciones === 0 && m.registros.length === 0, 'sin permiso no se suscribe solo (iOS exige el toque)');
  ok(/Turn on notifications to get price alerts/.test(m.texto()) && m.boton(), 'invita a activarlas, con el boton: ' + m.texto());
  ok(m.tarjeta() && !m.prueba(), 'sin permiso la tarjeta de la Watchlist se ve, con su boton (iOS pide el toque ahi)');
  m.el('wlPushActivar').click(); await espera(); await espera();
  ok(m.Notif.permission === 'granted' && m.suscripciones === 1 && m.registros.length === 1, 'el toque pide permiso, suscribe y registra');
  m = montar({ permiso: 'default', respuestaPermiso: 'denied', sub: null });
  m.el('wlPushActivar').click(); await espera(); await espera();
  ok(m.suscripciones === 0 && /blocked/.test(m.texto()), 'si dice que no, queda "blocked" y no se suscribe');
  ok(m.tarjeta() && /Off on this phone/.test(m.ajustes()), 'y la tarjeta sigue a la vista para decirlo');

  console.log('\nE) bordes');
  m = montar({ permiso: 'denied', sub: SUB });
  await m.api.revisarPush(); await espera();
  ok(m.registros.length === 0 && /blocked/.test(m.texto()), 'bloqueadas: no se registra nada');
  ok(m.tarjeta() && !m.prueba(), 'bloqueadas: la tarjeta se ve (Settings de iOS), sin boton de prueba');
  m = montar({ sinClave: true, sub: SUB });
  await m.api.revisarPush(); await espera();
  ok(m.registros.length === 0, 'sin la clave de la API no se le escribe al Worker');
  ok(!m.tarjeta() && /Checking/.test(m.ajustes()), '"Checking" es pasajero: no saca la tarjeta (no parpadea al abrir) y Settings lo dice');
  m = montar({ sinPush: true });
  await m.api.revisarPush();
  ok(/cannot receive push/.test(m.texto()) && !m.boton(), 'sin PushManager el estado es honesto y sin boton');
  ok(m.tarjeta() && /Off on this phone/.test(m.ajustes()), 'sin PushManager (no instalada en la pantalla de inicio) la tarjeta se ve');

  console.log('\nF) quien la llama');
  var arr = fs.readFileSync(path.join(ruta.RUTA, 'js', 'arranque.js'), 'utf8');
  var seg = fs.readFileSync(path.join(ruta.RUTA, 'js', 'seguridad.js'), 'utf8');
  // ALCANCE: el codigo escrito (el arranque y el desbloqueo tienen sus arneses).
  ok(/revisarPush\(\)/.test(arr) && /if \(typeof revisarPush === 'function'\) revisarPush\(\);/.test(seg), 'el arranque y el desbloqueo la llaman');
  ok(/id="wlPushActivar"/.test(fs.readFileSync(ruta.INDEX, 'utf8')), 'el boton existe en el index.html');

  console.log('\nG) donde vive cada cosa (bucle de mejora, vuelta 2, 22/11/2026)');
  var html = fs.readFileSync(ruta.INDEX, 'utf8');
  // Una vista va desde su <div id="view-..."> hasta el comienzo de la siguiente.
  function vista(nombre) {
    var i = html.indexOf('<div id="view-' + nombre + '"');
    if (i < 0) return '';
    var j = html.indexOf('<div id="view-', i + 10);
    return html.slice(i, j < 0 ? html.length : j);
  }
  function veces(id) { return (html.match(new RegExp('id="' + id + '"', 'g')) || []).length; }
  var vWl = vista('watchlist'), vSet = vista('diseno');
  ok(/<div class="card" id="wlPushCard" style="display:none">/.test(vWl), 'la tarjeta de la Watchlist nace oculta (sin parpadeo de "Checking...")');
  var tarjetaHtml = vWl.slice(vWl.indexOf('id="wlPushCard"'));
  ok(/id="wlPushEstado"/.test(tarjetaHtml) && /id="wlPushActivar"/.test(tarjetaHtml), 'el mensaje y "Enable notifications" siguen en esa tarjeta (el toque de iOS se da ahi)');
  ok(!/id="wlPushProbar"/.test(vWl) && !/id="wlPushMsg"/.test(vWl), 'el boton de prueba ya no esta en la Watchlist');
  ok(/id="cfgPushEstado"/.test(vSet) && /id="wlPushProbar"/.test(vSet) && /id="wlPushMsg"/.test(vSet), 'Settings tiene la linea de estado, el boton de prueba y su mensaje');
  ok(['wlPushCard', 'wlPushEstado', 'wlPushActivar', 'wlPushProbar', 'wlPushMsg', 'cfgPushEstado'].every(function (id) { return veces(id) === 1; }), 'cada id una sola vez en el documento (se movio, no se duplico)');

  console.log('\nH) el boton de prueba, apretado desde Settings');
  var iP = wl.indexOf("document.getElementById('wlPushProbar').onclick");
  var fP = wl.indexOf('}).probarPush();', iP);
  var bloque = wl.slice(iP, wl.indexOf('\n};', fP) + 3);
  var pedidos = 0, els = {};
  function elP(id) { if (!els[id]) els[id] = { id: id, innerHTML: '', style: {}, disabled: false, onclick: null }; return els[id]; }
  var runP = { _ok: null,
    withSuccessHandler: function (f) { runP._ok = f; return runP; },
    withFailureHandler: function () { return runP; },
    probarPush: function () { pedidos++; runP._ok({ ok: true, dispositivos: 1 }); } };
  new Function('document,google,esc,msgErr', bloque)(
    { getElementById: elP }, { script: { run: runP } },
    function (s) { return String(s); }, function (e, q) { return q + ' failed'; });
  var probar = elP('wlPushProbar');
  if (probar.onclick) probar.onclick.call(probar);
  ok(/id="wlPushProbar"/.test(vSet) && pedidos === 1 && /Sent to 1 device\(s\)/.test(elP('wlPushMsg').innerHTML) && !probar.disabled,
    'desde Settings, el toque pide la prueba al Worker y deja el resultado debajo: ' + elP('wlPushMsg').innerHTML);

  console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
  process.exit(fallos ? 1 : 0);
})();
