// El aviso del Inicio (#autoAviso, paneles.js) y su temporizador (24/09/2026).
//
// Auditoria del 23/09/2026 (A15): el aviso OK se borraba a los 8 s con un
// temporizador que no se guardaba. Si enseguida llegaba un error —la sync de
// Binance dice "synced" y la recarga que dispara falla—, a los 8 s ese
// temporizador viejo borraba el ERROR, y quedaban datos viejos sin aviso.
var fs = require('fs');
var path = require('path');
var ruta = require('./_ruta');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (cond) console.log('  ok   ' + msg);
  else { fallos++; console.log('  FALLA: ' + msg); }
}

var src = fs.readFileSync(path.join(ruta.RUTA, 'js', 'paneles.js'), 'utf8');
var ini = src.indexOf('var avisoInicioTimer');
var fin = src.indexOf('\n}\n', src.indexOf('function avisoInicio', ini));
if (ini < 0 || fin < 0) { console.log('  FALLA: no encontre avisoInicio en paneles.js'); console.log('1 asserts, 1 fallas'); process.exit(1); }
var codigo = src.slice(ini, fin + 2);

function montar() {
  var timers = [];
  var el = { style: {}, innerHTML: '' };
  var ctx = {
    document: { getElementById: function (id) { return id === 'autoAviso' ? el : null; } },
    setTimeout: function (fn) { timers.push({ fn: fn, vivo: true }); return timers.length; },
    clearTimeout: function (h) { if (h && timers[h - 1]) timers[h - 1].vivo = false; }
  };
  var nombres = Object.keys(ctx);
  var api = new Function(nombres.join(','), codigo + '\nreturn { avisoInicio: avisoInicio };')
    .apply(null, nombres.map(function (n) { return ctx[n]; }));
  return {
    el: el, api: api,
    pasar8s: function () { timers.forEach(function (t) { if (t.vivo) { t.vivo = false; t.fn(); } }); }
  };
}

console.log('\nA) un OK se va solo a los 8 s');
var m = montar();
m.api.avisoInicio('Binance synced', true);
ok(m.el.style.display === '' && /synced/.test(m.el.innerHTML), 'se muestra');
m.pasar8s();
ok(m.el.style.display === 'none' && m.el.innerHTML === '', 'y a los 8 s se va');

console.log('\nB) un error que llega DESPUES de un OK no lo borra el temporizador del OK');
m = montar();
m.api.avisoInicio('Binance synced', true);
m.api.avisoInicio('&#9888; Could not reach the server', false);
m.pasar8s();
ok(m.el.style.display === '' && /Could not reach/.test(m.el.innerHTML), 'el error sigue a la vista: ' + m.el.innerHTML);

console.log('\nC) dos OK seguidos: cuenta el ultimo');
m = montar();
m.api.avisoInicio('uno', true);
m.api.avisoInicio('dos', true);
ok(/dos/.test(m.el.innerHTML), 'se ve el segundo');
m.pasar8s();
ok(m.el.style.display === 'none', 'y se va una vez, sin dejar un temporizador colgado');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
