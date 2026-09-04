// Arnés del shim de google.script.run de ga-launcher/index.html.
// Cubre lo que se arregló: (1) el handler de fallo se llama SIEMPRE, incluso
// cuando vence la clave (antes quedaban candados y botones trabados), y
// (2) una respuesta que no es JSON da un mensaje humano en vez de
// "Unexpected token <".
var ruta = require('./_ruta');
var html = ruta.leerIndex();

// El corte arranca en el presupuesto de espera, NO en apiCall: desde el
// 21/08/2026 el timeout y el traductor de errores de red viven arriba de la
// funcion y son parte del mismo bloque.
var ini = html.indexOf('// Presupuesto de espera por pedido');
if (ini < 0) ini = html.indexOf('function apiCall(fn, args) {');
var fin = html.indexOf('// Pantalla de clave');
if (ini < 0 || fin < 0) { console.error('No se encontró el bloque del shim'); process.exit(1); }
var codigo = html.slice(ini, fin);

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

// Monta el shim con un fetch simulado y devuelve {run, lockMostrado}
function montar(respuesta) {
  var estado = { lockMostrado: 0, lockMsg: '' };
  var ctx = {
    fetch: function (url, opciones) {
      estado.opciones = opciones;
      if (respuesta.rechazaCon) return Promise.reject(respuesta.rechazaCon);
      if (respuesta.nuncaContesta) {
        return new Promise(function (_, rechazar) {
          if (opciones && opciones.signal) opciones.signal.addEventListener('abort', function () { rechazar(new Error('AbortError')); });
        });
      }
      return Promise.resolve({
        ok: respuesta.httpOk !== false,
        status: respuesta.status || 200,
        text: function () { return Promise.resolve(respuesta.body); }
      });
    },
    localStorage: { getItem: function () { return 'token-de-prueba'; }, setItem: function () {} },
    mostrarLock: function (m) { estado.lockMostrado++; estado.lockMsg = m; },
    hideSplash: function () {},
    document: { getElementById: function () { return { style: {}, textContent: '' }; } },
    window: {},
    API_URL: 'https://ejemplo/exec',
    getApiToken: function () { return 'token-de-prueba'; }
  };
  var nombres = Object.keys(ctx);
  var fn = new Function(nombres.join(','), codigo + '\nreturn window.google.script.run;');
  estado.run = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));
  return estado;
}

function correr(respuesta) {
  var m = montar(respuesta);
  var res = { exito: null, fallo: null };
  m.run.withSuccessHandler(function (d) { res.exito = d; })
       .withFailureHandler(function (e) { res.fallo = e; })
       .getPortfolioData();
  return new Promise(function (r) {
    setTimeout(function () { res.lockMostrado = m.lockMostrado; res.lockMsg = m.lockMsg; r(res); }, 50);
  });
}

(async function () {
  console.log('\nA) respuesta normal');
  var r = await correr({ body: JSON.stringify({ data: { total: 123 } }) });
  ok(r.exito && r.exito.total === 123, 'los datos llegan al handler de éxito');
  ok(r.fallo === null, 'no se llama al de fallo');

  console.log('\nB) clave vencida (el bug que trababa los botones)');
  r = await correr({ body: JSON.stringify({ error: 'auth' }) });
  ok(r.lockMostrado === 1, 'muestra la pantalla de clave');
  ok(r.fallo !== null, 'AHORA sí llama al handler de fallo (antes no, y todo quedaba trabado)');
  ok(r.fallo && r.fallo.auth === true, 'el error viene marcado como de clave');
  ok(r.fallo && /passcode/i.test(r.fallo.message), 'el mensaje es entendible, no dice "auth"');

  console.log('\nC) el servidor devuelve HTML en vez de JSON');
  r = await correr({ body: '<!DOCTYPE html><html><body>Se excedio la cuota</body></html>' });
  ok(r.fallo !== null, 'se trata como fallo');
  ok(r.fallo && !/Unexpected token/i.test(r.fallo.message), 'no filtra el error crudo de JSON');
  ok(r.fallo && /unexpected|not responding/i.test(r.fallo.message), 'mensaje humano: ' + (r.fallo && r.fallo.message));

  console.log('\nD) error HTTP del servidor');
  r = await correr({ httpOk: false, status: 500, body: 'Internal Server Error' });
  ok(r.fallo && /500/.test(r.fallo.message), 'informa el código de error');

  console.log('\nE) error de negocio del backend');
  r = await correr({ body: JSON.stringify({ error: 'unknown_fn', message: 'Función no disponible' }) });
  ok(r.fallo && /no disponible/.test(r.fallo.message), 'pasa el mensaje del backend');
  ok(r.lockMostrado === 0, 'no muestra la pantalla de clave por un error común');

  // Auditoría del 21/08/2026: sin señal, Safari rechaza el fetch con
  // TypeError('Load failed') y ESO era lo que se pintaba en Noticias,
  // Dividendos, Aportes, Análisis, Buscador y Diagnóstico.
  console.log('\nF) sin señal: mensaje humano, no el error crudo de Safari');
  r = await correr({ rechazaCon: new TypeError('Load failed') });
  ok(r.fallo !== null, 'se trata como fallo');
  ok(r.fallo && !/Load failed/.test(r.fallo.message), 'NO se filtra el "Load failed" crudo de WebKit');
  ok(r.fallo && /signal|connection/i.test(r.fallo.message), 'mensaje humano: ' + (r.fallo && r.fallo.message));
  ok(r.lockMostrado === 0, 'un problema de red no hace pensar que vencio la clave');

  // Antes el fetch iba pelado: si el servidor no contestaba, la app quedaba
  // colgada a merced del timeout de red del sistema, sin cancelar ni avisar.
  console.log('\nG) todo pedido sale cancelable, con su propio presupuesto de espera');
  var m2 = montar({ body: JSON.stringify({ data: {} }) });
  m2.run.withSuccessHandler(function () {}).withFailureHandler(function () {}).getPortfolioData();
  ok(!!m2.opciones, 'se llamo a fetch');
  ok(m2.opciones && !!m2.opciones.signal, 'el pedido lleva signal: se puede abortar');
  ok(/API_TIMEOUT_LARGO_MS/.test(codigo) && /noticias/.test(codigo),
     'las fns lentas (noticias y las syncs) tienen un presupuesto propio, mas largo');

  console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
  process.exit(fallos ? 1 : 0);
})();
