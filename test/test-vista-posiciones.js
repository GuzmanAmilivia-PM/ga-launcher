// Arnés de la pantalla Posiciones (25/08/2026).
// Pedido de Guzmán: el título del Inicio dice "Posiciones" (no "Principales
// posiciones") y al tocarlo se abre una pantalla con TODAS las posiciones —
// P. compra / Precio / Valor — sin cash y sin USDT ("que usdt es cash").
//
// El bloque se evalúa con un DOM de mentira y las implementaciones REALES de
// los helpers (tipoDe, ordenarPorTipo, esc/fmt/fmtNum, daychgHtml/gananciaHtml,
// TIPO_LABELS): una copia escrita a mano acá verificaría el fixture del propio
// test, no la app (lección de la auditoría del 24/08/2026).
var ruta = require('./_ruta');
var fs = require('fs');
var path = require('path');
var html = ruta.leerIndex();

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

// ---- las implementaciones reales que el bloque usa ----
function fuente(nombre, regex) {
  var m = html.match(regex);
  if (!m) { console.log('  FALLA: no encuentro ' + nombre); process.exit(1); }
  return m[0];
}
var preambulo = 'var montosOcultos = false;\n' +
  fuente('esc', /function esc\(s\) \{[\s\S]*?\n\}/) + '\n' +
  fuente('fmt', /function fmt\(n\) \{[\s\S]*?\n\}/) + '\n' +
  fuente('fmtNum', /function fmtNum\(n\) \{[\s\S]*?\n\}/) + '\n' +
  fuente('signoPct', /function signoPct[^\n]*\}/) + '\n' +
  fuente('pctHtml', /function pctHtml[\s\S]*?\n\}/) + '\n' +
  fuente('tipoDe', /function tipoDe\(h\) \{[\s\S]*?\n\}/) + '\n' +
  fuente('logoUrl', /function logoUrl\(h\) \{[\s\S]*?\n\}/) + '\n' +
  fuente('celdaInstrumentoHtml', /function celdaInstrumentoHtml\(h\) \{[\s\S]*?\n\}/) + '\n' +
  fuente('ordenarPorTipo', /function ordenarPorTipo\(list\) \{[\s\S]*?\n\}/) + '\n' +
  fuente('daychgHtml', /function daychgHtml\(p\) \{[\s\S]*?\n\}/) + '\n' +
  fuente('gananciaHtml', /function gananciaHtml\(p\) \{[\s\S]*?\n\}/) + '\n' +
  fuente('TIPO_LABELS', /var TIPO_LABELS = \{[^}]*\};/) + '\n';

// El bloque de la pantalla, entre sus marcadores. Renombrarlos rompe esto a
// propósito: el arnés avisa en vez de pasar sin probar nada.
var codigo = ruta.bloque(html,
  '// ---------- Posiciones (la lista completa, desde el Inicio) ----------',
  '// ---------- Portafolio (torta + desglose) ----------');

// ---- DOM de mentira ----
function elemento(id) {
  var e = { id: id, tag: id ? null : 'nuevo', style: {}, className: '', children: [], _html: '', colSpan: 0 };
  Object.defineProperty(e, 'innerHTML', {
    get: function () { return e._html; },
    set: function (v) { e._html = v; e.children.length = 0; }
  });
  e.appendChild = function (c) { e.children.push(c); return c; };
  e.addEventListener = function (ev, fn) { e._ev = e._ev || {}; e._ev[ev] = fn; };
  return e;
}
var els = {};
var doc = {
  getElementById: function (id) { if (!els[id]) els[id] = elemento(id); return els[id]; },
  createElement: function () { return elemento(null); }
};
var vistasPedidas = [];
var detallesAbiertos = [];
var logosEnganchados = 0;
var lastData = { posiciones: [] };
var ctx = {
  document: doc,
  lastData: lastData,
  setView: function (n) { vistasPedidas.push(n); },
  toggleDetalle: function (tr, h) { detallesAbiertos.push(h); },
  // Espia: el de verdad (graficos.js) necesita querySelectorAll; aca solo
  // importa que cada fila pintada lo llame para que el logo tenga su caida.
  engancharLogos: function () { logosEnganchados++; },
  Number: Number, isFinite: isFinite, String: String, Math: Math
};
var nombres = Object.keys(ctx);
var fn = new Function(nombres.join(','), preambulo + codigo +
  '\nreturn { renderPosiciones: renderPosiciones, fmt: fmt, fmtNum: fmtNum, daychgHtml: daychgHtml, gananciaHtml: gananciaHtml };');
