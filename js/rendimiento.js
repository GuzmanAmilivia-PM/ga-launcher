// ---------- Rendimiento historico por cuenta (V17) ----------
// La entrada "Historical performance" de la pagina de IBKR y de Schwab
// (15/09/2026), pedido de Guzman: lo que PortfolioAnalyst le muestra, sin
// entrar a la web del broker, y con dos preguntas separadas:
//   1. Me fue bien con MI plata?  -> el MWR (mis depositos, en mis fechas) y
//      "la misma plata en SPY" (los mismos depositos y retiros, en las mismas
//      fechas, puestos en el indice), con la diferencia en dolares.
//   2. Mis elecciones le ganan al indice? -> el TWR (sin el efecto de los
//      depositos) contra el SPY del mismo tramo.
// Cuatro rangos: YTD, 1 ano, 3 anos, desde el origen. Un rango que excede la
// historia disponible lo dice (U2) y nunca inventa la base.
//
// TODA la cuenta la hace el Worker (`rendimiento_cuenta`, business/
// Rendimiento.js): la historia por cuenta no viaja al telefono, y la leccion
// del YTD del 9/09 es que calcule uno solo. Aca solo se dibuja. El indice es
// SPY con dividendos reinvertidos, la misma serie que el resto de la app
// desde el 15/09/2026 (lo dice `indice.nota`).
//
// CARGA DESPUES de paneles.js y ANTES de arranque.js. Lo llama showAccount
// (vistas.js) SIEMPRE dentro de una funcion, nunca al cargar; usa Chart
// (gagraf.js), buildChartOptions/temaChart (graficos.js) y los formateadores
// de nucleo.js, que ya estan cargados cuando alguien abre una cuenta.
var rendDatos = null;        // la ultima respuesta del Worker
var rendCuenta = null;       // la clave de la cuenta cuyo pedido esta EN VUELO / a la vista
var rendRango = 'ytd';       // el rango elegido; se conserva entre cuentas
var rendChartInstance = null;
var REND_RANGOS = [
  { key: 'ytd', label: 'YTD' },
  { key: '1a', label: '1Y' },
  { key: '3a', label: '3Y' },
  { key: 'origen', label: 'All' }
];

// Solo las cuentas cuyos depositos informa el broker: IBKR y Schwab. Binance
// tiene la cuenta hecha en el Worker, pero sus flujos son los que Guzman carga
// a mano y por ahora no se ofrece (decision del pedido: "empezando por IBKR y
// Schwab").
function rendEsCuenta(acc) {
  var k = String((acc && acc.key) || '');
  return k === 'IB' || k === 'CS';
}

// Al abrir una cuenta: muestra u oculta la tarjeta y pide los numeros. La
// respuesta de OTRA cuenta (abrir IBKR, volver, abrir Schwab antes de que
// conteste) se descarta: el mismo cuidado que accPedida en showAccount.
function mostrarRendimiento(acc) {
  var box = document.getElementById('accRend');
  if (!box) return;
  if (!rendEsCuenta(acc)) { box.hidden = true; rendCuenta = null; return; }
  box.hidden = false;
  rendCuenta = acc.key;
  var mismo = rendDatos && rendDatos.cuenta === acc.key;
  if (mismo) renderRendimiento();
  else {
    rendDatos = null;
    document.getElementById('rendBody').innerHTML = '<p class="loadingtxt">Calculating your history against SPY...</p>';
  }
  google.script.run.withSuccessHandler(function (r) {
    if (rendCuenta !== acc.key) return;
    rendDatos = r;
    renderRendimiento();
  }).withFailureHandler(function (err) {
    if (rendCuenta !== acc.key) return;
    if (mismo) return;   // con datos ya pintados, un fallo de red no borra la pantalla
    document.getElementById('rendBody').innerHTML = '<p class="newsempty">' + esc(msgErr(err, 'The performance history')) + '</p>';
  }).getRendimientoCuenta({ cuenta: acc.key });
}

