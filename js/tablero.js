// El tablero del Inicio: la tira de indicadores del escritorio, las
// principales posiciones con su mini-grafico y su logo, y el detalle
// desplegable de cada activo (TradingView + indicadores). Los ayudantes de
// % del dia y ganancia (daychgHtml/gananciaHtml) viven aca porque los usan
// las filas del tablero y las de Posiciones. Hasta el 6/09/2026 todo esto
// vivia dentro de graficos.js; se separo por pantalla, sin cambiar una linea.
// Variacion del dia de mercado (verde/rojo), estilo Binance. Va arriba del
// PRECIO, que es el numero que se movio hoy — pedido de Guzman (17/08/2026).
// Antes estaba arriba del valor total, donde se confundia con la ganancia
// acumulada de la posicion.
function daychgHtml(p) {
  if (p.cambioDia === null || p.cambioDia === undefined || p.cambioDia === '' ||
      !isFinite(Number(p.cambioDia))) {
    // D8: el cash no cotiza y su celda vacia esta bien. Para un valor, en
    // cambio, la celda vacia se lee igual que "no se movio" — y no saber no
    // es lo mismo que no moverse. La marca ocupa el mismo renglon que
    // ocuparia el % del dia (.daystale, hermana de .daychg).
    return esFilaCash(p) ? '' : '<span class="daystale">not priced</span>';
  }
  return pctHtml(Number(p.cambioDia), 2, extHtml(p));
}

// El salto fuera de rueda (8/09/2026), pedido de Guzman: "cuando hay un
// salto grande de pre market o after market deberia aparecer entre parentesis
// al costado de ese %". El backend manda cambioExt (el ultimo precio fuera
// de rueda contra el cierre regular) y sesionExt ('pre' | 'post') solo con el
// mercado cerrado; aca se muestra si el salto llega a EXT_UMBRAL_PCT. Un
// movimiento chico fuera de rueda es ruido y no merece el renglon.
var EXT_UMBRAL_PCT = 1;
function extHtml(p) {
  var x = Number(p.cambioExt);
  if (p.cambioExt === null || p.cambioExt === undefined || !isFinite(x) || Math.abs(x) < EXT_UMBRAL_PCT) return '';
  return ' <span class="dayext">(' + (p.sesionExt === 'pre' ? 'pre' : 'post') + ' ' + signoPct(x, 1) + ')</span>';
}

// Ganancia acumulada de la posicion: precio actual contra el precio medio de
// compra. Va arriba del VALOR, que es la plata que representa. Sin precio de
// compra no se muestra nada: el promedio sale de las hojas de cada cuenta y hay
// posiciones (cripto vieja, cash) que no lo tienen. Un cero ahi diria "no
// ganaste nada", que es una afirmacion, no un dato que falta.
function gananciaHtml(p) {
  var pm = Number(p.precioCompra), pa = Number(p.precioActual);
  if (!isFinite(pm) || pm <= 0 || !isFinite(pa) || pa <= 0) return '';
  return pctHtml((pa / pm - 1) * 100, 2);
}
// ---------- La tira de indicadores del escritorio (31/08/2026) ----------
// Sale de comparar con IBKR, Schwab, Fidelity, Sharesight y Snowball:
// NINGUNO abre con un grafico, todos abren con numeros. El cambio del dia en
// DOLARES (no solo en %) y el resultado no realizado aparecen en 7-8 de cada
// 10; hoy la app no tenia ni uno ni otro.
//
// Se calcula con lo que YA viene en el payload — ni una llamada mas.
//
// Dos honestidades que no son decorativas:
// - El cambio del dia SOLO suma las posiciones que tienen variacion. Hoy
//   faltan varias (Finnhub frena por IP; ver la entrada del 31/08 en
//   HISTORIAL.md), y sumar como cero las que no tienen daria un numero
//   MENOR al real presentado como completo. Por eso el subtitulo dice sobre
//   cuantas posiciones se calculo cuando no estan todas.
// - El resultado no realizado solo cuenta las que tienen precio de compra
//   conocido: el fondo de Itau y la liquidez no lo tienen.
// D8 (31/08/2026). Fidelity separa "Today's Change" de "Change in Securities
// Not Priced Today" en vez de meter todo en un numero. Aca no se puede copiar
// literal —de lo que no tiene precio de hoy no sabemos NADA, ni siquiera
// cuanto se movio—, asi que la version honesta es sacarlo del calculo y
// decir cuanta plata quedo afuera.
//
// Dos cosas estaban mal antes, y las dos empujaban el numero para el mismo
// lado:
//
//  1. El PORCENTAJE se dividia por la cartera ENTERA mientras que el monto
//     de arriba solo sumaba lo que si tiene precio. Eso equivale a afirmar
//     que lo no cotizado se movio 0%, que es una afirmacion, no un dato. Con
//     la cartera real hay ~12,7% sin precio de hoy: el porcentaje salia
//     aguado como un 25% menos de lo que de verdad se movio la parte medida.
//  2. El CASH se contaba como "sin dato". El cash no cotiza porque no se
//     mueve, no porque falte informacion. Contarlo hacia que el aviso no
//     pudiera desaparecer nunca — y un aviso que esta siempre encendido se
//     aprende a ignorar.
//
// El cash SI entra en el divisor, y ahi no hay contradiccion: de verdad se
// movio 0%. Lo unico que se saca del calculo es lo que no sabemos.
function calcularKpis(data) {
  var pos = (data && data.posiciones) || [];
  var diaUsd = 0, ayerMedido = 0, conDia = 0;
  var sinPrecio = 0, valorSinPrecio = 0;
  var valorConCosto = 0, costo = 0;
  pos.forEach(function (p) {
    var v = Number(p.valor);
    var cd = Number(p.cambioDia);
    var tieneDia = p.cambioDia !== null && p.cambioDia !== undefined && isFinite(cd);
    if (isFinite(v) && v > 0) {
      if (tieneDia) {
        // v es el valor de HOY: lo de ayer es v / (1 + cd/100).
        var ayer = v / (1 + cd / 100);
        if (isFinite(ayer) && ayer > 0) { diaUsd += v - ayer; ayerMedido += ayer; conDia++; }
      } else if (esFilaCash(p)) {
        ayerMedido += v;   // no se movio: aporta al divisor y nada al cambio
      } else {
        sinPrecio++; valorSinPrecio += v;
      }
    }
    // El cash NO tiene resultado no realizado: es plata, no una posicion
    // comprada a un precio. Excluirlo no es una preferencia de presentacion,
    // es un bug encontrado el 31/08/2026 mirando la pantalla con datos
    // reales: la fila de ITAU llega con `base` 239.974 contra un valor de
    // 6.021 (la columna no esta en dolares), y esa sola fila daba
    // "Unrealized −USD 198.516 / −65,1%" cuando lo real es +USD 35.437 /
    // +54,4%. El SIGNO estaba dado vuelta, no solo el monto.
    var base = Number(p.base);
    if (isFinite(v) && isFinite(base) && base > 0 && !esFilaCash(p)) {
      valorConCosto += v; costo += base;
    }
  });
  var total = Number(data && data.total);
  return {
    diaUsd: conDia ? diaUsd : null,
    diaPct: (conDia && ayerMedido > 0) ? (diaUsd / ayerMedido * 100) : null,
    conDia: conDia,
    sinPrecio: sinPrecio,
    valorSinPrecio: valorSinPrecio,
    // Sobre la cartera entera, para poder decir "esto es un octavo de lo
    // tuyo" y no solo un monto suelto.
    pctSinPrecio: (isFinite(total) && total > 0) ? (valorSinPrecio / total * 100) : null,
    noRealizado: costo > 0 ? (valorConCosto - costo) : null,
    noRealizadoPct: costo > 0 ? ((valorConCosto - costo) / costo * 100) : null
  };
}

