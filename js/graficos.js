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
renderEvoMini();
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
// La etiqueta del periodo se escribe PRIMERO, antes de cualquier salida
// temprana. Estaba al final y las dos salidas de abajo (serie vacia, base en
// cero) la dejaban con el valor anterior: quedaba "en 5A" al lado de un
// porcentaje vacio mientras regia 1S. Desde que el selector se esconde con el
// grafico, esa etiqueta es lo UNICO que dice que periodo rige — mentir ahi es
// exactamente lo que el cambio queria evitar. Auditoria del 23/08/2026.
var elPer = document.getElementById('rangeNombre');
if (elPer) {
var r = RANGES.filter(function (x) { return x.dias === currentRangeDias; })[0];
elPer.textContent = r ? ('en ' + r.key) : '';
}
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
pintarVsBench(serie, pct);
pintarMovimiento(serie);
}
// El desglose, en una linea: de cuanto arrancaste, cuanto pusiste, cuanto
// rindio. Aparece SOLO cuando hubo aportes en el periodo — si no los hubo,
// todo el cambio es mercado y la linea no diria nada que el % no diga ya.
function pintarMovimiento(serie) {
  var el = document.getElementById('movSaldo');
  if (!el) return;
  var m = movimientoDelSaldo(serie);
  if (!m) { el.innerHTML = ''; el.className = 'movsaldo'; return; }

  if (m.sinDatos === 'aportes') {
    // Sin la lista no se puede separar, y decir "todo fue mercado" seria
    // mentir. Se calla: el panel de Aportes la trae al deslizar.
    el.innerHTML = ''; el.className = 'movsaldo'; return;
  }
  if (m.sinDatos === 'rango') {
    el.innerHTML = '<span class="mov-aviso">En este período no puedo separar aportes de rendimiento: el registro de aportes empieza después.</span>';
    el.className = 'movsaldo'; return;
  }
  if (Math.abs(m.aportes) < 1) { el.innerHTML = ''; el.className = 'movsaldo'; return; }

  // Etiquetas CORTAS a proposito: con las largas ("al empezar", "que
  // aportaste") la linea ocupaba cuatro renglones en un telefono de 375px y
  // empujaba el grafico fuera de la primera pantalla. Medido, no estimado.
  var signoAp = m.aportes >= 0 ? '+' : '−';
  var etAp = m.aportes >= 0 ? 'aportado' : 'retirado';
  el.innerHTML =
    '<span class="mov-item"><b>' + esc(fmt(m.inicial)) + '</b> inicial</span>' +
    '<span class="mov-op">' + signoAp + '</span>' +
    '<span class="mov-item"><b>' + esc(fmt(Math.abs(m.aportes))) + '</b> ' + etAp + '</span>' +
    '<span class="mov-op">' + (m.mercado >= 0 ? '+' : '−') + '</span>' +
    '<span class="mov-item ' + (m.mercado >= 0 ? 'up' : 'down') + '"><b>' + esc(fmt(Math.abs(m.mercado))) + '</b> mercado' +
      (m.mercadoPct !== null ? ' <em>' + signoPct(m.mercadoPct, 1) + '</em>' : '') + '</span>';
  el.className = 'movsaldo';
}
// El delta contra el indice, en PUNTOS porcentuales (no en %): la diferencia
// entre dos porcentajes se mide en pp, y decir "+3,2%" cuando son 3,2 pp es
// un error clasico que ademas cambia el numero de significado.
//
// El asterisco no es decorativo: si hubo aportes en el rango, la cartera
// crecio en parte por plata que pusiste, y contra un indice re-escalado eso
// se lee como rendimiento. Se dice, no se esconde.
function pintarVsBench(serie, pctCartera) {
  var el = document.getElementById('vsBench');
  if (!el) return;
  var pb = benchPctEnRango(serie);
  if (pb === null || !isFinite(pctCartera)) { el.textContent = ''; el.className = 'vsbench'; return; }
  // Cuando hubo aportes, el % crudo de la cartera NO es comparable contra el
  // indice: incluye plata que pusiste. Desde el 31/08/2026, si el desglose
  // esta disponible se compara el rendimiento LIMPIO (movimientoDelSaldo),
  // que es la comparacion honesta. El asterisco queda solo para el caso en
  // que no se puede desglosar.
  var m = movimientoDelSaldo(serie);
  var limpio = (m && !m.sinDatos && m.mercadoPct !== null && Math.abs(m.aportes) >= 1) ? m.mercadoPct : null;
  var base = (limpio !== null) ? limpio : pctCartera;
  var delta = base - pb;
  var noSeParan = m && m.sinDatos === 'rango' && aportesEnRango(serie) !== 0;
  var hayAportesSinDesglose = (limpio === null) && (m ? (m.sinDatos ? true : false) : false) && aportesEnRango(serie) > 0;

  el.textContent = (delta >= 0 ? '+' : '−') + Math.abs(delta).toFixed(1) + ' pp vs ' +
    (benchNombre || 'el índice') + ((noSeParan || hayAportesSinDesglose) ? ' *' : '');
  el.className = 'vsbench ' + (delta >= 0 ? 'up' : 'down');

  if (limpio !== null) {
    el.title = 'Comparado con el rendimiento de tu cartera SIN contar los ' + fmt(Math.abs(m.aportes)) +
      ' que ' + (m.aportes >= 0 ? 'aportaste' : 'retiraste') + ' en el período. El índice se mide arrancando del mismo valor.';
  } else if (noSeParan || hayAportesSinDesglose) {
    el.title = 'Ojo: en este período hubo aportes y no pude separarlos, así que parte de la suba de tu cartera es plata que pusiste, no rendimiento.';
  } else {
    el.title = 'El índice se compara arrancando del mismo valor que tu cartera: es lo que habría valido el mismo dinero en ' +
      (benchNombre || 'el índice') + '.';
  }
}
function getFilteredDataPoints(serie) {
  return serie.filter(function (p, i) {
  if (i === serie.length - 1) return true; // el punto actual siempre se muestra
  var d = new Date(p.fecha).getDay();
  return d !== 0 && d !== 6;
  }).map(function (p) { return { x: p.fecha, y: p.valor }; });
  }

