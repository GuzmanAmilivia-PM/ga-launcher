// Arnés de sincronizarTodo() — el botón "Sincronizar" del menú, que encadena
// IBKR -> Schwab -> Binance -> refrescar precios.
// El protocolo de Binance vive en bnbSincronizar() y se prueba aparte
// (test-bnb-sync.js); acá se mockea por su contrato {alOk, alError}.
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var codigo = ruta.bloque(html,
  '// ---------- Sincronizar todo (menu) ----------',
  '// ---------- Deshacer: respaldos de las hojas ----------');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
}

function correr(nombre, cfg) {
  var estado = {
    texto: [], avisos: [], menuCerrado: false, loadData: 0, refrescos: 0,
    llamadas: [], vistasRefrescadas: []
  };
  var txtEl = { set textContent(v) { estado.texto.push(v); }, get textContent() { return ''; } };
  var ctx = {
    document: { getElementById: function (id) { return id === 'mRefrescarTxt' ? txtEl : null; } },
    esc: function (s) { return String(s); },
    toggleMenu: function (o) { if (!o) estado.menuCerrado = true; },
    loadData: function () { estado.loadData++; },
    avisoInicio: function (msg, esOk) { estado.avisos.push({ msg: msg, ok: !!esOk }); },
    msgErr: function (e, suj) { return String(suj || '') + ':' + ((e && e.message) || e); },
    msgBackend: function (r) { return ((r && r.mensajes) || ['no se pudo sincronizar']).join(' '); },
    syncEnCurso: function () { return !!cfg.ocupado; },
    cargarEstadoCS: function () { estado.vistasRefrescadas.push('cs'); },
    cargarEstadoIBKR: function () { estado.vistasRefrescadas.push('ibkr'); },
    currentView: cfg.vista || 'inicio',
    bnbConfig: function () { return cfg.bnbConfigurado ? { key: 'k', secret: 's' } : null; },
    // Contrato real de bnbSincronizar: llama alOk(r) o alError(msg).
    bnbSincronizar: function (cb) {
      estado.llamadas.push('bnb');
      setImmediate(function () {
        if (cfg.bnbError) cb.alError(cfg.bnbError);
        else cb.alOk(cfg.bnb || { ok: true, cambios: [] });
      });
    },
    ibkrSyncEnCurso: false, csEnCurso: false, bnbEnCurso: false,
    google: {
      script: {
        run: (function () {
          function mk() {
            var oks = [], fails = [];
            var api = {
              withSuccessHandler: function (f) { oks.push(f); return api; },
              withFailureHandler: function (f) { fails.push(f); return api; },
              sincronizarIBKR: function () { resolver('ibkr', cfg.ibkr); },
              sincronizarCS: function () { resolver('cs', cfg.cs); },
              refrescarPrecios: function () { estado.refrescos++; resolver('refrescar', cfg.refrescar); }
            };
            function resolver(nom, r) {
              estado.llamadas.push(nom);
              setImmediate(function () {
                if (r === 'FALLA') fails.forEach(function (f) { f(new Error('boom')); });
                else oks.forEach(function (f) { f(r); });
              });
            }
            return api;
          }
          return { withSuccessHandler: function (f) { return mk().withSuccessHandler(f); },
                   withFailureHandler: function (f) { return mk().withFailureHandler(f); } };
        })()
      }
    }
  };

  var nombres = Object.keys(ctx);
  var fn = new Function(nombres.join(','), codigo + '\nreturn { sincronizarTodo: sincronizarTodo, syncTodoEnCurso: function () { return syncTodoEnCurso; } };');
  var api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));
  estado.api = api;
  api.sincronizarTodo();
  return new Promise(function (res) {
    setTimeout(function () { console.log('\n' + nombre); res(estado); }, 400);
  });
}

var OKV = { ok: true, cambios: [] };
var OK1 = { ok: true, cambios: [{ tipo: 'qty', symbol: 'VOO' }] };

