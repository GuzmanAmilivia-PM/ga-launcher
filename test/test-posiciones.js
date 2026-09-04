// Arnés de los dos porcentajes de la tabla de posiciones (17/08/2026).
// Pedido de Guzmán: el % del día va arriba del PRECIO (es el número que se movió
// hoy) y arriba del VALOR va la ganancia acumulada, precio medio de compra contra
// precio actual. Antes el % del día estaba arriba del valor, donde se leía como
// si fuera la ganancia de la posición.
//
// Las dos tablas —Principales posiciones (Inicio) y Portafolio— arman la fila con
// la MISMA línea repetida en dos archivos, así que acá se verifica el orden de las
// celdas en las dos: si alguien arregla una y se olvida de la otra, la app diría
// dos cosas distintas del mismo dato.
var ruta = require('./_ruta');
var fs = require('fs');
var path = require('path');
var html = ruta.leerIndex();
var codigo = ruta.bloque(html,
  '// Variacion del dia de mercado',
  '// ---------- Reparto de Principales posiciones ----------');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

// pctHtml, signoPct, esc y fmtNum viven en nucleo.js (E6 / auditoria 19-08):
// se inyectan las implementaciones REALES.
var pctHtmlSrc = (html.match(/function pctHtml[\s\S]*?\n\}/) || [''])[0];
var signoPctSrc = (html.match(/function signoPct[^\n]*\}/) || [''])[0];
var escSrc = (html.match(/function esc\(s\)[\s\S]*?\n\}/) || [''])[0];
var fmtNumSrc = (html.match(/function fmtNum[\s\S]*?\n\}/) || [''])[0];
// esFilaCash decide si una fila SIN variacion del dia es plata quieta (celda
// vacia, correcta) o un valor sin precio de hoy (marca "not priced"). Se
// inyecta la REAL, como el resto: con un doble de mentira el arnes probaria
// su propia idea de que es cash, que es justo lo que no hay que duplicar.
var cashSrc = (html.match(/var SIMBOLOS_CASH = \[[^\]]*\];/) || [''])[0] + '\n' +
  (html.match(/function esFilaCash[\s\S]*?\n\}/) || [''])[0];
if (!pctHtmlSrc || !signoPctSrc || !escSrc || !fmtNumSrc) { console.log('  FALLA: no encuentro pctHtml/signoPct/esc/fmtNum en nucleo.js'); process.exit(1); }
if (cashSrc.indexOf('function esFilaCash') === -1) { console.log('  FALLA: no encuentro esFilaCash/SIMBOLOS_CASH en nucleo.js'); process.exit(1); }
var ctx = { Number: Number, isFinite: isFinite };
var nombres = Object.keys(ctx);
var fn = new Function(nombres.join(','), signoPctSrc + '\n' + pctHtmlSrc + '\n' + escSrc + '\n' + fmtNumSrc + '\n' + cashSrc + '\n' + codigo +
  '\nreturn { daychgHtml: daychgHtml, gananciaHtml: gananciaHtml, filaHoldingHtml: filaHoldingHtml, logoUrl: logoUrl, sinLogo: _sinLogo, fmtNum: fmtNum, SPARK_H: SPARK_H, SPARK_W: SPARK_W, sparkSvg: sparkSvg, esFilaCash: esFilaCash };');
var api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));

console.log('\nA) el % del dia');
ok(api.daychgHtml({ cambioDia: 2.117 }).indexOf('+2.12%') !== -1, 'positivo con signo y dos decimales');
ok(api.daychgHtml({ cambioDia: 2.117 }).indexOf('up') !== -1, 'positivo en verde');
ok(api.daychgHtml({ cambioDia: -0.14 }).indexOf('-0.14%') !== -1 && api.daychgHtml({ cambioDia: -0.14 }).indexOf('down') !== -1, 'negativo en rojo');
ok(api.daychgHtml({ cambioDia: 0 }).indexOf('+0.00%') !== -1, 'cero es un dato y se muestra');
// D8 (31/08/2026) — ANTES estos tres esperaban celda vacia para TODO lo que
// no tuviera variacion del dia. Eso mezclaba dos cosas muy distintas: el
// cash, que no cotiza porque no se mueve, y un valor cuyo precio de hoy no
// llego. En la segunda, la celda vacia se lee igual que "no se movio" — y no
// saber no es lo mismo que no moverse. Ahora el valor lleva marca y el cash
// no. Si algun dia alguien "limpia" esto devolviendo la celda vacia a los
// dos casos, estos asserts se ponen en rojo, que es el punto.
ok(api.daychgHtml({ symbol: 'MSFT', cambioDia: null }).indexOf('not priced') !== -1,
  'valor sin precio de hoy: lo dice, no deja la celda muda');
ok(api.daychgHtml({ symbol: 'MSFT', cambioDia: '' }).indexOf('not priced') !== -1, 'idem con el vacio');
ok(api.daychgHtml({ symbol: 'MSFT' }).indexOf('not priced') !== -1, 'idem sin la propiedad');
ok(api.daychgHtml({ symbol: 'MSFT', cambioDia: 'x' }).indexOf('not priced') !== -1, 'idem con basura');
ok(api.daychgHtml({ symbol: 'USDT', cambioDia: null }) === '', 'el cash no lleva marca: no cotiza porque no se mueve');
ok(api.daychgHtml({ symbol: 'LIQUIDEZ', cambioDia: null }) === '', 'la liquidez de una cuenta tampoco');
ok(api.daychgHtml({ symbol: 'ITAU', tipo: 'cash', cambioDia: null }) === '', 'ni la fila marcada como cash por el backend');
ok(api.daychgHtml({ symbol: 'MSFT', cambioDia: 1.2 }).indexOf('not priced') === -1,
  'con el dato no aparece ninguna marca');
// La marca tiene que ocupar el MISMO renglon que ocuparia el %: arriba del
// precio y sola. La primera version reusaba .wl-viejo (la clase de la
// watchlist, que es INLINE) y quedaba pegada al precio — "not priced512.3"
// — mientras la fila de al lado mostraba su % arriba. Ninguna medida lo
// delataba: la celda entraba igual y la fila media lo mismo. Lo cazo una
// captura de pantalla. Este arnes no tiene navegador, asi que lo unico que
// puede vigilar es que se use la clase hermana de .daychg y no otra.
ok(/class="daystale"/.test(api.daychgHtml({ symbol: 'MSFT', cambioDia: null })),
  'la marca usa .daystale, la clase que —como .daychg— es display:block');
ok(api.daychgHtml({ symbol: 'MSFT', cambioDia: null }).indexOf('wl-viejo') === -1,
  'y NO la de la watchlist, que es inline y la pega al precio');

console.log('\nA2) que cuenta como plata quieta (una sola definicion, D8)');
// El detalle de una cuenta NO trae `tipo` (getAccountData devuelve la fila de
// la hoja sin clasificar), asi que la regla tiene que funcionar tambien por
// simbolo o por nombre — si no, el cash de Itau y el de Binance saldrian
// marcados como "sin precio" en la pagina de su cuenta.
ok(api.esFilaCash({ tipo: 'cash', symbol: 'LOQUESEA' }) === true, 'el tipo del backend manda cuando esta');
ok(api.esFilaCash({ tipo: 'accion', symbol: 'ITAU' }) === false, 'y manda TAMBIEN para decir que NO es cash');
ok(api.esFilaCash({ symbol: 'USDT' }) === true, 'sin tipo, cae al simbolo');
ok(api.esFilaCash({ symbol: 'usdt' }) === true, 'sin importar mayusculas');
ok(api.esFilaCash({ symbol: 'X', descripcion: 'Liquidez de la cuenta' }) === true, 'o al nombre de la fila');
ok(api.esFilaCash({ symbol: 'MSFT' }) === false, 'una accion no es cash');
ok(api.esFilaCash(null) === false, 'sin fila no explota');

