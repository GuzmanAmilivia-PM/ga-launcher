// Grafico de evolucion, detalle por activo (TradingView), posiciones
// ---------- Gráfico de evolución ----------
function buildRangeBar(barId) {
var bar = document.getElementById(barId);
bar.innerHTML = '';
RANGES.forEach(function (r) {
var btn = document.createElement('button');
btn.className = 'rangebtn' + (r.dias === currentRangeDias ? ' active' : '');
btn.textContent = r.key;
btn._dias = r.dias;
btn.onclick = function () {
currentRangeDias = r.dias;
syncRangeBars();
drawLineChart(filterSerie(currentRangeDias));
updateRangePct();
if (document.getElementById('chartModal').style.display !== 'none') drawBigChart();
};
bar.appendChild(btn);
});
}
function syncRangeBars() {
document.querySelectorAll('.rangebar .rangebtn').forEach(function (b) {
b.classList.toggle('active', b._dias === currentRangeDias);
});
}
function filterSerie(dias) {
if (!fullSerie.length) return [];
var now = Date.now();
var day = 24 * 60 * 60 * 1000;
var corte; if (dias === 'ytd') { corte = new Date(new Date().getFullYear(), 0, 1).getTime(); } else { corte = now - dias * day; }
var out = fullSerie.filter(function (p) { return p.fecha >= corte; });
if (out.length < 2 && fullSerie.length) {
var idx = fullSerie.length - 2;
out = fullSerie.slice(idx < 0 ? 0 : idx);
}
return out;
}
// Rendimiento anualizado (V6): en ventanas largas el % total no alcanza para
// saber si fue bueno — +40% en 3 años es otra cosa que +40% en uno. Aparece
// recien pasado ~1 año de datos (dias >= 400): anualizar un rango corto
// proyecta una racha como si durara un año, que es inventar. null = no
// corresponde mostrarlo.
function pctAnualizado(pct, dias) {
if (!(dias >= 400)) return null;
var factor = 1 + pct / 100;
if (factor <= 0) return null; // -100% o peor: la formula no tiene sentido
return (Math.pow(factor, 365 / dias) - 1) * 100;
}
function updateRangePct() {
var el = document.getElementById('rangePct');
var serie = filterSerie(currentRangeDias);
if (!serie.length || !currentTotal) { el.textContent = ''; el.className = 'rangepct'; return; }
var base = serie[0].valor;
if (!base) { el.textContent = ''; return; }
var pct = (currentTotal / base - 1) * 100;
var dias = (serie[serie.length - 1].fecha - serie[0].fecha) / 86400000;
var anual = pctAnualizado(pct, dias);
el.textContent = signoPct(pct, 2) +
(anual !== null ? ' · ' + signoPct(anual, 1) + ' anual' : '');
el.className = 'rangepct ' + (pct >= 0 ? 'up' : 'down');
}
function getFilteredDataPoints(serie) {
  return serie.filter(function (p, i) {
  if (i === serie.length - 1) return true; // el punto actual siempre se muestra
  var d = new Date(p.fecha).getDay();
  return d !== 0 && d !== 6;
  }).map(function (p) { return { x: p.fecha, y: p.valor }; });
  }
  function buildChartOptions(pts) {
  var TC = temaChart();
  var xMin = (pts && pts.length) ? pts[0].x : undefined;
  var xMax = (pts && pts.length) ? pts[pts.length - 1].x : undefined;
  return {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
  x: { type: 'linear', min: xMin, max: xMax, bounds: 'data', ticks: { color: TC.tick, maxTicksLimit: 6, callback: function (value) { return new Date(value).toLocaleDateString('es-UY', { day: '2-digit', month: 'short' }); } }, grid: { color: TC.grid } },
  y: { ticks: { color: TC.tick, callback: function (v) { return montosOcultos ? '' : v; } }, grid: { color: TC.grid } }
  }
  };
  }
  // El grafico chico y el del modal eran la misma llamada copiada (E6).
  function dibujarEvolucion(canvasId, prev, serie) {
  var dataPoints = getFilteredDataPoints(serie);
  if (prev) prev.destroy();
  return new Chart(document.getElementById(canvasId), {
  type: 'line',
  data: { datasets: [{ data: dataPoints, borderColor: '#d4af37', backgroundColor: 'rgba(212,175,55,0.12)', fill: true, tension: 0.3, pointRadius: 0 }] },
  options: buildChartOptions(dataPoints)
  });
  }
  function drawLineChart(serie) {
  lineChartInstance = dibujarEvolucion('lineChart', lineChartInstance, serie);
  }
  var bigChartInstance = null;
  function drawBigChart() {
  bigChartInstance = dibujarEvolucion('lineChartBig', bigChartInstance, filterSerie(currentRangeDias));
  }
  function openChartModal() {
  document.getElementById('chartModal').style.display = 'flex';
  syncRangeBars();
  drawBigChart();
  }
  function closeChartModal() {
  document.getElementById('chartModal').style.display = 'none';
  if (bigChartInstance) { bigChartInstance.destroy(); bigChartInstance = null; }
  }
  document.getElementById('expandBtn').onclick = openChartModal;
  document.getElementById('chartModalClose').onclick = closeChartModal;

