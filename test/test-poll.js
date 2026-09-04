// Arnés del poll liviano de js/arranque.js: los polls de 60 s piden {lite:true}
// (sin la serie histórica), una respuesta idéntica NO repinta el DOM, y una
// respuesta lite conserva la serie de la última carga completa.
var ruta = require('./_ruta');
var fs = require('fs');
var path = require('path');
var DateReal = Date; // el Date del harness está stubeado; este es el de Node

// Se carga arranque.js entero (es el archivo del poll) con stubs.
var codigo = fs.readFileSync(path.join(ruta.RUTA, 'js', 'arranque.js'), 'utf8');
// El archivo también conecta el ojito y el poll al cargar: esas líneas usan el
// DOM de mentira y son inofensivas acá.

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

// La época del reloj falso tiene que ser MAYOR que los 30 min del presupuesto
// de carga completa: con una época chica, "nunca hubo carga completa" (0)
// parece reciente y el arranque pediría lite cuando no corresponde.
var AHORA0 = 100000000;
function montar(cfg) {
  var estado = { renders: [], pedidos: [], guardados: [], ahora: AHORA0 };
  function elemento() {
    var e = { style: {}, innerHTML: '', textContent: '', classList: { add: function () {}, contains: function () { return true; }, toggle: function () {} }, addEventListener: function () {}, appendChild: function () {}, onclick: null };
    return e;
  }
  var ctx = {
    document: {
      getElementById: function () { return elemento(); },
      createElement: function () { return elemento(); },
      querySelector: function () { return elemento(); },
      querySelectorAll: function () { return []; },
      addEventListener: function () {},
      visibilityState: 'visible',
      body: elemento(), documentElement: elemento()
    },
    localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
    // Date con constructor real: mercadoAbierto hace `new Date(ms)`.
    Date: (function () { function D(ms) { return new DateReal(ms); } D.now = function () { return estado.ahora; }; D.UTC = DateReal.UTC; return D; })(),
    JSON: JSON,
    setInterval: function () {}, setTimeout: function () {},
    // globals de nucleo.js / graficos.js que arranque usa
    fullSerie: cfg.serieInicial || [],
    lastData: null,
    // Vacio POR DEFECTO: arranque.js dispara un loadData() propio al cargar si
    // hay token, y esa llamada fantasma desordenaba las respuestas del mock.
    // Con cfg.token la llamada del arranque es EL objeto del test (lite-first).
    getApiToken: function () { return cfg.token ? 'tok' : ''; },
    mostrarLock: function () {},
    hideSplash: function () {},
    pintarBadges: function () {},
    avisoInicio: function () {},
    cacheLeer: function () { return cfg.cache || null; },
    cacheGuardar: function (k, d) { estado.guardados.push(d); },
    pintarOjo: function () {},
    bnbAutoSync: function () {},
    accountByName: function () { return null; },
    nombrePlataforma: function (n) { return n; },
    __hookRender: function (d) { estado.renders.push(d); },
    fmt: function (v) { return String(v); },
    esc: function (s) { return String(s); },
    mask: function (s) { return s; },
    google: {
      script: {
        run: (function () {
          function mk() {
            var oks = [], fails = [];
            var api = {
              withSuccessHandler: function (f) { oks.push(f); return api; },
              withFailureHandler: function (f) { fails.push(f); return api; },
              getPortfolioData: function (args) {
                estado.pedidos.push(args);
                var r = cfg.respuestas.shift();
                if (r) setImmediate(function () { oks.forEach(function (f) { f(r); }); });
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
  ctx.window = ctx;
  // arranque.js llama funciones de otros archivos (pintarOjo, buildRangeBar,
  // bnbAutoSync...). Acá solo importa el poll: cualquier funcion externa que
  // el archivo use y no esté stubeada arriba se stubea sola como no-op, así
  // el arnés no se rompe cada vez que arranque.js llame algo nuevo.
  var propias = {}, mDecl, reDecl = /function (\w+)/g;
  while ((mDecl = reDecl.exec(codigo)) !== null) propias[mDecl[1]] = true;
  var reUso = /(\w+)\s*\(/g, mUso;
  while ((mUso = reUso.exec(codigo)) !== null) {
    var nom = mUso[1];
    // Un nombre que empieza con digito NO es un identificador valido: viene de
    // un COMENTARIO, no del codigo. El regex de arriba toma cualquier palabra
    // pegada a un parentesis, y una fecha escrita "02/09/2026 (..." hacia que
    // se declarara un parametro llamado 2026 — y ahi el new Function ni
    // compila, con un error que no dice nada de comentarios. Paso el 02/09.
    if (/^[0-9]/.test(nom)) continue;
    if (!(nom in ctx) && !propias[nom] && !/^(if|for|while|switch|catch|function|return|typeof|new)$/.test(nom)) {
      ctx[nom] = function () {};
    }
  }
  var nombres = Object.keys(ctx);
  // arranque.js declara SU PROPIO render (el real): se reemplaza DESPUES de
  // evaluarlo, conservando lo unico que el poll necesita del real
  // (fullSerie = data.serie) y registrando la llamada para los asserts.
  var fn = new Function(nombres.join(','), codigo +
    '\nrender = function (d) { fullSerie = (d && d.serie) || fullSerie; __hookRender(d); };' +
    '\nreturn { loadData: loadData, mercadoAbierto: mercadoAbierto };');
  estado.api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));
  return estado;
}

function esperar() { return new Promise(function (r) { setTimeout(r, 60); }); }

var COMPLETO = { total: 100, cuentas: [{ nombre: 'CS', valor: 100 }], serie: [1, 2, 3], liquidez: 5, actualizado: 'a1' };
var LITE_IGUAL = { total: 100, cuentas: [{ nombre: 'CS', valor: 100 }], liquidez: 5, actualizado: 'a2', lite: true };
var LITE_CAMBIO = { total: 111, cuentas: [{ nombre: 'CS', valor: 111 }], liquidez: 5, actualizado: 'a3', lite: true };

(async function () {
  console.log('\nA) primera carga: completa, pinta y guarda');
  var m = montar({ respuestas: [Object.assign({}, COMPLETO)] });
  m.api.loadData();
  await esperar();
  ok(m.pedidos[0] === null, 'la primera carga pide el payload COMPLETO (args null)');
  ok(m.renders.length === 1, 'pinta');
  ok(m.guardados.length === 1 && m.guardados[0].serie.length === 3, 'guarda en cache CON la serie');

  console.log('\nB) poll con datos identicos: pide lite y NO repinta');
  m = montar({ respuestas: [Object.assign({}, COMPLETO), Object.assign({}, LITE_IGUAL)] });
  m.api.loadData();
  await esperar();
  m.estadoAhora = m.ahora; // el mismo minuto
  m.api.loadData();
  await esperar();
  ok(m.pedidos[1] && m.pedidos[1].lite === true, 'el poll pide {lite:true}');
  ok(m.renders.length === 1, 'NO repinta si nada cambio (repintar cerraba el TradingView abierto)');
  ok(m.guardados.length === 1, 'ni pisa el cache');

  console.log('\nC) poll con un cambio real: repinta con la serie conservada');
  m = montar({ respuestas: [Object.assign({}, COMPLETO), Object.assign({}, LITE_CAMBIO)] });
  m.api.loadData();
  await esperar();
  m.api.loadData();
  await esperar();
  ok(m.renders.length === 2, 'repinta porque el total cambio');
  ok(m.renders[1].serie && m.renders[1].serie.length === 3, 'la respuesta lite hereda la serie de la carga completa');
  ok(m.guardados.length === 2 && m.guardados[1].serie.length === 3, 'y el cache queda completo, no mutilado');

  console.log('\nD) pasados 30 min vuelve a pedir el payload completo');
  m = montar({ respuestas: [Object.assign({}, COMPLETO), Object.assign({}, COMPLETO, { actualizado: 'a9' })] });
  m.api.loadData();
  await esperar();
  m.ahora += 31 * 60 * 1000;
  m.api.loadData();
  await esperar();
  ok(m.pedidos[1] === null, 'a los 31 min pide completo de nuevo (por el punto nuevo del historico)');

  console.log('\nE) backend viejo que ignora lite: todo sigue andando');
  m = montar({ respuestas: [Object.assign({}, COMPLETO), Object.assign({}, COMPLETO, { total: 200, actualizado: 'zz' })] });
  m.api.loadData();
  await esperar();
  m.api.loadData(); // pide lite pero el backend viejo devuelve TODO igual
  await esperar();
  ok(m.renders.length === 2 && m.renders[1].total === 200, 'una respuesta completa a un pedido lite se procesa normal');

  console.log('\nF) el poll conoce el horario de la bolsa (en UTC, sin zonas horarias)');
  m = montar({ respuestas: [] });
  var ma = m.api.mercadoAbierto;
  ok(ma(DateReal.UTC(2026, 7, 18, 15, 0)) === true, 'martes 15:00 UTC -> abierta');
  ok(ma(DateReal.UTC(2026, 7, 18, 5, 0)) === false, 'martes 05:00 UTC -> cerrada');
  ok(ma(DateReal.UTC(2026, 7, 15, 15, 0)) === false, 'sabado -> cerrada');
  ok(ma(DateReal.UTC(2026, 7, 18, 21, 15)) === true, 'martes 21:15 UTC -> aun abierta (invierno de NY)');
  ok(ma(DateReal.UTC(2026, 7, 18, 22, 0)) === false, 'martes 22:00 UTC -> cerrada');

  console.log('\nG) arranque lite-first: cache fresco y completo -> el primer pedido es lite');
  var CACHE_FULL = { total: 100, cuentas: [{ nombre: 'CS', valor: 100 }], serie: [1, 2, 3], bench: { valores: [7, 8, 9] }, serieGrupo: { valores: [4, 5, 6] }, liquidez: 5, actualizado: 'c0' };
  m = montar({ token: true, cache: { t: AHORA0 - 5 * 60 * 1000, data: Object.assign({}, CACHE_FULL) }, respuestas: [Object.assign({}, LITE_CAMBIO)] });
  await esperar();
  ok(m.pedidos.length === 1 && m.pedidos[0] && m.pedidos[0].lite === true, 'con cache de 5 min el arranque pide {lite:true}');
  ok(m.renders.length >= 1 && m.guardados.length === 1 && m.guardados[0].serie.length === 3, 'la respuesta lite hereda la serie del cache y se guarda');
  ok(!!m.guardados[0].bench && !!m.guardados[0].serieGrupo, 'bench y serieGrupo se re-adjuntan: el cache queda completo para el proximo arranque');

  console.log('\nH) cache viejo (>30 min): el arranque pide completo, como siempre');
  m = montar({ token: true, cache: { t: AHORA0 - 31 * 60 * 1000, data: Object.assign({}, CACHE_FULL) }, respuestas: [Object.assign({}, COMPLETO)] });
  await esperar();
  ok(m.pedidos.length === 1 && m.pedidos[0] === null, 'primer pedido completo (args null): el grafico no se queda viejo');

  console.log('\nI) cache fresco pero sin bench/serieGrupo (anterior a v63): completo, conservador');
  m = montar({ token: true, cache: { t: AHORA0 - 5 * 60 * 1000, data: { total: 100, cuentas: [{ nombre: 'CS', valor: 100 }], serie: [1, 2, 3], liquidez: 5, actualizado: 'c2', lite: true } }, respuestas: [Object.assign({}, COMPLETO)] });
  await esperar();
  ok(m.pedidos.length === 1 && m.pedidos[0] === null, 'sin bench en el cache no se arriesga: pide completo');

  console.log('\nJ) sin cache: el arranque pide completo (el caso de siempre)');
  m = montar({ token: true, respuestas: [Object.assign({}, COMPLETO)] });
  await esperar();
  ok(m.pedidos.length === 1 && m.pedidos[0] === null, 'sin cache local, completo');

  console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
  process.exit(fallos ? 1 : 0);
})();