console.log('\nB) la ganancia sobre el precio medio de compra');
ok(api.gananciaHtml({ precioCompra: 100, precioActual: 112.5 }).indexOf('+12.50%') !== -1, 'compro a 100 y vale 112,5 -> +12,50%');
ok(api.gananciaHtml({ precioCompra: 100, precioActual: 112.5 }).indexOf('up') !== -1, 'ganancia en verde');
var perdida = api.gananciaHtml({ precioCompra: 200, precioActual: 150 });
ok(perdida.indexOf('-25.00%') !== -1 && perdida.indexOf('down') !== -1, 'compro a 200 y vale 150 -> -25% en rojo');
// Sin precio de compra NO se muestra un cero: el promedio sale de las hojas de
// cada cuenta y hay posiciones que no lo tienen. Un cero afirmaria "no ganaste
// nada", que es distinto de "no sé".
ok(api.gananciaHtml({ precioCompra: null, precioActual: 100 }) === '', 'sin precio de compra, nada (no un 0%)');
ok(api.gananciaHtml({ precioCompra: 0, precioActual: 100 }) === '', 'precio de compra en cero no divide');
ok(api.gananciaHtml({ precioCompra: 100, precioActual: null }) === '', 'sin precio actual, nada');
ok(api.gananciaHtml({ precioCompra: 'x', precioActual: 100 }) === '', 'basura en el precio de compra, nada');

console.log('\nC) cada porcentaje en su columna, en las DOS tablas');
function celdas(archivo) {
  var src = fs.readFileSync(path.join(ruta.RUTA, 'js', archivo), 'utf8');
  var i = src.indexOf("esc(fmtNum(h.precioActual))");
  if (i < 0) return null;
  // La fila se arma en lineas seguidas: precio, valor (y en Inicio, el % del
  // total). El corte es holdpct (Inicio) o el onclick de la fila (cuenta).
  var fin = src.indexOf('holdpct', i);
  if (fin === -1) fin = src.indexOf('toggleDetalle', i);
  return src.slice(src.lastIndexOf('<td>', i - 20), fin);
}
// Las DOS tablas dejaron de decir lo mismo A PROPOSITO el 22/08/2026: Guzman
// pidio sacar de "Principales posiciones" primero el monto en dolares y
// despues la ganancia acumulada. Esa tabla quedo como una LISTA DE MERCADO
// (simbolo, tendencia del mes, precio con su variacion del dia); el detalle de
// cuenta sigue siendo el ESTADO DE CUENTA y conserva los dos datos.
// Lo unico que las dos comparten: el % del dia va ARRIBA del precio.
['graficos.js', 'vistas.js'].forEach(function (f) {
  var trozo = celdas(f);
  ok(trozo !== null, f + ': encuentro la fila de la tabla');
  if (!trozo) return;
  var iDay = trozo.indexOf('daychgHtml(h)');
  var iPrecio = trozo.indexOf('fmtNum(h.precioActual)');
  ok(iDay !== -1 && iDay < iPrecio, f + ': el % del dia va ARRIBA del precio');
  ok(trozo.indexOf('daychgHtml(h)', iPrecio) === -1, f + ': el % del dia NO quedo tambien mas abajo');
});
console.log('\nC2) Inicio = lista de mercado; detalle de cuenta = estado de cuenta');
// La fila del Inicio se mira ENTERA (celdas() corta en holdpct, que ahora es
// la celda siguiente al precio): si alguien repone el monto o la ganancia ahi,
// estos asserts fallan.
var filaInicio = (fs.readFileSync(path.join(ruta.RUTA, 'js', 'graficos.js'), 'utf8')
  .match(/function filaHoldingHtml[\s\S]*?(?=\/\/ ---------- Reparto de Principales)/) || [''])[0];
var trozoCuenta = celdas('vistas.js');
ok(filaInicio.indexOf('fmt(h.valor)') === -1,
  'el Inicio YA NO muestra el monto en dolares');
ok(filaInicio.indexOf('gananciaHtml(h)') === -1,
  'ni la ganancia acumulada: quedo como lista de mercado');
ok(trozoCuenta && trozoCuenta.indexOf('fmt(h.valor)') !== -1,
  'el detalle de cuenta conserva el monto: no se toco');
ok(trozoCuenta && trozoCuenta.indexOf('gananciaHtml(h)') !== -1,
  'y conserva la ganancia acumulada');

console.log('\nD) el poll no cierra el detalle abierto: actualizacion en el lugar');
// Bloque con toggleDetalle + renderHoldings, evaluado con un DOM de mentira
// que modela parentNode/insertBefore/nextSibling (toggleDetalle los usa).
var codigo2 = ruta.bloque(html,
  '// ---------- Detalle desplegable por activo + grafico TradingView ----------',
  '// ---------- Retirar / Depositar liquidez ----------');