function pintarKpis(data) {
  var el = document.getElementById('kpiStrip');
  if (!el) return;
  var k = calcularKpis(data);
  function celda(etiqueta, valor, pct, clase, nota) {
    return '<div><p class="kpi-et">' + esc(etiqueta) + '</p><p class="kpi-va' + (clase ? ' ' + clase : '') + '">' +
      valor + (pct ? '<span class="kpi-sec">' + pct + '</span>' : '') + '</p>' +
      (nota ? '<p class="kpi-et" style="margin:5px 0 0;letter-spacing:.04em;text-transform:none">' + esc(nota) + '</p>' : '') +
      '</div>';
  }
  var h = '';
  // 1) Hoy, en dolares Y en porcentaje.
  if (k.diaUsd === null) {
    h += celda('Today', '&mdash;', '', '', 'no daily data yet');
  } else {
    // La nota dice la PLATA que quedo afuera, no cuantas posiciones: seis
    // posiciones chicas y una grande se leen igual contadas, y no son lo
    // mismo. Con la cartera real, "6 of 24 positions" suena menor y en plata
    // es un octavo de todo.
    h += celda('Today', (k.diaUsd >= 0 ? '+' : '−') + fmt(Math.abs(k.diaUsd)),
      k.diaPct === null ? '' : signoPct(k.diaPct, 2),
      k.diaUsd >= 0 ? 'up' : 'down',
      k.sinPrecio ? ('excludes ' + fmt(k.valorSinPrecio) + ' not priced today' +
        (k.pctSinPrecio ? ' (' + k.pctSinPrecio.toFixed(1) + '%)' : '')) : '');
  }
  // 2) El resultado no realizado.
  if (k.noRealizado === null) {
    h += celda('Unrealized', '&mdash;', '', '', 'no cost basis');
  } else {
    h += celda('Unrealized', (k.noRealizado >= 0 ? '+' : '−') + fmt(Math.abs(k.noRealizado)),
      signoPct(k.noRealizadoPct, 1), k.noRealizado >= 0 ? 'up' : 'down');
  }
  // 3) La liquidez, que en el telefono vive en su propia linea.
  h += celda('Cash', fmt(data.liquidez),
    (data.liquidezPct ? (data.liquidezPct * 100).toFixed(1) + '%' : ''));
  el.innerHTML = h;
}