(async function () {
  // A) todo configurado, todo OK
  var e = await correr('A) los tres brokers configurados y sin errores', {
    ibkr: OK1, cs: OKV, bnbConfigurado: true, bnb: OK1, refrescar: {}
  });
  ok(JSON.stringify(e.llamadas) === '["ibkr","cs","bnb","refrescar"]',
     'orden esperado, fue ' + JSON.stringify(e.llamadas));
  ok(e.refrescos === 1, 'refrescarPrecios corre una vez');
  ok(e.menuCerrado, 'cierra el menú al terminar');
  ok(e.loadData === 1, 'recarga los datos una vez');
  ok(e.avisos.length === 1 && e.avisos[0].ok === true, 'un aviso, en verde');
  ok(/IBKR: 1 change/.test(e.avisos[0].msg), 'reporta IBKR');
  ok(/Schwab: no changes/.test(e.avisos[0].msg), 'reporta Schwab');
  ok(/Binance: 1 change/.test(e.avisos[0].msg), 'reporta Binance');
  ok(e.texto[e.texto.length - 1] === 'Sync', 'el texto del botón vuelve a Sincronizar');
  ok(e.vistasRefrescadas.length === 0, 'NO refresca pantallas de brokers que nadie mira');

  // A2) si el usuario está parado en la pantalla del broker, sí se refresca
  e = await correr('A2) parado en la pantalla de IBKR', {
    ibkr: OK1, cs: OKV, bnbConfigurado: false, refrescar: {}, vista: 'ibkr'
  });
  ok(e.vistasRefrescadas.indexOf('ibkr') >= 0, 'refresca la vista visible');
  ok(e.vistasRefrescadas.indexOf('cs') === -1, 'y solo esa');

  // B) brokers sin configurar -> se saltean en silencio
  e = await correr('B) IBKR y Schwab sin configurar, Binance sin clave', {
    ibkr: { ok: false, sinConfig: true }, cs: { ok: false, sinConfig: true },
    bnbConfigurado: false, refrescar: {}
  });
  ok(JSON.stringify(e.llamadas) === '["ibkr","cs","refrescar"]',
     'saltea los no configurados, fue ' + JSON.stringify(e.llamadas));
  ok(e.avisos.length === 0, 'sin avisos cuando no hay nada configurado');
  ok(e.loadData === 1, 'igual refresca precios y recarga');

  // C) IBKR falla: no corta la cadena
  e = await correr('C) IBKR con error', {
    ibkr: { ok: false, mensajes: ['token vencido'] }, cs: OKV,
    bnbConfigurado: false, refrescar: {}
  });
  ok(e.llamadas.indexOf('cs') >= 0 && e.refrescos === 1, 'sigue con Schwab y precios pese al error');
  ok(e.avisos.length === 1 && e.avisos[0].ok === false, 'aviso en rojo');
  ok(/IBKR: token vencido/.test(e.avisos[0].msg), 'muestra el motivo de IBKR');

  // D) excepción de red en Schwab
  e = await correr('D) Schwab cae con excepción', {
    ibkr: OKV, cs: 'FALLA', bnbConfigurado: false, refrescar: {}
  });
  ok(e.refrescos === 1, 'la excepción no cuelga la cadena');
  ok(/Schwab:.*boom/.test(e.avisos[0].msg), 'traduce el error de Schwab');

  // E) Binance frena por su cuenta (fondos en Earn)
  e = await correr('E) Binance frena por posible Earn', {
    ibkr: OKV, cs: OKV, bnbConfigurado: true,
    bnbError: 'varias posiciones sin saldo (Earn)', refrescar: {}
  });
  ok(/Earn/.test(e.avisos[0].msg), 'traslada el aviso de Binance');
  ok(e.avisos[0].ok === false, 'en rojo');
  ok(e.refrescos === 1, 'igual refresca precios');

  // F) falla el refresco de precios
  e = await correr('F) falla refrescarPrecios', {
    ibkr: OKV, cs: OKV, bnbConfigurado: false, refrescar: 'FALLA'
  });
  ok(e.menuCerrado && e.loadData === 1, 'igual cierra y recarga');
  ok(/[Pp]recios/.test(e.avisos[0].msg), 'avisa del fallo de precios');

  // G) ya hay una sincronización corriendo -> no arranca otra
  e = await correr('G) con otra sincronización en curso', {
    ocupado: true, ibkr: OKV, cs: OKV, bnbConfigurado: false, refrescar: {}
  });
  ok(e.llamadas.length === 0, 'no dispara nada');
  ok(e.avisos.length === 0, 'ni avisa');

  console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
  process.exit(fallos ? 1 : 0);
})();