var api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));

// La cartera de prueba, con el orden por valor que ya manda el Worker y los
// dos "posiciones" que en realidad son cash (USDT y la fila del banco).
lastData.posiciones = [
  { symbol: 'VOO', nombre: 'Vanguard S&P 500', tipo: 'etf', valor: 30000, qty: 30, precioActual: 520.5, precioCompra: 400, cambioDia: 1.2, cripto: false },
  { symbol: 'QQQ', nombre: 'Invesco QQQ', tipo: 'etf', valor: 20000, qty: 40, precioActual: 500, precioCompra: 350, cambioDia: 0.8, cripto: false },
  { symbol: 'META', nombre: 'Meta Platforms', tipo: 'accion', valor: 9000, qty: 18, precioActual: 500, precioCompra: 250, cambioDia: -0.5, cripto: false },
  { symbol: 'BTC', nombre: 'Bitcoin', tipo: 'cripto', valor: 5000, qty: 0.05, precioActual: 60000, precioCompra: null, cambioDia: 2.1, cripto: true },
  { symbol: 'USDT', nombre: 'Tether', tipo: 'cash', valor: 1000, qty: 1000, precioActual: 1, precioCompra: null, cambioDia: null, cripto: true },
  { symbol: 'ITAU', nombre: 'Cash Itau', tipo: 'cash', valor: 2000, qty: null, precioActual: null, precioCompra: null, cambioDia: null, cripto: false }
];
api.renderPosiciones();
var filas = els.posBody.children;

console.log('\nA) que entra y que no: todas las posiciones, sin cash ni USDT');
var texto = filas.map(function (f) { return f.innerHTML; }).join('|');
ok(texto.indexOf('VOO') !== -1 && texto.indexOf('QQQ') !== -1 && texto.indexOf('META') !== -1, 'ETFs y acciones estan');
ok(texto.indexOf('BTC') !== -1, 'la cripto TAMBIEN esta: esta pantalla lista la cartera entera');
ok(texto.indexOf('USDT') === -1, 'USDT no aparece: es cash');
ok(texto.indexOf('ITAU') === -1, 'la fila del banco tampoco: no es una posicion');

console.log('\nB) secciones y orden, como en el Inicio');
ok(filas.length === 7, '4 posiciones + 3 cabeceras de seccion = 7 filas (hay ' + filas.length + ')');
var clases = filas.map(function (f) { return f.className; });
ok(clases[0] === 'holdsec' && clases[3] === 'holdsec' && clases[5] === 'holdsec', 'una cabecera antes de cada grupo');
ok(filas[0].innerHTML.indexOf('ETFs') !== -1 && filas[3].innerHTML.indexOf('Stocks') !== -1 && filas[5].innerHTML.indexOf('Crypto') !== -1,
  'ETFs primero, despues Acciones, despues Cripto (rotulos REALES de TIPO_LABELS)');
ok(filas[1].innerHTML.indexOf('VOO') !== -1 && filas[2].innerHTML.indexOf('QQQ') !== -1,
  'dentro del grupo se conserva el orden por valor que manda el Worker');

