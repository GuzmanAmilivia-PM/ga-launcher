// Editar a mano los precios de una posicion (V16), EJECUTADO (9/10/2026).
//
// La auditoria encontro un resto de A2 ("el resultado de lo que registras se
// esconde solo"): el "guardado" se escribia en la fila del detalle y la linea
// siguiente repinta la tabla de la cuenta (recargarCuentaAbierta), asi que el
// mensaje se iba en el mismo instante. Va al aviso flotante, como Trades y BTG.
// Corre wireEditPrecios de js/tablero.js con un DOM y un backend de mentira.
var fs = require('fs');
var path = require('path');
var ruta = require('./_ruta');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

var src = fs.readFileSync(path.join(ruta.RUTA, 'js', 'tablero.js'), 'utf8');
var ini = src.indexOf('function wireEditPrecios(td, pos) {');
var fin = src.indexOf('\n}\n', ini);
if (ini < 0 || fin < 0) { console.log('  FALLA: no encuentro wireEditPrecios en tablero.js'); console.log('1 asserts, 1 fallas'); process.exit(1); }
var codigo = src.slice(ini, fin + 2);

function montar(respuesta) {
  var est = { avisos: [], recargas: 0, pedidos: [] };
  var piezas = {};
  ['.detedit-abrir', '.detedit-form', '.detedit-pa', '.detedit-pc', '.detedit-msg', '.detedit-guardar', '.detedit-cerrar'].forEach(function (s) {
    piezas[s] = { value: '', textContent: '', hidden: true, disabled: false, onclick: null };
  });
  var td = { querySelector: function (s) { return piezas[s] || null; } };
  var run = {
    _ok: null, _fail: null,
    withSuccessHandler: function (f) { run._ok = f; return run; },
    withFailureHandler: function (f) { run._fail = f; return run; },
    editarPrecioManual: function (a) { est.pedidos.push(a); if (respuesta === 'FALLA') run._fail(new Error('x')); else run._ok(respuesta); }
  };
  var ctx = {
    google: { script: { run: run } },
    avisoFlotante: function (h, esOk) { est.avisos.push({ html: h, ok: esOk }); },
    // La recarga REAL vacia el tbody y arma filas nuevas: el mensaje de la
    // fila vieja desaparece con ella.
    recargarCuentaAbierta: function () { est.recargas++; piezas['.detedit-msg'].textContent = ''; piezas['.detedit-msg'].borrada = true; },
    msgBackend: function (r) { return ((r && r.mensajes) || []).join(' '); },
    esc: function (s) { return String(s).replace(/</g, '&lt;'); },
    Number: Number
  };
  var nombres = Object.keys(ctx);
  var wire = new Function(nombres.join(','), codigo + '\nreturn wireEditPrecios;').apply(null, nombres.map(function (n) { return ctx[n]; }));
  wire(td, { cuenta: 'ITAU', symbol: 'FONDO', precioActual: 712.44, precioCompra: 700 });
  est.piezas = piezas;
  return est;
}

console.log('\nA) guardar: el resultado va al aviso flotante, que sobrevive al repintado');
var m = montar({ ok: true, mensajes: ['FONDO: price 715 saved.'] });
m.piezas['.detedit-pa'].value = '715';
m.piezas['.detedit-guardar'].onclick();
ok(m.pedidos.length === 1 && m.pedidos[0].precioActual === 715 && m.pedidos[0].precioCompra === null, 'manda lo que se escribio');
ok(m.recargas === 1, 'repinta la cuenta con los numeros nuevos');
ok(m.avisos.length === 1 && m.avisos[0].ok === true && /FONDO: price 715 saved/.test(m.avisos[0].html), 'el resultado sale en el aviso flotante: ' + JSON.stringify(m.avisos));
m = montar({ ok: true });
m.piezas['.detedit-pc'].value = '690';
m.piezas['.detedit-guardar'].onclick();
ok(m.avisos.length === 1 && /Prices saved/.test(m.avisos[0].html), 'sin mensajes del Worker, dice "Prices saved."');

console.log('\nB) los errores se quedan en la fila (no hay repintado que los borre)');
m = montar({ ok: false, mensajes: ['That is not a price.'] });
m.piezas['.detedit-pa'].value = '-1';
m.piezas['.detedit-guardar'].onclick();
ok(m.piezas['.detedit-msg'].textContent === 'That is not a price.' && m.avisos.length === 0 && m.recargas === 0, 'un rechazo se lee al lado del formulario');
m = montar('FALLA');
m.piezas['.detedit-pa'].value = '715';
m.piezas['.detedit-guardar'].onclick();
ok(/could not save/.test(m.piezas['.detedit-msg'].textContent) && m.piezas['.detedit-guardar'].disabled === false, 'un fallo de red tambien, y el boton se suelta');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