// Los rotulos de las secciones, sacados de vistas.js. Eran una copia escrita a
// mano en este mismo archivo, asi que los tres asserts del texto de las
// cabeceras verificaban el fixture del propio test: renombrar las secciones en
// la app no rompia nada. Auditoria del 24/08/2026.
function tipoLabelsReales() {
  var src = fs.readFileSync(path.join(ruta.RUTA, 'js', 'vistas.js'), 'utf8');
  var m = src.match(/var TIPO_LABELS = \{[^}]*\};/);
  if (!m) { console.log('  FALLA: no encuentro TIPO_LABELS en vistas.js'); process.exit(1); }
  return new Function(m[0] + '\nreturn TIPO_LABELS;')();
}
function nodo(tag) {
  var n = {
    tag: tag || 'div', children: [], parentNode: null, className: '', style: {},
    textContent: '', colSpan: 0, _wired: false, _html: '', src: '',
    setAttribute: function () {}, addEventListener: function () {},
    appendChild: function (c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = n; n.children.push(c); return c; },
    removeChild: function (c) { var i = n.children.indexOf(c); if (i !== -1) n.children.splice(i, 1); c.parentNode = null; return c; },
    insertBefore: function (c, ref) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = n; var i = ref ? n.children.indexOf(ref) : -1; if (i === -1) n.children.push(c); else n.children.splice(i, 0, c); return c; },
    querySelector: function () { return nodo('div'); }
  };
  Object.defineProperty(n, 'innerHTML', {
    get: function () { return n._html; },
    set: function (v) { n._html = v; n.children.forEach(function (c) { c.parentNode = null; }); n.children = []; }
  });
  Object.defineProperty(n, 'nextSibling', {
    get: function () { if (!n.parentNode) return null; var i = n.parentNode.children.indexOf(n); return n.parentNode.children[i + 1] || null; }
  });
  return n;
}
var elHold = nodo('tbody'), btnHold = nodo('button');
var pedidosFund = [];
var ctx2 = {
  document: {
    getElementById: function (id) { return id === 'holdingsList' ? elHold : (id === 'holdMoreBtn' ? btnHold : nodo('div')); },
    createElement: function (t) { return nodo(t); }
  },
  esc: function (s) { return String(s); },
  fmt: function (v) { return 'US$ ' + v; },
  fmtNum: function (v) { return String(v); },
  signoPct: function (v) { return String(v); },
  daychgHtml: function () { return ''; },
  gananciaHtml: function () { return ''; },
  esTemaClaro: function () { return false; },
  // El de VERDAD, sacado de vistas.js. Era una copia escrita a mano: los tres
  // asserts del texto de las cabeceras verificaban el fixture del propio test,
  // asi que renombrar las secciones en la app no rompia nada.
  // Auditoria del 24/08/2026.
  TIPO_LABELS: tipoLabelsReales(),
  encodeURIComponent: encodeURIComponent,
  // V14 (26/08/2026): al abrir el detalle se piden los indicadores del
  // activo. El arnes no simulaba google.script.run y el bloque entero moria
  // al primer click — es la regla de la casa: si el codigo usa algo que el
  // entorno no simula, se agrega el stub ACA y el arnes gana fidelidad.
  msgErr: function (e) { return String((e && e.message) || e); },
  msgBackend: function (r) { return ((r && r.mensajes) || []).join(" "); },
  google: { script: { run: (function () {
    function mk() {
      var oks = [];
      var api = {
        withSuccessHandler: function (f) { oks.push(f); return api; },
        withFailureHandler: function () { return api; },
        getFundamentales: function (a) { pedidosFund.push(a); oks.forEach(function (f) { f({ ok: true, symbol: a.symbol, indicadores: [], estimaciones: {}, notas: [] }); }); }
      };
      return api;
    }
    return { withSuccessHandler: function (f) { return mk().withSuccessHandler(f); }, withFailureHandler: function (f) { return mk().withFailureHandler(f); } };
  })() } },
  JSON: JSON, Number: Number, isFinite: isFinite, Math: Math, String: String
};
var fn2 = new Function(Object.keys(ctx2).join(','), codigo2 + '\nreturn { renderHoldings: renderHoldings, toggleHoldings: toggleHoldings, toggleDetalle: toggleDetalle };');
var api2 = fn2.apply(null, Object.keys(ctx2).map(function (k) { return ctx2[k]; }));

function holding(sym, precio, valor, tipo) { return { symbol: sym, nombre: sym, qty: 1, precioActual: precio, valor: valor, pct: 0.1, tipo: tipo }; }
// Todas acciones: una sola cabecera de seccion arriba de todo.
var lista1 = [holding('VOO', 100, 1000), holding('QQQ', 200, 900), holding('NVDA', 300, 800), holding('AAPL', 50, 700), holding('MELI', 60, 600)];
api2.renderHoldings(lista1);
ok(elHold.children.length === 6 && /holdsec/.test(elHold.children[0].className), 'pinta 5 filas + 1 cabecera de seccion');
ok(elHold.children[0].innerHTML.indexOf('Stocks') !== -1, 'la cabecera dice Acciones');
// Se ven CINCO posiciones sin tocar nada (pedido de Guzman, 24/08/2026; eran
// cuatro). Con una lista de cinco, entonces, no se oculta ninguna.
ok(!/hidden-row/.test(elHold.children[5].className), 'con cinco posiciones se ven las cinco');
var filaQQQ = elHold.children[2];
filaQQQ.onclick();
ok(elHold.children.length === 7 && elHold.children[3].className === 'detrow', 'el detalle se inserta despues de QQQ');
var det = elHold.children[3];

var lista2 = [holding('VOO', 101, 1001), holding('QQQ', 201, 901), holding('NVDA', 301, 801), holding('AAPL', 51, 701), holding('MELI', 61, 601)];
api2.renderHoldings(lista2);
ok(elHold.children[2] === filaQQQ, 'mismos simbolos y orden: la fila NO se recrea');
ok(elHold.children[3] === det, 'el detalle abierto sigue donde estaba (el poll ya no lo cierra)');
ok(filaQQQ.innerHTML.indexOf('201') !== -1, 'y la fila muestra el precio nuevo');

api2.toggleHoldings();
ok(elHold.children[3] === det && !/hidden-row/.test(elHold.children[6].className), 'expandir tambien va en el lugar: detalle vivo y todas visibles');
api2.toggleHoldings();

// Un sorpasso DE VERDAD (QQQ pasa a valer mas que VOO) reconstruye la tabla.
// Antes esta prueba solo barajaba la lista de entrada sin tocar los valores;
// desde que el reparto ordena por valor, eso ya no cambia nada en pantalla
// —que es lo correcto— y la prueba pasaba sin probar el sorpasso.
var lista3 = [holding('VOO', 101, 900), holding('QQQ', 201, 1100), holding('NVDA', 301, 801), holding('AAPL', 51, 701), holding('MELI', 61, 601)];
api2.renderHoldings(lista3);
ok(elHold.children.length === 6, 'un sorpasso reconstruye (el detalle se cierra, como antes)');
ok(elHold.children[1] !== filaQQQ && elHold.children[1].innerHTML.indexOf('QQQ') !== -1, 'y QQQ pasa a estar primera');

// Lo que se ve y lo que queda detras del boton (pedido de Guzman, 24/08/2026):
// plegada, los ETFs; al expandir, los ETFs mas las CINCO no-ETF mas grandes.
//
// El caso que lo motivo esta adentro a proposito: SMH es un ETF y es la MAS
// CHICA de todas. Con la regla vieja —contar filas sobre la lista ya agrupada
// por tipo— SMH se veia y META y GOOG, que son mas grandes, quedaban
// escondidas. La lista se pasa DESORDENADA para que el orden de llegada no
// pueda hacer pasar la prueba de casualidad.
function simbolosDe(filtro) {
  var out = [];
  for (var k = 0; k < elHold.children.length; k++) {
    var f = elHold.children[k], cl = f.className || '';
    if (/holdsec/.test(cl)) continue;
    if (filtro === 'ocultas' ? !/hidden-row/.test(cl) : /hidden-row/.test(cl)) continue;
    out.push((f.innerHTML.match(/class="sym">([A-Z]+)</) || [])[1]);
  }
  return out;
}
// Las CABECERAS de seccion, que simbolosDe descarta. Sin esto no las miraba
// nadie: se podia dejar la cabecera "Acciones" flotando sobre cero filas y las
// pruebas seguian en verde — y es una de las cosas que el reparto nuevo vuelve
// criticas, porque plegada esa seccion entera esta oculta.
// Auditoria del 24/08/2026.
function cabecerasDe(filtro) {
  var out = [];
  for (var k = 0; k < elHold.children.length; k++) {
    var f = elHold.children[k], cl = f.className || '';
    if (!/holdsec/.test(cl)) continue;
    if (filtro === 'ocultas' ? !/hidden-row/.test(cl) : /hidden-row/.test(cl)) continue;
    out.push((f.innerHTML || '').replace(/<[^>]*>/g, '').trim());
  }
  return out;
}
// IWM, BTC e ITAU estan a proposito: el backend manda 12 posiciones y la tarjeta
// tiene que quedarse SIEMPRE en 3 ETFs + 5 acciones. IWM es un cuarto ETF
// (aparecio solo el 24/08 al subir el tope del backend, y Guzman no lo queria
// ahi); BTC es cripto e ITAU es cash de banco, y Guzman confirmo el 25/08/2026
// que NINGUNO de los dos va en esta tarjeta. Los dos entran al fixture con
// valores GRANDES —BTC pesa mas que dos de las acciones elegidas— para que el
// assert no pase de casualidad por ser chicos.
var cartera = [
  holding('MSFT', 487, 7310, 'accion'), holding('SMH', 546, 4921, 'etf'),
  holding('VOO', 701, 23160, 'etf'), holding('GOOG', 344, 5169, 'accion'),
  holding('ASML', 1740, 12172, 'accion'), holding('QQQ', 706, 14833, 'etf'),
  holding('META', 559, 6708, 'accion'), holding('KO', 60, 1200, 'accion'),
  holding('PEP', 70, 900, 'accion'), holding('IWM', 220, 3300, 'etf'),
  holding('BTC', 63000, 9500, 'cripto'), holding('ITAU', 1, 8000, 'cash')
];
api2.renderHoldings(cartera);
ok(simbolosDe('visibles').join(',') === 'VOO,QQQ,SMH',
  'plegada se ven los TRES ETFs y nada mas: ' + simbolosDe('visibles').join(','));