console.log('\nC) las columnas: P. compra, Precio (con el % del dia), Valor (con la ganancia)');
var voo = filas[1].innerHTML;
ok(voo.indexOf(api.fmtNum(400)) !== -1, 'el precio medio de compra, formateado como en toda la app');
ok(voo.indexOf(api.fmtNum(520.5)) !== -1, 'el precio actual');
// El valor va SIN el "USD " adelante (como la lista de TradingView): con el
// prefijo se partia en dos renglones en el telefono — captura del 25/08/2026.
ok(voo.indexOf(api.fmt(30000).replace('USD ', '')) !== -1, 'el valor total, pelado');
ok(voo.indexOf('USD') === -1, 'sin el "USD " adelante: era lo que partia el numero en dos renglones');
ok(voo.indexOf(api.daychgHtml({ cambioDia: 1.2 })) !== -1, 'el % del dia arriba del precio');
ok(voo.indexOf(api.gananciaHtml({ precioCompra: 400, precioActual: 520.5 })) !== -1, 'la ganancia acumulada arriba del valor');
ok(voo.indexOf('col-pc') !== -1 && voo.indexOf('col-precio') !== -1 && voo.indexOf('col-valor') !== -1,
  'cada numero en su columna con clase propia (nowrap: los numeros no se parten)');
var btc = filas[6].innerHTML;
ok(btc.indexOf('&mdash;') !== -1, 'sin precio de compra va una raya, no un cero');
ok(api.gananciaHtml({ precioCompra: null, precioActual: 60000 }) === '', 'y sin precio de compra no hay ganancia inventada');

console.log('\nC2) la fila tiene la pinta de la lista de mercado (la referencia de TradingView)');
// Misma celda de identidad que la tarjeta del Inicio: se llama a la MISMA
// funcion (celdaInstrumentoHtml, graficos.js), no a una copia.
ok(voo.indexOf('holdcell') !== -1 && voo.indexOf('holdav etf') !== -1,
  'logo en circulo con el color de su tipo, como en el Inicio');
ok(voo.indexOf('assets.parqet.com/logos/symbol/VOO') !== -1, 'el logo del ETF sale por SU ticker');
ok(filas[6].innerHTML.indexOf('cryptocurrency-icons') !== -1, 'la cripto usa su set de iconos');
ok(voo.indexOf('class="sym"') !== -1 && voo.indexOf('class="desc"') !== -1,
  'simbolo grande y descripcion abajo (el CSS de .holdtable la corta en una linea)');
ok(voo.indexOf('holdinit') !== -1 && voo.indexOf('onerror=') === -1,
  'iniciales de respaldo ocultas y NADA inline: el enganche del logo va por JS');
ok(logosEnganchados === 4, 'engancharLogos corrio para las 4 filas (la caida a iniciales queda activa): ' + logosEnganchados);
ok(codigo.indexOf('celdaInstrumentoHtml(h)') !== -1,
  'la celda de identidad ES la del Inicio (misma funcion, no una copia)');

console.log('\nD) tocar una fila abre su detalle desplegable');
filas[1].onclick();
ok(detallesAbiertos.length === 1 && detallesAbiertos[0].symbol === 'VOO', 'la fila llama a toggleDetalle con SU posicion');

console.log('\nE) navegacion: el titulo del Inicio abre la pantalla, Volver vuelve');
ok(els.posTitulo._ev && typeof els.posTitulo._ev.click === 'function', 'el titulo quedo cableado por JS (la politica de contenido no permite onclick inline)');
els.posTitulo._ev.click();
ok(vistasPedidas[vistasPedidas.length - 1] === 'posiciones', 'click en el titulo -> setView(posiciones)');
els.posTitulo._ev.keydown({ key: 'Enter', preventDefault: function () {} });
ok(vistasPedidas[vistasPedidas.length - 1] === 'posiciones' && vistasPedidas.length === 2, 'Enter tambien lo abre (role=button de verdad)');
var antes = vistasPedidas.length;
els.posTitulo._ev.keydown({ key: 'a', preventDefault: function () {} });
ok(vistasPedidas.length === antes, 'cualquier otra tecla no hace nada');
els.posBack.onclick();
ok(vistasPedidas[vistasPedidas.length - 1] === 'inicio', 'Volver -> setView(inicio)');

