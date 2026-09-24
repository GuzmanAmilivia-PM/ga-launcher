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
    // El resumen va al aviso FLOTANTE desde el 23/09/2026: el del Inicio no
    // se ve sincronizando desde otra pantalla. avisoInicio queda espiado para
    // verificar que YA NO se use (ver H4).
    avisoFlotante: function (msg, esOk) { estado.avisos.push({ msg: msg, ok: !!esOk }); },
    avisoInicio: function (msg) { (estado.avisosInicio = estado.avisosInicio || []).push(msg); },
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
              refrescarPrecios: function () { estado.refrescos++; resolver('refrescar', cfg.refrescar); },
              // Itau no lo sincroniza ni el telefono ni el Worker: se deja un PEDIDO y
              // la PC de Guzman lo atiende. La cadena lo pide primero y NO lo espera.
              itauPedir: function () { resolver('itau', cfg.itau || { estado: 'pedido' }); }
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
  api.sincronizarTodo(cfg.opts);
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
  ok(JSON.stringify(e.llamadas) === '["itau","ibkr","cs","bnb","refrescar"]',
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
  ok(JSON.stringify(e.llamadas) === '["itau","ibkr","cs","refrescar"]',
     'saltea los no configurados, fue ' + JSON.stringify(e.llamadas));
  // Itau NO depende de que haya brokers configurados: se pide igual, y por eso
  // hay un aviso aunque no haya nada mas. Apretar Sync y no ver nada seria
  // peor que una linea de mas.
  ok(e.avisos.length === 1 && /Itaú: update requested/.test(e.avisos[0].msg),
     'queda la linea de Itau, que es lo unico que se pidio');
  ok(e.loadData === 1, 'igual refresca precios y recarga');

  // B2) IBKR sincronizo pero la clave de Binance no esta en el telefono: se
  // dice (9/09/2026: Guzman creia que Sync "solo sincronizaba Charles e IBKR").
  e = await correr('B2) IBKR y Schwab OK, Binance sin clave en el telefono', {
    ibkr: OK1, cs: OKV, bnbConfigurado: false, refrescar: {}
  });
  ok(e.llamadas.indexOf('bnb') === -1, 'no intenta Binance sin clave');
  ok(e.avisos.length === 1 && /Binance: not synced, the API key is not on this phone/.test(e.avisos[0].msg), 'la linea de Binance dice que falta la clave en este telefono');
  ok(/Connections &rarr; Platforms &rarr; Binance/.test(e.avisos[0].msg), 'y a donde ir a pegarla');
  ok(e.avisos[0].ok === true, 'sin ponerse en rojo: no es un error');

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
  // Desde el 5/09/2026 el paso final no refresca precios: estampa el historico
  // del dia. El aviso nombra eso, y en ingles como el resto de la interfaz.
  ok(/History/.test(e.avisos[0].msg) && /today's totals/.test(e.avisos[0].msg), 'avisa del fallo del paso final, con su nombre nuevo');

  // G) ya hay una sincronización corriendo -> no arranca otra
  e = await correr('G) con otra sincronización en curso', {
    ocupado: true, ibkr: OKV, cs: OKV, bnbConfigurado: false, refrescar: {}
  });
  ok(e.llamadas.length === 0, 'no dispara nada');
  ok(e.avisos.length === 0, 'ni avisa');

  // H) Itau en la cadena (13/09/2026). Pedido de Guzman: "pero cuando le doy
  // sync en el panel lateral tmb?". Va PRIMERO y no se espera: lo escribe su
  // PC hasta un minuto despues.
  e = await correr('H) Itau va primero y se dice, sin esperarlo', {
    ibkr: OK1, cs: OKV, bnbConfigurado: true, bnb: OKV, refrescar: {}
  });
  ok(e.llamadas[0] === 'itau', 'Itau es lo primero: la PC trabaja mientras corren los brokers');
  ok(/Ita\u00fa: update requested/.test(e.avisos[0].msg), 'se dice que quedo PEDIDO, no sincronizado');
  ok(!/Ita\u00fa: (no changes|[0-9]+ change)/.test(e.avisos[0].msg),
     'y nunca se reporta como un broker mas: su resultado llega despues');

  // H2) Con la PC apagada el Worker lo dice, y la linea lo pasa tal cual: es
  // la diferencia entre "espera" y "prende la maquina".
  //
  // EL ESTADO SE ESCRIBE CON GUION BAJO, que es lo que emite el Worker
  // (`ItauSync.js`, `_estadoDe`). Este fixture decia 'sin-respuesta' con guion
  // normal —una forma que el backend no produce JAMAS— y sincronizar.js
  // comparaba contra esa misma forma inventada: el assert pasaba en verde
  // mientras en produccion el aviso NO salia nunca, justo en el unico caso en
  // que Guzman tiene que hacer algo. Es la trampa de las sondas con la forma
  // inventada, y aparecio tres veces en este proyecto. Lo encontro una
  // auditoria por agentes el 14/09/2026.
  e = await correr('H2) la PC no contesta', {
    ibkr: OKV, cs: OKV, bnbConfigurado: false, refrescar: {}, itau: { estado: 'sin_respuesta' }
  });
  ok(/your PC has not answered/.test(e.avisos[0].msg), 'avisa que la PC no contesto');
  // Y la forma vieja NO puede volver a colarse: si alguien la repone, esta
  // linea se pone roja en vez de pasar probando otra cosa.
  ok(html.indexOf("estado === 'sin-respuesta'") === -1,
     'nadie compara contra la forma con guion, que el Worker no emite');

  // H3) EL CICLO. Cuando la actualizacion de Itau termina bien, la pantalla de
  // la cuenta llama a sincronizarTodo para mostrar el numero nuevo. Si esa
  // llamada volviera a pedir Itau, habria un login al banco cada minuto para
  // siempre. Este assert esta dado vuelta a proposito: verifica que NO pase.
  e = await correr('H3) la llamada que viene de Itau NO vuelve a pedir Itau', {
    ibkr: OKV, cs: OKV, bnbConfigurado: false, refrescar: {}, opts: { sinItau: true }
  });
  ok(e.llamadas.indexOf('itau') === -1, 'no se pide Itau: fue ' + JSON.stringify(e.llamadas));
  ok(e.llamadas[0] === 'ibkr', 'la cadena arranca directo en los brokers');

  // H4) EL RESUMEN SE VE DESDE CUALQUIER PANTALLA (23/09/2026). Iba a
  // #autoAviso, que solo existe en el Inicio. Y lo que dijo quien llamo (el
  // corte de BTG, `opts.previo`) va ADELANTE: el resumen lo pisaba.
  e = await correr('H4) el resumen va al aviso flotante, con lo previo adelante', {
    ibkr: OKV, cs: OKV, bnbConfigurado: false, refrescar: {}, opts: { sinItau: true, previo: 'BTG guardado' }
  });
  ok(e.avisos.length === 1, 'un solo aviso al terminar: ' + e.avisos.length);
  ok(e.avisos[0] && e.avisos[0].msg.indexOf('BTG guardado') === 0, 'lo previo va primero: ' + (e.avisos[0] && e.avisos[0].msg));
  ok(e.avisos[0] && /IBKR/.test(e.avisos[0].msg) && /Schwab/.test(e.avisos[0].msg), 'y despues el resumen de la cadena');
  ok(!(e.avisosInicio && e.avisosInicio.length), 'y NADA va al aviso del Inicio, que desde otra pantalla no se ve');

  console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
  process.exit(fallos ? 1 : 0);
})();