ok(simbolosDe('ocultas').join(',') === 'ASML,MSFT,META,GOOG,KO',
  'y detras del boton las cinco acciones mas grandes, por VALOR: ' + simbolosDe('ocultas').join(','));
ok(simbolosDe('ocultas').indexOf('PEP') === -1, 'la sexta accion no entra: son cinco');
// Los dos topes son FIJOS: la tarjeta mide siempre lo mismo, mande el backend
// las posiciones que mande.
var todosLosSimbolos = simbolosDe('visibles').concat(simbolosDe('ocultas'));
ok(todosLosSimbolos.indexOf('IWM') === -1,
  'un CUARTO ETF no entra, aunque el backend lo mande: ' + todosLosSimbolos.join(','));
ok(todosLosSimbolos.indexOf('BTC') === -1,
  'y la cripto tampoco ocupa un lugar de las cinco, ni siendo mas grande que dos de ellas');
ok(todosLosSimbolos.indexOf('ITAU') === -1,
  'el cash de banco tampoco entra, ni con 8000 de valor: ' + todosLosSimbolos.join(','));
ok(todosLosSimbolos.length === 8, 'la tarjeta son 8 filas: 3 ETFs + 5 acciones (son ' + todosLosSimbolos.length + ')');
// El boton NO lleva numero. Decia `Ver todas (N)` y las dos mitades mentian: ni
// son todas (cripto y cash nunca entran, y de las acciones van cinco) ni N era
// el tamano de la cartera —era el del recorte: 8 sobre 12—. Texto elegido por
// Guzman el 25/08/2026. Este assert exige ADEMAS que no haya ningun digito, que
// es la forma de que nadie reponga el numero "informativo" sin que se note.
ok(btnHold.style.display === 'block' && btnHold.textContent === 'See more',
  'plegada el boton dice exactamente "Ver mas": ' + btnHold.textContent);
ok(!/\d/.test(btnHold.textContent),
  'y no lleva NINGUN numero al lado: ' + btnHold.textContent);
// La cabecera de una seccion se esconde con TODAS sus filas. Plegada, "Acciones"
// no tiene ni una fila a la vista: dejarla ahi seria un titulo sobre nada.
ok(cabecerasDe('visibles').join(',') === 'ETFs',
  'plegada se ve SOLO la cabecera de ETFs: ' + cabecerasDe('visibles').join(','));
ok(cabecerasDe('ocultas').join(',') === 'Stocks',
  'y la de Acciones esta escondida con sus filas: ' + cabecerasDe('ocultas').join(','));
// La cabecera mira SOLO su primera fila, y eso es correcto porque el reparto
// deja las secciones homogeneas. Esa propiedad se fija acá: si algun dia el
// reparto deja una seccion a medias, este assert avisa y hay que volver al
// codigo de la cabecera, que dejaria de alcanzar. Auditoria del 24/08/2026.
(function seccionesHomogeneas() {
  var seccionActual = null, mezclada = null;
  for (var k = 0; k < elHold.children.length; k++) {
    var f = elHold.children[k], cl = f.className || '';
    if (/holdsec/.test(cl)) { seccionActual = { nombre: (f.innerHTML || '').replace(/<[^>]*>/g, '').trim(), oculta: null }; continue; }
    if (!seccionActual) continue;
    var oculta = /hidden-row/.test(cl);
    if (seccionActual.oculta === null) seccionActual.oculta = oculta;
    else if (seccionActual.oculta !== oculta) mezclada = seccionActual.nombre;
  }
  ok(mezclada === null, 'ninguna seccion queda con filas visibles y ocultas mezcladas' + (mezclada ? ' (' + mezclada + ')' : ''));
})();
api2.toggleHoldings();
ok(cabecerasDe('visibles').join(',') === 'ETFs,Stocks',
  'expandida se ven las dos: ' + cabecerasDe('visibles').join(','));
ok(cabecerasDe('ocultas').length === 0, 'y no queda ninguna escondida');
ok(simbolosDe('visibles').join(',') === 'VOO,QQQ,SMH,ASML,MSFT,META,GOOG,KO',
  'expandida: los 3 ETFs + las 5 acciones, agrupadas por tipo: ' + simbolosDe('visibles').join(','));
var ocultasTrasExpandir = 0;
for (var jH = 1; jH < elHold.children.length; jH++) if (/hidden-row/.test(elHold.children[jH].className || '')) ocultasTrasExpandir++;
ok(ocultasTrasExpandir === 0, 'al expandir no queda ninguna fila escondida (son ocho)');
ok(btnHold.textContent === 'See less', 'expandida el boton dice "Ver menos": ' + btnHold.textContent);
api2.toggleHoldings();
ok(btnHold.textContent === 'See more', 'y al plegar vuelve a "Ver mas": ' + btnHold.textContent);

// --- Un simbolo repetido NO puede esconder la tabla entera ---
// El reparto marcaba lo visible en un mapa indexado por `symbol`. Con dos
// posiciones del mismo simbolo —una dentro del recorte y otra fuera— la clave
// marcaba a las DOS, y plegada no quedaba ni una fila: solo el boton. Con las
// posiciones sin symbol era peor: todas caian en la clave "UNDEFINED". Hoy el
// Worker fusiona por simbolo, asi que no se dispara en produccion; el assert
// fija que la tarjeta no dependa de eso. Auditoria del 25/08/2026.
(function simboloRepetido() {
  api2.renderHoldings([
    holding('VOO', 700, 20000, 'etf'),
    holding('VOO', 700, 5000, 'accion'),
    holding('MSFT', 487, 7310, 'accion')
  ]);
  ok(simbolosDe('visibles').join(',') === 'VOO',
    'con el simbolo repetido, plegada sigue mostrando el ETF: ' + simbolosDe('visibles').join(','));
  ok(simbolosDe('visibles').length > 0, 'y NO desaparecen todas las filas dejando solo el boton');
  api2.renderHoldings([
    { nombre: 'sin simbolo A', valor: 900, tipo: 'etf' },
    { nombre: 'sin simbolo B', valor: 800, tipo: 'accion' }
  ]);
  var visiblesSinSimbolo = 0;
  for (var kS = 0; kS < elHold.children.length; kS++) {
    var clS = elHold.children[kS].className || '';
    if (/asset-row/.test(clS) && !/hidden-row/.test(clS)) visiblesSinSimbolo++;
  }
  ok(visiblesSinSimbolo === 1, 'sin `symbol`, plegada muestra su fila igual (visibles: ' + visiblesSinSimbolo + ')');
})();