console.log('\nF) sin datos no hay pantalla rota');
lastData.posiciones = [{ symbol: 'USDT', nombre: 'Tether', tipo: 'cash', valor: 1000 }];
api.renderPosiciones();
ok(els.posBody.innerHTML.indexOf('No positions') !== -1, 'una cartera solo-cash dice "Sin posiciones", no una tabla vacia');
lastData.posiciones = [];
api.renderPosiciones();
ok(els.posBody.innerHTML.indexOf('No positions') !== -1, 'sin posiciones, idem');

console.log('\nG) el HTML y el cableado del resto de la app');
var indexCrudo = fs.readFileSync(ruta.INDEX, 'utf8');
ok(indexCrudo.indexOf('Principales posiciones') === -1, 'el titulo del Inicio ya no dice "Principales posiciones"');
ok(/<h2 id="posTitulo"[^>]*>Positions/.test(indexCrudo), 'dice "Positions" y es el h2 con id posTitulo');
ok(/id="posTitulo"[^>]*role="button"/.test(indexCrudo) && /id="posTitulo"[^>]*tabindex="0"/.test(indexCrudo),
  'el titulo es tocable tambien con teclado (role=button + tabindex)');
ok(indexCrudo.indexOf('id="view-posiciones"') !== -1 && indexCrudo.indexOf('id="posBody"') !== -1, 'la vista nueva existe con su tabla');
// "Compra" y no "P. compra": esa cabecera era lo MAS ANCHO de su columna y le
// robaba ~22px a la del nombre, que es la unica flexible (medido a 375px).
ok(/<table class="holdtable postable">\s*\n?<thead><tr><th>Instr\.<\/th><th>Buy<\/th><th>Price<\/th><th>Value<\/th><\/tr><\/thead>\s*\n?<tbody id="posBody">/.test(indexCrudo),
  'las columnas pedidas sobre la tabla con el estilo del Inicio (.holdtable)');
ok(/\.postable th \{[^}]*white-space:\s*nowrap/.test(indexCrudo), 'las cabeceras no se parten en dos renglones');
ok(/\.postable \.col-pc \{[^}]*nowrap/.test(indexCrudo) && /\.postable \.col-valor \{[^}]*nowrap/.test(indexCrudo),
  'precio de compra y valor tampoco (nota: esto mira la regla escrita, el arnes no mide geometria)');
// Pedido de Guzman (25/08/2026, segunda captura): el valor en gris como el
// precio de compra, para que el numero que salte a la vista sea el PRECIO.
ok(/\.postable \.col-valor \{[^}]*color: var\(--muted\)/.test(indexCrudo),
  'el valor va en gris (var(--muted)): el protagonista es el precio actual');
// Y el logo llena el circulo ENTERO: el padding fue 5 (logo chico), despues
// 1 (se veia como un aro blanco en los logos redondos) y quedo en 0 — el
// recorte redondo lo hace el border-radius (pedido de Guzman, 25/08 noche).
ok(/\.holdav img \{[^}]*padding: 0;/.test(indexCrudo),
  'el logo solapa su circulo entero (padding 0, sin aro blanco)');
var vistasSrc = fs.readFileSync(path.join(ruta.RUTA, 'js', 'vistas.js'), 'utf8');
ok(/var VIEWS = \[[^\]]*'posiciones'/.test(vistasSrc), 'la vista esta en VIEWS (setView la puede mostrar y esconder)');
ok(vistasSrc.indexOf("name === 'posiciones' ? 'inicio'") !== -1, 'en la barra de abajo queda encendido Inicio');
ok(vistasSrc.indexOf("if (name === 'posiciones') renderPosiciones();") !== -1, 'entrar a la vista la pinta');
ok(codigo.indexOf("tipoDe(p) !== 'cash'") !== -1, 'el filtro de cash esta escrito en el render (USDT no depende solo del backend)');
var arranqueSrc = fs.readFileSync(path.join(ruta.RUTA, 'js', 'arranque.js'), 'utf8');
ok(arranqueSrc.indexOf('view-posiciones') !== -1 && arranqueSrc.indexOf('renderPosiciones()') !== -1,
  'el poll de 60 s repinta la lista si esta a la vista');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
