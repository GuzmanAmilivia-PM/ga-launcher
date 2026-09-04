// Arnés de bnbSincronizar() — el protocolo de Binance, que antes estaba escrito
// dos veces (sync automática y botón del menú) con el umbral de Earn en dos
// redacciones distintas. Ahora vive en un solo lugar y se prueba una sola vez.
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var codigo = ruta.bloque(html,
  '// El protocolo completo de Binance en UN solo lugar',
  '// ---------- Sincronizar todo (menu) ----------');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

function montar(cfg) {
  var estado = { llamadas: [], guardado: {}, avisos: [], loadData: 0 };
  var ctx = {
    localStorage: {
      getItem: function (k) { return estado.guardado[k] || null; },
      setItem: function (k, v) { estado.guardado[k] = v; }
    },
    document: { getElementById: function () { return null; } },
    esc: function (s) { return String(s); },
    fechaCortaMs: function () { return '16/08 09:00'; },
    msgErr: function (e, suj) { return String(suj || '') + ': ' + ((e && e.message) || e); },
    msgBackend: function (r) { return ((r && r.mensajes) || ['no se pudo sincronizar']).join(' '); },
    bnbConfig: function () { return cfg.configurado === false ? null : { key: 'k', secret: 's' }; },
    getApiToken: function () { return cfg.sinToken ? '' : 'tok'; },
    syncEnCurso: function () { return !!cfg.ocupado; },
    loadData: function () { estado.loadData++; },
    avisoInicio: function (m, esOk) { estado.avisos.push({ msg: m, ok: !!esOk }); },
    BNB_AUTO_MIN_MS: 30 * 60 * 1000,
    bnbEnCurso: false,
    Date: Date,
    bnbLeerSaldos: function (cb, fail) {
      estado.llamadas.push('leer');
      if (cfg.leerFalla) return void setImmediate(fail);
      setImmediate(function () { cb([{ symbol: 'BTC', qty: 1 }]); });
    },
    google: {
      script: {
        run: (function () {
          function mk() {
            var oks = [], fails = [];
            var api = {
              withSuccessHandler: function (f) { oks.push(f); return api; },
              withFailureHandler: function (f) { fails.push(f); return api; },
              sincronizarBNB: function (a) {
                var nom = a.dryRun ? 'dry' : 'apply';
                var r = a.dryRun ? cfg.dry : cfg.apply;
                estado.llamadas.push(nom);
                setImmediate(function () {
                  if (r === 'FALLA') fails.forEach(function (f) { f(new Error('sin red')); });
                  else oks.forEach(function (f) { f(r); });
                });
              }
            };
            return api;
          }
          return { withSuccessHandler: function (f) { return mk().withSuccessHandler(f); },
                   withFailureHandler: function (f) { return mk().withFailureHandler(f); } };
        })()
      }
    }
  };
  var nombres = Object.keys(ctx);
  // bnbLock vive en brokers.js (dueño unico del candado, auditoria 19/08):
  // aca se replica escribiendo la misma variable compartida del contexto.
  var fn = new Function(nombres.join(','), 'function bnbLock(v) { bnbEnCurso = v; }\n' + codigo +
    '\nreturn { bnbSincronizar: bnbSincronizar, bnbAutoSync: bnbAutoSync, enCurso: function () { return bnbEnCurso; }, AVISO_EARN: BNB_AVISO_EARN };');
  estado.api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));
  return estado;
}

function esperar() { return new Promise(function (r) { setTimeout(r, 200); }); }

var CAMBIO = { ok: true, cambios: [{ tipo: 'qty', symbol: 'BTC' }] };
var CERRADAS2 = { ok: true, cambios: [{ tipo: 'cerrada' }, { tipo: 'cerrada' }] };