// --- El orden por valor no se cae si el valor viene como TEXTO ---
// Hoy el Worker manda numeros, asi que esto es profundidad, no un bug vivo. Pero
// es exactamente la clase de degradacion silenciosa que hizo falta arreglar en
// el caso SMH: con `Number('12.172,00')` dando NaN, TODAS las posiciones valian
// cero, empataban, y el reparto terminaba eligiendo "las que llegaron primero"
// en vez de las mas grandes — sin ningun sintoma. El formato que se cubre es el
// de la planilla (es-UY: punto de miles, coma decimal); un texto que no se pueda
// leer vale cero y queda ULTIMO, no empatado con todos.
(function valorComoTexto() {
  api2.renderHoldings([
    { symbol: 'CHICA', nombre: 'Chica', valor: '900,00', tipo: 'accion' },
    { symbol: 'GRANDE', nombre: 'Grande', valor: '12.172,00', tipo: 'accion' },
    { symbol: 'MEDIA', nombre: 'Media', valor: '5.000,00', tipo: 'accion' }
  ]);
  var orden = simbolosDe('visibles').join(',');
  ok(orden === 'GRANDE,MEDIA,CHICA',
    'con el valor como texto de la planilla sigue ordenando de mayor a menor: ' + orden);
  api2.renderHoldings([
    { symbol: 'BUENA', nombre: 'Buena', valor: 5000, tipo: 'accion' },
    { symbol: 'ROTA', nombre: 'Rota', valor: '#N/A', tipo: 'accion' }
  ]);
  ok(simbolosDe('visibles')[0] === 'BUENA',
    'y un valor ilegible queda ULTIMO, no empatado: ' + simbolosDe('visibles').join(','));
})();

// --- Solo cripto y/o cash: la tarjeta DICE que no hay nada ---
// La lista llega con elementos, asi que el corte de arriba no salta; pero el
// reparto queda vacio. Sin este corte la tarjeta era un rectangulo EN BLANCO
// bajo el titulo, que es justo lo que el mensaje existe para evitar.
(function soloCriptoYCash() {
  api2.renderHoldings([holding('BTC', 63000, 9500, 'cripto'), holding('ITAU', 1, 8000, 'cash')]);
  ok(/No positions/.test(elHold.innerHTML),
    'con solo cripto y cash la tarjeta dice "Sin posiciones.", no queda vacia');
  ok(btnHold.style.display === 'none', 'y el boton no se muestra sobre una tabla sin filas');
})();
api2.renderHoldings(cartera);

// Tipos mezclados: agrupa por seccion aunque el orden por valor los mezcle.
// Los ETFs van PRIMERO desde el 22/08/2026 (pedido de Guzman): sus dos ETFs
// mas grandes pesan mas que cualquier accion suelta. ESTE ASSERT ESTA DADO
// VUELTA a proposito — antes exigia las acciones primero.
// La accion se llama QQQ y el ETF VOO al reves de la realidad justamente para
// que el agrupado no pueda pasar "de casualidad" por el nombre.
var lista4 = [holding('VOO', 100, 1000, 'etf'), holding('QQQ', 200, 900, 'accion'), holding('NVDA', 300, 800, 'accion')];
api2.renderHoldings(lista4);
ok(elHold.children.length === 5, '3 filas + 2 cabeceras');
ok(/holdsec/.test(elHold.children[0].className) && elHold.children[0].innerHTML.indexOf('ETFs') !== -1, 'la primera cabecera es la de ETFs');
ok(elHold.children[1].innerHTML.indexOf('VOO') !== -1 && elHold.children[1].innerHTML.indexOf('holdav etf') !== -1, 'el ETF va arriba, con el avatar de su tipo');
ok(/holdsec/.test(elHold.children[2].className) && elHold.children[2].innerHTML.indexOf('Stocks') !== -1, 'y despues la cabecera de Acciones');
ok(elHold.children[3].innerHTML.indexOf('QQQ') !== -1 && elHold.children[4].innerHTML.indexOf('NVDA') !== -1, 'las acciones abajo, conservando su orden por valor');

console.log('\nE) el rendimiento anualizado (V6): solo con mas de un año de datos');
var pctSrc = (html.match(/function pctAnualizado[\s\S]*?\n\}/) || [''])[0];
ok(!!pctSrc, 'pctAnualizado existe en graficos.js');
var pctAnualizado = new Function('return ' + pctSrc)();
ok(pctAnualizado(40, 1095) > 11.8 && pctAnualizado(40, 1095) < 12.0, '+40% en 3 años ~ +11,9% anual (=' + (pctAnualizado(40, 1095) || 0).toFixed(2) + ')');
ok(pctAnualizado(32, 200) === null, 'un rango corto no se anualiza (proyectar una racha es inventar)');
ok(pctAnualizado(32, 365) === null, '1A justo tampoco: el anualizado seria el mismo numero');
ok(pctAnualizado(-30, 730) < -16 && pctAnualizado(-30, 730) > -17, '-30% en 2 años ~ -16,3% anual');
ok(pctAnualizado(-120, 800) === null, 'una perdida total no rompe la formula (null, no NaN)');

console.log('\nF) el mini-grafico de cada posicion (V6)');
// Se evalua la funcion REAL, no una copia: un sparkline mal escalado dibuja
// una linea plausible y falsa, y a ojo no se distingue de una buena.
var graficosSrc = fs.readFileSync(path.join(ruta.RUTA, 'js', 'graficos.js'), 'utf8');
// Se corta en sparkDe, no en el primer '}' al margen: en este código las llaves
// internas también van al margen, y cortar ahí traía media función.
var sparkSrc = (graficosSrc.match(/var SPARK_W[\s\S]*?(?=function sparkDe)/) || [''])[0];
ok(!!sparkSrc, 'sparkSvg existe en graficos.js');
var sparkSvg = new Function(sparkSrc + '\nreturn sparkSvg;')();

var sube = sparkSvg([10, 11, 12, 15]);
// El color va por CLASE, no por hexadecimal: el tema claro usa otro verde y
// otro rojo, y un hex fijo daba 2,3:1 de contraste sobre blanco.
ok(/class="spark sube"/.test(sube), 'una serie que sube se marca como sube (el color lo pone el tema)');
ok(sube.indexOf('#22c55e') === -1 && sube.indexOf('stroke=') === -1, 'y NO trae el color escrito a mano');
ok(sube.indexOf('<polyline') !== -1, 'es una polilinea escrita a mano, no una libreria (R2)');
ok((sube.match(/,/g) || []).length === 4, 'un punto por cierre (4 cierres, 4 pares x,y)');
ok(sube.indexOf('NaN') === -1, 'sin NaN en las coordenadas');
ok(/class="spark baja"/.test(sparkSvg([15, 12, 11, 10])), 'una serie que baja se marca como baja');
// El ultimo contra el PRIMERO, no contra el maximo: lo que importa es si el
// mes termino arriba o abajo de donde empezo.
ok(/class="spark baja"/.test(sparkSvg([10, 30, 8])), 'un mes que sube fuerte y termina ABAJO del inicio va en rojo (el maximo no manda)');
// La columna se llama "Mes": sin esto, un lector de pantalla anuncia celdas
// vacias — promete un dato y no lo entrega.
ok(sparkSvg([100, 102.3]).indexOf('aria-label="+2.3% this month"') !== -1, 'el porcentaje del mes queda dicho para lectores de pantalla');
ok(sparkSvg([100, 92]).indexOf('aria-label="-8.0% this month"') !== -1, 'y con signo cuando cayo');