// ---------- Detalle desplegable por activo + grafico TradingView ----------
var detalleAbierto = null;
// El widget se incrusta como IFRAME, no como <script> de TradingView.
// Antes su loader corria en ESTE documento, el mismo que guarda en localStorage
// la clave de Binance y el token de la API: cualquier alteracion de ese script
// se las llevaba. La URL de incrustacion directa da exactamente el mismo
// widget (la carga igual su loader, pero del otro lado del iframe).
function crearTvWidget(container, symbol) {
  var cfg = {
    symbol: symbol, width: '100%', height: 180, locale: 'es', dateRange: '12M',
    colorTheme: (esTemaClaro() ? 'light' : 'dark'), isTransparent: true, autosize: false
  };
  var fr = document.createElement('iframe');
  fr.src = 'https://s.tradingview.com/embed-widget/mini-symbol-overview/?locale=en#' +
    encodeURIComponent(JSON.stringify(cfg));
  fr.setAttribute('scrolling', 'no');
  fr.setAttribute('frameborder', '0');
  fr.setAttribute('title', 'Chart for ' + symbol);
  // Sin allow-forms/allow-modals/allow-top-navigation: el widget solo dibuja.
  fr.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
  fr.setAttribute('referrerpolicy', 'origin');
  fr.style.cssText = 'width:100%;height:180px;border:0;display:block';
  container.appendChild(fr);
  // Tocar el grafico abre TradingView en ESE ticker (pedido de Guzman,
  // 29/08/2026). El toque no puede llegarle al iframe con intencion nuestra
  // (es de otro origen y va sandboxeado), asi que un ancla transparente
  // cubre el widget entero, logo incluido, y lleva directo al grafico web
  // completo de TradingView. Se probo abrir primero la app nativa via su
  // esquema privado (tradingview://) con este mismo ticker: la app SI abre,
  // pero TradingView no documenta en ningun lado el formato del parametro
  // (probados varios, verificado a mano en el telefono el 29-30/08/2026) y
  // siempre cae en la pantalla general en vez del ticker pedido — mostrar
  // eso es peor que no intentarlo, asi que se saco. El link web es simple,
  // predecible y siempre lleva al ticker correcto.
  var web = 'https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(symbol);
  var a = document.createElement('a');
  a.href = web; // link real: largo-toque, "abrir en pestana" y VoiceOver funcionan solo con el HTML
  a.target = '_blank';
  a.rel = 'noopener';
  a.setAttribute('aria-label', 'Open ' + symbol + ' in TradingView');
  a.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;z-index:1';
  container.style.position = 'relative';
  container.appendChild(a);
}
function toggleDetalle(tr, pos) {
  var mismo = detalleAbierto && detalleAbierto.tr === tr;
  if (detalleAbierto && detalleAbierto.det.parentNode) detalleAbierto.det.parentNode.removeChild(detalleAbierto.det);
  detalleAbierto = null;
  if (mismo) return;
  var det = document.createElement('tr');
  det.className = 'detrow';
  var td = document.createElement('td');
  td.colSpan = tr.children.length;
  var pm = Number(pos.precioCompra);
  var tienePm = isFinite(pm) && pm > 0;
  var base = (pos.base !== undefined && pos.base !== null) ? Number(pos.base) : (tienePm && Number(pos.qty) ? pm * Number(pos.qty) : null);
  var pa = Number(pos.precioActual);
  var symU = String(pos.symbol || '').toUpperCase();
  // Editable = posicion de PRECIO MANUAL dentro de la pagina de SU cuenta
  // (V16, 29/08/2026): sin proveedor vivo (gfTicker vacio), sin cotizacion
  // cripto, y con la cuenta conocida — hoy, el fondo de Itau. Nacio con el
  // corte a D1: la celda de la planilla que Guzman editaba dejo de llegar.
  // Las criptos de Binance tambien pueden editar SOLO el precio de compra
  // (9/09/2026): lo comprado por Convert o con tarjeta no figura en el
  // historial spot que lee la app, y sin precio medio no hay % de ganancia.
  // El precio actual de una cripto sigue viniendo del mercado.
  var editable = !!pos.cuenta && !pos.gfTicker && symU !== 'USDT' && symU !== 'LIQUIDEZ';
  var soloCompra = !!pos.cripto;
  var html = '<div class="detgrid">' +
    '<span><span class="detlbl">Average price</span><b>' + (tienePm ? esc(fmtNum(pm)) : '&mdash;') + '</b></span>' +
    '<span><span class="detlbl">Cost basis</span><b>' + (base ? fmt(base) : '&mdash;') + '</b></span>';
  if (tienePm && isFinite(pa) && pa > 0) {
    var res = (pa / pm - 1) * 100;
    html += '<span><span class="detlbl">Result</span><b class="' + (res >= 0 ? 'up' : 'down') + '">' + signoPct(res, 1) + '</b></span>';
  }
  html += '</div>';
  if (editable) {
    html += '<div class="detedit">' +
      '<button type="button" class="detedit-abrir">' + (soloCompra ? 'Set buy price' : 'Edit prices') + '</button>' +
      '<div class="detedit-form" hidden>' +
      (soloCompra ? '' : '<label><span class="detlbl">Current price</span><input class="detedit-pa" type="number" inputmode="decimal" step="any" min="0"></label>') +
      '<label><span class="detlbl">Buy price (last lot)</span><input class="detedit-pc" type="number" inputmode="decimal" step="any" min="0"></label>' +
      '<div class="detedit-botones"><button type="button" class="detedit-guardar">Save</button><button type="button" class="detedit-cerrar">Cancel</button></div>' +
      '<p class="detedit-msg"></p>' +
      '</div></div>';
  }
  html += '<div class="detfund"></div><div class="tvwrap"></div>';
  td.innerHTML = html;
  det.appendChild(td);
  tr.parentNode.insertBefore(det, tr.nextSibling);
  if (editable) wireEditPrecios(td, pos);
  if (symU && symU !== 'USDT' && symU !== 'ITAU') {
    crearTvWidget(td.querySelector('.tvwrap'), pos.cripto ? ('BINANCE:' + symU + 'USDT') : symU);
  } else {
    td.querySelector('.tvwrap').style.display = 'none';
  }
  detalleAbierto = { tr: tr, det: det };
  cargarFundamentales(symU, td.querySelector('.detfund'));
}

