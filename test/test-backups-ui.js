// Arnés del bloque "Deshacer" (respaldos) de ga-launcher/index.html.
// Sin jsdom: se stubea el DOM mínimo y se evalúa el bloque extraído por
// marcadores de comentario.
var ruta = require('./_ruta');
var html = ruta.leerIndex();

var ini = html.indexOf('// ---------- Deshacer: respaldos de las hojas ----------');
var fin = html.indexOf('// ---------- IA Insights ----------');
if (ini < 0 || fin < 0 || fin < ini) { console.error('No se encontró el bloque'); process.exit(1); }
var codigo = html.slice(ini, fin);

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

// Elemento DOM de mentira, suficiente para innerHTML y querySelectorAll.
function elem() {
  var e = {
    innerHTML: '', style: {}, _botones: [],
    querySelectorAll: function () { return e._botones; },
    setAttribute: function () {}
  };
  return e;
}

function montar(cfg) {
  var estado = { lista: elem(), res: elem(), loadData: 0, confirms: [], llamadas: [] };
  var ctx = {
    document: {
      getElementById: function (id) {
        if (id === 'bakList') return estado.lista;
        if (id === 'bakResultado') return estado.res;
        return null;
      }
    },
    esc: function (s) { return String(s).replace(/</g, '&lt;'); },
    errorEnVista: function (id, err, que) {
      var e = (id === 'bakList') ? estado.lista : estado.res;
      e.innerHTML = '<p>' + ((err && err.message) || ('No se pudieron cargar ' + que + '.')) + '</p>';
    },
    fechaCortaMs: function (ms) {
      var d = new Date(ms);
      return ('0'+d.getDate()).slice(-2) + '/' + ('0'+(d.getMonth()+1)).slice(-2) + ' ' +
             ('0'+d.getHours()).slice(-2) + ':' + ('0'+d.getMinutes()).slice(-2);
    },
    nombrePlataforma: function (n) { return n === 'IB' ? 'IBKR' : n; },
    loadData: function () { estado.loadData++; },
    window: {
      confirm: function (m) { estado.confirms.push(m); return cfg.confirmar !== false; }
    },
    Array: Array,
    google: {
      script: {
        run: (function () {
          function mk() {
            var oks = [], fails = [];
            var api = {
              withSuccessHandler: function (f) { oks.push(f); return api; },
              withFailureHandler: function (f) { fails.push(f); return api; },
              listarBackups: function () { resolver('listar', cfg.listar); },
              restaurarBackup: function (a) { estado.restauro = a; resolver('restaurar', cfg.restaurar); }
            };
            function resolver(nom, r) {
              estado.llamadas.push(nom);
              setImmediate(function () {
                if (r === 'FALLA') fails.forEach(function (f) { f(new Error('sin conexion')); });
                else oks.forEach(function (f) { f(r); });
              });
            }
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
  // fechaSalud vive en config.js (fechaBackup era su copia y se unifico en
  // E6): se inyecta la implementacion REAL, extraida del fuente.
  var fechaSaludSrc = (html.match(/function fechaSalud[\s\S]*?\n\}/) || [''])[0];
  if (!fechaSaludSrc) { console.log('  FALLA: no encuentro fechaSalud en config.js'); process.exit(1); }
  var nombres = Object.keys(ctx);
  var fn = new Function(nombres.join(','), fechaSaludSrc + '\n' + codigo + '\nreturn { cargarBackups: cargarBackups, restaurarHoja: restaurarHoja };');
  estado.api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));
  return estado;
}

function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms || 60); }); }

(async function () {
  console.log('\nA) lista de respaldos');
  var m = montar({ listar: { ok: true, backups: [
    { hoja: 'IB', cuando: '2026-08-15T11:30:00.000Z', motivo: 'sincronizacion IBKR' },
    { hoja: 'CS', cuando: '2026-08-15T08:00:00.000Z', motivo: 'operacion de trade' }
  ] } });
  m.api.cargarBackups();
  await esperar();
  ok(/IBKR/.test(m.lista.innerHTML), 'muestra el nombre lindo de la plataforma, no "IB"');
  ok(/sincronizacion IBKR/.test(m.lista.innerHTML), 'muestra el motivo');
  // La fecha ISO solo puede aparecer como atributo (para restaurar esa copia
  // exacta), nunca como texto a la vista.
  ok(!/>[^<]*2026-08-15T11/.test(m.lista.innerHTML), 'no muestra la fecha cruda al usuario');
  ok(/data-cuando="2026-08-15T11:30:00.000Z"/.test(m.lista.innerHTML), 'pero la lleva en el boton');
  ok((m.lista.innerHTML.match(/Revert to this/g) || []).length === 2, 'un boton por respaldo');

  console.log('\nB) sin respaldos todavia');
  m = montar({ listar: { ok: true, backups: [] } });
  m.api.cargarBackups();
  await esperar();
  ok(/No backups yet/.test(m.lista.innerHTML), 'mensaje de lista vacia');
  ok(!/Revert to this/.test(m.lista.innerHTML), 'sin botones');

  console.log('\nC) restaurar confirmando');
  m = montar({ confirmar: true, restaurar: { ok: true, mensajes: ['La hoja CS volvio a como estaba.'] }, listar: { ok: true, backups: [] } });
  m.api.restaurarHoja('CS', '2026-08-15T08:00:00.000Z');
  await esperar();
  ok(m.confirms.length === 1 && /undone/.test(m.confirms[0]), 'pide confirmacion y aclara que se puede deshacer');
  ok(m.restauro && m.restauro.hoja === 'CS', 'manda la hoja correcta');
  ok(m.restauro.cuando === '2026-08-15T08:00:00.000Z', 'y la copia exacta que se toco');
  ok(/volvio a como estaba/.test(m.res.innerHTML), 'muestra el resultado');
  ok(m.loadData === 1, 'recarga los datos de la app');

  console.log('\nD) restaurar cancelando');
  m = montar({ confirmar: false, restaurar: { ok: true } });
  m.api.restaurarHoja('CS');
  await esperar();
  ok(m.llamadas.indexOf('restaurar') === -1, 'si cancela, NO llama al backend');
  ok(m.loadData === 0, 'no recarga nada');

  console.log('\nE) el backend rechaza la restauracion');
  m = montar({ confirmar: true, restaurar: { ok: false, mensajes: ['El respaldo esta dañado.'] } });
  m.api.restaurarHoja('CS');
  await esperar();
  ok(/dañado/.test(m.res.innerHTML), 'muestra el motivo del rechazo');
  ok(m.loadData === 0, 'no recarga si no se restauro');

  console.log('\nF) falla de red');
  m = montar({ listar: 'FALLA' });
  m.api.cargarBackups();
  await esperar();
  ok(!/Loading/.test(m.lista.innerHTML), 'no queda en "Loading..." para siempre');
  ok(/conexion|copias/.test(m.lista.innerHTML), 'muestra un mensaje de error');

  console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
  process.exit(fallos ? 1 : 0);
})();
