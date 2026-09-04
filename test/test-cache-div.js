// Arnés del caché local de Dividendos/Aportes de ga-launcher/index.html.
// Verifica que al entrar se pinte al instante lo último visto y que un fallo
// de red no borre lo que ya está en pantalla.
var ruta = require('./_ruta');
var html = ruta.leerIndex();

var ini = html.indexOf('// Cache local de los paneles lentos');
var fin = html.indexOf('// Vista estilo resumen de ingresos del broker');
if (ini < 0 || fin < 0 || fin < ini) { console.error('No se encontró el bloque'); process.exit(1); }
var codigo = html.slice(ini, fin);

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

function montar(cfg) {
  var store = cfg.guardado ? { 'ga_cache_div': JSON.stringify(cfg.guardado) } : {};
  var estado = { store: store, pintados: [], elems: {}, spinner: false };
  function elem(id) {
    if (!estado.elems[id]) {
      estado.elems[id] = {
        _html: '', style: {}, removeAttribute: function () {},
        get innerHTML() { return this._html; },
        set innerHTML(v) { this._html = v; if (/loadingtxt/.test(v)) estado.spinner = true; }
      };
    }
    return estado.elems[id];
  }
  var ctx = {
    document: { getElementById: function (id) { return elem(id); } },
    localStorage: {
      getItem: function (k) { return store[k] || null; },
      setItem: function (k, v) { store[k] = v; }
    },
    esc: function (s) { return String(s); },
    msgErr: function (e) { return (e && e.message) || String(e); },
    ajustarAlturaDeck: function () {},
    fechaCortaMs: function (ms) {
      var d = new Date(ms);
      return ('0'+d.getDate()).slice(-2) + '/' + ('0'+(d.getMonth()+1)).slice(-2) + ' ' +
             ('0'+d.getHours()).slice(-2) + ':' + ('0'+d.getMinutes()).slice(-2);
    },
    Date: Date,
    divCargado: false,
    // renderDividendos real no está en el bloque: se mockea para observar.
    renderDividendos: function (r) { estado.pintados.push(r); },
    google: {
      script: {
        run: (function () {
          function mk() {
            var oks = [], fails = [];
            var api = {
              withSuccessHandler: function (f) { oks.push(f); return api; },
              withFailureHandler: function (f) { fails.push(f); return api; },
              getDividendos: function (a) {
                estado.pidio = a;
                setImmediate(function () {
                  if (cfg.respuesta === 'FALLA') fails.forEach(function (f) { f(new Error('sin conexion')); });
                  else oks.forEach(function (f) { f(cfg.respuesta); });
                });
              }
            };
            return api;
          }
          return {
            withSuccessHandler: function (f) { return mk().withSuccessHandler(f); },
            withFailureHandler: function (f) { return mk().withFailureHandler(f); }
          };
        })()
      }
    }
  };
  var nombres = Object.keys(ctx);
  var fn = new Function(nombres.join(','), codigo + '\nreturn { cargarDividendos: cargarDividendos };');
  estado.api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));
  estado.elem = elem;
  return estado;
}

function esperar() { return new Promise(function (r) { setTimeout(r, 60); }); }

var FRESCO = { ok: true, anio: 2026, totalCobrado: 400 };
var VIEJO = { ok: true, anio: 2026, totalCobrado: 382 };

(async function () {
  console.log('\nA) primera vez, sin nada guardado');
  var m = montar({ respuesta: FRESCO });
  m.api.cargarDividendos();
  ok(m.spinner === true, 'sin caché muestra "Cargando..."');
  await esperar();
  ok(m.pintados.length === 1 && m.pintados[0].totalCobrado === 400, 'pinta los datos del servidor');
  ok(m.store['ga_cache_div'], 'los guarda para la próxima');

  console.log('\nB) segunda vez, con datos guardados');
  m = montar({ guardado: { t: Date.now() - 3600000, data: VIEJO }, respuesta: FRESCO });
  m.api.cargarDividendos();
  ok(m.spinner === false, 'NO muestra "Cargando...": ya hay algo en pantalla');
  ok(m.pintados.length === 1 && m.pintados[0].totalCobrado === 382, 'pinta al instante lo último visto');
  ok(/updating/.test(m.elem('divCacheAviso').innerHTML), 'avisa que está actualizando');
  await esperar();
  ok(m.pintados.length === 2 && m.pintados[1].totalCobrado === 400, 'después repinta con lo fresco');
  ok(m.elem('divCacheAviso').style.display === 'none', 'y saca el aviso');

  console.log('\nC) con caché y sin red: no se borra la pantalla');
  m = montar({ guardado: { t: Date.now() - 3600000, data: VIEJO }, respuesta: 'FALLA' });
  m.api.cargarDividendos();
  await esperar();
  ok(m.pintados.length === 1 && m.pintados[0].totalCobrado === 382, 'quedan los datos guardados');
  ok(/could not update/.test(m.elem('divCacheAviso').innerHTML), 'avisa que no pudo actualizar');
  ok(!/Cargando/.test(m.elem('divBody').innerHTML), 'no queda un spinner colgado');

  console.log('\nD) sin caché y sin red: mensaje de error');
  m = montar({ respuesta: 'FALLA' });
  m.api.cargarDividendos();
  await esperar();
  ok(/sin conexion/.test(m.elem('divBody').innerHTML), 'muestra el error');
  ok(m.pintados.length === 0, 'no pinta nada');

  console.log('\nE) el botón de refrescar ignora el caché');
  m = montar({ guardado: { t: Date.now(), data: VIEJO }, respuesta: FRESCO });
  m.api.cargarDividendos(true);
  ok(m.pintados.length === 0, 'con forzar NO pinta lo viejo');
  ok(m.spinner === true, 'muestra que está trabajando');
  await esperar();
  ok(m.pidio && m.pidio.forzar === true, 'le pide al backend que ignore su caché');

  console.log('\nF) una respuesta con error no pisa el caché bueno');
  m = montar({ guardado: { t: Date.now(), data: VIEJO }, respuesta: { ok: false, mensajes: ['falló'] } });
  var antes = m.store['ga_cache_div'];
  m.api.cargarDividendos();
  await esperar();
  ok(m.store['ga_cache_div'] === antes, 'el caché guardado sigue siendo el bueno');

  console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
  process.exit(fallos ? 1 : 0);
})();
