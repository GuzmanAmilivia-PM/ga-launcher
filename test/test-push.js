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
  return est;
}
function espera() { return new Promise(function (r) { setTimeout(r, 10); }); }
var SUB = { toJSON: function () { return { endpoint: 'https://push.example/vieja', keys: {} }; } };

(async function () {
  console.log('\nA) con permiso y suscripcion viva: se re-registra, una vez por dia');
  var m = montar({ sub: SUB });
  await m.api.revisarPush(); await espera();
  ok(m.registros.length === 1 && m.registros[0].sub.endpoint === 'https://push.example/vieja', 'al abrir se re-registra la suscripcion que tiene el navegador');
  ok(/price alerts, sharp moves in your positions, and the BTG reminder on the 7th/.test(m.texto()), 'el estado nombra los tres avisos: ' + m.texto());
  ok(m.prueba() && !m.boton(), 'con el boton de prueba, sin el de activar');
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
  ok(m.el('wlPushActivar') && m.store.ga_push_ok === undefined, 'la marca vieja se borra');
  m.subscribeFalla = false;
  m.el('wlPushActivar').click(); await espera(); await espera();
  ok(m.suscripciones === 1 && m.registros.length === 1 && /This phone gets/.test(m.texto()), 'el toque suscribe, registra y la tarjeta vuelve a "funciona"');

  console.log('\nD) sin permiso todavia: el boton lo pide dentro del toque');
  m = montar({ permiso: 'default', sub: null });
  await m.api.revisarPush(); await espera();
  ok(m.suscripciones === 0 && m.registros.length === 0, 'sin permiso no se suscribe solo (iOS exige el toque)');
  ok(/Turn on notifications to get price alerts/.test(m.texto()) && m.boton(), 'invita a activarlas, con el boton: ' + m.texto());
  m.el('wlPushActivar').click(); await espera(); await espera();
  ok(m.Notif.permission === 'granted' && m.suscripciones === 1 && m.registros.length === 1, 'el toque pide permiso, suscribe y registra');
  m = montar({ permiso: 'default', respuestaPermiso: 'denied', sub: null });
  m.el('wlPushActivar').click(); await espera(); await espera();
  ok(m.suscripciones === 0 && /blocked/.test(m.texto()), 'si dice que no, queda "blocked" y no se suscribe');

  console.log('\nE) bordes');
  m = montar({ permiso: 'denied', sub: SUB });
  await m.api.revisarPush(); await espera();
  ok(m.registros.length === 0 && /blocked/.test(m.texto()), 'bloqueadas: no se registra nada');
  m = montar({ sinClave: true, sub: SUB });
  await m.api.revisarPush(); await espera();
  ok(m.registros.length === 0, 'sin la clave de la API no se le escribe al Worker');
  m = montar({ sinPush: true });
  await m.api.revisarPush();
  ok(/cannot receive push/.test(m.texto()) && !m.boton(), 'sin PushManager el estado es honesto y sin boton');

  console.log('\nF) quien la llama');
  var arr = fs.readFileSync(path.join(ruta.RUTA, 'js', 'arranque.js'), 'utf8');
  var seg = fs.readFileSync(path.join(ruta.RUTA, 'js', 'seguridad.js'), 'utf8');
  // ALCANCE: el codigo escrito (el arranque y el desbloqueo tienen sus arneses).
  ok(/revisarPush\(\)/.test(arr) && /if \(typeof revisarPush === 'function'\) revisarPush\(\);/.test(seg), 'el arranque y el desbloqueo la llaman');
  ok(/id="wlPushActivar"/.test(fs.readFileSync(ruta.INDEX, 'utf8')), 'el boton existe en el index.html');

  console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
  process.exit(fallos ? 1 : 0);
})();