// El formulario de editar precios de una posicion MANUAL (V16, 29/08/2026).
// El permiso de escribir lo decide el backend (posicion_editar rechaza toda
// posicion con proveedor vivo): aca solo se muestra el formulario cuando
// tiene sentido y se pinta la respuesta tal cual.
function wireEditPrecios(td, pos) {
  var abrir = td.querySelector('.detedit-abrir');
  var form = td.querySelector('.detedit-form');
  var inPa = td.querySelector('.detedit-pa');
  var inPc = td.querySelector('.detedit-pc');
  var msg = td.querySelector('.detedit-msg');
  var btn = td.querySelector('.detedit-guardar');
  var cerrar = td.querySelector('.detedit-cerrar');
  if (!abrir || !form || !btn) return;
  abrir.onclick = function () {
    form.hidden = !form.hidden;
    if (!form.hidden) {
      if (inPa && Number(pos.precioActual) > 0) inPa.value = Number(pos.precioActual);
      if (inPc && Number(pos.precioCompra) > 0) inPc.value = Number(pos.precioCompra);
    }
  };
  if (cerrar) cerrar.onclick = function () { form.hidden = true; if (msg) msg.textContent = ''; };
  btn.onclick = function () {
    var pa2 = inPa && inPa.value !== '' ? Number(inPa.value) : null;
    var pc2 = inPc && inPc.value !== '' ? Number(inPc.value) : null;
    if (pa2 === null && pc2 === null) { if (msg) msg.textContent = 'Enter at least one price.'; return; }
    btn.disabled = true;
    if (msg) msg.textContent = 'Saving...';
    google.script.run.withSuccessHandler(function (r) {
      btn.disabled = false;
      if (!r || !r.ok) { if (msg) msg.textContent = msgBackend(r) || 'Could not save.'; return; }
      if (msg) msg.textContent = (r.mensajes || []).join(' ');
      // La cuenta abierta se refresca con los numeros nuevos; la funcion
      // vive en vistas.js (ambito global compartido, cargado antes).
      if (typeof recargarCuentaAbierta === 'function') recargarCuentaAbierta();
    }).withFailureHandler(function () {
      btn.disabled = false;
      if (msg) msg.textContent = 'Network error: could not save.';
    }).editarPrecioManual({ cuenta: pos.cuenta, symbol: pos.symbol, precioActual: pa2, precioCompra: pc2 });
  };
}

// ---------- Indicadores del detalle (V14) ----------
// Los numeros duros de la posicion, con el multiplo que le corresponde a su
// tipo de activo y comparado contra SU PROPIA mediana historica. El backend
// (fn 'fundamentales') decide QUE indicadores tienen sentido para cada clase
// y manda los textos resueltos: aca solo se pinta.
//
// Cache en memoria por simbolo: el detalle se abre y se cierra todo el tiempo
// y los fundamentales no cambian en una sesion. El backend ademas cachea 6 h.
var fundCache = {};
function cargarFundamentales(symbol, caja) {
  if (!symbol || !caja) return;
  if (fundCache[symbol]) { pintarFundamentales(fundCache[symbol], caja); return; }
  caja.innerHTML = '<p class="detfund-cargando">Loading indicators...</p>';
  google.script.run.withSuccessHandler(function (r) {
    if (r) fundCache[symbol] = r;
    // El detalle pudo cerrarse mientras el pedido viajaba: sin este chequeo
    // se escribiria sobre un nodo que ya no esta en la pagina.
    if (caja.parentNode) pintarFundamentales(r, caja);
  }).withFailureHandler(function (err) {
    if (caja.parentNode) caja.innerHTML = '<p class="detfund-cargando">' + esc(msgErr(err, 'The indicators')) + '</p>';
  }).getFundamentales({ symbol: symbol });
}

