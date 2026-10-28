// El seguimiento del pedido a Itau (bancos.js, itauSeguir) — 24/09/2026.
//
// Auditoria del 23/09/2026 (A15), dos cosas:
//  1. Despues de salir de la pantalla de la cuenta seguia preguntando cada
//     3 s, desde el Inicio, hasta que la PC terminara.
//  2. El refresco al terminar no corria NUNCA: el boton sube itauActivo y
//     llama a itauSeguir, que empezaba con itauParar(), que lo bajaba.
var fs = require('fs');
var path = require('path');
var ruta = require('./_ruta');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (cond) console.log('  ok   ' + msg);
  else { fallos++; console.log('  FALLA: ' + msg); }
}

var src = fs.readFileSync(path.join(ruta.RUTA, 'js', 'bancos.js'), 'utf8');
var ini = src.indexOf('var ITAU_ESPERA_MS');
var fin = src.indexOf('\n(function () {', src.indexOf('function itauSeguir'));
if (ini < 0 || fin < 0) { console.log('  FALLA: no encontre itauSeguir en bancos.js'); console.log('1 asserts, 1 fallas'); process.exit(1); }
var codigo = src.slice(ini, fin);

function montar(cfg) {
  var estado = { preguntas: 0, timers: [], syncs: 0, respuestas: cfg.respuestas.slice() };
  var caja = { hidden: false };
  var ctx = {
    document: { getElementById: function (id) { return id === 'accItau' ? caja : { disabled: false, innerHTML: '', textContent: '' }; } },
    esc: function (s) { return String(s); },
    setTimeout: function (fn) { estado.timers.push(fn); return estado.timers.length; },
    clearTimeout: function () {},
    sincronizarTodo: function (o) { estado.syncs++; estado.syncArgs = o; },
    google: { script: { run: {
      withSuccessHandler: function (ok) {
        return { withFailureHandler: function () { return { itauEstado: function () {
          estado.preguntas++;
          ok(estado.respuestas.shift());
        } }; } };
      }
    } } },
    currentView: 'account'
  };
  var nombres = Object.keys(ctx);
  estado.api = new Function(nombres.join(','), codigo +
    '\nreturn { seguir: itauSeguir, activar: function () { itauActivo = true; }, salir: function () { currentView = "inicio"; } };')
    .apply(null, nombres.map(function (n) { return ctx[n]; }));
  estado.caja = caja;
  estado.tick = function () { var t = estado.timers.shift(); if (t) t(); };
  return estado;
}

console.log('\nA) al terminar bien, la pantalla se refresca (el refresco que no corria nunca)');
var m = montar({ respuestas: [{ estado: 'actualizando' }, { estado: 'listo', mensaje: 'Updated.' }] });
m.api.activar();          // lo que hace el boton antes de llamar a itauSeguir
m.api.seguir();
m.tick();
ok(m.preguntas === 2, 'pregunto hasta que termino');
ok(m.syncs === 1 && m.syncArgs && m.syncArgs.sinItau === true, 'y al terminar refresco la cartera, sin volver a pedir Itau');

console.log('\nB) fuera de la pantalla de la cuenta deja de preguntar');
m = montar({ respuestas: [{ estado: 'actualizando' }, { estado: 'actualizando' }, { estado: 'actualizando' }] });
m.api.activar();
m.api.seguir();
ok(m.timers.length === 1, 'mientras sigue en curso, programa la proxima pregunta');
m.api.salir();            // volvio al Inicio
m.tick();
ok(m.preguntas === 2 && m.timers.length === 0, 'la pregunta que ya estaba en camino se contesta y no se programa otra');
ok(m.syncs === 0, 'y no refresca nada desde otra pantalla');

console.log('\nC) abrir la cuenta con un resultado VIEJO no dispara una recarga');
m = montar({ respuestas: [{ estado: 'listo', mensaje: 'Updated.' }] });
m.api.seguir();           // sin activar: nadie apreto el boton en esta pantalla
ok(m.syncs === 0, 'solo muestra el estado');

console.log('\nD) el resultado dice DE CUANDO es (9/10/2026, auditoria)');
// "Fund updated: 712.44 UYU per unit." no decia cuando: puede ser de dias
// atras. Se usa horaDelDato, la del renglon Today (tablero.js, la real).
var tablero = fs.readFileSync(path.join(ruta.RUTA, 'js', 'tablero.js'), 'utf8');
var hdd = (tablero.match(/function horaDelDato\(ms, ahora\) \{[\s\S]*?\n\}/) || [''])[0];
ok(!!hdd, 'encuentro horaDelDato en tablero.js');
var textoDe = new Function('esc', 'document', 'google', 'setTimeout', 'clearTimeout', hdd + '\n' + codigo + '\nreturn itauTexto;')(
  function (s) { return String(s); }, { getElementById: function () { return null; } }, {}, function () {}, function () {});
var finAyer = new Date(2026, 9, 8, 14, 5, 0).getTime();
var t = textoDe({ estado: 'listo', mensaje: 'Fund updated: 712.44 UYU per unit.', fin: finAyer });
ok(/Fund updated: 712\.44 UYU per unit\. <span class="detsec">as of Oct 8, 2:05\s?PM<\/span>/.test(t), 'el resultado lleva "as of" con el dia y la hora: ' + t);
ok(!/as of/.test(textoDe({ estado: 'listo', mensaje: 'Updated.' })), 'sin hora del fin no inventa una');
ok(!/as of/.test(textoDe({ estado: 'error', mensaje: 'Bad password.', fin: finAyer })), 'un error no lleva "as of" (no hay dato nuevo)');
ok(!/UYU today/.test(src), 'la tabla del fondo ya no dice "today" del precio (puede ser de dias atras)');

// La lectura automatica apagada (28/10/2026): Itau pide un token a la PC
// desde el 16/10 y Guzman carga el fondo a mano. La pantalla lo dice y no
// sigue un pedido que nadie atiende.
var fsI = require('fs'), pathI = require('path');
var bancosSrc = fsI.readFileSync(pathI.join(ruta.RUTA, 'js', 'bancos.js'), 'utf8');
var vistasSrc = fsI.readFileSync(pathI.join(ruta.RUTA, 'js', 'vistas.js'), 'utf8');
ok(/var ITAU_AUTOMATICO = false;/.test(bancosSrc), 'la lectura automatica de Itau esta apagada');
ok(/if \(ITAU_AUTOMATICO\) itauSeguir\(\); else itauManual\(\);/.test(vistasSrc), 'la pantalla de Itau usa la carga manual cuando esta apagada');
ok(/Edit prices/.test(bancosSrc.slice(bancosSrc.indexOf('function itauManual'))), 'y dice con que boton se carga');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