// ---------- Aportes (estado compartido) ----------
// La lista de aportes la pide el panel de Aportes (cargarAportes, paneles.js)
// y se guarda aca porque tambien la consume comparacionGrupo(). El area de
// "capital aportado" sobre el grafico de Evolucion (V1) y el indice simulado
// del grafico (V2) se BORRARON el 17/08/2026: estuvieron una tarde (v50-v52),
// se sacaron a pedido de Guzman (el patrimonio TOTAL incluye Itau y BTG,
// cuyos aportes no estan cargados, y el numero salia mentiroso) y su
// reemplazo real — la comparacion del panel de Aportes (V7,
// comparacionGrupo) — ya esta en produccion. Si alguna vez vuelven, viven en
// el historial de git.
var aportesLista = [];

// 'yyyy-mm-dd' -> ms de la medianoche LOCAL. new Date('2025-03-10') parsea en
// UTC y en Montevideo caeria el dia anterior.
function apISOaMs(s) {
  var p = String(s || '').split('-');
  if (p.length !== 3) return NaN;
  return new Date(+p[0], +p[1] - 1, +p[2]).getTime();
}

// ---------- El indice de referencia ----------
// El backend manda el cierre del indice alineado punto a punto con la serie
// (`bench.valores`), asi el telefono no tiene que buscar ninguna fecha. Lo
// consume comparacionGrupo(): el indice NO se compara "en general", se simula
// la MISMA plata puesta en las MISMAS fechas.
var benchPuntos = [], benchNombre = '', benchLargo = 0;

function limpiarBench() { benchPuntos = []; benchNombre = ''; benchLargo = 0; }

function aplicarBench(data) {
  var b = data && data.bench;
  if (!b || !b.valores || !b.valores.length) {
    // Una respuesta SIN indice no borra el que ya estaba, siempre que siga
    // alineado a la misma serie. Mientras la hoja del backend se llena, varias
    // respuestas seguidas vienen sin indice, y borrarlo hacia que la linea
    // apareciera y desapareciera sola.
    if (benchPuntos.length && (fullSerie || []).length === benchLargo) return;
    limpiarBench();
    return;
  }
  // El pegamento es el INDICE del arreglo: bench.valores[i] corresponde a
  // fullSerie[i]. Si el backend cambiara una sin la otra, esto se desalinea, y
  // por eso la longitud se verifica antes de usar nada.
  if (b.valores.length !== (fullSerie || []).length) { limpiarBench(); return; }
  limpiarBench();
  benchNombre = b.nombre || 'el indice';
  benchLargo = b.valores.length;
  fullSerie.forEach(function (p, i) {
    var v = b.valores[i];
    if (v !== null && isFinite(v)) benchPuntos.push({ ts: p.fecha, valor: v });
  });
}

// El cierre del indice en una fecha: el ultimo anterior o igual (no cotiza
// fines de semana ni feriados). null si la fecha es previa a todo lo que hay.
function benchEn(ts) {
  var v = null;
  for (var i = 0; i < benchPuntos.length; i++) {
    if (benchPuntos[i].ts > ts) break;
    v = benchPuntos[i].valor;
  }
  return v;
}

// ---------- La comparacion del panel de Aportes (V7) ----------
// Solo las cuentas cuyos aportes se conocen de verdad: Schwab e IBKR los informa
// el broker, Binance sale de lo que carga Guzman. Itau y BTG NO entran — su
// saldo cuenta entero como aporte, asi que aportan cero rendimiento y no pueden
// inflar el numero. El backend decide quien entra (`serieGrupo`) y manda su valor
// dia por dia; aca no se duplica ninguna regla de nombres.
// Arranca el 17/08/2026: antes de eso no hay historia por cuenta que leer.
var grupoPuntos = [], grupoNombre = '', grupoLargo = 0;