function pintarFundamentales(r, caja) {
  if (!r) { caja.innerHTML = ''; return; }
  var h = '';
  if (r.ok === false) {
    // Un simbolo sin cobertura no es un error de la app: se dice y punto.
    h = '<p class="detfund-cargando">' + esc(msgBackend(r)) + '</p>';
    caja.innerHTML = h;
    return;
  }
  var ind = r.indicadores || [];
  if (ind.length) {
    h += '<div class="detfund-tabla">';
    ind.forEach(function (i) {
      h += '<div class="detfund-fila"><span>' + esc(i.nombre) + '</span><b>' + esc(i.valor) + '</b>' +
        (i.contexto ? '<em>' + esc(i.contexto) + '</em>' : '') + '</div>';
    });
    h += '</div>';
  }
  var e = r.estimaciones || {};
  var pr = e.proximoReporte;
  if (e.forwardPE || pr || e.consenso) {
    h += '<p class="detfund-tit">Looking forward</p><div class="detfund-tabla">';
    if (e.forwardPE) {
      h += '<div class="detfund-fila"><span>Forward P/E</span><b>' + esc(e.forwardPE) + '</b>' +
        (e.forwardPEG ? '<em>forward PEG ' + esc(e.forwardPEG) + '</em>' : '') + '</div>';
    }
    if (pr) {
      var det = [];
      if (pr.epsEstimado) det.push('EPS ' + pr.epsEstimado + ' expected');
      if (pr.ventasEstimadas) det.push('revenue ' + pr.ventasEstimadas);
      h += '<div class="detfund-fila"><span>Next earnings</span><b>' + esc(pr.fecha) +
        (pr.cuando ? ' <em style="display:inline">(' + esc(pr.cuando) + ')</em>' : '') + '</b>' +
        (det.length ? '<em>' + esc(det.join(' · ')) + '</em>' : '') + '</div>';
    }
    if (e.consenso) {
      var c = e.consenso;
      h += '<div class="detfund-fila"><span>Analyst consensus</span><b>' + c.compra + ' buy · ' + c.mantener + ' hold · ' + c.venta + ' sell</b>' +
        '<em>what other analysts publish, not a suggestion from this app</em></div>';
    }
    h += '</div>';
  }
  (r.notas || []).forEach(function (n) {
    h += '<p class="detfund-nota">' + esc(n) + '</p>';
  });
  caja.innerHTML = h;
  // El panel cambio de alto: la tarjeta que lo contiene tiene que seguirlo.
  if (typeof ajustarAlturaDeck === 'function') ajustarAlturaDeck();
}
// ---------- Principales posiciones (Inicio) ----------
var holdingsExpanded = false;
var lastHoldings = [];
// Las filas pintadas ({symbol, tr}) y las cabeceras de seccion ({tr, idx de
// su primera fila}), para poder actualizar EN EL LUGAR.
var holdFilas = [];
var holdCabezas = [];
// Tipo visual de una posicion; TIPO_LABELS (vistas.js) le pone el nombre.
function tipoDe(h) {
return (h.tipo === 'accion' || h.tipo === 'etf' || h.tipo === 'cripto' || h.tipo === 'cash') ? h.tipo : (h.cripto ? 'cripto' : 'accion');
}
// Agrupado por tipo (referencia de Guzman, 18/08/2026: la lista de mercado de
// TradingView): las secciones separan acciones de ETFs y cripto. Dentro de
// cada grupo se conserva el orden que ya viene (valor descendente).
//
// Los ETFs van PRIMERO desde el 22/08/2026 (pedido de Guzman). Tiene sentido
// con su cartera: los dos ETFs mas grandes (VOO y QQQ) pesan mas que
// cualquier accion suelta, asi que lo primero que se ve es lo que mas pesa.
function ordenarPorTipo(list) {
var orden = ['etf', 'accion', 'cripto'];
var out = [];
orden.forEach(function (t) { list.forEach(function (h) { if (tipoDe(h) === t) out.push(h); }); });
list.forEach(function (h) { if (orden.indexOf(tipoDe(h)) === -1) out.push(h); });
return out;
}
// La fila se arma en UN solo lugar, la use quien la use (crear o actualizar):
// test-posiciones verifica aca que cada porcentaje quede en su columna.
// Sin columna de cantidad (pedido de Guzman): la cantidad vive en el detalle.
// ---------- Mini-grafico por posicion (V6) ----------
// Los cierres del ultimo mes por simbolo llegan en el payload COMPLETO
// (data.sparks); el poll de 60 s no los trae, porque un mes de cierres no
// cambia en 60 segundos. Por eso una respuesta sin el dato NO borra el que
// ya estaba — mismo criterio defensivo que el indice y la serie del grupo.
var sparksPorSym = {};
function aplicarSparks(data) {
var s = data && data.sparks;
// Un objeto VACIO tambien se ignora: el backend manda {} cuando no pudo leer
// los cierres guardados, y pisar con vacio
// borraria dibujos que siguen siendo validos. Auditoria del 22/08/2026.
if (!s || typeof s !== 'object' || !Object.keys(s).length) return;
sparksPorSym = s;
}
// Un <svg> escrito a mano: dibujar 7 lineas de 24 puntos no justifica una
// libreria (regla R2), y una <polyline> es exactamente eso.
// 64x28 desde el 22/08/2026: al sacar las columnas de monto y ganancia sobro
// ancho, y el dibujo de 46x20 quedaba chico para lo que ahora es el dato
// principal de la fila junto al precio. El alto tambien sube — la escala usa
// todo el alto disponible, asi que un mini-grafico mas alto DISTINGUE mejor
// los movimientos chicos, no solo se ve mas grande.
var SPARK_W = 80, SPARK_H = 32;
// Cada relleno necesita su propio degradado: dos <svg> con el MISMO id de
// gradiente se pisan (el navegador usa el primero que encuentra) y el segundo
// saldria pintado del color del primero — verde bajo una linea roja.
var _sparkId = 0;
// w/h opcionales: la tabla de posiciones usa el tamano chico de siempre, y la
// mini de Evolucion pide uno ancho y bajo. Misma funcion para las dos — el
// dibujo ya estaba probado y no tiene sentido tener dos.
//
// `opts.area` rellena debajo de la linea. En la TABLA no va: siete filas con
// relleno la vuelven pesada.
//
// LOS PUNTOS POR VALOR SE SACARON (23/08/2026). El pedido original fue por el
// rango 1S, que se veia "facetado, tipo montana con quiebres duros" — y la
// causa eran los DATOS, no el dibujo: el historico guarda un valor por dia, o
// sea 7 puntos y 6 tramos rectos por semana. Se intento marcarlos con un
// circulo para que el codo se leyera como dato y no como defecto. No funciono:
// "saca los puntitos esos". Lo que SI resolvio el problema fue achicar el
// dibujo — de 305 unidades de ancho a 100 (EVO_W), el tramo de una semana pasa
// de 50px a 16 y el codo se disimula solo. Si algun dia vuelve a aparecer
// facetado, la palanca es el TAMANO, no marcar los puntos: ya se probo y se
// descarto. (Decia "a 87", que es el ancho MEDIDO de la celda en pantalla, no
// el del dibujo; con 87 la cuenta de al lado no cierra. Auditoria del
// 23/08/2026.)
function sparkSvg(serie, w, h, dicePct, opts) {
if (!serie || serie.length < 2) return '';
var o = opts || {};
var W = w || SPARK_W, H = h || SPARK_H;
var min = serie[0], max = serie[0];
for (var i = 1; i < serie.length; i++) { if (serie[i] < min) min = serie[i]; if (serie[i] > max) max = serie[i]; }
var rango = max - min;
// Un mes plano (o un solo precio repetido) se dibuja como una raya al medio,
// no como una division por cero.
var pad = 2, alto = H - pad * 2, ancho = W - pad * 2;
var pts = [], xs = [];
for (var j = 0; j < serie.length; j++) {
var x = pad + (j * ancho) / (serie.length - 1);
var y = pad + (rango === 0 ? alto / 2 : alto - ((serie[j] - min) / rango) * alto);
xs.push(x);
pts.push(x.toFixed(1) + ',' + y.toFixed(1));
}
// El color sale del TEMA, no de un hexadecimal fijo: la app tiene tema claro y
// ahi el verde es #0f9d58 (el #22c55e del tema oscuro sobre fondo blanco da
// 2,3:1 de contraste, por debajo del minimo). Va como clase porque un
// stroke="var(--green)" en el ATRIBUTO no lo resuelve el navegador.
var sube = serie[serie.length - 1] >= serie[0];
var pct = serie[0] ? ((serie[serie.length - 1] / serie[0] - 1) * 100) : 0;
// El texto para lectores de pantalla no es adorno: la columna se llama "Mes" y
// sin esto anuncia siete celdas VACIAS — promete un dato y no lo entrega.
var dicho = (pct >= 0 ? '+' : '') + pct.toFixed(1) + '% ' + (dicePct || 'this month');
// El relleno baja hasta el borde de abajo (H), no hasta H-pad: apoyado en el
// piso de la tarjeta parece un area, flotando 2px parece un error.
var relleno = '';
if (o.area) {
var gid = 'sparkfill' + (++_sparkId);
relleno = '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
'<stop offset="0" stop-color="currentColor" stop-opacity=".26"/>' +
'<stop offset="1" stop-color="currentColor" stop-opacity="0"/>' +
'</linearGradient></defs>' +
'<path class="sparkarea" fill="url(#' + gid + ')" d="M' + pts.join(' L') +
' L' + xs[xs.length - 1].toFixed(1) + ',' + H + ' L' + xs[0].toFixed(1) + ',' + H + ' Z"/>';
}
return '<svg class="spark ' + (sube ? 'sube' : 'baja') + '" width="' + W + '" height="' + H +
// El viewBox tiene que ser el MISMO W/H con el que se calcularon los puntos.
// Quedo en SPARK_W/SPARK_H al generalizar la funcion y la mini de Evolucion
// —que dibuja en 300x44— salia recortada: se veia un pedacito de linea y el
// resto afuera del cuadro. Lo agarro una captura de Guzman, no una prueba.
// preserveAspectRatio="none" para que la linea ocupe TODO el ancho: una
// sparkline se estira a proposito, no se centra con bordes vacios.
'" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + dicho + '">' +
relleno + '<polyline points="' + pts.join(' ') + '"/></svg>';
}
function sparkDe(h) {
var s = sparksPorSym[String(h && h.symbol || '').toUpperCase()];
return sparkSvg(s);
}
// Logos de verdad en vez de las iniciales (pedido de Guzman, 22/08/2026: "en
// TradingView se ve mejor... y me gustaria que aparezcan los logos asi").
//
// Las dos fuentes van POR TICKER, no por dominio. Es la propiedad importante:
// el ticker ES la identidad del activo, asi que un logo o carga el correcto o
// no carga nada. La primera version usaba Clearbit, que pide el DOMINIO de la
// empresa: obligaba a mantener una tabla adivinada a mano y, peor, un dominio
// mal adivinado habria mostrado el logo de OTRA empresa al lado de plata de
// verdad — un error que no se ve como error. (Ademas Clearbit ya no responde:
// verificado el 22/08/2026, no devuelve nada.)
//
// Cobertura medida contra la cartera real ese dia: 16 de 19 acciones/ETFs, y
// 4 de 6 criptos. Lo que no esta en ninguna de las dos (NA9 en Xetra, TEP en
// Paris, MPT, RUNE, POL) se queda con las iniciales de siempre — que es el
// comportamiento anterior, no una falla.
function logoUrl(h) {
var sym = String(h.symbol || '').toUpperCase();
if (tipoDe(h) === 'cash') return null;
// Un logo declarado por el backend GANA sobre el servicio por ticker
// (27/08/2026). El servicio acierta en la mayoria, pero busca por ticker y un
// ticker se REUSA: para SPCX (SpaceX, que salio a bolsa el 12/06/2026)
// devolvia el logo de la gestora que lo tenia antes — un logo ajeno al lado
// de un simbolo se lee como si fuera el suyo.
if (h.logo) return h.logo;
if (tipoDe(h) === 'cripto') return 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@master/128/color/' + sym.toLowerCase() + '.png';
return 'https://assets.parqet.com/logos/symbol/' + encodeURIComponent(sym);
}
// Si el logo no carga (dominio sin logo, cripto fuera del set, sin red), se
// cae a las iniciales de siempre — nunca queda un hueco vacio.
function _sinLogo(img) {
img.style.display = 'none';
if (img.nextElementSibling) img.nextElementSibling.style.display = 'flex';
}
// Engancha el fallback de cada logo recien pintado. Va por JS y no por un
// atributo `onerror` en el HTML porque la politica de contenido no permite
// codigo inline: con el atributo, el navegador lo BLOQUEA y el circulo queda
// vacio. Se llama despues de escribir cada tabla.
function engancharLogos(contenedor) {
if (!contenedor || !contenedor.querySelectorAll) return;
var imgs = contenedor.querySelectorAll('img.holdlogo');
for (var i = 0; i < imgs.length; i++) {
  var img = imgs[i];
  if (img._enganchado) continue;
  img._enganchado = true;
  img.onerror = function () { _sinLogo(this); };
  // Un logo que ya fallo antes de que llegaramos a engancharlo (viene del
  // cache del navegador) no vuelve a disparar onerror: se mira el estado.
  if (img.complete && img.naturalWidth === 0) _sinLogo(img);
}
}
// La celda de identidad (logo + simbolo + descripcion) se arma en UN solo
// lugar: la usan la tarjeta del Inicio (aca abajo) y la pantalla Posiciones
// (renderPosiciones, vistas.js). Devuelve el contenido, sin el <td>: cada
// tabla pone el suyo.
// `descHtml` (opcional, YA escapado por quien lo manda): reemplaza el nombre
// en el renglon de abajo. El detalle de cuenta pone ahi el valor y la
// ganancia (8/09/2026).
function celdaInstrumentoHtml(h, descHtml) {
var sym = String(h.symbol || '');
var inic = sym.length <= 3 ? sym : sym.slice(0, 2);
var logo = logoUrl(h);
// El `onerror` NO va inline: la politica de contenido de la app no permite
// codigo dentro del HTML (script-src sin unsafe-inline), asi que ese handler
// nunca corria y un logo que no existe dejaba el circulo VACIO en vez de caer a
// las iniciales. Se engancha desde JS, en engancharLogos(). Auditoria del
// 24/08/2026.
var avatar = logo
  ? '<img src="' + esc(logo) + '" alt="" loading="lazy" class="holdlogo"><span class="holdinit" style="display:none">' + esc(inic) + '</span>'
  : esc(inic);
return '<span class="holdcell"><span class="holdav ' + tipoDe(h) + '">' + avatar + '</span><span class="holdid"><span class="sym">' + esc(sym) + '</span><span class="desc' + (descHtml ? ' accval' : '') + '">' + (descHtml || esc(h.nombre || '')) + '</span></span></span>';
}
function filaHoldingHtml(h) {
var pctDisplay = (h.pct * 100).toFixed(1) + '%';
return '<td>' + celdaInstrumentoHtml(h) + '</td>' +
'<td class="col-spark">' + sparkDe(h) + '</td>' +
'<td class="col-precio">' + daychgHtml(h) + esc(fmtNum(h.precioActual)) + '</td>' +
// Pedido de Guzman (22/08/2026), en dos pasos: primero se saco el monto en
// dolares y despues la ganancia acumulada. Esta tabla queda como una lista de
// mercado —simbolo, tendencia del mes, precio con su variacion del dia— y no
// como un estado de cuenta. Los dos datos que salieron siguen estando en el
// detalle de cada cuenta (vistas.js), que NO se toco, y la ganancia por
// posicion tambien en el desplegable de la fila.
'<td class="holdpct col-pct">' + pctDisplay + '</td>';
}
// ---------- Reparto de Principales posiciones ----------
// (Este encabezado es el marcador de fin de bloque de test-posiciones.js. Antes
// el marcador era la línea `var HOLD_ETFS = 3;`, o sea que el VALOR era parte
// del delimitador: mutar el tope para probar la cobertura no ponía asserts en
// rojo, mataba el arnés entero con "no se encontró el bloque" — y una
// verificación que aborta no verifica nada. Auditoría del 24/08/2026.)
var HOLD_ETFS = 3;
var HOLD_ACCIONES = 5;
// El valor llega como número del Worker, pero el orden de esta tarjeta es
// justo lo que ya falló una vez (el caso SMH), así que no se confía: un valor
// que no se pueda leer como número vale 0 y queda ÚLTIMO, en vez de empatar
// con todos y dejar el orden librado a quién llegó primero.
function numeroValor(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
  return isFinite(n) ? n : 0;
}
function porValor(a, b) { return numeroValor(b.valor) - numeroValor(a.valor); }
function _masGrandes(list, tipo, cuantos) {
  return list.filter(function (h) { return tipoDe(h) === tipo; }).sort(porValor).slice(0, cuantos);
}
/**
 * Qué muestra la tarjeta (pedido de Guzmán, 24/08/2026, en dos pasos):
 *   - plegada: sus 3 ETFs más grandes;
 *   - "Ver más": esos 3 ETFs más sus 5 acciones más grandes. Nada más.
 *
 * Los dos números son fijos a propósito: la tarjeta mide siempre lo mismo. Con
 * "todos los ETFs" alcanzó con que el backend mandara más posiciones para que
 * apareciera un cuarto (IWM) que Guzmán no quería ver ahí.
 *
 * Y se elige por VALOR, nunca por posición en la lista. El agrupado por tipo
 * (ETFs primero, pedido del 22/08) es de PRESENTACIÓN: cuando el corte se hacía
 * contando filas sobre esa lista ya agrupada, la pantalla mostraba SMH —la más
 * chica de todas, 4,1% de la cartera— y escondía META (5,6%) y GOOG (4,4%),
 * solo porque SMH es un ETF y los ETFs van arriba.
 *
 * NI CRIPTO NI CASH entran acá (decisión de Guzmán, 25/08/2026, confirmada
 * cuando se le preguntó). Queda excluido por partida doble y a propósito: el
 * Worker ya saca el cash del payload (`_esPosicionCash`) y este reparto elige
 * SOLO entre 'etf' y 'accion', así que un cash que se le escapara al backend
 * tampoco entraría. Ojo con el comentario que había acá antes, que decía que la
 * cripto "se ve entera en Portafolio": ERA FALSO. Portafolio es una torta con
 * su leyenda, no una lista de posiciones. Desde el 25/08/2026 la cartera entera
 * (cripto incluida, cash no) se lista en la pantalla Posiciones, que se abre
 * tocando el título de esta tarjeta (renderPosiciones, vistas.js) — esta
 * tarjeta del Inicio sigue siendo SOLO el recorte 3 ETFs + 5 acciones.
 */
