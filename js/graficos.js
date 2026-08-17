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
function updateRangePct() {
var el = document.getElementById('rangePct');
var serie = filterSerie(currentRangeDias);
if (!serie.length || !currentTotal) { el.textContent = ''; el.className = 'rangepct'; return; }
var base = serie[0].valor;
if (!base) { el.textContent = ''; return; }
var pct = (currentTotal / base - 1) * 100;
el.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
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
  function drawLineChart(serie) {
  var dataPoints = getFilteredDataPoints(serie);
  if (lineChartInstance) lineChartInstance.destroy();
  lineChartInstance = new Chart(document.getElementById('lineChart'), {
  type: 'line',
  data: { datasets: [{ data: dataPoints, borderColor: '#d4af37', backgroundColor: 'rgba(212,175,55,0.12)', fill: true, tension: 0.3, pointRadius: 0 }] },
  options: buildChartOptions(dataPoints)
  });
  }
  var bigChartInstance = null;
  function drawBigChart() {
  var dataPoints = getFilteredDataPoints(filterSerie(currentRangeDias));
  if (bigChartInstance) bigChartInstance.destroy();
  bigChartInstance = new Chart(document.getElementById('lineChartBig'), {
  type: 'line',
  data: { datasets: [{ data: dataPoints, borderColor: '#d4af37', backgroundColor: 'rgba(212,175,55,0.12)', fill: true, tension: 0.3, pointRadius: 0 }] },
  options: buildChartOptions(dataPoints)
  });
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

// ---------- Capital aportado (V1) ----------
// OJO — 17/08/2026: esto NO se dibuja en el grafico de Evolucion. Estuvo una
// tarde (v50-v52) y se saco a pedido de Guzman, con razon: el patrimonio TOTAL
// incluye Itau y BTG, cuyos aportes solo existen si se cargan a mano en la hoja
// Transacciones, y no estan. Con aportes faltantes el "Pusiste" queda corto y el
// "Rindio" queda inflado — el numero no era incompleto, era MENTIROSO. El
// grafico de Evolucion volvio a ser el generico de siempre (una sola linea).
//
// Los calculos quedan porque la comparacion se va a rehacer en el panel de
// Aportes, restringida a las cuentas cuyos aportes se conocen de verdad
// (Schwab e IBKR los informa el broker; Binance sale de Transacciones).
//
// Se calcula SOBRE LA VENTANA que elige el usuario, no desde el inicio:
//   capital = patrimonio al arrancar la ventana + aportes desde entonces
// El motivo es un limite de datos, no una preferencia: el Historico de
// patrimonio es mas viejo que la actividad que informan los brokers (Schwab da
// ~400 dias, IBKR lo que diga su Flex Query). El backend dice desde cuando la
// lista esta COMPLETA (`desde`) y aca no se dibuja ni un pixel antes de esa
// fecha — un area que arrancara antes seria una mentira prolija.
var aportesLista = [], aportesDesde = null, aportesPedidos = false;
var COLOR_CAPITAL = '#8c96aa';
var COLOR_INDICE = '#5b8def';

// 'yyyy-mm-dd' -> ms de la medianoche LOCAL. new Date('2025-03-10') parsea en
// UTC y en Montevideo caeria el dia anterior.
function apISOaMs(s) {
  var p = String(s || '').split('-');
  if (p.length !== 3) return NaN;
  return new Date(+p[0], +p[1] - 1, +p[2]).getTime();
}

/**
 * El capital sobre la ventana ya filtrada del patrimonio.
 * Devuelve null cuando no se puede afirmar nada: sin cobertura, sin aportes, o
 * cuando lo que queda de ventana cubierta son menos de dos puntos.
 */
function serieCapital(pts) {
  if (!pts || pts.length < 2 || !aportesDesde || !aportesLista.length) return null;
  var desdeTs = apISOaMs(aportesDesde);
  if (!isFinite(desdeTs)) return null;
  var i0 = 0;
  while (i0 < pts.length && pts[i0].x < desdeTs) i0++;
  if (pts.length - i0 < 2) return null;

  var base = pts[i0].y, t0 = pts[i0].x;
  var ap = [];
  aportesLista.forEach(function (r) {
    var ts = apISOaMs(r.fecha);
    // Los del dia del arranque ya estan dentro del patrimonio que hace de base.
    if (isFinite(ts) && ts > t0 && isFinite(r.monto)) ap.push({ ts: ts, monto: r.monto });
  });
  ap.sort(function (a, b) { return a.ts - b.ts; });

  var out = [], acum = 0, j = 0;
  for (var i = i0; i < pts.length; i++) {
    while (j < ap.length && ap[j].ts <= pts[i].x) { acum += ap[j].monto; j++; }
    out.push({ x: pts[i].x, y: base + acum });
  }
  return { pts: out, base: base, capital: base + acum, recortado: i0 > 0, desde: t0 };
}

// ---------- El indice simulado (V2) ----------
// El indice NO se compara "en general": se simula la MISMA plata puesta en las
// MISMAS fechas. La pregunta que contesta es la unica que importa — si eso
// mismo hubiera ido al S&P 500, cuanto tendria hoy.
// El backend manda el cierre del indice alineado punto a punto con la serie
// (`bench.valores`), asi el telefono no tiene que buscar ninguna fecha.
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

/**
 * Cuanto valdria hoy la misma plata puesta en el indice. Compra "unidades" del
 * indice con el capital inicial y con cada aporte al cierre de SU dia, y las
 * valua en cada punto. Corre sobre los mismos puntos que el capital (cap.pts),
 * asi las tres lineas arrancan y terminan juntas.
 */
function serieIndice(cap) {
  if (!cap || !cap.pts.length || !benchPuntos.length) return null;
  var b0 = benchEn(cap.desde);
  if (!b0) return null;
  var unidades = cap.base / b0;
  var fin = cap.pts[cap.pts.length - 1].x;

  var ap = [];
  aportesLista.forEach(function (r) {
    var ts = apISOaMs(r.fecha);
    if (isFinite(ts) && ts > cap.desde && ts <= fin && isFinite(r.monto)) ap.push({ ts: ts, monto: r.monto });
  });
  ap.sort(function (a, b) { return a.ts - b.ts; });

  var out = [], j = 0;
  for (var i = 0; i < cap.pts.length; i++) {
    while (j < ap.length && ap[j].ts <= cap.pts[i].x) {
      var bv = benchEn(ap[j].ts);
      if (bv) unidades += ap[j].monto / bv;
      j++;
    }
    var aqui = benchEn(cap.pts[i].x);
    if (aqui) out.push({ x: cap.pts[i].x, y: unidades * aqui });
  }
  if (out.length < 2) return null;
  return { pts: out, final: out[out.length - 1].y, nombre: benchNombre };
}

// La lista de aportes NO viaja en el payload del portafolio a proposito:
// consultar los brokers puede tardar varios segundos y frenaria el arranque,
// que es el momento mas sensible de la app. Se pide aparte, despues del primer
// pintado, y se guarda en el MISMO cache local que usa el panel de Aportes
// (una sola consulta sirve a los dos).
function cargarAportesGrafico(forzar) {
  var c = forzar ? null : cacheLeer('ga_cache_apo');
  if (c && c.data) aplicarAportes(c.data, false);
  if (aportesPedidos && !forzar) return;
  aportesPedidos = true;
  google.script.run
    .withSuccessHandler(function (r) {
      if (r && r.ok) { cacheGuardar('ga_cache_apo', r); aplicarAportes(r, true); }
    })
    .withFailureHandler(function () { aportesPedidos = false; })
    .getAportes();
}

function aplicarAportes(r, redibujar) {
  aportesLista = (r && r.lista) || [];
  aportesDesde = (r && r.desde) || null;
  if (!redibujar) return;
  try {
    drawLineChart(filterSerie(currentRangeDias));
    var m = document.getElementById('chartModal');
    if (m && m.style.display !== 'none') drawBigChart();
  } catch (e) {}
}

// Variacion del dia de mercado (verde/rojo), estilo Binance
function daychgHtml(p) {
  if (p.cambioDia === null || p.cambioDia === undefined || p.cambioDia === '') return '';
  var v = Number(p.cambioDia);
  if (!isFinite(v)) return '';
  return '<span class="daychg ' + (v >= 0 ? 'up' : 'down') + '">' + (v >= 0 ? '+' : '') + v.toFixed(2) + '%</span>';
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
    html += '<span><span class="detlbl">Resultado</span><b class="' + (res >= 0 ? 'up' : 'down') + '">' + (res >= 0 ? '+' : '') + res.toFixed(1) + '%</b></span>';
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
function toggleHoldings() { try { holdingsExpanded = !holdingsExpanded; renderHoldings(lastHoldings); } catch (e) { var b = document.getElementById('holdMoreBtn'); if (b) b.textContent = 'ERR ' + (e && e.message); } }
function renderHoldings(list) {
var el = document.getElementById('holdingsList');
var btn = document.getElementById('holdMoreBtn');
if (btn && !btn._wired) { btn._wired = true; btn.addEventListener('click', toggleHoldings); }
lastHoldings = list || [];
el.innerHTML = '';
if (!list || !list.length) { el.innerHTML = '<tr><td colspan="5" class="newsempty">Sin posiciones.</td></tr>'; if (btn) btn.style.display = 'none'; return; }
list.forEach(function (h, idx) {
var tr = document.createElement('tr');
if (idx >= HOLD_VISIBLE && !holdingsExpanded) tr.className = 'hidden-row';
var pctDisplay = (h.pct * 100).toFixed(1) + '%';
tr.innerHTML = '<td><span class="sym">' + esc(h.symbol) + '</span><span class="desc">' + esc(h.nombre || '') + '</span></td>' +
'<td>' + esc(fmtNum(h.qty)) + '</td>' +
'<td>' + esc(fmtNum(h.precioActual)) + '</td>' +
'<td>' + daychgHtml(h) + fmt(h.valor) + '</td>' +
'<td class="holdpct col-pct">' + pctDisplay + '</td>';
tr.className += ' asset-row';
tr.onclick = function () { toggleDetalle(tr, h); };
el.appendChild(tr);
});
if (btn) {
if (list.length > HOLD_VISIBLE) { btn.style.display = 'block'; btn.textContent = holdingsExpanded ? 'Ver menos' : ('Ver todas (' + list.length + ')'); }
else { btn.style.display = 'none'; }
}
}