function rendPctHtml(v, dec) {
  if (v === null || v === undefined || !isFinite(v)) return '<p class="capval">&mdash;</p>';
  return '<p class="capval ' + (v >= 0 ? 'up' : 'down') + '">' + signoPct(Number(v), dec === undefined ? 1 : dec) + '</p>';
}
function rendUsdConSigno(v) {
  var n = Math.round(Number(v) || 0);
  return mask((n >= 0 ? '+' : '−') + 'US$ ' + Math.abs(n).toLocaleString('en-US'));
}
// "annualized x%" debajo del numero, solo cuando el Worker lo anualizo (rangos
// de un ano o mas: los cortos van crudos, como en PortfolioAnalyst).
function rendAnualHtml(m) {
  if (!m || m.anualizado === null || m.anualizado === undefined) return '';
  return '<p class="rendsub">' + signoPct(Number(m.anualizado), 1) + ' a year</p>';
}

function renderRendimiento() {
  var body = document.getElementById('rendBody');
  if (!body) return;
  var r = rendDatos;
  if (!r) return;
  if (!r.ok) { body.innerHTML = '<p class="newsempty">' + esc(msgBackend(r)) + '</p>'; return; }
  var h = '';
  if (r.pocos) {
    h += '<p class="capnota">History starts today: the first numbers appear tomorrow.</p>';
    (r.avisos || []).forEach(function (a) { h += '<p class="newsempty" style="font-size:12px">&#9888; ' + esc(a) + '</p>'; });
    body.innerHTML = h;
    return;
  }
  h += '<div class="rangebar" id="rendRangos">';
  REND_RANGOS.forEach(function (rg) {
    h += '<button type="button" class="rangebtn' + (rg.key === rendRango ? ' active' : '') + '" data-rango="' + rg.key + '">' + rg.label + '</button>';
  });
  h += '</div>';
  var g = r.rangos && r.rangos[rendRango];
  if (!g || g.pocos) {
    h += '<p class="capnota" style="margin-top:12px">Not enough history in this range yet' +
      (g && g.desdeDisponible ? ' (it starts ' + esc(fechaCortaMs(g.desdeDisponible)) + ')' : '') + '.</p>';
  } else {
    var idx = (r.indice && r.indice.nombre) || 'S&P 500';
    var mp = g.spy && g.spy.mismaPlata;
    // Pregunta 1: mi plata, mis fechas.
    h += '<p class="lbl" style="margin-top:12px">With your money, on your dates</p>';
    h += '<div class="caprow">';
    h += '<div><p class="detlbl">You</p>' + rendPctHtml(g.mwr && g.mwr.pct) + rendAnualHtml(g.mwr) + '</div>';
    h += '<div><p class="detlbl">Same money in ' + esc(idx) + '</p>' + rendPctHtml(mp && mp.mwr && mp.mwr.pct) + rendAnualHtml(mp && mp.mwr) + '</div>';
    h += '<div><p class="detlbl">Difference</p><p class="capval ' + ((g.spy && g.spy.diferenciaUsd >= 0) ? 'up' : 'down') + '">' +
      (g.spy && g.spy.diferenciaUsd !== null ? esc(rendUsdConSigno(g.spy.diferenciaUsd)) : '&mdash;') + '</p></div>';
    h += '</div>';
    // Pregunta 2: sin el efecto de los depositos.
    h += '<p class="lbl" style="margin-top:14px">Without deposits (your picks vs. the index)</p>';
    h += '<div class="caprow">';
    h += '<div><p class="detlbl">Your account</p>' + rendPctHtml(g.twr && g.twr.pct) + rendAnualHtml(g.twr) + '</div>';
    h += '<div><p class="detlbl">' + esc(idx) + '</p>' + rendPctHtml(g.spy && g.spy.pct) + rendAnualHtml(g.spy) + '</div>';
    h += '</div>';
    // Los flujos y el efectivo: el contexto.
    h += '<div style="margin-top:10px">';
    h += '<div class="apostat"><span>Deposits</span><b>' + esc(fmtUsdEnt(g.depositos)) + '</b></div>';
    h += '<div class="apostat"><span>Withdrawals</span><b>' + esc(fmtUsdEnt(g.retiros)) + '</b></div>';
    h += '<div class="apostat"><span>Net</span><b>' + esc(fmtUsdEnt(g.neto)) + '</b></div>';
    h += '<div class="apostat"><span>Now vs. same money in ' + esc(idx) + '</span><b>' + esc(mask(fmtUsdEnt(g.valor))) +
      (mp ? ' <span class="desc">vs ' + esc(mask(fmtUsdEnt(mp.valor))) + '</span>' : '') + '</b></div>';
    if (g.efectivo) {
      h += '<div class="apostat"><span>Cash on average</span><b>' + esc(Number(g.efectivo.promedioPct).toFixed(1)) + '%' +
        (g.efectivo.dias < g.dias ? ' <span class="desc">since ' + esc(fechaCortaMs(g.efectivo.desde)) + '</span>' : '') + '</b></div>';
    }
    h += '</div>';
    h += '<div class="chartbox" style="margin-top:12px"><canvas id="rendChart"></canvas></div>';
    h += '<p class="rendleyenda"><span class="rendlin rendlin-cta"></span>your account <span class="rendlin rendlin-idx"></span>same money in ' + esc(idx) + '</p>';
    // La lectura en una frase (U1) y lo que falta, dicho en la cara (U2).
    var nota = 'Since ' + fechaCortaMs(g.desde) + ', from ' + fmtUsdEnt(g.base) + '.';
    if (g.parcial) nota += ' This range asks for more history than there is: it starts where the data starts.';
    if (r.indice && r.indice.nota) nota += ' Index: ' + r.indice.nota + '.';
    if (r.historia && r.historia.importado) nota += ' History before ' + fechaCortaMs(apISOaMs(r.historia.appDesde)) + ' comes from the broker’s own records.';
    h += '<p class="capnota">' + esc(nota) + '</p>';
  }
  (r.avisos || []).forEach(function (a) { h += '<p class="newsempty" style="font-size:12px">&#9888; ' + esc(a) + '</p>'; });
  body.innerHTML = h;
  // Los botones del rango: sin manejadores inline (la CSP los bloquea).
  var btns = body.querySelectorAll('#rendRangos .rangebtn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener('click', function (ev) {
      rendRango = ev.currentTarget.getAttribute('data-rango');
      renderRendimiento();
    });
  }
  if (g && !g.pocos) dibujarRendimiento(g);
}

// La cuenta (acento vivo) contra "la misma plata en SPY" (gris punteado, como
// el indice en Evolucion): la referencia no es la protagonista.
function dibujarRendimiento(g) {
  var canvas = document.getElementById('rendChart');
  if (!canvas || typeof Chart !== 'function') return;
  var cta = [], idx = [];
  (g.serie || []).forEach(function (p) {
    if (isFinite(p.valor)) cta.push({ x: p.ts, y: p.valor });
    if (p.spy !== null && isFinite(p.spy)) idx.push({ x: p.ts, y: p.spy });
  });
  if (cta.length < 2) return;
  if (rendChartInstance) { try { rendChartInstance.destroy(); } catch (e) {} }
  var ds = [{ data: cta, borderColor: colorAcento(), backgroundColor: acentoRgba(0.12), fill: true, tension: 0.3, pointRadius: 0 }];
  if (idx.length > 1) ds.push({ data: idx, borderColor: 'rgba(144,160,184,.85)', borderDash: [5, 4], borderWidth: 1.8, fill: false, tension: 0.3, pointRadius: 0 });
  rendChartInstance = new Chart(canvas, { type: 'line', data: { datasets: ds }, options: buildChartOptions(cta) });
}
