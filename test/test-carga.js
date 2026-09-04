// Ejecuta los archivos de js/ EN ORDEN, como hace el navegador al abrir la
// app. Atrapa la clase de bug que dejó a Guzmán afuera de su app el
// 16/08/2026: un archivo que al CARGAR referencia algo definido en un archivo
// posterior (en el archivo único el izado lo tapaba; partido, es un
// ReferenceError que mata el resto del archivo — el bloqueo quedó en "App
// bloqueada" sin botones, sin clave y sin salida).
//
// Se corre DOS veces: sin nada en localStorage (primer uso) y con el bloqueo
// de seguridad activado + token (el estado real del teléfono de Guzmán, que
// era justo el camino sin cubrir).
//
// El entorno de mentira y la carga viven en _entorno.js, compartidos con
// test-llamadas.js, que es el que cubre la otra mitad: que lo que se llama
// DESPUÉS de cargar también exista.
var entorno = require('./_entorno');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

function correr(nombreEscenario, storage) {
  var r = entorno.cargar(storage);
  console.log('\n' + nombreEscenario);
  ok(r.orden.length >= 10, 'se cargaron ' + r.orden.length + ' archivos en el orden del index');
  ok(r.errores.length === 0, 'ninguno murio al cargar' + (r.errores.length ? ' — ' + r.errores.join(' | ') : ''));
  return r.ambito;
}

// Escenario 1: primer uso, sin nada guardado.
correr('A) primer uso (localStorage vacio)', {});

// Escenario 2: EL DEL BUG — bloqueo activado y token presente. En v30 esto
// moria en seguridad.js y dejaba la pantalla "App bloqueada" sin controles.
correr('B) bloqueo de seguridad activado + token (el estado real del telefono)', {
  ga_sec: JSON.stringify({ pin: 'hash', bio: 'credencial' }),
  ga_token: 'token-de-prueba'
});

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