function repartoHoldings(list) {
  var todos = (list || []).slice();
  var etfs = _masGrandes(todos, 'etf', HOLD_ETFS);
  var acciones = _masGrandes(todos, 'accion', HOLD_ACCIONES);
  // Sin ETFs, plegada no puede quedar vacía: se muestran las acciones.
  var plegados = etfs.length ? etfs : acciones;
  // Los visibles se llevan POR REFERENCIA, no por símbolo. Cuando esto era un
  // mapa indexado por `symbol`, dos posiciones con el mismo símbolo (una dentro
  // del recorte y otra fuera) marcaban la misma clave y escondían las dos —y
  // con varias posiciones sin símbolo, todas caían en la clave "UNDEFINED" y la
  // tabla plegada quedaba SIN UNA SOLA FILA, solo el botón. Hoy el Worker
  // fusiona por símbolo, así que no se dispara; el modo de falla era
  // desproporcionado y esto además es más simple. Auditoría del 25/08/2026.
  return { lista: etfs.concat(acciones), visibles: plegados };
}
// `ordenarPorTipo` reordena pero conserva los mismos objetos, así que comparar
// por referencia sigue siendo válido después de ordenar.
function claseFila(h, visibles) {
  var oculta = !holdingsExpanded && visibles.indexOf(h) === -1;
  return (oculta ? 'hidden-row ' : '') + 'asset-row';
}
// Si expandir falla, el botón vuelve a su texto normal y el detalle queda en la
// consola: antes escribía `ERR <mensaje de excepción>` ENCIMA del botón, que le
// deja al usuario un texto que no significa nada y además rompe el control.
function toggleHoldings() {
  try { holdingsExpanded = !holdingsExpanded; renderHoldings(lastHoldings); }
  catch (e) {
    if (window.console && console.error) console.error('toggleHoldings', e);
    var b = document.getElementById('holdMoreBtn');
    if (b) b.textContent = holdingsExpanded ? 'See less' : 'See more';
  }
}
function renderHoldings(list) {
var el = document.getElementById('holdingsList');
var btn = document.getElementById('holdMoreBtn');
if (btn && !btn._wired) { btn._wired = true; btn.addEventListener('click', toggleHoldings); }
lastHoldings = list || [];
if (!list || !list.length) { holdFilas = []; holdCabezas = []; el.innerHTML = '<tr><td colspan="4" class="newsempty">No positions.</td></tr>'; if (btn) btn.style.display = 'none'; return; }
// Qué entra en la tabla y qué queda detrás del boton (ver repartoHoldings):
// los ETFs siempre, y las 5 no-ETF mas grandes al expandir.
var reparto = repartoHoldings(list);
var visibles = reparto.visibles;
var lista = ordenarPorTipo(reparto.lista);
// El corte de "sin posiciones" se repite DESPUES del reparto. Si la cartera
// trajera solo cripto y/o cash, arriba pasa (la lista no está vacía) pero el
// reparto sí queda vacío, y la tarjeta terminaba siendo un rectángulo en blanco
// bajo el título, sin el mensaje que existe justo para eso. Auditoría del
// 25/08/2026.
if (!lista.length) { holdFilas = []; holdCabezas = []; el.innerHTML = '<tr><td colspan="4" class="newsempty">No positions.</td></tr>'; if (btn) btn.style.display = 'none'; return; }
// Actualizacion EN EL LUGAR (R4): si la tabla ya muestra estos simbolos en
// este orden, se refrescan las celdas de cada fila sin vaciar el tbody.
// Vaciarlo en cada poll cerraba el detalle abierto (y recargaba su grafico
// de TradingView) para pintar casi lo mismo. Si cambian los simbolos o el
// orden (una compra, un sorpasso por valor), se reconstruye como siempre.
var enLugar = holdFilas.length === lista.length && holdFilas.every(function (f, i) { return f.symbol === lista[i].symbol && f.tr.parentNode === el; });
if (!enLugar) { el.innerHTML = ''; holdFilas = []; holdCabezas = []; }
var tipoPrev = null;
lista.forEach(function (h, idx) {
var t = tipoDe(h);
if (!enLugar && t !== tipoPrev) {
var sec = document.createElement('tr');
sec.innerHTML = '<td colspan="4">' + esc((typeof TIPO_LABELS !== 'undefined' && TIPO_LABELS[t]) || t) + '</td>';
el.appendChild(sec);
holdCabezas.push({ tr: sec, idx: idx });
tipoPrev = t;
}
var tr = enLugar ? holdFilas[idx].tr : document.createElement('tr');
tr.className = claseFila(h, visibles);
tr.innerHTML = filaHoldingHtml(h);
engancharLogos(tr);
tr.onclick = function () { toggleDetalle(tr, h); };
if (!enLugar) { el.appendChild(tr); holdFilas.push({ symbol: h.symbol, tr: tr }); }
});
// La cabecera de una seccion se esconde junto con sus filas: una cabecera
// sobre cero filas es un titulo sobre nada.
//
// Alcanza con mirar la PRIMERA fila de la seccion porque el reparto las hace
// homogeneas: los ETFs se ven todos o —plegada— se ven todos, y las acciones
// se esconden todas juntas. Nunca hay una seccion mezclada. Eso es una
// PROPIEDAD DEL REPARTO, no de este bucle, asi que el arnes la verifica
// aparte: si algun dia el reparto deja una seccion a medias, esa prueba avisa
// y hay que volver acá. Auditoria del 24/08/2026.
holdCabezas.forEach(function (c) {
var primeraOculta = claseFila(lista[c.idx], visibles).indexOf('hidden-row') !== -1;
c.tr.className = 'holdsec' + (primeraOculta ? ' hidden-row' : '');
});
if (btn) {
// El botón dice "Ver más", sin número. Antes decía `Ver todas (N)`, y las dos
// mitades mentían: no son TODAS (la cripto y el cash nunca entran, y de las
// acciones solo van las 5 más grandes) y N era el tamaño del recorte, no el de
// la cartera — con 12 posiciones el botón anunciaba 8. Un número al lado de la
// palabra "todas" es exactamente el número inventado que este proyecto decidió
// no mostrar. Texto elegido por Guzmán el 25/08/2026.
var cuantasOcultas = lista.length - visibles.length;
if (cuantasOcultas > 0) { btn.style.display = 'block'; btn.textContent = holdingsExpanded ? 'See less' : 'See more'; }
else { btn.style.display = 'none'; }
}
}