// ---------- La linea del indice sobre el grafico (31/08/2026) ----------
// El dato del S&P ya viajaba en el payload y lo usaban comparacionGrupo y
// comparacionAnual, pero NUNCA se dibujaba: el grafico tenia una sola serie.
// Sale de comparar con IBKR (hasta 3 indices), Schwab (5) y Fidelity (26):
// la comparacion contra un indice esta en 8 de cada 10 productos y era el
// hueco mas grande del tablero.
//
// COMO se compara, que es la decision de fondo: el indice se re-escala para
// ARRANCAR en el mismo valor que la cartera al principio del rango visible.
// Asi las dos curvas comparten eje y se leen juntas — es lo que hace
// Sharesight y lo que Schwab llama "value vs. net contributions". La lectura
// es "si el mismo dinero hubiera estado en SPY".
//
// LA TRAMPA, y por eso existe aportesEnRango(): si en el periodo hubo
// aportes, la cartera sube en parte porque pusiste plata, no porque rindiera,
// y contra un indice re-escalado eso se lee como que le ganaste. La app NO
// puede callarse eso: cuando hay aportes en el rango, el delta se muestra
// con un asterisco y la leyenda lo dice. La comparacion limpia de verdad
// —la que descuenta los aportes— ya existe y es comparacionGrupo().
function serieBench(serie) {
  if (!benchPuntos.length || serie.length < 2) return [];
  // El ancla es el primer punto que SE DIBUJA, no serie[0]. El grafico saltea
  // fines de semana (getFilteredDataPoints), asi que si la serie empieza un
  // sabado ese punto no existe en el dibujo: anclando ahi, las dos curvas
  // arrancaban separadas por un escaloncito. Se veia poco y mentia igual.
  var vistos = serie.filter(function (p, i) {
    if (i === serie.length - 1) return true;
    var d = new Date(p.fecha).getDay();
    return d !== 0 && d !== 6;
  });
  var ancla = null;
  for (var i = 0; i < vistos.length; i++) {
    var bv = benchEn(vistos[i].fecha);
    if (bv !== null && isFinite(bv) && bv !== 0 && vistos[i].valor) {
      ancla = { valor: vistos[i].valor, bench: bv };
      break;
    }
  }
  if (!ancla) return [];
  var out = [];
  vistos.forEach(function (p) {
    var b = benchEn(p.fecha);
    if (b === null || !isFinite(b)) return;
    out.push({ x: p.fecha, y: ancla.valor * (b / ancla.bench) });
  });
  return out;
}

