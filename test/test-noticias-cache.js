// Arnés de las noticias guardadas en el teléfono (23/09/2026): "la carga de
// news esta un poco lenta cuando abro la app". Verifica que al abrir se pinte
// lo último visto (Inicio y pestaña News), que la respuesta lo reemplace, que
// una respuesta sin titulares o un fallo de red NO lo pisen, y que el pedido
// se repita como mucho cada media hora y nunca dos a la vez.
//
// Corre el código REAL: el bloque de pedirNoticias (vistas.js) y el de los
// helpers de caché local (paneles.js), sacados por sus marcadores.
var ruta = require('./_ruta');
var html = ruta.leerIndex();

var codigo = ruta.bloque(html, 'var NOTICIAS_VIGENCIA_MS', 'function showAccount(') +
  '\n' + ruta.bloque(html, 'function cacheLeer(', 'function cargarConCache(');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

var HORA = 3600000;

function montar(guardado) {
  var store = guardado ? { ga_cache_news: JSON.stringify(guardado) } : {};
  var estado = { store: store, noticias: [], macro: [], errores: [], pedidos: [], ahora: 1e12, elems: {} };
  function elem(id) {
    if (!estado.elems[id]) estado.elems[id] = { innerHTML: '', style: {} };
    return estado.elems[id];
  }
  var ctx = {
    document: { getElementById: elem },
    localStorage: {
      getItem: function (k) { return store[k] || null; },
      setItem: function (k, v) { store[k] = v; }
    },
    Date: { now: function () { return estado.ahora; } },
    fechaCortaMs: function () { return '22/09 18:40'; },
    noticiasCargadas: false,
    renderNoticias: function (d) { estado.noticias.push(d); },
    renderMacroInicio: function (d) { estado.macro.push(d); },
    errorEnVista: function (id, err) { estado.errores.push(id); },
    // El shim guarda los handlers y el arnés contesta cuando quiere, en el
    // acto: nada de asserts esperando microtasks.
    google: { script: { run: {
      withSuccessHandler: function (f) {
        var p = { ok: f };
        var api = {
          withFailureHandler: function (g) { p.falla = g; return api; },
          getNoticias: function () { estado.pedidos.push(p); }
        };
        return api;
      }
    } } }
  };
  var nombres = Object.keys(ctx);
  var fn = new Function(nombres.join(','), codigo +
    '\nreturn { pintarNoticiasCache: pintarNoticiasCache, pedirNoticias: pedirNoticias };');
  estado.api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));
  estado.elem = elem;
  estado.guardado = function () { var j = store.ga_cache_news; return j ? JSON.parse(j) : null; };
  return estado;
}

var VIEJO = { bruscos: [], mercado: [{ titulo: 'Ayer' }], macro: [{ titulo: 'Macro de ayer' }], empresas: [] };
var FRESCO = { bruscos: [], mercado: [{ titulo: 'Hoy' }], macro: [{ titulo: 'Macro de hoy' }], empresas: [] };
var VACIO = { bruscos: [], mercado: [], macro: [], empresas: [] };

console.log('\nA) al abrir, con noticias guardadas: se ven YA');
var m = montar({ t: 1e12 - 14 * HORA, data: VIEJO });
ok(m.api.pintarNoticiasCache() === true, 'pinta lo guardado');
ok(m.macro.length === 1 && m.macro[0].macro[0].titulo === 'Macro de ayer', 'la tarjeta del Inicio sale con lo guardado, sin esperar la red');
ok(m.noticias.length === 1, 'y la pestana News tambien');
ok(/Data from/.test(m.elem('newsCacheAviso').innerHTML) && /updating/.test(m.elem('newsCacheAviso').innerHTML),
  'la pestana dice de cuando son y que se estan actualizando');
ok(m.pedidos.length === 0, 'pintar lo guardado no pide nada por su cuenta');

console.log('\nB) llega la respuesta: reemplaza, guarda y saca el aviso');
m.api.pedirNoticias();
ok(m.pedidos.length === 1, 'sale un pedido');
m.pedidos[0].ok(FRESCO);
ok(m.macro[m.macro.length - 1].macro[0].titulo === 'Macro de hoy', 'el Inicio pasa a lo fresco');
ok(m.guardado().data.macro[0].titulo === 'Macro de hoy', 'y queda guardado para la proxima apertura');
ok(m.elem('newsCacheAviso').style.display === 'none', 'el aviso se va');

