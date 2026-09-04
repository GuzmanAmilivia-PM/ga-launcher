// Arnés de aplicarExtras (R1, js/paneles.js): los agregados que llegan con el
// payload completo alimentan los caches locales, pintan los paneles y los
// marcan como cargados — el primer deslizado no paga su propia llamada. Un
// payload con ok:false no pisa nada.
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var codigo = ruta.bloque(html,
  '// ---------- R1: agregados que llegan con el dashboard ----------',
  'var divChartInstance');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

function montar() {
  var estado = { guardados: {}, renders: [], marcas: [], alturas: 0 };
  var ctx = {
    cacheGuardar: function (clave, data) { estado.guardados[clave] = data; },
    renderDividendos: function (r) { estado.renders.push(['div', r]); },
    renderAportes: function (r) { estado.renders.push(['apo', r]); },
    renderAnalisis: function (r) { estado.renders.push(['ana', r]); },
    // Desde el 31/08/2026 aplicarExtras pinta TAMBIEN la pagina Analysis y el
    // tablero (antes solo la tarjeta: entrar a Analysis en el telefono quedaba
    // con los spinners eternos), y deja anaUltima seteada.
    renderAnalisisDetalle: function (r) { estado.renders.push(['anaDet', r]); },
    renderAsignacionTablero: function (r) { estado.renders.push(['anaTab', r]); },
    anaUltima: null,
    limpiarMarca: function (id) { estado.marcas.push(id); },
    ajustarAlturaDeck: function () { estado.alturas++; },
    divCargado: false, apoCargado: false, anaCargado: false,
    console: { error: function () {} }
  };
  var nombres = Object.keys(ctx);
  var fn = new Function(nombres.join(','), codigo +
    '\nreturn { aplicarExtras: aplicarExtras, flags: function () { return { d: divCargado, a: apoCargado, an: anaCargado, anaUltima: anaUltima }; } };');
  estado.api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));
  return estado;
}

console.log('\nA) extras completo: guarda, pinta y marca los tres paneles');
var m = montar();
var DIV = { ok: true, anio: 2026 }, APO = { ok: true, aportes: 500 }, ANA = { ok: true, puntaje: 90 };
m.api.aplicarExtras({ dividendos: DIV, aportes: APO, analisis: ANA });
ok(m.guardados['ga_cache_div'] === DIV && m.guardados['ga_cache_apo'] === APO && m.guardados['ga_cache_ana'] === ANA, 'los tres caches locales quedan alimentados');
var tipos = m.renders.map(function (r) { return r[0]; });
ok(tipos.join(',') === 'div,apo,ana,anaDet,anaTab', 'los tres paneles se pintan, y el analisis pinta SUS TRES pantallas: ' + tipos.join(','));
var f = m.api.flags();
ok(f.d === true && f.a === true && f.an === true, 'quedan marcados como cargados: el deslizado no vuelve a pedir');
ok(f.anaUltima === ANA, 'anaUltima queda seteada: entrar a Analysis pinta al instante, sin spinners eternos');
ok(m.alturas === 1, 'la tarjeta deslizable reajusta su altura');
ok(m.marcas.indexOf('divCacheAviso') !== -1 && m.marcas.indexOf('apoCacheAviso') !== -1 && m.marcas.indexOf('anaCacheAviso') !== -1, 'las marcas de "actualizando" se limpian');

console.log('\nB) un payload con ok:false no pisa nada');
m = montar();
m.api.aplicarExtras({ dividendos: { ok: false, mensajes: ['x'] }, aportes: APO });
ok(m.guardados['ga_cache_div'] === undefined, 'el dividendos roto NO se guarda');
ok(m.api.flags().d === false, 'ni se marca cargado (el deslizado lo va a pedir aparte)');
ok(m.guardados['ga_cache_apo'] === APO && m.api.flags().a === true, 'los aportes sanos siguen entrando');

console.log('\nC) extras parcial o vacio: solo lo que vino');
m = montar();
m.api.aplicarExtras({ analisis: ANA });
ok(m.renders.map(function (r) { return r[0]; }).join(',') === 'ana,anaDet,anaTab', 'solo el analisis (sus tres pantallas)');
ok(m.api.flags().d === false && m.api.flags().a === false, 'los otros paneles quedan como estaban');
m = montar();
m.api.aplicarExtras({});
ok(m.renders.length === 0 && Object.keys(m.guardados).length === 0, 'vacio: no pasa nada');

// El ojito de privacidad (arranque.js) repinta TAMBIEN los paneles lentos
// desde su cache local (auditoria 19/08/2026: si los extras no viajaron en el
// ultimo payload, Dividendos/Aportes/Analisis quedaban mostrando los montos
// con el ojo cerrado). La bandera *Cargado evita tapar un error con datos.
console.log('\nD) el ojito repinta tambien los paneles lentos');
var OJITO = ruta.bloque(html,
  '// ---------- Ojito de privacidad ----------',
  '// ---------- Carga de datos ----------');
function montarOjito(flags, caches) {
  var est = { renders: [] };
  var els = {};
  function el(id) { return els[id] || (els[id] = { onclick: null }); }
  var ctx = {
    document: { getElementById: el },
    localStorage: { setItem: function () {} },
    montosOcultos: false,
    pintarOjo: function () {},
    lastData: null, render: function () {},
    lastAcc: null, lastAccData: null, renderAccount: function () {},
    lastOps: null, renderOperaciones: function () { est.renders.push(['ops', null]); },
    cacheLeer: function (clave) { return caches[clave] || null; },
    divCargado: flags.d, apoCargado: flags.a, anaCargado: flags.an,
    renderDividendos: function (r) { est.renders.push(['div', r]); },
    renderAportes: function (r) { est.renders.push(['apo', r]); },
    renderAnalisis: function (r) { est.renders.push(['ana', r]); }
  };
  var nombres = Object.keys(ctx);
  new Function(nombres.join(','), OJITO).apply(null, nombres.map(function (n) { return ctx[n]; }));
  est.click = function () { els.eyeBtn.onclick(); };
  return est;
}
var DDIV = { ok: true, anio: 2026 };
var mo = montarOjito({ d: true, a: true, an: true }, {
  ga_cache_div: { t: 1, data: DDIV },
  ga_cache_apo: { t: 1, data: APO },
  ga_cache_ana: { t: 1, data: ANA }
});
mo.click();
ok(mo.renders.length === 3 && mo.renders[0][1] === DDIV && mo.renders[1][1] === APO && mo.renders[2][1] === ANA,
  'con los tres paneles cargados, el toggle los repinta desde el cache local');
mo = montarOjito({ d: false, a: true, an: false }, {
  ga_cache_div: { t: 1, data: DDIV },
  ga_cache_apo: { t: 1, data: APO },
  ga_cache_ana: { t: 1, data: ANA }
});
mo.click();
ok(mo.renders.length === 1 && mo.renders[0][0] === 'apo',
  'un panel en error o sin cargar NO se repinta (no se tapa el error con datos viejos)');
mo = montarOjito({ d: true, a: true, an: true }, {});
mo.click();
ok(mo.renders.length === 0, 'sin cache local no hay nada que repintar');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