// Cuanto se aporto DENTRO del rango visible. Devuelve 0 si no hubo, o si
// todavia no llego la lista de aportes (se pide aparte, en su panel).
function aportesEnRango(serie) {
  if (!serie.length || !aportesLista.length) return 0;
  var desde = serie[0].fecha, hasta = serie[serie.length - 1].fecha;
  var total = 0;
  aportesLista.forEach(function (a) {
    var ts = apISOaMs(a.fecha);
    if (ts === null || ts < desde || ts > hasta) return;
    // `grupo`, NO `monto`: es el nombre que manda el backend (getAportes
    // devuelve {fecha, grupo}; `monto` se saco del payload hace tiempo).
    // Leyendo `monto` esto devolvia SIEMPRE 0 —undefined no es finito— y con
    // eso movimientoDelSaldo informaba "Contributions: US$ 0" atribuyendo
    // todo al mercado, que es exactamente la mentira que D3 vino a eliminar.
    // Los otros dos lugares que recorren esta lista ya leian `grupo` bien;
    // este quedo solo. Encontrado el 1/09/2026.
    var m = Number(a.grupo);
    if (isFinite(m)) total += m;
  });
  return total;
}

// ---------- Qué movió el saldo (31/08/2026) ----------
// El hermano del benchmark, y la razón por la que el delta contra el índice
// llevaba asterisco. La cuenta es simple y la conclusión no lo es:
//
//   saldo final − saldo inicial = lo que APORTASTE + lo que RINDIÓ
//
// El mercado se despeja por diferencia, que es lo correcto: los aportes se
// saben con precisión (están registrados uno por uno), el rendimiento no se
// mide directo. Fidelity llama a esto "What drove your change in balance?",
// IBKR lo arma como cascada de Change in NAV y Schwab como "value vs. net
// contributions" — tres productos llegaron por separado a lo mismo, que es
// la señal más fuerte de la comparación.
//
// LAS DOS GUARDAS, que son el 90% del valor de esto:
//  1. Si la lista de aportes no llegó todavía (se pide en su panel), NO se
//     inventa un cero: sin ella, TODO el cambio se atribuiría a mercado.
//  2. Si el rango empieza ANTES de lo que la lista cubre (aportesDesde), los
//     aportes de ese tramo no están y caerían en "mercado". Se dice que no
//     se puede desglosar, en vez de dar un número lindo y falso.
function movimientoDelSaldo(serie) {
  if (!serie || serie.length < 2) return null;
  var inicial = serie[0].valor, final = serie[serie.length - 1].valor;
  if (!isFinite(inicial) || !isFinite(final)) return null;

  if (!aportesCargados) return { sinDatos: 'aportes' };
  // El rango arranca antes de lo que la lista conoce: no alcanza para
  // separar. Un dia de margen para no pelear con husos horarios.
  if (aportesDesde !== null && serie[0].fecha < aportesDesde - 86400000) {
    return { sinDatos: 'rango', desde: aportesDesde };
  }

  var aportes = aportesEnRango(serie);
  return {
    inicial: inicial,
    aportes: aportes,
    mercado: (final - inicial) - aportes,
    final: final,
    // El rendimiento medido sobre el capital que de verdad estuvo puesto.
    // No es exacto —un aporte de ayer no trabajó todo el periodo— pero es
    // mucho mas honesto que (final/inicial−1) cuando hubo aportes.
    mercadoPct: (inicial + aportes) > 0 ? ((final - inicial - aportes) / (inicial + aportes) * 100) : null
  };
}

// El % del indice en el mismo rango, para el delta en puntos porcentuales.
function benchPctEnRango(serie) {
  if (!benchPuntos.length || serie.length < 2) return null;
  var b0 = benchEn(serie[0].fecha);
  var bFin = benchEn(serie[serie.length - 1].fecha);
  if (!b0 || !bFin) return null;
  return (bFin / b0 - 1) * 100;
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
  x: { type: 'linear', min: xMin, max: xMax, bounds: 'data', ticks: { color: TC.tick, maxTicksLimit: 6, callback: function (value) { return new Date(value).toLocaleDateString('en-US', { day: '2-digit', month: 'short' }); } }, grid: { color: TC.grid } },
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
  // El acento se lee VIVO (colorAcento, nucleo.js): con el hexadecimal
  // clavado, la línea de Evolución seguía dorada con cualquier paleta.
  data: { datasets: datasetsEvolucion(dataPoints, serie) },
  options: buildChartOptions(dataPoints)
  });
  }
