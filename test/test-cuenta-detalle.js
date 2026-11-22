// El detalle de una cuenta con el diseno del Inicio (8/09/2026).
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var asserts = 0, fallos = 0;
function ok(cond, msg) { asserts++; if (!cond) { fallos++; console.log('  FALLA: ' + msg); } else console.log('  ok   ' + msg); }

var src = (html.match(/function renderAccount\(acc, data\) \{[\s\S]*?\n\}\n/) || [''])[0];
ok(!!src, 'encuentro renderAccount');
// El valor va sin el "USD " adelante desde el 21/11/2026 (valorPelado): con el
// prefijo, a 375 px el % de ganancia quedaba cortado. Que de verdad salga
// pelado y con el ojito respetado lo prueba test-corte-grupo, EJECUTANDO.
ok(/celdaInstrumentoHtml\(h, esc\(valorPelado\(h\.valor\)\) \+ ' ' \+ gananciaHtml\(h\)\)/.test(src), 'la fila lleva el logo con las iniciales de respaldo, y abajo del simbolo el valor en dolares (sin prefijo) con la ganancia acumulada');
// El arnes recorta renderAccount en la primera llave de cierre al principio de
// una linea: si el recorte quedo entero, llega hasta el final de la funcion.
ok(/toggleDetalle\(tr, \{[^\n]*\n[^\n]*body\.appendChild\(tr\);\n\}\);\n\}\n$/.test(src), 'y el recorte de renderAccount llega entero hasta su cierre (nadie puso una llave al principio de linea adentro)');
ok(/class="col-spark">' \+ sparkDe\(h\)/.test(src), 'y el mini-grafico del mes');
ok(/daychgHtml\(h\) \+ esc\(fmtNum\(h\.precioActual\)\) \+ compra/.test(src), 'el % del dia arriba del precio, y el precio medio de compra debajo');
ok(/class="pcmini">avg /.test(src), 'el precio medio va en chico, como "avg"');
// Que las filas de cash (USDT, LIQUIDEZ) no se listen se prueba EJECUTANDO el
// render, en test-corte-grupo.js. Acá vivía un assert que exigía el texto
// `if (esFilaCash(h)) return;` y se puso rojo el 14/09 al mover ese mismo
// filtro a un .filter() — sin que cambiara nada de lo que hace. Un assert que
// se rompe con un cambio de forma y no con uno de conducta no está cuidando
// nada: acá queda solo que el filtro SE CONSULTE.
ok(/esFilaCash\(h\)/.test(src), 'la tabla consulta esFilaCash (la exclusión en sí la verifica test-corte-grupo, ejecutando)');
ok(/engancharLogos\(tr\)/.test(src), 'los logos que no cargan caen a las iniciales');
ok(/h\.cripto = true;/.test(src), 'en Binance las filas se marcan cripto para el logo y el tipo');
var thead = (html.match(/<tbody id="accBody">/) || []).index;
var tabla = html.slice(Math.max(0, thead - 400), thead);
ok(/<table class="holdtable holdhome">/.test(tabla), 'la tabla usa las clases del Inicio: tres columnas, sin cabecera visible');
ok(/<th class="col-spark">Month<\/th>/.test(tabla), 'con la columna del mes en el encabezado');
ok(/\.pcmini \{/.test(html) && /\.accval \.daychg \{ display: inline/.test(html), 'los estilos .pcmini y .accval existen (la ganancia va en linea)');

// BTG tiene que dejar anotado que ES la cuenta abierta (14/09/2026).
//
// ALCANCE: esto mira el codigo escrito, no el resultado. No hay arnes que
// ejecute showAccount (depende de google.script.run y de media pantalla), asi
// que es un candado contra la regresion, no una medicion.
//
// Por que importa: `lastAcc` solo lo escribia renderAccount, por donde BTG no
// pasa — sale antes por su propio camino. Con eso, guardar un corte de BTG te
// llevaba a la cuenta anterior (o no hacia nada si BTG era la primera de la
// sesion), y cambiar tema o paleta repintaba otra cuenta bajo su titulo.
// Lo encontro una auditoria por agentes.
ok(/if \(esBtg\(acc\)\) \{ lastAcc = acc; lastAccData = null; mostrarBtg\(\); return; \}/.test(html),
   'la rama de BTG anota lastAcc (y deja lastAccData en null, para que los repintados se abstengan)');

// ===========================================================================
// Las paginas de cuenta abren al instante (bucle de mejora del 21/11/2026).
// ===========================================================================
// showAccount solo recordaba EN MEMORIA la ultima cuenta vista: tras reabrir
// la app, cada cuenta mostraba "Loading..." hasta que contestaba el backend.
// Ahora la ultima respuesta SANA de cada cuenta queda en el telefono, bajo UNA
// clave (`ga_cache_acc`, un mapa por cuenta), y se pinta enseguida.
//
// Esto SI ejecuta showAccount: la app cargada entera (_entorno.js), un DOM que
// recuerda lo que se le escribio y un backend de mentira que contesta cuando
// el arnes lo decide — asi se ve que pasa ANTES de la respuesta.
// Los numeros son inventados (el repo es publico).
console.log('\nLas cuentas abren con lo guardado en el telefono');
var entorno = require('./_entorno');
function montar(storage) {
  var c = entorno.cargar(storage || {});
  var g = c.ambito;
  var elems = {};
  g.document.getElementById = function (id) {
    if (elems[id]) return elems[id];
    var e = entorno.elemento();
    e.id = id; e.filas = []; e.textos = [];
    var h = '', t = '';
    Object.defineProperty(e, 'innerHTML', { get: function () { return h; }, set: function (v) { h = String(v); e.filas = []; } });
    Object.defineProperty(e, 'textContent', { get: function () { return t; }, set: function (v) { t = String(v); e.textos.push(t); } });
    e.appendChild = function (x) { e.filas.push(x); return x; };
    elems[id] = e;
    return e;
  };
  // El backend: cada pedido queda anotado con sus dos manejadores, sin contestar.
  var pedidos = [];
  function cadena(exito, fallo) {
    return new Proxy({}, { get: function (o, k) {
      if (k === 'withSuccessHandler') return function (f) { return cadena(f, fallo); };
      if (k === 'withFailureHandler') return function (f) { return cadena(exito, f); };
      return function (arg) { pedidos.push({ fn: k, arg: arg, exito: exito, fallo: fallo }); };
    } });
  }
  g.google = { script: { run: cadena(null, null) } };
  // La tarjeta del rendimiento historico pide lo suyo aparte: aca no importa.
  g.mostrarRendimiento = function () {};
  function cuenta(key, nombre) {
    return g.ACCOUNTS.filter(function (a) { return a.key === key; })[0] || { key: key, nombre: nombre };
  }
  return {
    c: c, g: g, el: g.document.getElementById, cuenta: cuenta,
    deCuenta: function () { return pedidos.filter(function (p) { return p.fn === 'getAccountData'; }); },
    guardado: function () { return g.localStorage.getItem('ga_cache_acc'); }
  };
}
var datosIB = { total: 40000, liquidez: 500, posiciones: [
  { symbol: 'ASML', nombre: 'ASML Holding', tipo: 'accion', valor: 27500, qty: 12, precioActual: 1592, precioCompra: 900 },
  { symbol: 'OMF', nombre: 'OneMain', tipo: 'accion', valor: 12000, qty: 200, precioActual: 60, precioCompra: 45 }
] };
var datosCS = { total: 72370, liquidez: 1947, posiciones: [
  { symbol: 'VOO', nombre: 'Vanguard S&P 500', tipo: 'etf', valor: 23593, qty: 33, precioActual: 715, precioCompra: 431.9 }
] };

// --- primera vez: nada guardado, se espera al backend y la respuesta se guarda
var m1 = montar({});
ok(m1.c.errores.length === 0, 'la app carga entera' + (m1.c.errores.length ? ': ' + m1.c.errores.join(' | ') : ''));
ok(m1.g.GA_CACHES.indexOf('ga_cache_acc') !== -1, 'ga_cache_acc esta en GA_CACHES: el borrado de emergencia se la lleva');
var ib1 = m1.cuenta('IB', 'IBKR'), cs1 = m1.cuenta('CS', 'Charles Schwab');
m1.g.showAccount(ib1, 'portafolio');
ok(m1.el('accTotal').textContent === 'Loading...' && m1.guardado() === null, 'sin nada guardado, la primera vez espera (y todavia no hay nada en el telefono)');
ok(m1.deCuenta().length === 1 && m1.deCuenta()[0].arg === 'IB', 'y pide la cuenta al backend');
m1.deCuenta()[0].exito(datosIB);
var mapa1 = (JSON.parse(m1.guardado() || 'null') || {}).data || {};
ok(m1.el('accTotal').textContent === 'USD 40,000' && m1.el('accBody').filas.length === 2, 'la respuesta se pinta');
ok(!!mapa1.IB && mapa1.IB.data.total === 40000 && mapa1.IB.data.posiciones.length === 2 && mapa1.IB.t > 0,
   'y la respuesta sana queda guardada bajo ga_cache_acc, en la entrada de ESA cuenta');
m1.g.showAccount(cs1, 'portafolio');
m1.deCuenta()[1].exito(datosCS);
var mapa2 = (JSON.parse(m1.guardado() || 'null') || {}).data || {};
ok(mapa2.CS && mapa2.CS.data.total === 72370 && mapa2.IB && mapa2.IB.data.total === 40000 && Object.keys(mapa2).length === 2,
   'otra cuenta se suma al MISMO mapa sin pisar la anterior (una sola clave, un casillero por cuenta)');
var claves = m1.g.GA_CACHES.filter(function (k) { return m1.g.localStorage.getItem(k) !== null; });
ok(claves.join(',') === 'ga_cache_acc', 'y no se creo ninguna clave por cuenta: ' + claves.join(','));

// --- la app "recien abierta": memoria vacia, solo lo guardado en el telefono
// (La foto se arma a mano, con la forma que escribe la app —que ya se probo
// arriba—, para que esta parte no dependa de que la anterior haya guardado.)
var foto = JSON.stringify({ t: 1, data: { IB: { t: 1, data: datosIB }, CS: { t: 1, data: datosCS } } });
var m2 = montar({ ga_cache_acc: foto });
var ib2 = m2.cuenta('IB', 'IBKR');
ok(m2.g.lastAcc === null && m2.g.lastAccData === null, 'app recien abierta: en memoria no hay ninguna cuenta');
m2.g.showAccount(ib2, 'portafolio');
ok(m2.el('accTotal').textContent === 'USD 40,000' && m2.el('accBody').filas.length === 2,
   'la cuenta se pinta ANTES de que conteste el backend: ' + m2.el('accTotal').textContent);
ok(m2.el('accTotal').textos.indexOf('Loading...') === -1, 'y sin pasar por "Loading..."');
ok(m2.deCuenta().length === 1 && m2.deCuenta()[0].arg === 'IB', 'igual se pide lo fresco por detras');

// --- un {ok:false} o un fallo de red no pisan lo pintado ni lo guardado
m2.deCuenta()[0].exito({ ok: false, error: 'boom' });
ok(m2.el('accTotal').textContent === 'USD 40,000' && m2.el('accBody').filas.length === 2, 'un {ok:false} no pisa lo que se ve');
ok(m2.guardado() === foto, 'ni lo guardado');
m2.deCuenta()[0].fallo({ message: 'network' });
ok(m2.el('accTotal').textContent === 'USD 40,000' && m2.el('accError').innerHTML === '' && m2.guardado() === foto,
   'un fallo de red tampoco: ni borra la pantalla ni muestra un error encima de los datos');

// --- y lo fresco, cuando llega sano, reemplaza la pantalla y lo guardado
m2.deCuenta()[0].exito({ total: 41250, liquidez: 300, posiciones: [datosIB.posiciones[0]] });
var mapa3 = (JSON.parse(m2.guardado() || 'null') || {}).data || {};
ok(m2.el('accTotal').textContent === 'USD 41,250' && m2.el('accBody').filas.length === 1, 'lo fresco reemplaza lo pintado');
ok(mapa3.IB && mapa3.IB.data.total === 41250 && mapa3.CS && mapa3.CS.data.total === 72370, 'y lo guardado de esa cuenta (la otra queda como estaba)');

// --- la respuesta tardia de OTRA cuenta no se guarda bajo la que esta abierta
var m3 = montar({ ga_cache_acc: foto });
m3.g.showAccount(m3.cuenta('IB', 'IBKR'), 'portafolio');
m3.g.showAccount(m3.cuenta('CS', 'Charles Schwab'), 'portafolio');
m3.deCuenta()[0].exito({ total: 99999, liquidez: 0, posiciones: [] });
ok(m3.guardado() === foto && m3.el('accTotal').textContent === 'USD 72,370', 'una respuesta tardia de la cuenta anterior no toca ni la pantalla ni lo guardado');
console.log(asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