console.log('\nC) la vigencia: nada antes de media hora, uno despues');
m.api.pedirNoticias();
ok(m.pedidos.length === 1, 'recien llegado: el poll de 60 s no vuelve a pedir');
m.ahora += 29 * 60000;
m.api.pedirNoticias();
ok(m.pedidos.length === 1, 'a los 29 min tampoco');
m.ahora += 2 * 60000;
m.api.pedirNoticias();
ok(m.pedidos.length === 2, 'a los 31 min si: la PWA que quedo viva desde anoche no muestra lo de anoche');

console.log('\nD) nunca dos a la vez');
m = montar(null);
m.api.pedirNoticias();
m.api.pedirNoticias();
m.api.pedirNoticias();
ok(m.pedidos.length === 1, 'tres toques con el pedido en vuelo: UN pedido');
m.pedidos[0].falla(new Error('Load failed'));
m.api.pedirNoticias();
ok(m.pedidos.length === 2, 'si fallo, el siguiente llamado reintenta');

console.log('\nE) sin red y con algo guardado: la pantalla no se borra');
m = montar({ t: 1e12 - 3 * HORA, data: VIEJO });
m.api.pintarNoticiasCache();
m.api.pedirNoticias();
m.pedidos[0].falla(new Error('Load failed'));
ok(m.errores.length === 0, 'no se pinta el error encima de los titulares');
ok(/could not update/.test(m.elem('newsCacheAviso').innerHTML), 'avisa que no pudo actualizar');
ok(m.guardado().data.macro[0].titulo === 'Macro de ayer', 'lo guardado sigue ahi');

console.log('\nF) sin red y sin nada guardado: el error de siempre');
m = montar(null);
ok(m.api.pintarNoticiasCache() === false, 'no hay nada que pintar');
m.api.pedirNoticias();
m.pedidos[0].falla(new Error('Load failed'));
ok(m.errores[0] === 'noticiasBody', 'la pestana muestra el error, con reintento al volver a entrar');

console.log('\nG) los feeds caidos (respuesta sin titulares) no pisan lo guardado');
m = montar({ t: 1e12 - 3 * HORA, data: VIEJO });
m.api.pintarNoticiasCache();
m.api.pedirNoticias();
m.pedidos[0].ok(VACIO);
ok(m.guardado().data.macro[0].titulo === 'Macro de ayer', 'lo guardado no se reemplaza por nada');
ok(m.macro.length === 1, 'la tarjeta del Inicio no se apaga');
ok(/could not update/.test(m.elem('newsCacheAviso').innerHTML), 'y la pestana lo dice');
m.api.pedirNoticias();
ok(m.pedidos.length === 2, 'el proximo poll reintenta (no cuenta como cargado)');

console.log('\nH) sin nada guardado, una respuesta vacia se muestra como vacia');
m = montar(null);
m.api.pedirNoticias();
m.pedidos[0].ok(VACIO);
ok(m.noticias.length === 1 && m.guardado() === null, 'pinta el "no hay noticias" y no guarda el vacio');

console.log('\nI) lo guardado se borra con "Olvide mi clave" y se pinta al arrancar');
var paneles = require('fs').readFileSync(require('path').join(ruta.RUTA, 'js', 'paneles.js'), 'utf8');
ok(/var GA_CACHES = \[[^\]]*'ga_cache_news'/.test(paneles), 'ga_cache_news esta en GA_CACHES (el borrado de emergencia la recorre)');
var arranque = require('fs').readFileSync(require('path').join(ruta.RUTA, 'js', 'arranque.js'), 'utf8');
ok(/if \(getApiToken\(\)\) \{ pintarCache\(\); pintarNoticiasCache\(\); loadData\(\); \}/.test(arranque),
  'el arranque pinta las noticias guardadas antes de pedir nada');
ok(html.indexOf('<div id="newsCacheAviso" style="display:none"></div>\n<div id="noticiasBody">') !== -1 ||
   html.indexOf('<div id="newsCacheAviso" style="display:none"></div>\r\n<div id="noticiasBody">') !== -1,
  'el aviso de la pestana esta justo arriba de las noticias');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