// La cartera SIEMPRE; el indice solo si hay dato. Va PUNTEADO y en gris, no
// en otro color fuerte: es la referencia, no una segunda protagonista — y
// ademas el punteado lo distingue sin depender del color (la misma razon por
// la que las subas y bajas llevan signo y no solo verde/rojo).
function datasetsEvolucion(dataPoints, serie) {
  var ds = [{
    data: dataPoints, borderColor: colorAcento(), backgroundColor: acentoRgba(0.12),
    fill: true, tension: 0.3, pointRadius: 0
  }];
  var b = serieBench(serie || []);
  if (b.length > 1) {
    ds.push({
      data: b, borderColor: 'rgba(144,160,184,.85)', borderDash: [5, 4],
      borderWidth: 1.8, fill: false, tension: 0.3, pointRadius: 0
    });
  }
  return ds;
}
  // El grafico de Evolucion arranca PLEGADO (pedido de Guzman, 22/08/2026:
  // "que no ocupe tanto a lo largo... solo dice como fue en % durante el
  // periodo seleccionado"). Lo que queda a la vista es el % del rango y los
  // botones de rango; el dibujo se ve al tocar Ampliar, que ya abria el
  // grafico grande.
  //
  // Con la caja oculta NO se dibuja: Chart.js sobre un canvas de alto cero
  // calcula mal la escala y ademas seria trabajo tirado en cada poll.
  function evoPlegado() {
  var box = document.getElementById('evoChartBox');
  return !box || box.style.display === 'none';
  }
  function drawLineChart(serie) {
  if (evoPlegado()) return;
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
  // SE TOCA EL GRAFICO, no un boton al costado (pedido de Guzman, 22/08/2026:
  // "que se expanda cuando aprieto sobre la mini grafica, no con el boton
  // chico del costado; si vuelvo a clickear sobre el grafico expandido se
  // vuelve a compactar en el mini").
  //
  // Plegado NO queda un hueco: se dibuja la MISMA mini grafica que las filas
  // de posiciones (sparkSvg), asi la tarjeta dice algo aunque este compacta.
  // La eleccion se recuerda; la primera vez arranca compacta.
  // 100x40, "apenas un poco mas grande" que los 80x32 de las filas de
  // posiciones (23/08/2026). El tamano NO es decoracion: a 305px de ancho —lo
  // que medía cuando ocupaba la tarjeta entera— una semana daba 50px por tramo
  // y se veia como una montana rota; en 100 da 16 y el codo se disimula solo.
  //
  // 100 y no 120 porque el dibujo se estira SIN conservar la proporcion: la
  // celda mide 97px medidos en el navegador, asi que un viewBox de 120 lo
  // comprimiria a 0,81 y los circulos saldrian ovalados. Con 100 queda 1:1.
  var EVO_W = 100, EVO_H = 40;
  function renderEvoMini() {
  var el = document.getElementById('evoMini');
  if (!el) return;
  var serie = filterSerie(currentRangeDias) || [];
  var vals = serie.map(function (p) { return p.valor; });
  // Mas de ~120 puntos en 300 de ancho es ruido: se muestrea parejo.
  if (vals.length > 120) {
    var paso = vals.length / 120, m = [];
    for (var i = 0; i < 120; i++) m.push(vals[Math.floor(i * paso)]);
    m.push(vals[vals.length - 1]);
    vals = m;
  }
  el.innerHTML = sparkSvg(vals, EVO_W, EVO_H, 'over the period', { area: true }) ||
    '<span class="evomini-vacio">No data yet</span>';
  }
  function pintarBotonEvo() {
  var abierto = !evoPlegado();
  var mini = document.getElementById('evoMini');
  if (mini) {
  mini.style.display = abierto ? 'none' : '';
  mini.setAttribute('aria-expanded', abierto ? 'true' : 'false');
  }
  var caja = document.getElementById('evoChartBox');
  if (caja) caja.setAttribute('aria-expanded', abierto ? 'true' : 'false');
  // Los botones de periodo y el de pantalla completa viajan JUNTOS con el
  // grafico: plegado no se ven, que era el pedido. Un solo nodo para los dos,
  // asi no puede quedar uno visible y el otro no.
  var ctl = document.getElementById('evoControls');
  if (ctl) ctl.style.display = abierto ? '' : 'none';
  }
  function toggleEvo() {
  var box = document.getElementById('evoChartBox');
  if (!box) return;
  var abrir = evoPlegado();
  box.style.display = abrir ? '' : 'none';
  try { localStorage.setItem('ga_evo_abierto', abrir ? '1' : '0'); } catch (e) {}
  pintarBotonEvo();
  // Se dibuja DESPUES de mostrar la caja: sobre un canvas de alto cero la
  // escala sale mal.
  if (abrir) drawLineChart(filterSerie(currentRangeDias)); else renderEvoMini();
  if (typeof ajustarAlturaDeck === 'function') ajustarAlturaDeck();
  }
  // El area del grafico ES el control, plegada y desplegada.
  //
  // Dos cuidados que costaron una auditoria (23/08/2026):
  //  - un deslizamiento del carrusel que arranca sobre el grafico NO es un
  //    clic (huboSwipe, en paneles.js): sin esto, deslizar hacia Dividendos
  //    plegaba el grafico de paso y encima lo recordaba;
  //  - un <div> con role="button" NO convierte Enter/Espacio en clic solo, eso
  //    lo hace un <button> de verdad. Con la caja abierta y sin esto, quien usa
  //    teclado o VoiceOver no tenia NINGUN control para volver a compactar: una
  //    trampa con estado guardado, de la que no se sale reabriendo la app.
  function _clicEvo() {
  if (typeof huboSwipe !== 'undefined' && huboSwipe) return;
  toggleEvo();
  }
  function _teclaEvo(e) {
  if (!e || (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar')) return;
  e.preventDefault();
  toggleEvo();
  }
  var _mini = document.getElementById('evoMini');
  if (_mini) { _mini.onclick = _clicEvo; _mini.onkeydown = _teclaEvo; }
  var _caja = document.getElementById('evoChartBox');
  if (_caja) { _caja.onclick = _clicEvo; _caja.onkeydown = _teclaEvo; }
  var _ampBtn = document.getElementById('evoAmpliarBtn');
  // stopPropagation: hoy el boton vive en la cabecera, fuera de la caja, pero
  // si alguna vez se mueve adentro un clic en el no debe plegar el grafico.
  if (_ampBtn) _ampBtn.onclick = function (e) { if (e && e.stopPropagation) e.stopPropagation(); openChartModal(); };
  document.getElementById('chartModalClose').onclick = closeChartModal;
  try {
  if (localStorage.getItem('ga_evo_abierto') === '1') {
    var _box = document.getElementById('evoChartBox');
    if (_box) _box.style.display = '';
  }
  } catch (e) {}
  pintarBotonEvo();

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
var aportesDesde = null;   // ms; hasta donde ATRAS es confiable la lista
// "Todavia no se cargaron" y "no hubo ninguno" son la MISMA lista vacia, y
// confundirlos es grave: comparacionAnual() sin flujos devuelve el cambio
// BRUTO del patrimonio —el numero inflado que incluye lo que Guzman aporto—
// presentado como rendimiento. Los aportes solo llegan al arrancar si el cache
// del servidor esta caliente (regla R1); si no, recien cuando se abre el panel
// de Aportes. Esta bandera hace que la tarjeta del año no se dibuje hasta
// saberlo de verdad.
var aportesCargados = false;

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

// El año contra el indice (pedido de Guzman, 22/08/2026: "que aparezcan
// comparaciones vs sp500 ytd", en la vista Portafolio).
//
// LA TRAMPA, y por que este calculo no es una resta:
// el cambio bruto del patrimonio en el año INCLUYE la plata que Guzman puso.
// Con sus numeros del 22/08/2026: el patrimonio subio 30,8% pero 7.000 de esos
// los aporto el; el rendimiento de verdad fue 21,6%. Poner el 30,8% al lado
// del S&P seria exactamente el error que este proyecto ya cometio y saco en
// v58 ("Rendimiento del año" = total - inicio - aportes netos).
//
// Asi que se encadena tramo a tramo descontando los aportes de cada tramo —
// la misma tecnica que `twrPct` en comparacionGrupo(), aplicada a la serie
// TOTAL. Es honesto SIEMPRE QUE los movimientos del año esten cargados; en
// 2026 lo estan (los aportes suman exactamente lo que informa el backend).
//
// Devuelve null cuando no se puede afirmar nada: sin serie del año anterior no
// hay punto de partida, y sin indice alineado no hay con que comparar.
function comparacionAnual() {
  if (!aportesCargados) return null;   // ver aportesCargados: sin flujos el numero miente
  if (!fullSerie || fullSerie.length < 2) return null;
  var ini = new Date(new Date().getFullYear(), 0, 1).getTime();

  // La base es el ULTIMO punto del año PASADO: el cierre con el que se arranca.
  // Si la serie empieza dentro de este año, no hay punto de partida y no se
  // inventa uno — se devuelve null y la tarjeta no se dibuja.
  var i0 = -1;
  for (var i = 0; i < fullSerie.length; i++) { if (fullSerie[i].fecha < ini) i0 = i; }
  if (i0 < 0 || i0 >= fullSerie.length - 1) return null;

  var base = fullSerie[i0].valor, fin = fullSerie[fullSerie.length - 1].valor;
  if (!(base > 0)) return null;

  var flujos = [];
  aportesLista.forEach(function (r) {
    var ts = apISOaMs(r.fecha);
    var m = Number(r.grupo);
    if (isFinite(ts) && ts > fullSerie[i0].fecha && isFinite(m) && m !== 0) flujos.push({ ts: ts, monto: m });
  });

  // Encadenado por tramos: cada tramo rinde su valor final MENOS los aportes
  // que cayeron dentro, contra el valor anterior. Un tramo que no se puede
  // medir con honestidad (valor no positivo) anula el numero entero.
  var twr = 1, ok = true;
  for (var j = i0 + 1; j < fullSerie.length; j++) {
    var vPrev = fullSerie[j - 1].valor, vHoy = fullSerie[j].valor;
    var flujo = 0;
    flujos.forEach(function (a) { if (a.ts > fullSerie[j - 1].fecha && a.ts <= fullSerie[j].fecha) flujo += a.monto; });
    if (!(vPrev > 0) || !(vHoy - flujo > 0)) { ok = false; break; }
    twr *= (vHoy - flujo) / vPrev;
  }
  if (!ok) return null;

  var b0 = benchEn(fullSerie[i0].fecha), bFin = benchEn(fullSerie[fullSerie.length - 1].fecha);
  var out = {
    desde: fullSerie[i0].fecha,
    pct: (twr - 1) * 100,
    bruto: (fin / base - 1) * 100,
    aportes: flujos.reduce(function (m, a) { return m + a.monto; }, 0),
    idxNombre: benchNombre,
    idxPct: (b0 && bFin) ? ((bFin / b0 - 1) * 100) : null
  };
  return out;
}

// La lista de aportes NO viaja en el payload del portafolio a proposito:
// consultar los brokers puede tardar varios segundos y frenaria el arranque,
// que es el momento mas sensible de la app. La pide el panel de Aportes
// (cargarAportes, paneles.js) y aca solo se guarda lo que comparacionGrupo()
// necesita.
function aplicarAportes(r) {
  aportesLista = (r && r.lista) || [];
  // `desde` vuelve a guardarse (31/08/2026). Se habia sacado el 17/08 porque
  // solo lo leia serieCapital, que se borro — pero ahora es una GUARDA de
  // correctitud: el desglose del periodo no puede restar aportes de un tramo
  // que la lista no cubre, porque toda esa plata caeria en "mercado" y diria
  // que ganaste algo que en realidad depositaste.
  aportesDesde = (r && r.desde) ? apISOaMs(r.desde) : null;
  if (r) aportesCargados = true;
}

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
  return pctHtml(Number(p.cambioDia), 2);
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
  var editable = !!pos.cuenta && !pos.cripto && !pos.gfTicker && symU !== 'USDT' && symU !== 'LIQUIDEZ';
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
      '<button type="button" class="detedit-abrir">Edit prices</button>' +
      '<div class="detedit-form" hidden>' +
      '<label><span class="detlbl">Current price</span><input class="detedit-pa" type="number" inputmode="decimal" step="any" min="0"></label>' +
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
function celdaInstrumentoHtml(h) {
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
return '<span class="holdcell"><span class="holdav ' + tipoDe(h) + '">' + avatar + '</span><span class="holdid"><span class="sym">' + esc(sym) + '</span><span class="desc">' + esc(h.nombre || '') + '</span></span></span>';
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
var MC_MESES = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
function celdaCalor(pct) {
if (pct === null || pct === undefined) return '<span class="mc-celda mc-vacia"></span>';
var v = pct * 100;
// La intensidad crece con el tamano del movimiento y se planta en ±8%.
var alpha = Math.min(0.85, 0.18 + (Math.abs(v) / 8) * 0.6);
var rgb = v >= 0 ? '34,197,94' : '244,63,94';
var txt = (v >= 0 ? '+' : '') + (Math.abs(v) >= 9.95 ? v.toFixed(0) : v.toFixed(1));
return '<span class="mc-celda" style="background:rgba(' + rgb + ',' + alpha.toFixed(2) + ')">' + txt + '</span>';
}
// La tarjeta "Este año vs el mercado" (Portafolio). Si comparacionAnual()
// devuelve null la tarjeta NO se dibuja: preferimos que no este a que muestre
// un guion sin explicacion.
function renderAnual() {
var card = document.getElementById('anualCard');
var el = document.getElementById('anualBody');
if (!card || !el) return;
var c = null;
try { c = comparacionAnual(); } catch (e) { c = null; }
if (!c) { card.style.display = 'none'; return; }
card.style.display = '';

function pct(v) {
if (v === null || !isFinite(v)) return '<p class="capval">&mdash;</p>';
return '<p class="capval ' + (v >= 0 ? 'up' : 'down') + '">' + signoPct(v, 1) + '</p>';
}
var dif = (c.idxPct !== null && isFinite(c.idxPct)) ? (c.pct - c.idxPct) : null;

var h = '<div class="caprow">';
h += '<div><p class="lbl">Tu cartera</p>' + pct(c.pct) + '</div>';
h += '<div><p class="lbl">' + esc(c.idxNombre || 'Index') + '</p>' + pct(c.idxPct) + '</div>';
if (dif !== null) {
h += '<div><p class="lbl">Difference</p><p class="capval ' + (dif >= 0 ? 'up' : 'down') + '">' +
signoPct(dif, 1) + '</p></div>';
}
h += '</div>';

// La nota NO es relleno: sin ella el numero se lee como el cambio del
// patrimonio, que es otra cosa y siempre mas grande.
// Fecha SIN hora: fechaCortaMs trae la hora (sirve para "ultima sync"), y en
// una fecha de cierre de año "30/12 12:00" solo estorba.
var dDesde = new Date(c.desde);
var desdeTxt = ('0' + dDesde.getDate()).slice(-2) + '/' + ('0' + (dDesde.getMonth() + 1)).slice(-2) + '/' + dDesde.getFullYear();
h += '<p class="capnota">From ' + desdeTxt + ' to today. This is the return on your ' +
'investments <b>net of what you contributed</b>: your net worth went up ' +
signoPct(c.bruto, 1) + ', but ' + esc(fmtUsdEnt(c.aportes)) + ' of that you put in yourself, you didn&rsquo;t earn it. ' +
(c.idxPct !== null ? 'The index doesn&rsquo;t pay dividends and your accounts do.' : '') + '</p>';
el.innerHTML = h;
}

function renderMapaCalor() {
var el = document.getElementById('mapaCalor');
if (!el) return;
var filas = mapaCalorMensual(fullSerie || []);
if (!filas.length) { el.innerHTML = '<p class="newsempty">With one more month of history, the first month will appear.</p>'; return; }
var html = '<div class="mc-fila mc-head"><span class="mc-anio"></span>' +
MC_MESES.map(function (m) { return '<span class="mc-celda">' + m + '</span>'; }).join('') + '</div>';
filas.forEach(function (f) {
html += '<div class="mc-fila"><span class="mc-anio">' + f.anio + '</span>' + f.meses.map(celdaCalor).join('') + '</div>';
});
el.innerHTML = html;
}

