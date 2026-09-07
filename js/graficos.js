// El grafico de Evolucion del Inicio y todo lo que se compara sobre el: los
// rangos, los ejes, el submuestreo, la linea del indice, que movio el saldo,
// los aportes y el bench compartidos, y la comparacion del panel de Aportes.
// Hasta el 6/09/2026 este archivo traia ademas el tablero (tira de
// indicadores, principales posiciones, detalle por activo) y el mapa de
// calor: hoy viven en tablero.js y calor.js, que se cargan justo despues.
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
// "in", no "en": se escapo del pasaje a ingles del 26/08/2026 (01/09/2026).
elPer.textContent = r ? ('in ' + r.key) : '';
}
var serie = filterSerie(currentRangeDias);
if (!serie.length || !currentTotal) { el.textContent = ''; el.className = 'rangepct'; return; }
var base = serie[0].valor;
if (!base) { el.textContent = ''; return; }
var pct = (currentTotal / base - 1) * 100;
var dias = (serie[serie.length - 1].fecha - serie[0].fecha) / 86400000;
var anual = pctAnualizado(pct, dias);
el.textContent = signoPct(pct, 2) +
// "ann." y no "annualized": esta celda es la que CEDE ancho en la fila del
// total, y en 2A/5A el texto ya llega a "+245.67% · +31.2% ann." — la palabra
// entera la empujaria fuera. Se escapo del pasaje a ingles (01/09/2026).
(anual !== null ? ' · ' + signoPct(anual, 1) + ' ann.' : '');
el.className = 'rangepct ' + (pct >= 0 ? 'up' : 'down');
pintarVsBench(serie, pct);
}
// El desglose "start + added + market" se SACO el 02/09/2026 a pedido de
// Guzman. movimientoDelSaldo() NO se toca: sigue viva y es la que le da a
// pintarVsBench el rendimiento LIMPIO —sin los aportes— para comparar contra
// el indice. Borrarla de paso habria devuelto esa comparacion al % crudo, que
// infla la cartera con la plata que pusiste.
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

  // El texto NO cambia de forma: el signo adelante se conserva a proposito
  // (es la misma convencion que el % de arriba, y hay asserts que lo
  // custodian). Lo unico que cambia es que ahora entra en una sola linea,
  // porque el renglon es de ancho completo. Se traduce el respaldo del nombre
  // del indice, que estaba en español como los titulos de aca abajo.
  el.textContent = (delta >= 0 ? '+' : '−') + Math.abs(delta).toFixed(1) + ' pp vs ' +
    (benchNombre || 'the index') + ((noSeParan || hayAportesSinDesglose) ? ' *' : '');
  el.className = 'vsbench ' + (delta >= 0 ? 'up' : 'down');

  if (limpio !== null) {
    el.title = 'Compared against your portfolio’s return WITHOUT the ' + fmt(Math.abs(m.aportes)) +
      ' you ' + (m.aportes >= 0 ? 'added' : 'withdrew') + ' over the period. The index starts from the same value.';
  } else if (noSeParan || hayAportesSinDesglose) {
    el.title = 'Heads up: there were deposits in this period and they could not be separated, so part of your portfolio’s rise is money you put in, not return.';
  } else {
    el.title = 'The index starts from the same value as your portfolio: it is what the same money would have been worth in ' +
      (benchNombre || 'the index') + '.';
  }
}
function getFilteredDataPoints(serie) {
  return serie.filter(function (p, i) {
  if (i === serie.length - 1) return true; // el punto actual siempre se muestra
  var d = new Date(p.fecha).getDay();
  return d !== 0 && d !== 6;
  }).map(function (p) { return { x: p.fecha, y: p.valor }; });
  }


// ---------- Las etiquetas de los ejes (02/09/2026) ----------
// Parte del mismo pedido ("que se vea mas pro"), y las dos son de lectura,
// no de dato: el grafico dibuja exactamente lo mismo.
//
// EJE Y: "120K" en vez de "120000". Seis cifras repetidas cinco veces roban
// ancho al dibujo y no agregan precision — el numero exacto vive arriba, en
// el total, que es donde se lo busca. Por debajo de 10.000 se escribe entero:
// ahi el "K" con decimal (9,4K) es MENOS legible que 9.400.
// Cuantos decimales necesita una escala para que dos marcas VECINAS no se
// escriban igual (06/09/2026). Sale del PASO, que es el unico dato que lo
// sabe: con paso 200 sobre 120.000, "120K" se repetia cinco veces.
function _decimalesPara(paso, div) {
  var p = Math.abs(Number(paso)) / div;
  if (!isFinite(p) || p <= 0) return 0;
  if (p >= 1) return 0;
  if (p >= 0.1) return 1;
  return 2;
}
function montoCorto(v, paso) {
  var n = Number(v);
  if (!isFinite(n)) return '';
  var abs = Math.abs(n);
  // Sin paso se comporta como antes: los tests unitarios y cualquier llamador
  // que solo quiera el numero corto siguen viendo lo mismo.
  if (abs >= 1e6) {
    var dM = paso === undefined ? (abs >= 1e7 ? 0 : 1) : _decimalesPara(paso, 1e6);
    return (n / 1e6).toFixed(dM).replace(/\.0+$/, '') + 'M';
  }
  if (abs >= 1e4) {
    var dK = paso === undefined ? 0 : _decimalesPara(paso, 1e3);
    return (n / 1e3).toFixed(dK).replace(/\.0+$/, '') + 'K';
  }
  return n.toLocaleString('en-US');
}