var plano = sparkSvg([50, 50, 50]);
ok(plano.indexOf('NaN') === -1, 'un mes plano no divide por cero');
// Los limites se DERIVAN de las constantes, no van escritos a mano: agrandar
// el dibujo (paso del 22/08/2026, de 46x20 a 64x28) rompia estos asserts sin
// que nada estuviera mal. Lo que se custodia es la propiedad —usa todo el
// alto, el plano va al medio—, no un numero.
var PAD = 2, ARRIBA = PAD, ABAJO = api.SPARK_H - PAD, MEDIO = PAD + (api.SPARK_H - PAD * 2) / 2;
ok(plano.indexOf(',' + MEDIO.toFixed(1)) !== -1, 'y se dibuja como una raya al medio (y=' + MEDIO + ' de ' + api.SPARK_H + ')');
ok(sparkSvg([42]) === '', 'un solo cierre no es una linea: no dibuja nada');
ok(sparkSvg([]) === '' && sparkSvg(null) === '', 'sin datos, nada');

// El cierre mas alto tiene que tocar el borde de arriba y el mas bajo el de
// abajo: si no, el dibujo desperdicia el alto y todas las posiciones se ven
// igual de planas — que es la forma silenciosa de que esto no sirva.
var ys = (sparkSvg([10, 20]).match(/,(\d+\.\d)/g) || []).map(function (x) { return parseFloat(x.slice(1)); });
ok(Math.min.apply(null, ys) === ARRIBA && Math.max.apply(null, ys) === ABAJO, 'la serie usa todo el alto (y de ' + ARRIBA + ' a ' + ABAJO + ')');

// La cadena COMPLETA en un solo modulo, sin declarar sparksPorSym a mano: el
// arnes anterior le inyectaba su propia variable, asi que probaba que
// aplicarSparks escribiera en ALGUNA, nunca en la MISMA que lee sparkDe. Con
// eso, sparkDe tenia cero cobertura de ejecucion y se podia cortar entero.
// Auditoria por mutacion del 22/08/2026.
var cadenaSrc = (graficosSrc.match(/var sparksPorSym[\s\S]*?(?=function filaHoldingHtml)/) || [''])[0];
ok(!!cadenaSrc, 'se puede aislar la cadena aplicarSparks -> sparksPorSym -> sparkDe');
var cad = new Function('String,Object,Math,isFinite',
  cadenaSrc + '\nreturn { apl: aplicarSparks, de: sparkDe, svg: sparkSvg };')(String, Object, Math, isFinite);

cad.apl({ sparks: { VOO: [10, 11, 12] } });
ok(cad.de({ symbol: 'VOO' }).indexOf('<polyline') !== -1, 'lo que aplicarSparks guarda es lo que sparkDe lee');
ok(cad.de({ symbol: 'voo' }).indexOf('<polyline') !== -1, 'y la busqueda ignora mayusculas (el backend manda las claves en MAYUSCULA)');
ok(cad.de({ symbol: 'NADA' }) === '', 'un simbolo sin serie no dibuja nada');
ok(cad.de({}) === '' && cad.de(null) === '', 'sin simbolo tampoco explota');

// El eje Y, POR POSICION y no por conjunto: el assert anterior usaba min/max
// sobre todas las coordenadas, asi que dar vuelta el grafico —todas las subidas
// dibujadas como caidas— lo dejaba pasar.
var ys2 = (sparkSvg([10, 20]).match(/,(\d+\.\d)/g) || []).map(function (x) { return parseFloat(x.slice(1)); });
ok(ys2[0] === ABAJO && ys2[1] === ARRIBA, 'el cierre mas BAJO va abajo (y=' + ABAJO + ') y el mas alto arriba (y=' + ARRIBA + '): ' + ys2.join(' '));

// La frontera exacta entre verde y rojo: un mes que termina donde empezo NO es
// una perdida. Con >= cambiado por > se pintaba de rojo y nadie se quejaba.
ok(/class="spark sube"/.test(sparkSvg([50, 50, 50])), 'un mes plano NO es una perdida: va en verde');

// El orden de las celdas se mide DENTRO de filaHoldingHtml. El assert anterior
// buscaba 'sparkDe(h)' en el archivo entero y encontraba primero la DECLARACION
// de la funcion, que esta arriba del precio pase lo que pase: comparaba la
// declaracion contra el precio, no la celda contra la celda.
var filaSrc2 = (graficosSrc.match(/function filaHoldingHtml[\s\S]*?(?=\/\/ ---------- Reparto de Principales)/) || [''])[0];
ok(!!filaSrc2, 'se puede aislar filaHoldingHtml');
ok(filaSrc2.indexOf('sparkDe(h)') !== -1, 'la fila dibuja el mini-grafico');
ok(filaSrc2.indexOf('sparkDe(h)') < filaSrc2.indexOf('esc(fmtNum(h.precioActual))'),
  'y su celda va ANTES de la del precio, como en una lista de mercado');

// Una columna nueva con un colspan viejo deja la fila vacia y las cabeceras de
// seccion cortadas. Se cuenta contra la cabecera REAL del HTML.
// La tabla del Inicio se identifica por .holdhome, la clase propia que gano el
// 02/09/2026 al acotar la regla de la cabecera oculta: .holdtable la comparten
// tres tablas y anclarse a ella agarraba la equivocada.
// Sin regex a proposito: la cabecera se ubica por su marcado exacto.
var _marca = '<table class="holdtable holdhome"><thead><tr>';
var _tIni = html.indexOf(_marca);
// El corte arranca DESPUES del marcador: la propia etiqueta <thead> contiene
// "<th" y se contaba como una columna de mas.
var thead = _tIni < 0 ? '' : html.slice(_tIni + _marca.length, html.indexOf('</tr>', _tIni));
var nCols = (thead.match(/<th/g) || []).length;
ok(nCols === 4, 'la tabla del Inicio tiene 4 columnas: simbolo, mes, precio y % del total (' + nCols + ')');
var colspans = graficosSrc.match(/colspan="(\d+)"/g) || [];
ok(colspans.length > 0 && colspans.every(function (c) { return c === 'colspan="' + nCols + '"'; }),
  'los colspan coinciden con las columnas de la tabla (' + colspans.join(', ') + ')');

// El poll de 60 s NO trae los cierres. Si una respuesta sin el dato borrara el
// mapa, el mini-grafico apareceria y desapareceria solo cada minuto.
var aplSrc = (graficosSrc.match(/function aplicarSparks[\s\S]*?\n\}/) || [''])[0];
ok(!!aplSrc, 'aplicarSparks existe');
var mod = new Function('var sparksPorSym = {};' + aplSrc +
  '\nreturn { apl: aplicarSparks, ver: function () { return sparksPorSym; } };')();
mod.apl({ sparks: { VOO: [1, 2] } });
ok(mod.ver().VOO && mod.ver().VOO.length === 2, 'el payload completo carga los cierres');
mod.apl({ total: 1 });
ok(mod.ver().VOO && mod.ver().VOO.length === 2, 'un poll lite (sin sparks) NO borra los que ya estaban');