function limpiarGrupo() { grupoPuntos = []; grupoNombre = ''; grupoLargo = 0; }

function aplicarGrupo(data) {
  var g = data && data.serieGrupo;
  if (!g || !g.valores || !g.valores.length) {
    // Igual que el indice: una respuesta sin el dato no borra el que ya estaba,
    // mientras siga alineado a la misma serie.
    if (grupoPuntos.length && (fullSerie || []).length === grupoLargo) return;
    limpiarGrupo();
    return;
  }
  if (g.valores.length !== (fullSerie || []).length) { limpiarGrupo(); return; }
  limpiarGrupo();
  grupoNombre = g.nombre || '';
  grupoLargo = g.valores.length;
  fullSerie.forEach(function (p, i) {
    var v = g.valores[i];
    if (v !== null && isFinite(v)) grupoPuntos.push({ ts: p.fecha, valor: v });
  });
}

// Medianoche local del dia de `ts` — para comparar aportes (que solo traen
// FECHA, sin hora) contra el dia calendario de un snapshot.
function _inicioDelDia(ts) {
  var d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Porcentaje real contra porcentaje del indice, sobre las mismas cuentas, el
 * mismo periodo y el mismo capital.
 * - null: no hay nada que decir (ni un dia guardado).
 * - {pocos:true}: hay historia pero todavia no alcanza para un porcentaje.
 */
function comparacionGrupo() {
  if (!grupoPuntos.length) return null;
  if (grupoPuntos.length < 2) return { pocos: true, dias: grupoPuntos.length, nombre: grupoNombre };

  // El primer punto es un snapshot tomado EN UN MOMENTO del dia (el trigger de
  // las 8:00, o cuando se apreto Actualizar). Un aporte fechado ESE MISMO DIA
  // (los aportes solo traen fecha, sin hora) puede haber pasado antes o
  // despues del snapshot, y no hay forma de saberlo. Asumir que "ya estaba en
  // la base" sin poder probarlo fue el bug real (reporte de Guzman,
  // 17/08/2026): el aporte de ese dia aparecia contado como rendimiento,
  // porque el valor final SI lo incluia pero el capital no. Se resuelve
  // corriendo la base al primer dia SIN esa ambiguedad — mejor un dia menos
  // de historia que un numero mentiroso.
  var i0 = 0;
  while (i0 < grupoPuntos.length - 1) {
    var diaBase = _inicioDelDia(grupoPuntos[i0].ts);
    var ambiguo = aportesLista.some(function (r) {
      var ts = apISOaMs(r.fecha);
      var m = Number(r.grupo);
      return isFinite(ts) && ts === diaBase && isFinite(m) && m !== 0;
    });
    if (!ambiguo) break;
    i0++;
  }
  if (i0 >= grupoPuntos.length - 1) return { pocos: true, dias: grupoPuntos.length, nombre: grupoNombre };

  var t0 = grupoPuntos[i0].ts, tFin = grupoPuntos[grupoPuntos.length - 1].ts;
  var base = grupoPuntos[i0].valor, valor = grupoPuntos[grupoPuntos.length - 1].valor;

  // Solo la parte del aporte que fue a estas cuentas (el backend la separa en
  // `grupo`); los del dia del arranque (ya sin ambiguedad, por el ajuste de
  // arriba) ya estan dentro de la base.
  var enVentana = [];
  aportesLista.forEach(function (r) {
    var ts = apISOaMs(r.fecha);
    var m = Number(r.grupo);
    if (isFinite(ts) && ts > t0 && ts <= tFin && isFinite(m) && m !== 0) enVentana.push({ ts: ts, monto: m });
  });
  var aportes = 0;
  enVentana.forEach(function (a) { aportes += a.monto; });

  var capital = base + aportes;
  if (!capital) return null;
  var out = {
    nombre: grupoNombre, desde: t0, hasta: tFin, dias: grupoPuntos.length,
    capital: capital, valor: valor, aportes: aportes,
    pct: (valor / capital - 1) * 100, idxPct: null, idxNombre: benchNombre
  };

  // El rendimiento de la CARTERA, encadenado dia a dia y SIN el efecto del
  // timing de los aportes (V6): cada tramo entre dos puntos rinde su valor
  // final —quitando los aportes que cayeron en el tramo— contra el valor
  // anterior, y los tramos se multiplican. El "pct" de arriba es lo que
  // lograste VOS (tu plata, tus fechas); este es lo que rindieron las
  // inversiones como tales. Un aporte se asume al cierre de su dia, la misma
  // convencion que la simulacion del indice (V2). Si algun tramo no se puede
  // medir con honestidad (valor no positivo), viaja null, no un invento.
  out.twrPct = null;
  var twr = 1, twrOk = true;
  for (var i = i0 + 1; i < grupoPuntos.length; i++) {
    var vPrev = grupoPuntos[i - 1].valor, vHoy = grupoPuntos[i].valor;
    var tsPrev = grupoPuntos[i - 1].ts, tsHoy = grupoPuntos[i].ts;
    if (!(vPrev > 0) || !isFinite(vHoy)) { twrOk = false; break; }
    var flujo = 0;
    // Por RANGO (tsPrev, tsHoy], no por dia exacto: un aporte fechado en un
    // dia sin punto de la serie (finde, snapshot perdido) igual se descuenta
    // de su tramo — si no, contaria como rendimiento.
    enVentana.forEach(function (a) { if (a.ts > tsPrev && a.ts <= tsHoy) flujo += a.monto; });
    var vSinFlujo = vHoy - flujo;
    if (!(vSinFlujo > 0)) { twrOk = false; break; }
    twr *= vSinFlujo / vPrev;
  }
  if (twrOk) out.twrPct = (twr - 1) * 100;

  // El indice, con los MISMOS aportes en las MISMAS fechas y medido contra el
  // MISMO capital: si no, los dos porcentajes no serian comparables.
  var b0 = benchEn(t0), bFin = benchEn(tFin);
  if (b0 && bFin) {
    var unidades = base / b0;
    enVentana.forEach(function (a) {
      var bv = benchEn(a.ts);
      if (bv) unidades += a.monto / bv;
    });
    out.idxPct = ((unidades * bFin) / capital - 1) * 100;
  }
  return out;
}

// La lista de aportes NO viaja en el payload del portafolio a proposito:
// consultar los brokers puede tardar varios segundos y frenaria el arranque,
// que es el momento mas sensible de la app. La pide el panel de Aportes
// (cargarAportes, paneles.js) y aca solo se guarda lo que comparacionGrupo()
// necesita.
function aplicarAportes(r) {
  aportesLista = (r && r.lista) || [];
}

// Variacion del dia de mercado (verde/rojo), estilo Binance. Va arriba del
// PRECIO, que es el numero que se movio hoy — pedido de Guzman (17/08/2026).
// Antes estaba arriba del valor total, donde se confundia con la ganancia
// acumulada de la posicion.
function daychgHtml(p) {
  if (p.cambioDia === null || p.cambioDia === undefined || p.cambioDia === '') return '';
  var v = Number(p.cambioDia);
  if (!isFinite(v)) return '';
  return pctHtml(v, 2);
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
  fr.src = 'https://s.tradingview.com/embed-widget/mini-symbol-overview/?locale=es#' +
    encodeURIComponent(JSON.stringify(cfg));
  fr.setAttribute('scrolling', 'no');
  fr.setAttribute('frameborder', '0');
  fr.setAttribute('title', 'Gráfico de ' + symbol);
  // Sin allow-forms/allow-modals/allow-top-navigation: el widget solo dibuja.
  fr.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
  fr.setAttribute('referrerpolicy', 'origin');
  fr.style.cssText = 'width:100%;height:180px;border:0;display:block';
  container.appendChild(fr);
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
  var html = '<div class="detgrid">' +
    '<span><span class="detlbl">Precio medio</span><b>' + (tienePm ? esc(fmtNum(pm)) : '&mdash;') + '</b></span>' +
    '<span><span class="detlbl">Base de coste</span><b>' + (base ? fmt(base) : '&mdash;') + '</b></span>';
  if (tienePm && isFinite(pa) && pa > 0) {
    var res = (pa / pm - 1) * 100;
    html += '<span><span class="detlbl">Resultado</span><b class="' + (res >= 0 ? 'up' : 'down') + '">' + signoPct(res, 1) + '</b></span>';
  }
  html += '</div><div class="tvwrap"></div>';
  td.innerHTML = html;
  det.appendChild(td);
  tr.parentNode.insertBefore(det, tr.nextSibling);
  var symU = String(pos.symbol || '').toUpperCase();
  if (symU && symU !== 'USDT' && symU !== 'ITAU') {
    crearTvWidget(td.querySelector('.tvwrap'), pos.cripto ? ('BINANCE:' + symU + 'USDT') : symU);
  } else {
    td.querySelector('.tvwrap').style.display = 'none';
  }
  detalleAbierto = { tr: tr, det: det };
}
// ---------- Principales posiciones (Inicio) ----------
var HOLD_VISIBLE = 4;
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
function ordenarPorTipo(list) {
var orden = ['accion', 'etf', 'cripto'];
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
// Un objeto VACIO tambien se ignora: el backend manda {} cuando la hoja _spark
// falla (Sheets caida, GOOGLEFINANCE sin responder, cuota), y pisar con vacio
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
var SPARK_W = 64, SPARK_H = 28;
function sparkSvg(serie) {
if (!serie || serie.length < 2) return '';
var min = serie[0], max = serie[0];
for (var i = 1; i < serie.length; i++) { if (serie[i] < min) min = serie[i]; if (serie[i] > max) max = serie[i]; }
var rango = max - min;
// Un mes plano (o un solo precio repetido) se dibuja como una raya al medio,
// no como una division por cero.
var pad = 2, alto = SPARK_H - pad * 2, ancho = SPARK_W - pad * 2;
var pts = [];
for (var j = 0; j < serie.length; j++) {
var x = pad + (j * ancho) / (serie.length - 1);
var y = pad + (rango === 0 ? alto / 2 : alto - ((serie[j] - min) / rango) * alto);
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
var dicho = (pct >= 0 ? '+' : '') + pct.toFixed(1) + '% en el mes';
return '<svg class="spark ' + (sube ? 'sube' : 'baja') + '" width="' + SPARK_W + '" height="' + SPARK_H +
'" viewBox="0 0 ' + SPARK_W + ' ' + SPARK_H + '" role="img" aria-label="' + dicho + '">' +
'<polyline points="' + pts.join(' ') + '"/></svg>';
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
if (tipoDe(h) === 'cripto') return 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@master/128/color/' + sym.toLowerCase() + '.png';
return 'https://assets.parqet.com/logos/symbol/' + encodeURIComponent(sym);
}
// Si el logo no carga (dominio sin logo, cripto fuera del set, sin red), se
// cae a las iniciales de siempre — nunca queda un hueco vacio.
function _sinLogo(img) {
img.style.display = 'none';
if (img.nextElementSibling) img.nextElementSibling.style.display = 'flex';
}
function filaHoldingHtml(h) {
var pctDisplay = (h.pct * 100).toFixed(1) + '%';
var sym = String(h.symbol || '');
var inic = sym.length <= 3 ? sym : sym.slice(0, 2);
var logo = logoUrl(h);
var avatar = logo
  ? '<img src="' + esc(logo) + '" alt="" loading="lazy" onerror="_sinLogo(this)"><span class="holdinit" style="display:none">' + esc(inic) + '</span>'
  : esc(inic);
return '<td><span class="holdcell"><span class="holdav ' + tipoDe(h) + '">' + avatar + '</span><span class="holdid"><span class="sym">' + esc(sym) + '</span><span class="desc">' + esc(h.nombre || '') + '</span></span></span></td>' +
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
function claseFila(idx) { return (idx >= HOLD_VISIBLE && !holdingsExpanded ? 'hidden-row ' : '') + 'asset-row'; }
function toggleHoldings() { try { holdingsExpanded = !holdingsExpanded; renderHoldings(lastHoldings); } catch (e) { var b = document.getElementById('holdMoreBtn'); if (b) b.textContent = 'ERR ' + (e && e.message); } }
function renderHoldings(list) {
var el = document.getElementById('holdingsList');
var btn = document.getElementById('holdMoreBtn');
if (btn && !btn._wired) { btn._wired = true; btn.addEventListener('click', toggleHoldings); }
lastHoldings = list || [];
if (!list || !list.length) { holdFilas = []; holdCabezas = []; el.innerHTML = '<tr><td colspan="4" class="newsempty">Sin posiciones.</td></tr>'; if (btn) btn.style.display = 'none'; return; }
var lista = ordenarPorTipo(list);
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
tr.className = claseFila(idx);
tr.innerHTML = filaHoldingHtml(h);
tr.onclick = function () { toggleDetalle(tr, h); };
if (!enLugar) { el.appendChild(tr); holdFilas.push({ symbol: h.symbol, tr: tr }); }
});
// La cabecera de una seccion se esconde junto con TODAS sus filas: si su
// primera fila quedo detras de "Ver todas", la seccion entera esta oculta.
holdCabezas.forEach(function (c) {
c.tr.className = 'holdsec' + ((c.idx >= HOLD_VISIBLE && !holdingsExpanded) ? ' hidden-row' : '');
});
if (btn) {
if (lista.length > HOLD_VISIBLE) { btn.style.display = 'block'; btn.textContent = holdingsExpanded ? 'Ver menos' : ('Ver todas (' + lista.length + ')'); }
else { btn.style.display = 'none'; }
}
}
// ---------- Mapa de calor mensual (V5) ----------
// Rendimiento de cada mes sobre la serie de patrimonio que YA llega: cierre
// del mes contra cierre del mes anterior. La serie compacta guarda un punto
// por mes hacia atras, asi que el cierre mensual existe tambien en la zona
// vieja. Sin mes anterior no se inventa nada (queda vacio); el mes en curso
// se mide hasta hoy (el ultimo punto de la serie es siempre el valor actual).
// OJO: es sobre el patrimonio TOTAL — un aporte o retiro grande cuenta como
// movimiento del mes; la nota debajo del mapa lo dice (regla U2).
function mapaCalorMensual(serie) {
if (!serie || serie.length < 2) return [];
var cierres = {}; // anio*12+mes -> ultimo valor del mes (la serie es ascendente)
serie.forEach(function (p) {
var d = new Date(p.fecha);
var v = Number(p.valor);
if (!isFinite(v)) return;
cierres[d.getFullYear() * 12 + d.getMonth()] = v;
});
var claves = Object.keys(cierres).map(Number).sort(function (a, b) { return a - b; });
var porAnio = {};
for (var i = 1; i < claves.length; i++) {
var k = claves[i];
if (claves[i - 1] !== k - 1) continue; // hueco: sin cierre del mes anterior
var prev = cierres[k - 1];
if (!(prev > 0)) continue;
var anio = Math.floor(k / 12), mes = k % 12;
if (!porAnio[anio]) { porAnio[anio] = []; for (var m = 0; m < 12; m++) porAnio[anio].push(null); }
porAnio[anio][mes] = Math.round((cierres[k] / prev - 1) * 10000) / 10000;
}
return Object.keys(porAnio).map(Number).sort(function (a, b) { return b - a; })
.map(function (a) { return { anio: a, meses: porAnio[a] }; });
}
var MC_MESES = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
function celdaCalor(pct) {
if (pct === null || pct === undefined) return '<span class="mc-celda mc-vacia"></span>';
var v = pct * 100;
// La intensidad crece con el tamano del movimiento y se planta en ±8%.
var alpha = Math.min(0.85, 0.18 + (Math.abs(v) / 8) * 0.6);
var rgb = v >= 0 ? '34,197,94' : '244,63,94';
var txt = (v >= 0 ? '+' : '') + (Math.abs(v) >= 9.95 ? v.toFixed(0) : v.toFixed(1));
return '<span class="mc-celda" style="background:rgba(' + rgb + ',' + alpha.toFixed(2) + ')">' + txt + '</span>';
}
function renderMapaCalor() {
var el = document.getElementById('mapaCalor');
if (!el) return;
var filas = mapaCalorMensual(fullSerie || []);
if (!filas.length) { el.innerHTML = '<p class="newsempty">Con un mes m&aacute;s de historia aparece el primer mes.</p>'; return; }
var html = '<div class="mc-fila mc-head"><span class="mc-anio"></span>' +
MC_MESES.map(function (m) { return '<span class="mc-celda">' + m + '</span>'; }).join('') + '</div>';
filas.forEach(function (f) {
html += '<div class="mc-fila"><span class="mc-anio">' + f.anio + '</span>' + f.meses.map(celdaCalor).join('') + '</div>';
});
el.innerHTML = html;
}