// EJE X: la escala manda el formato. Con "02 Sep" fijo, un rango de 5 anios
// mostraba cinco dias sueltos y un rango de una semana repetia el mes cinco
// veces. Ahora: dias en los rangos cortos, mes en los medianos, mes+anio
// cuando el rango cruza mas de un anio (si no, "Jan" de 2024 y "Jan" de 2026
// se leen igual, que es el error mas caro de los tres).
var MS_DIA_EJE = 86400000;
function etiquetaFechaEje(valor, xMin, xMax) {
  var d = new Date(valor);
  var dias = (xMax && xMin) ? (xMax - xMin) / MS_DIA_EJE : 0;
  // El apostrofo NO es decorativo: 'Apr 26' (mes + anio) se lee igual que
  // 'Apr 26' (mes + dia), que es lo que muestra el rango corto de abajo. Con
  // 'Apr '26' no hay forma de confundirlos. Lo destapo el arnes al comparar
  // los tres formatos entre si.
  if (dias > 400) return d.toLocaleDateString('en-US', { month: 'short' }) + ' ’' +
    String(d.getFullYear()).slice(-2);
  if (dias > 45) return d.toLocaleDateString('en-US', { month: 'short' });
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
}

// ---------- Submuestreo del grafico (02/09/2026) ----------
// Pedido de Guzman: "tiene muchos puntos para YTD, optimizalo para que se vea
// mas pro". Y era un numero, no una impresion: YTD son ~175 dias habiles y el
// grafico del Inicio mide ~290px, o sea MENOS DE 2 PIXELES por segmento. A esa
// densidad cada movimiento diario se dibuja como un diente y el conjunto se lee
// como ruido, no como una tendencia.
//
// Se usa LTTB (Largest-Triangle-Three-Buckets), que es el algoritmo estandar
// para achicar series temporales sin deformarlas. Lo importante para ESTA app:
//
//   ELIGE PUNTOS REALES, no promedia. Cada punto dibujado es un valor que tu
//   cartera tuvo de verdad ese dia. Un promedio movil se veria mas lindo y
//   seria un numero inventado — y este grafico es tu patrimonio.
//
// Ademas conserva los PICOS: por eso no sirve "uno cada N", que se saltea los
// maximos y minimos justo cuando son lo unico que importa mirar. LTTB elige,
// dentro de cada tramo, el punto que forma el triangulo mas grande con el
// anterior y con el promedio del tramo siguiente — que es una forma de decir
// "el que mas cambia la silueta".
//
// El primero y el ultimo NUNCA se tocan: el ultimo es el valor de hoy.
function submuestrearLTTB(puntos, cupo) {
  var n = puntos.length;
  if (!(cupo >= 3) || n <= cupo) return puntos;      // ya entra: no se toca
  var out = [puntos[0]];
  var paso = (n - 2) / (cupo - 2);
  var aIdx = 0;
  for (var i = 0; i < cupo - 2; i++) {
    // Promedio del tramo SIGUIENTE, que es el tercer vertice del triangulo.
    var desdeProm = Math.floor((i + 1) * paso) + 1;
    var hastaProm = Math.min(Math.floor((i + 2) * paso) + 1, n - 1);
    var promX = 0, promY = 0, cuenta = hastaProm - desdeProm;
    if (cuenta < 1) { desdeProm = n - 1; hastaProm = n; cuenta = 1; }
    for (var j = desdeProm; j < hastaProm; j++) { promX += puntos[j].x; promY += puntos[j].y; }
    promX /= cuenta; promY /= cuenta;

    var desde = Math.floor(i * paso) + 1;
    var hasta = Math.min(Math.floor((i + 1) * paso) + 1, n - 1);
    var aX = puntos[aIdx].x, aY = puntos[aIdx].y;
    var mejorArea = -1, mejor = desde;
    for (var k = desde; k < hasta; k++) {
      var area = Math.abs((aX - promX) * (puntos[k].y - aY) - (aX - puntos[k].x) * (promY - aY)) / 2;
      if (area > mejorArea) { mejorArea = area; mejor = k; }
    }
    out.push(puntos[mejor]);
    aIdx = mejor;
  }
  out.push(puntos[n - 1]);
  return out;
}

