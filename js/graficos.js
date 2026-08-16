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

