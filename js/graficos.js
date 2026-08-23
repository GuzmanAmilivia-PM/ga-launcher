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
// Al lado del total, el % solo NO dice de que periodo habla: el selector esta
// mas abajo, en otra tarjeta. Se escribe la etiqueta del rango elegido.
var elPer = document.getElementById('rangeNombre');
if (elPer) {
var r = RANGES.filter(function (x) { return x.dias === currentRangeDias; })[0];
elPer.textContent = r ? ('en ' + r.key) : '';
}
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
  el.innerHTML = sparkSvg(vals, EVO_W, EVO_H, 'en el periodo', { area: true, puntos: true }) ||
    '<span class="evomini-vacio">Sin datos todav&iacute;a</span>';
  }
  function pintarBotonEvo() {
  var abierto = !evoPlegado();
  var mini = document.getElementById('evoMini');
  if (mini) mini.style.display = abierto ? 'none' : '';
  var amp = document.getElementById('evoAmpliarBtn');
  if (amp) amp.style.display = abierto ? '' : 'none';
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
  var _mini = document.getElementById('evoMini');
  if (_mini) _mini.onclick = toggleEvo;
  var _caja = document.getElementById('evoChartBox');
  if (_caja) _caja.onclick = toggleEvo;
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
  if (r) aportesCargados = true;
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
// Un punto se dibuja cuando los tramos son largos; con tramos cortos serian
// una mancha.
//
// El umbral se cuenta en PUNTOS, no en separacion. La primera version medía la
// separacion en unidades del dibujo y habia que reajustarla cada vez que
// cambiaba el tamano —de 300 a 120 el mismo umbral pasaba a significar otra
// cosa—, asi que el numero no describia ninguna regla. Lo que importa es
// simple: pocas lecturas se marcan, muchas no.
//
// 8 sale del caso real: una semana son 7 dias. Un mes o un YTD traen 30, y ahi
// treinta circulos sobre la linea no son un dato sino una cortina (se probo con
// 38 permitidos y Guzman lo vio "horrible" en el telefono el 23/08/2026).
var SPARK_MAX_PUNTOS = 8;
// w/h opcionales: la tabla de posiciones usa el tamano chico de siempre, y la
// mini de Evolucion pide uno ancho y bajo. Misma funcion para las dos — el
// dibujo ya estaba probado y no tiene sentido tener dos.
//
// `opts` (23/08/2026) — el pedido de Guzman fue por el rango 1S, donde el
// grafico se veia "facetado, tipo montana con quiebres duros". La causa NO era
// el dibujo sino los DATOS: el historico guarda un valor por dia, asi que una
// semana son 7 puntos y 6 tramos rectos; estirados sobre la tarjeta ancha cada
// tramo mide ~55px y el codo se ve enorme. Los minis de las posiciones se ven
// organicos porque meten 24 cierres en 76px — 3,3px por tramo, invisible.
//
// Ningun tamano arregla eso: 7 puntos son 7 puntos. Lo que se hace es que se
// LEAN como lo que son.
//   opts.puntos — marca cada valor. El codo deja de ser un defecto y pasa a
//     ser un dato. Se decidio esto y NO suavizar la curva: una curva entre dos
//     dias dibuja plata en lugares donde no estuvo, que es el mismo criterio
//     por el que las criptas sin historial no dibujan nada.
//   opts.area — rellena debajo. La tarjeta de Evolucion es ancha y una linea
//     fina sola adentro es justo lo que Guzman ya habia rechazado ("mucho
//     espacio para un grafico chico"). En la TABLA no va: siete filas con
//     relleno la vuelven pesada.
function sparkSvg(serie, w, h, dicePct, opts) {
if (!serie || serie.length < 2) return '';
var o = opts || {};
var W = w || SPARK_W, H = h || SPARK_H;
var min = serie[0], max = serie[0];
for (var i = 1; i < serie.length; i++) { if (serie[i] < min) min = serie[i]; if (serie[i] > max) max = serie[i]; }
var rango = max - min;
// Un mes plano (o un solo precio repetido) se dibuja como una raya al medio,
// no como una division por cero.
// Se decide PRIMERO si va a haber puntos, porque de eso depende el margen. La
// separacion se mide contra el margen chico: la diferencia entre 296 y 291 de
// ancho no mueve la decision, y asi la cuenta no se muerde la cola.
var hayPuntos = !!o.puntos && serie.length <= SPARK_MAX_PUNTOS;
// Con puntos el margen tiene que dar para el CIRCULO, no solo para la linea:
// el de hoy tiene radio 3,2 mas su borde, y contra un pad de 2 salia cortado
// por la mitad en el lado derecho de la tarjeta (se vio en el telefono).
// Sin puntos vuelve a 2, si no el relleno deja un hueco contra los bordes.
var pad = hayPuntos ? 4.5 : 2, alto = H - pad * 2, ancho = W - pad * 2;
var pts = [], xs = [], ys = [];
for (var j = 0; j < serie.length; j++) {
var x = pad + (j * ancho) / (serie.length - 1);
var y = pad + (rango === 0 ? alto / 2 : alto - ((serie[j] - min) / rango) * alto);
xs.push(x); ys.push(y);
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
var dicho = (pct >= 0 ? '+' : '') + pct.toFixed(1) + '% ' + (dicePct || 'en el mes');
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
var puntos = '';
if (hayPuntos) {
for (var k = 0; k < xs.length; k++) {
// El ultimo va hueco: es DONDE ESTAS HOY, no un dia mas de la serie.
var hoy = k === xs.length - 1;
puntos += '<circle' + (hoy ? ' class="hoy" r="3.2"' : ' r="2.4"') +
' cx="' + xs[k].toFixed(1) + '" cy="' + ys[k].toFixed(1) + '"/>';
}
}
return '<svg class="spark ' + (sube ? 'sube' : 'baja') + '" width="' + W + '" height="' + H +
// El viewBox tiene que ser el MISMO W/H con el que se calcularon los puntos.
// Quedo en SPARK_W/SPARK_H al generalizar la funcion y la mini de Evolucion
// —que dibuja en 300x44— salia recortada: se veia un pedacito de linea y el
// resto afuera del cuadro. Lo agarro una captura de Guzman, no una prueba.
// preserveAspectRatio="none" para que la linea ocupe TODO el ancho: una
// sparkline se estira a proposito, no se centra con bordes vacios.
'" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + dicho + '">' +
relleno + '<polyline points="' + pts.join(' ') + '"/>' + puntos + '</svg>';
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
h += '<div><p class="lbl">' + esc(c.idxNombre || 'Índice') + '</p>' + pct(c.idxPct) + '</div>';
if (dif !== null) {
h += '<div><p class="lbl">Diferencia</p><p class="capval ' + (dif >= 0 ? 'up' : 'down') + '">' +
signoPct(dif, 1) + '</p></div>';
}
h += '</div>';

// La nota NO es relleno: sin ella el numero se lee como el cambio del
// patrimonio, que es otra cosa y siempre mas grande.
// Fecha SIN hora: fechaCortaMs trae la hora (sirve para "ultima sync"), y en
// una fecha de cierre de año "30/12 12:00" solo estorba.
var dDesde = new Date(c.desde);
var desdeTxt = ('0' + dDesde.getDate()).slice(-2) + '/' + ('0' + (dDesde.getMonth() + 1)).slice(-2) + '/' + dDesde.getFullYear();
h += '<p class="capnota">Del ' + desdeTxt + ' a hoy. Es el rendimiento de tus ' +
'inversiones <b>descontando lo que aportaste</b>: tu patrimonio subi&oacute; ' +
signoPct(c.bruto, 1) + ', pero ' + esc(fmtUsdEnt(c.aportes)) + ' de eso los pusiste vos, no los ganaste. ' +
(c.idxPct !== null ? 'El &iacute;ndice no paga dividendos y tus cuentas s&iacute;.' : '') + '</p>';
el.innerHTML = h;
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