// El cupo sale del ANCHO REAL del lienzo, no de un numero fijo: el grafico del
// Inicio y el de pantalla completa son el mismo codigo con anchos muy
// distintos, y un cupo unico dejaria a uno ruidoso o al otro con escalones.
// ~4px por segmento es lo que hace que la linea se lea como una curva.
var PX_POR_SEGMENTO = 4;
function cupoDePuntos(canvasId) {
  var c = document.getElementById(canvasId);
  var ancho = (c && c.getBoundingClientRect().width) || 0;
  if (!ancho) return 90;                              // sin medida, un default sano
  return Math.max(40, Math.min(240, Math.round(ancho / PX_POR_SEGMENTO)));
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
// Es sobre la serie TOTAL, asi que descuenta el aporte a TODAS las cuentas
// (aporteTotalDelDia, en el bloque de aportes), no solo el del grupo.
function aportesEnRango(serie) {
  if (!serie.length || !aportesLista.length) return 0;
  var desde = serie[0].fecha, hasta = serie[serie.length - 1].fecha;
  var total = 0;
  aportesLista.forEach(function (a) {
    var ts = apISOaMs(a.fecha);
    if (ts === null || ts < desde || ts > hasta) return;
    var m = aporteTotalDelDia(a);
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
  x: { type: 'linear', min: xMin, max: xMax, bounds: 'data', ticks: { color: TC.tick, maxTicksLimit: 6, callback: function (value) { return etiquetaFechaEje(value, xMin, xMax); } }, grid: { color: TC.grid } },
  y: { ticks: { color: TC.tick, callback: function (v, paso) { return montosOcultos ? '' : montoCorto(v, paso); } }, grid: { color: TC.grid } }
  }
  };
  }
  // El grafico chico y el del modal eran la misma llamada copiada (E6).
  function dibujarEvolucion(canvasId, prev, serie) {
  // El cupo se calcula ANTES de destruir el grafico anterior: el lienzo tiene
  // que estar en el documento para poder medirle el ancho.
  var cupo = cupoDePuntos(canvasId);
  var dataPoints = submuestrearLTTB(getFilteredDataPoints(serie), cupo);
  if (prev) prev.destroy();
  return new Chart(document.getElementById(canvasId), {
  type: 'line',
  // El acento se lee VIVO (colorAcento, nucleo.js): con el hexadecimal
  // clavado, la línea de Evolución seguía dorada con cualquier paleta.
  data: { datasets: datasetsEvolucion(dataPoints, serie, cupo) },
  options: buildChartOptions(dataPoints)
  });
  }
// La cartera SIEMPRE; el indice solo si hay dato. Va PUNTEADO y en gris, no
// en otro color fuerte: es la referencia, no una segunda protagonista — y
// ademas el punteado lo distingue sin depender del color (la misma razon por
// la que las subas y bajas llevan signo y no solo verde/rojo).
function datasetsEvolucion(dataPoints, serie, cupo) {
  var ds = [{
    data: dataPoints, borderColor: colorAcento(), backgroundColor: acentoRgba(0.12),
    fill: true, tension: 0.3, pointRadius: 0
  }];
  // El indice se submuestrea con el MISMO cupo: si una curva llevara todos
  // sus puntos y la otra no, la comparacion visual seria entre dos niveles de
  // detalle distintos y la mas densa pareceria mas volatil por el dibujo.
  var b = submuestrearLTTB(serieBench(serie || []), cupo || 0);
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

// El aporte de un dia sobre el patrimonio ENTERO. El backend manda dos montos
// por dia (getAportes, 7/09/2026): `grupo` es lo que entro a Schwab + IBKR +
// Binance, y `total` lo que entro a TODAS las cuentas, bancos incluidos.
// Todo calculo sobre la serie TOTAL (aportesEnRango y con ella la linea vs
// S&P del Inicio, comparacionAnual, los retornos mensuales de Analisis) tiene
// que leer `total`: leyendo `grupo`, un deposito de sueldo a BTG —grupo 0—
// quedaba contado como rendimiento, y el Inicio decia que la cartera le habia
// ganado 1,25 puntos al indice con plata que Guzman acababa de poner.
// comparacionGrupo() es la UNICA que sigue leyendo `grupo`: mide solo esas
// cuentas, y ahi un deposito a BTG no existe.
// Si `total` no vino (un cache local anterior a este campo), se cae a `grupo`,
// que es lo que se leia hasta hoy: peor que el dato nuevo, mejor que un cero.
// Y NUNCA `monto`: ese nombre no viaja, y leerlo sumaba cero en silencio
// (encontrado el 1/09/2026).
function aporteTotalDelDia(a) {
  var t = Number(a.total);
  return isFinite(t) ? t : Number(a.grupo);
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

  // `total`, no `grupo`: esta es la serie del patrimonio ENTERO, y el aporte
  // que hay que descontar es el que entro a cualquier cuenta (ver
  // aporteTotalDelDia).
  var flujos = [];
  aportesLista.forEach(function (r) {
    var ts = apISOaMs(r.fecha);
    var m = aporteTotalDelDia(r);
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