(async function () {
  console.log('\nA) camino feliz: compara y aplica');
  var m = montar({ dry: CAMBIO, apply: CAMBIO });
  var res = {};
  m.api.bnbSincronizar({ alOk: function (r) { res.ok = r; }, alError: function (e) { res.err = e; } });
  await esperar();
  ok(JSON.stringify(m.llamadas) === '["leer","dry","apply"]', 'lee, compara y aplica (' + m.llamadas + ')');
  ok(res.ok && res.ok.cambios.length === 1, 'devuelve el resultado aplicado');
  ok(m.guardado['ga_bnb_ultima'], 'deja la marca de ultima sincronizacion');
  ok(m.api.enCurso() === false, 'suelta el candado');

  console.log('\nB) sin cambios: no aplica nada');
  m = montar({ dry: { ok: true, cambios: [] } });
  res = {};
  m.api.bnbSincronizar({ alOk: function (r) { res.ok = r; }, alError: function (e) { res.err = e; } });
  await esperar();
  ok(m.llamadas.indexOf('apply') === -1, 'no llama a aplicar');
  ok(res.ok && !res.err, 'lo reporta como exito');
  ok(m.api.enCurso() === false, 'suelta el candado');

  console.log('\nC) guarda de Earn: 2 o mas posiciones sin saldo');
  m = montar({ dry: CERRADAS2, apply: CAMBIO });
  res = {};
  m.api.bnbSincronizar({ alOk: function (r) { res.ok = r; }, alError: function (e) { res.err = e; } });
  await esperar();
  ok(m.llamadas.indexOf('apply') === -1, 'NO aplica');
  ok(res.err === m.api.AVISO_EARN, 'devuelve exactamente el aviso de Earn');
  ok(m.api.enCurso() === false, 'suelta el candado');

  console.log('\nD) una sola cerrada sí se aplica');
  m = montar({ dry: { ok: true, cambios: [{ tipo: 'cerrada' }] }, apply: CAMBIO });
  m.api.bnbSincronizar({});
  await esperar();
  ok(m.llamadas.indexOf('apply') >= 0, 'aplica normalmente');

  console.log('\nE) el teléfono no puede leer los saldos');
  m = montar({ leerFalla: true });
  res = {};
  m.api.bnbSincronizar({ alError: function (e) { res.err = e; } });
  await esperar();
  ok(m.llamadas.indexOf('dry') === -1, 'no molesta al backend');
  ok(/phone/.test(res.err || ''), 'explica que fue el telefono');
  ok(m.api.enCurso() === false, 'suelta el candado');

  console.log('\nF) falla de red al aplicar');
  m = montar({ dry: CAMBIO, apply: 'FALLA' });
  res = {};
  m.api.bnbSincronizar({ alError: function (e) { res.err = e; } });
  await esperar();
  ok(!!res.err, 'reporta el error');
  ok(m.api.enCurso() === false, 'suelta el candado (el bug de los botones trabados)');
  ok(!m.guardado['ga_bnb_ultima'], 'no marca como sincronizado');

  console.log('\nG) la sync automatica es silenciosa salvo Earn');
  m = montar({ dry: CAMBIO, apply: CAMBIO });
  m.api.bnbAutoSync();
  await esperar();
  ok(m.avisos.length === 1 && m.avisos[0].ok === true, 'avisa el exito con cambios');
  ok(m.loadData === 1, 'recarga la pantalla');

  m = montar({ dry: { ok: true, cambios: [] } });
  m.api.bnbAutoSync();
  await esperar();
  ok(m.avisos.length === 0, 'sin cambios no molesta');

  m = montar({ dry: CERRADAS2 });
  m.api.bnbAutoSync();
  await esperar();
  ok(m.avisos.length === 1 && /Earn/.test(m.avisos[0].msg), 'el caso Earn si avisa');

  m = montar({ dry: 'FALLA' });
  m.api.bnbAutoSync();
  await esperar();
  ok(m.avisos.length === 0, 'un fallo de red no molesta: queda el camino manual');

  console.log('\nH) la sync automatica respeta el freno de 30 minutos y el candado');
  m = montar({ dry: CAMBIO, apply: CAMBIO, ocupado: true });
  m.api.bnbAutoSync();
  await esperar();
  ok(m.llamadas.length === 0, 'con otra sync en curso no arranca');

  m = montar({ dry: CAMBIO, apply: CAMBIO });
  m.guardado['ga_bnb_auto_ts'] = String(Date.now());
  m.api.bnbAutoSync();
  await esperar();
  ok(m.llamadas.length === 0, 'recien sincronizado, no repite');

  m = montar({ dry: CAMBIO, apply: CAMBIO, sinToken: true });
  m.api.bnbAutoSync();
  await esperar();
  ok(m.llamadas.length === 0, 'sin clave de la API no intenta');

  console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
  process.exit(fallos ? 1 : 0);
})();