console.log('\nG) logos de verdad en el avatar, con caida a las iniciales');
// Pedido de Guzman (22/08/2026): "en TradingView se ve mejor... me gustaria
// que aparezcan los logos". api.logoUrl/sinLogo/filaHoldingHtml salen del
// MISMO codigo que corre en produccion (bloque compartido de arriba).
// La propiedad que importa: las dos fuentes van POR TICKER, nunca por un
// dominio adivinado. Un dominio mal adivinado mostraria el logo de OTRA
// empresa al lado de plata de verdad, y eso no se ve como error.
ok(api.logoUrl({ symbol: 'MSFT', tipo: 'accion' }).indexOf('/logos/symbol/MSFT') !== -1,
  'una accion arma la URL con SU ticker');
ok(api.logoUrl({ symbol: 'VOO', tipo: 'etf' }).indexOf('/logos/symbol/VOO') !== -1,
  'un ETF tambien');
ok(api.logoUrl({ symbol: 'ETH', tipo: 'cripto', cripto: true }).indexOf('/eth.png') !== -1,
  'una cripto usa el set de iconos, en minuscula');
ok(api.logoUrl({ symbol: 'ITAU', tipo: 'cash' }) === null,
  'una fila que es CASH (un saldo bancario) no tiene logo de empresa que mostrar');
ok(api.logoUrl({ symbol: 'msft', tipo: 'accion' }).indexOf('/MSFT') !== -1,
  'no importan mayusculas/minusculas en el simbolo que llega');
ok(api.logoUrl({ symbol: 'A/B', tipo: 'accion' }).indexOf('A%2FB') !== -1,
  'un simbolo con caracteres raros se escapa: no puede romper la URL');

// El fallback: si la imagen no carga, se esconde y aparecen las iniciales.
// DOM de mentira minimo (mismo patron que la seccion D).
var img = { style: {}, nextElementSibling: { style: {} } };
api.sinLogo(img);
ok(img.style.display === 'none', 'la imagen rota se esconde');
ok(img.nextElementSibling.style.display === 'flex', 'y las iniciales, que estaban ocultas, aparecen');
var imgSolo = { style: {}, nextElementSibling: null };
api.sinLogo(imgSolo);
ok(imgSolo.style.display === 'none', 'sin hermano (caso raro) no explota, igual esconde la imagen');

// La fila real: con logo conocido, trae <img> Y las iniciales de respaldo
// (ocultas); sin logo conocido, sigue exactamente como antes.
var filaCon = api.filaHoldingHtml({ symbol: 'MSFT', nombre: 'Microsoft', tipo: 'accion', pct: 0.05, precioActual: 480, cambioDia: 0.4 });
ok(filaCon.indexOf('<img src="https://assets.parqet.com/logos/symbol/MSFT') !== -1, 'MSFT trae su <img>');
// El enganche NO va inline: la politica de contenido prohibe codigo dentro del
// HTML, asi que un `onerror="..."` lo BLOQUEA el navegador y el circulo queda
// vacio en vez de mostrar las iniciales. Estuvo asi desde que se pusieron los
// logos y no se noto porque los logos cargaban. Auditoria del 24/08/2026.
ok(filaCon.indexOf('onerror=') === -1, 'sin manejadores inline, que la politica de contenido bloquea');
ok(filaCon.indexOf('class="holdlogo"') !== -1, 'la imagen queda marcada para engancharla desde JS');
var graficosLogo = fs.readFileSync(path.join(ruta.RUTA, 'js', 'graficos.js'), 'utf8');
ok(/function engancharLogos[\s\S]{0,400}onerror = function/.test(graficosLogo),
  'y hay un enganche por JS que cae a las iniciales');
ok(/tr\.innerHTML = filaHoldingHtml\(h\);\s*\n\s*engancharLogos\(tr\);/.test(graficosLogo),
  'que se llama despues de pintar cada fila');
ok(filaCon.indexOf('holdinit') !== -1 && filaCon.indexOf('display:none') !== -1,
  'las iniciales de respaldo viajan en la fila, ocultas de entrada');
// Un ticker que la fuente no tiene (NA9 en Xetra, por ejemplo) igual pide el
// logo: el 404 dispara el onerror y caen las iniciales. Lo que NO puede pasar
// es que quede un hueco vacio.
var filaCash = api.filaHoldingHtml({ symbol: 'ITAU', nombre: 'Itau', tipo: 'cash', pct: 0.01, precioActual: 0, cambioDia: null });
ok(filaCash.indexOf('<img') === -1, 'una fila de cash NO trae ningun <img> (nada que pueda romperse)');
ok(filaCash.indexOf('>ITAU<') !== -1 || filaCash.indexOf('>IT<') !== -1, 'y muestra las iniciales de siempre');


// El viewBox tiene que ser el MISMO tamano con el que se calcularon los
// puntos. Al generalizar sparkSvg quedo clavado en el tamano chico, y la mini
// de Evolucion —que dibuja en 300x44— salia RECORTADA: se veia un pedacito de
// linea y el resto afuera del cuadro. Lo agarro una captura de Guzman, no una
// prueba. Estos asserts existen para que no vuelva a pasar.
var anchoSvg = api.sparkSvg([1, 5, 2, 8], 300, 44, 'en el periodo');
ok(/viewBox="0 0 300 44"/.test(anchoSvg), 'el viewBox usa el tamano PEDIDO, no el de la tabla');
ok(/width="300" height="44"/.test(anchoSvg), 'y el ancho y alto tambien');
var ys3 = (anchoSvg.match(/,(\d+\.\d)/g) || []).map(function (x) { return parseFloat(x.slice(1)); });
var xs3 = (anchoSvg.match(/[ "](\d+\.\d),/g) || []).map(function (x) { return parseFloat(x.replace(/[ ",]/g, '')); });
ok(Math.max.apply(null, ys3) <= 44 && Math.max.apply(null, xs3) <= 300,
  'ningun punto queda FUERA del cuadro (el bug: puntos hasta x=298 en un viewBox de 80)');
ok(/preserveAspectRatio="none"/.test(anchoSvg),
  'y se estira a todo el ancho: una sparkline no se centra con bordes vacios');
// El tamano por omision (la tabla de posiciones) no cambia.
var chico = api.sparkSvg([1, 2, 3]);
ok(/viewBox="0 0 80 32"/.test(chico), 'sin pedir tamano, sigue el de la tabla');
ok(/this month/.test(chico) && /en el periodo/.test(anchoSvg), 'y cada uno dice su propia leyenda');

console.log('\nG2) el relleno del area, y que los puntos por valor NO vuelvan');
// Historia corta, porque el codigo ya no la cuenta: en 1S el grafico se veia
// "facetado, tipo montana con quiebres duros". Se intento marcar cada valor con
// un circulo para que el codo se leyera como dato. Guzman lo rechazo dos veces
// ("horrible", "saca los puntitos esos"). Lo que SI lo resolvio fue achicar el
// dibujo: de 305px de ancho a 87, el tramo de una semana pasa de 50px a 16.
//
// Estos asserts estan DADOS VUELTA a proposito (regla de la casa): verifican
// que los circulos no esten, para que nadie los reponga sin querer.
var corto = api.sparkSvg([10, 8, 9, 8.5, 9.4, 9.3, 9.5], 100, 40, 'en el periodo', { area: true });
ok(corto.indexOf('<circle') === -1, 'una semana NO lleva un circulo por dia: se probo y se descarto');
ok(corto.indexOf('class="hoy"') === -1, 'ni el punto de hoy');
ok(/<path class="sparkarea"/.test(corto), 'lo que SI queda es el relleno debajo de la linea');
// Ni siquiera pidiendolo: la opcion se saco, no se apago. Si alguien vuelve a
// pasar { puntos: true } tiene que seguir sin dibujar nada.
ok(api.sparkSvg([10, 8, 9], 100, 40, 'x', { area: true, puntos: true }).indexOf('<circle') === -1,
  'y la opcion ya no existe: pedirla no los trae de vuelta');

