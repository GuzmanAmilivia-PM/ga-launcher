// El aviso de version nueva (9/10/2026, auditoria).
//
// Al publicar con la app abierta, el service worker nuevo toma el control
// (skipWaiting + claim) y nucleo.js mostraba "There's a new version" en
// #updateAviso, que vive en el INICIO: parado en Portfolio o en Trades no se
// veia, y el menu ya decia el numero nuevo con el codigo viejo corriendo.
// Ahora tambien va al aviso flotante, que se ve desde cualquier pantalla.
// Corre la app entera (_entorno.js) y dispara el 'controllerchange'.
var entorno = require('./_entorno');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

function montar(swControla) {
  var c = entorno.cargar({}, { swControla: swControla });
  var g = c.ambito;
  var elems = {};
  g.document.getElementById = function (id) {
    if (!elems[id]) { var e = entorno.elemento(); e.id = id; e.style = {}; e.hidden = true; elems[id] = e; }
    return elems[id];
  };
  var relojes = [];
  g.setTimeout = function (f, ms) { relojes.push(ms); return relojes.length; };
  var recargas = 0;
  g.location.reload = function () { recargas++; };
  return { c: c, g: g, el: g.document.getElementById, relojes: relojes, recargas: function () { return recargas; } };
}

console.log('\nA) con la app abierta llega una version nueva');
var m = montar(true);
ok(m.c.errores.length === 0, 'la app carga entera' + (m.c.errores.length ? ': ' + m.c.errores.join(' | ') : ''));
m.g.navigator.serviceWorker.__dispararSw('controllerchange');
var av = m.el('avisoFlotante');
ok(av.hidden === false && /new version of the app/.test(av.innerHTML), 'sale en el aviso flotante, visible desde cualquier pantalla: ' + av.innerHTML.slice(0, 60));
ok(/id="updateBtnFlot"/.test(av.innerHTML), 'con su boton Update');
ok(m.relojes.indexOf(6000) === -1, 'y no se va solo: queda hasta que se toca');
ok(m.el('updateAviso').style.display === '', 'el aviso del Inicio sigue ademas');
var upd = m.el('updateBtnFlot');
if (typeof upd.onclick === 'function') upd.onclick({ stopPropagation: function () {} });
ok(m.recargas() === 1, 'Update recarga la app con la version nueva');

console.log('\nB) la PRIMERA visita no es una actualizacion');
m = montar(false);
m.g.navigator.serviceWorker.__dispararSw('controllerchange');
ok(m.el('avisoFlotante').hidden === true && m.el('updateAviso').style.display !== '', 'el primer service worker que toma control no avisa nada');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