// El relleno NO puede traer el color escrito a mano: el tema claro usa otro
// verde y otro rojo. Un '#' solo no sirve de assert — la referencia al
// degradado es url(#...) — asi que se busca un COLOR.
ok(!/#[0-9a-fA-F]{3}\b/.test(corto) && /currentColor/.test(corto), 'el color del relleno sale del tema (currentColor), no de un hex');
// Un id repetido hace que el segundo degradado use el del primero: verde
// debajo de una linea roja. Dos dibujos seguidos NO pueden compartirlo.
var g1 = (api.sparkSvg([1, 2], 100, 40, 'x', { area: true }).match(/id="(sparkfill\d+)"/) || [])[1];
var g2 = (api.sparkSvg([2, 1], 100, 40, 'x', { area: true }).match(/id="(sparkfill\d+)"/) || [])[1];
ok(!!g1 && !!g2 && g1 !== g2, 'cada relleno tiene su propio degradado (' + g1 + ' vs ' + g2 + ')');
// El relleno apoya en el piso y en los dos costados: flotando se ve como un
// error, no como un area.
var dRel = (corto.match(/ d="([^"]+)"/) || [])[1];
ok(dRel.indexOf('M2.0,') === 0 && / L2\.0,40 Z$/.test(dRel), 'y apoya en el piso y en los dos costados del cuadro');

// La tabla de posiciones NO lleva relleno: son siete filas y se vuelve pesada.
ok(chico.indexOf('sparkarea') === -1 && chico.indexOf('<circle') === -1, 'la tabla de posiciones sigue siendo solo la linea');
ok(anchoSvg.indexOf('sparkarea') === -1, 'y sin pedir area tampoco aparece en el tamano ancho');

console.log('\nH) el precio en es-UY, como el resto de la plata en la app');
// fmtNum era el UNICO numero de toda la app sin pasar por es-UY: un precio de
// 1763.76 salia con la puntuacion de JS al reves de como se lee ahi.
ok(api.fmtNum(1763.76) === '1,763.76', 'miles con coma, decimales con punto, como fmt/fmtUsd (' + api.fmtNum(1763.76) + ')');
ok(api.fmtNum(549.9) === '549.9', 'sin ceros de mas cuando el numero no los tiene (' + api.fmtNum(549.9) + ')');
ok(api.fmtNum(33) === '33', 'una cantidad entera (unidades) sigue sin decimales (' + api.fmtNum(33) + ')');
ok(api.fmtNum(null) === '—' && api.fmtNum(undefined) === '—' && api.fmtNum('') === '—', 'sin dato, la rayita de siempre');

console.log('\nI) la tabla tiene que ENTRAR en la pantalla del telefono');
// Se desbordo DOS veces (22/08/2026): la segunda dejo el precio cortado por la
// mitad en el iPhone y no fallo ninguna prueba. El ancho real solo se mide en
// un navegador, que este arnes no tiene — pero SI se puede custodiar el
// mecanismo que lo hace entrar:
//
// La celda del nombre es la que absorbe lo que sobra (max-width:0 + width:100%
// es el truco estandar para que una celda de tabla sea la flexible), y la
// descripcion se acorta sola con puntos suspensivos. Antes la descripcion
// tenia un tope en `vw` — un ancho fijo de PANTALLA, que no sabe cuanto lugar
// queda de verdad en la fila — y por eso empujaba el precio afuera.
ok(/\.holdtable td:first-child\s*\{[^}]*max-width:\s*0/.test(html),
  'la celda del nombre es la flexible (max-width:0)');
ok(/\.holdtable td:first-child\s*\{[^}]*width:\s*100%/.test(html),
  'y absorbe el ancho sobrante (width:100%)');
var descRegla = (html.match(/\.holdtable \.desc \{[^}]*\}/) || [''])[0];
ok(descRegla.indexOf('text-overflow: ellipsis') !== -1, 'la descripcion se acorta con puntos suspensivos');
ok(descRegla.indexOf('vw') === -1,
  'y NO con un tope en vw: ese ancho no sabe cuanto lugar queda en la fila y empujaba el precio afuera');
ok(/\.holdtable \.col-precio \{[^}]*white-space:\s*nowrap/.test(html),
  'el precio no se parte en dos lineas');

console.log('\nF) editar precios manuales en el detalle (V16, 29/08/2026)');
// El formulario aparece SOLO para una posicion de precio manual dentro de su
// cuenta (cuenta conocida, sin gfTicker, sin cripto): hoy, el fondo de Itau.
// El permiso real lo decide el backend (posicion_editar rechaza proveedor
// vivo); aca se custodia que la app no ofrezca editar lo que no corresponde.
function detalleDe(pos) {
  var cont = nodo('tbody');
  var tr = nodo('tr');
  cont.appendChild(tr);
  api2.toggleDetalle(tr, pos);
  var det = cont.children[1];
  return det && det.children[0] ? det.children[0]._html : '';
}
var htmlItau = detalleDe({ symbol: 'ITAU', precioCompra: 120.49, precioActual: 120.69, qty: 2005, cuenta: 'ITAU', gfTicker: null, cripto: false });
ok(htmlItau.indexOf('Edit prices') !== -1, 'el fondo de Itau (precio manual) ofrece editar');
ok(htmlItau.indexOf('detedit-pa') !== -1 && htmlItau.indexOf('detedit-pc') !== -1,
  'con los dos campos: precio actual y precio de compra');
var htmlVoo = detalleDe({ symbol: 'VOO', precioCompra: 431.9, precioActual: 700, qty: 33, cuenta: 'CS', gfTicker: 'VOO', cripto: false });
ok(htmlVoo.indexOf('Edit prices') === -1, 'VOO (proveedor vivo) NO ofrece editar');
var htmlMerged = detalleDe({ symbol: 'ITAU', precioCompra: 120.49, precioActual: 120.69, qty: 2005 });
ok(htmlMerged.indexOf('Edit prices') === -1,
  'fuera de la pagina de la cuenta (sin cuenta conocida) tampoco: el boton vive en la pagina de Itau');
var htmlUsdt = detalleDe({ symbol: 'USDT', precioActual: 1, qty: 380, cuenta: 'BNB', gfTicker: null, cripto: false });
ok(htmlUsdt.indexOf('Edit prices') === -1, 'USDT no: su 1 esta a mano y es verdad, no se toca desde la app');
// Y la fn esta cableada en el MAP de nucleo.js (el contrato del otro lado lo
// cruza test-html seccion G contra API_FNS del worker).
var nucleoSrc = fs.readFileSync(path.join(ruta.RUTA, 'js', 'nucleo.js'), 'utf8');
ok(nucleoSrc.indexOf("editarPrecioManual: 'posicion_editar'") !== -1,
  'editarPrecioManual figura en el MAP de nucleo.js');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
