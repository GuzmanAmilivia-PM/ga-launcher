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
var corte;
if (dias === 'ytd') {
// La base del año es el ÚLTIMO punto del año anterior —el cierre con el que
// se arranca—, no el primer dato de enero (9/09/2026, Guzmán: el YTD del
// Inicio decía +27,7% desde el 30/01 mientras la tarjeta del año decía que
// el patrimonio subió +32,7% desde el 30/12: dos "YTD" distintos). Es la
// misma base que comparacionAnual y que el crecimiento sin aportes del
// backend. Si la serie empieza dentro del año, se cae al 1 de enero.
var ene1 = new Date(new Date().getFullYear(), 0, 1).getTime();
var i0 = -1;
for (var k = 0; k < fullSerie.length; k++) { if (fullSerie[k].fecha < ene1) i0 = k; }
corte = i0 >= 0 ? fullSerie[i0].fecha : ene1;
} else { corte = now - dias * day; }
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
  // SIN LA LISTA DE APORTES NO SE DIBUJA NADA (14/09/2026). Es la misma guarda
  // que ya tenia comparacionAnual y que aca faltaba: aportesCargados arranca en
  // false y la lista llega al abrir el panel de Aportes — o al arrancar, pero
  // SOLO si el cache del servidor esta caliente. Sin ella no se puede descontar
  // lo que Guzman deposito, y el % crudo contra el indice daba el DOBLE de
  // ventaja: 21,6 pp en vez de 10,7 el 13/09/2026, con 8.500 aportados en el
  // ano. Y era INTERMITENTE —el mismo numero salia bien o mal segun la
  // temperatura del cache—, asi que no habia forma de saber cual se estaba
  // leyendo. El asterisco de mas abajo NO cubre este caso y nunca pudo: para
  // avisar "hubo aportes que no pude descontar" necesita la lista de aportes,
  // que es justo lo que falta. Un hueco que se llena solo un segundo despues es
  // mejor que un numero que miente a favor. Lo encontro Guzman mirando la
  // pantalla, no la suite.
  if (m && m.sinDatos === 'aportes') { el.textContent = ''; el.className = 'vsbench'; return; }
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
  // Con aportes en el rango, la linea dice ADEMAS el rendimiento sin ellos
  // (23/09/2026, auditoria general, punto 15). El % de arriba ("+32% in YTD")
  // es el patrimonio entero, depositos incluidos, y la aclaracion vivia en un
  // `title` que el iPhone nunca muestra: al lado de "+10.7 pp vs S&P 500" se
  // leia que el indice habia hecho +21%. Son las dos caras del mismo YTD que
  // pidio Guzman ("ytd completo o sin contemplar depositos"), una arriba de
  // la otra. Sin aportes no se agrega nada: ahi el % de arriba ya es limpio.
  el.textContent = (limpio !== null ? signoPct(limpio, 1) + ' without deposits · ' : '') +
    (delta >= 0 ? '+' : '−') + Math.abs(delta).toFixed(1) + ' pp vs ' +
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

// ---------- La vista en % del grafico (22/09/2026) ----------
// Hasta hoy el grafico en DOLARES llevaba punteada la linea del S&P, re-escalada
// al valor de la cartera al principio del rango (serieBench, 31/08/2026). Se
// saco a pedido de Guzman: la curva en dolares INCLUYE lo que depositaste, asi
// que contra ella el indice nunca es comparable — y sumarle los depositos al
// indice tambien los dibuja como saltos. "No la compares vs S&P 500 si tiene en
// cuenta los depositos." El grafico en dolares queda con una sola curva.
//
// La comparacion vive ahora en la vista en %: las dos curvas arrancan en 0 % al
// principio del rango y miden CRECIMIENTO POR RENDIMIENTO — la cartera con el
// MISMO encadenado sin depositos que el "pp vs S&P" del Inicio (_twrCadena,
// abajo en el bloque de aportes) y el indice con su propio %. Por construccion,
// la distancia entre las dos puntas es exactamente ese "pp vs S&P".
//
// Las guardas son las de movimientoDelSaldo, por la misma razon: sin la lista
// de aportes, o con un rango que empieza antes de lo que la lista cubre, un
// deposito se dibujaria como rendimiento. Ahi no se dibuja: se dice por que.
var evoModo = 'valor';
var EVO_MODOS = [
  { key: '$', modo: 'valor', titulo: 'Value in dollars' },
  { key: '%', modo: 'pct', titulo: 'Return without deposits vs the S&P 500' }
];
function buildModoBar(barId) {
  var bar = document.getElementById(barId);
  if (!bar) return;
  bar.innerHTML = '';
  EVO_MODOS.forEach(function (m) {
    var btn = document.createElement('button');
    btn.className = 'rangebtn' + (m.modo === evoModo ? ' active' : '');
    btn.textContent = m.key;
    btn.title = m.titulo;
    btn.setAttribute('aria-label', m.titulo);
    btn._modo = m.modo;
    btn.onclick = function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      evoModo = m.modo;
      syncModoBars();
      drawLineChart(filterSerie(currentRangeDias));
      if (document.getElementById('chartModal').style.display !== 'none') drawBigChart();
    };
    bar.appendChild(btn);
  });
}
function syncModoBars() {
  document.querySelectorAll('.modobar .rangebtn').forEach(function (b) {
    b.classList.toggle('active', b._modo === evoModo);
  });
}
// Las dos curvas en %, o {sinDatos} con el motivo. El primer punto del rango
// va SIEMPRE (es el 0 % de las dos); despues se saltean los fines de semana
// igual que en la curva en dolares.
function serieRendimientoPct(serie) {
  if (!serie || serie.length < 2) return { sinDatos: 'serie' };
  if (!aportesCargados) return { sinDatos: 'aportes' };
  if (aportesDesde !== null && serie[0].fecha < aportesDesde - 86400000) {
    return { sinDatos: 'rango', desde: aportesDesde };
  }
  var c = _twrCadena(serie);
  if (!c) return { sinDatos: 'serie' };
  var b0 = benchEn(serie[0].fecha);
  var cartera = [], indice = [];
  serie.forEach(function (p, i) {
    if (i !== 0 && i !== serie.length - 1) {
      var d = new Date(p.fecha).getDay();
      if (d === 0 || d === 6) return;
    }
    cartera.push({ x: p.fecha, y: (c.factores[i] - 1) * 100 });
    var b = benchEn(p.fecha);
    if (b0 && b !== null && isFinite(b)) indice.push({ x: p.fecha, y: (b / b0 - 1) * 100 });
  });
  return { cartera: cartera, indice: indice };
}
// Lo que se dice debajo del dibujo en la vista en %: la leyenda cuando hay
// grafico, el motivo cuando no. En dolares no se dice nada.
function pintarNotaEvo(nota, r) {
  if (!nota) return;
  if (evoModo !== 'pct') { nota.hidden = true; nota.innerHTML = ''; return; }
  nota.hidden = false;
  var idx = esc(benchNombre || 'S&P 500');
  if (!r || !r.sinDatos) {
    nota.innerHTML = '<span class="rendlin"></span>your portfolio, without deposits ' +
      '<span class="rendlin rendlin-idx"></span>' + idx + ' (dividends reinvested)';
  } else if (r.sinDatos === 'aportes') {
    nota.textContent = 'Loading your deposits to separate them from the return…';
  } else if (r.sinDatos === 'rango') {
    nota.textContent = 'Deposits are known back to ' + new Date(r.desde).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ': pick a shorter range to compare without them.';
  } else {
    nota.textContent = 'Not enough data to compare this range.';
  }
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
  // El % es el MISMO encadenado que usan la tarjeta del año y el backend
  // (twrEnRango, 9/09/2026). Antes era (final−inicial−aportes)/(inicial+aportes),
  // una aproximación distinta: el "vs S&P" del Inicio y el de Portfolio daban
  // números distintos para el mismo período.
  var t = twrEnRango(serie);
  return {
    inicial: inicial,
    aportes: aportes,
    mercado: (final - inicial) - aportes,
    final: final,
    mercadoPct: t ? t.pct : null
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
  function buildChartOptions(pts, enPct) {
  var TC = temaChart();
  var xMin = (pts && pts.length) ? pts[0].x : undefined;
  var xMax = (pts && pts.length) ? pts[pts.length - 1].x : undefined;
  // En % el eje dice porcentajes y NO se oculta con el ojo: un % no revela
  // cuanta plata hay (el mismo criterio que el % del rango, que se ve siempre).
  var ejeY = enPct
    ? function (v, paso) { var d = (paso && Math.abs(paso) < 1) ? 1 : 0; return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d) + '%'; }
    : function (v, paso) { return montosOcultos ? '' : montoCorto(v, paso); };
  return {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
  x: { type: 'linear', min: xMin, max: xMax, bounds: 'data', ticks: { color: TC.tick, maxTicksLimit: 6, callback: function (value) { return etiquetaFechaEje(value, xMin, xMax); } }, grid: { color: TC.grid } },
  y: { ticks: { color: TC.tick, callback: ejeY }, grid: { color: TC.grid } }
  }
  };
  }
  // El grafico chico y el del modal eran la misma llamada copiada (E6).
  // Desde el 22/09/2026 dibuja lo que diga evoModo: el patrimonio en dolares,
  // o las dos curvas de rendimiento en %. Si la vista en % no se puede medir,
  // no dibuja nada (devuelve null) y la nota dice por que.
  function dibujarEvolucion(canvasId, prev, serie, notaId) {
  // El cupo se calcula ANTES de destruir el grafico anterior: el lienzo tiene
  // que estar en el documento para poder medirle el ancho.
  var cupo = cupoDePuntos(canvasId);
  var nota = notaId ? document.getElementById(notaId) : null;
  var dataPoints = null;
  var ds = null;
  if (evoModo === 'pct') {
    var r = serieRendimientoPct(serie);
    pintarNotaEvo(nota, r);
    if (r.sinDatos) { if (prev) prev.destroy(); return null; }
    dataPoints = submuestrearLTTB(r.cartera, cupo);
    ds = datasetsRendimiento(dataPoints, submuestrearLTTB(r.indice, cupo));
  } else {
    pintarNotaEvo(nota, null);
    dataPoints = submuestrearLTTB(getFilteredDataPoints(serie), cupo);
    ds = datasetsEvolucion(dataPoints);
  }
  if (prev) prev.destroy();
  return new Chart(document.getElementById(canvasId), {
  type: 'line',
  // El acento se lee VIVO (colorAcento, nucleo.js): con el hexadecimal
  // clavado, la línea de Evolución seguía dorada con cualquier paleta.
  data: { datasets: ds },
  options: buildChartOptions(dataPoints, evoModo === 'pct')
  });
  }
// En dolares, UNA sola curva: el patrimonio (22/09/2026; ver la vista en %).
function datasetsEvolucion(dataPoints) {
  return [{
    data: dataPoints, borderColor: colorAcento(), backgroundColor: acentoRgba(0.12),
    fill: true, tension: 0.3, pointRadius: 0
  }];
}
// En %, la cartera con el acento y SIN relleno (un relleno hasta el cero
// pintaria de color las rachas negativas como si fueran area ganada), y el
// indice PUNTEADO y en gris: es la referencia, no una segunda protagonista, y
// el punteado lo distingue sin depender del color. Las dos con el MISMO cupo:
// dos niveles de detalle harian parecer mas volatil a la curva mas densa.
function datasetsRendimiento(cartera, indice) {
  var ds = [{
    data: cartera, borderColor: colorAcento(), backgroundColor: acentoRgba(0.12),
    fill: false, tension: 0.3, pointRadius: 0
  }];
  if (indice && indice.length > 1) {
    ds.push({
      data: indice, borderColor: 'rgba(144,160,184,.85)', borderDash: [5, 4],
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
  lineChartInstance = dibujarEvolucion('lineChart', lineChartInstance, serie, 'evoNota');
  }
  var bigChartInstance = null;
  function drawBigChart() {
  bigChartInstance = dibujarEvolucion('lineChartBig', bigChartInstance, filterSerie(currentRangeDias), 'evoNotaBig');
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
  // Arranca compacta CADA VEZ que se entra a la app; dentro de la sesion se
  // recuerda lo que elegiste (ver el pie de este bloque, 13/09/2026).
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
  // MENOS PUNTOS DE LOS QUE HAY (13/09/2026, Guzman: "para YTD no deberia
  // marcar todos los puntos... tanto punto no suma, resta"). Los 47 del YTD en
  // una celda de ~57px dan poco mas de 1px por tramo: eso es ruido, no una
  // tendencia. El submuestreo lo hace sparkSvg (LTTB, puntos reales); aca solo
  // se decide CUANTOS entran.
  var vals = serie.map(function (p) { return p.valor; });
  var fechas = serie.map(function (p) { return p.fecha; });
  // DOCE PUNTOS, TOPE (13/09/2026, Guzman mirandolo en el iPhone: "unos 12
  // puntos maximo, equidistantes en fecha"). Es un numero visto en pantalla, no
  // calculado: en una celda de ~57px doce tramos son ~5px cada uno, que es
  // donde la linea se lee como una tendencia. La celda igual se mide, por si
  // algun dia es mas angosta que eso; nunca sube de 12. El reparto en tramos
  // iguales de CALENDARIO lo hace sparkSvg, que es quien tiene las fechas.
  var anchoReal = (el.getBoundingClientRect && el.getBoundingClientRect().width) || 0;
  var cupoMini = anchoReal ? Math.max(6, Math.min(12, Math.round(anchoReal / PX_POR_SEGMENTO))) : 12;
  el.innerHTML = sparkSvg(vals, EVO_W, EVO_H, 'over the period', { area: true, xs: fechas, cupo: cupoMini }) ||
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
  // AL ENTRAR SIEMPRE ARRANCA COMPACTA (13/09/2026, pedido de Guzman: "la
  // grafica minimizada deberia ser el estandar cuando ingreso a la app"). Antes
  // se recordaba la eleccion entre sesiones y quedaba desplegada para siempre
  // desde la unica vez que se abrio. Desplegarla sigue siendo un toque, y
  // dentro de la sesion el estado se mantiene: lo que se solto es que la
  // preferencia sobreviva al cierre de la app.
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

// El rendimiento SIN aportes de un tramo de la serie TOTAL: encadenado punto
// a punto, descontando de cada tramo los aportes y retiros (`total`) que
// cayeron en él. Es LA definición de "sin depósitos" de la app (9/09/2026):
// la usan el "vs S&P" del Inicio (movimientoDelSaldo), la tarjeta del año en
// Portfolio (comparacionAnual) y —con la misma cuenta, en el backend— el
// bloque "Whole portfolio, without contributions". Un tramo que no se puede
// medir (valor no positivo) anula el número: null, nunca un invento.
// Vive en ESTE bloque porque test-capital.js lo evalúa aislado y
// comparacionAnual la necesita.
function twrEnRango(serie) {
  var c = _twrCadena(serie);
  if (!c) return null;
  return { pct: (c.factores[c.factores.length - 1] - 1) * 100, aportes: c.aportes };
}
// La cadena ENTERA, punto por punto (22/09/2026): factores[i] es lo que rindió
// la cartera desde serie[0] hasta serie[i], sin los aportes. twrEnRango se
// queda con la punta; la vista en % del grafico dibuja todos. Una sola cuenta
// para los dos, asi la curva no puede terminar en otro numero que el "pp vs
// S&P" que tiene arriba.
function _twrCadena(serie) {
  if (!serie || serie.length < 2) return null;
  var t0 = serie[0].fecha, tFin = serie[serie.length - 1].fecha;
  var flujos = [];
  aportesLista.forEach(function (r) {
    var ts = apISOaMs(r.fecha);
    var m = aporteTotalDelDia(r);
    if (isFinite(ts) && ts > t0 && ts <= tFin && isFinite(m) && m !== 0) flujos.push({ ts: ts, monto: m });
  });
  // El flujo entra AL INICIO de su tramo y participa de su rendimiento
  // (15/09/2026, V17): tramo = valor final / (valor anterior + flujo). Es la
  // convención de IBKR, verificada contra PortfolioAnalyst tramo por tramo
  // (Bench.crecimientoSinAportes tiene la explicación completa). Antes se
  // descontaba al cierre, y el acumulado se apartaba 2,2 puntos.
  var twr = 1, factores = [1];
  for (var j = 1; j < serie.length; j++) {
    var vPrev = serie[j - 1].valor, vHoy = serie[j].valor;
    var flujo = 0;
    flujos.forEach(function (a) { if (a.ts > serie[j - 1].fecha && a.ts <= serie[j].fecha) flujo += a.monto; });
    if (!(vPrev > 0) || !(vPrev + flujo > 0) || !(vHoy > 0)) return null;
    twr *= vHoy / (vPrev + flujo);
    factores.push(twr);
  }
  return { factores: factores, aportes: flujos.reduce(function (m, a) { return m + a.monto; }, 0) };
}

// ---------- El indice de referencia ----------
// El backend manda el cierre del indice alineado punto a punto con la serie
// (`bench.valores`), asi el telefono no tiene que buscar ninguna fecha. Lo
// consume comparacionGrupo(): el indice NO se compara "en general", se simula
// la MISMA plata puesta en las MISMAS fechas.
var benchPuntos = [], benchNombre = '', benchLargo = 0;

// El molde que comparten aplicarBench y aplicarGrupo (14/09/2026). Las dos
// funciones eran la MISMA escrita dos veces: la guarda de "una respuesta vacia
// no borra lo que ya estaba", el chequeo de largo contra fullSerie y el
// volcado punto a punto. Solo cambiaban la clave del payload, el trio de
// variables y el nombre por defecto. Auditoria del 14/09/2026.
//
// Devuelve {puntos, nombre, largo} para reemplazar, o NULL para no tocar nada.
// Esa distincion es el corazon de la fn y por eso no devuelve un objeto vacio:
// "conservar lo que hay" y "limpiar" son decisiones distintas.
//
// El pegamento es el INDICE del arreglo: valores[i] corresponde a
// fullSerie[i]. Si el backend cambiara una sin la otra, esto se desalinea, y
// por eso la longitud se verifica antes de usar nada.
function _alinearContraSerie(payload, nombrePorDefecto, largoActual, hayPuntos) {
  var vacio = { puntos: [], nombre: '', largo: 0 };
  if (!payload || !payload.valores || !payload.valores.length) {
    // Mientras el backend se llena, varias respuestas seguidas vienen sin el
    // dato, y borrarlo hacia que la linea apareciera y desapareciera sola.
    if (hayPuntos && (fullSerie || []).length === largoActual) return null;
    return vacio;
  }
  if (payload.valores.length !== (fullSerie || []).length) return vacio;
  var puntos = [];
  fullSerie.forEach(function (pt, i) {
    var v = payload.valores[i];
    if (v !== null && isFinite(v)) puntos.push({ ts: pt.fecha, valor: v });
  });
  return { puntos: puntos, nombre: payload.nombre || nombrePorDefecto, largo: payload.valores.length };
}

function aplicarBench(data) {
  // El respaldo va en INGLES como toda la interfaz: decia 'el indice', y como
  // el español ya es truthy, el 'the index' de pintarVsBench no podia ganarle
  // nunca. Hoy no se ve —el Worker siempre manda el nombre— pero era una
  // cadena en español a un toque de pantalla.
  var r = _alinearContraSerie(data && data.bench, 'the index', benchLargo, benchPuntos.length > 0);
  if (!r) return;
  benchPuntos = r.puntos; benchNombre = r.nombre; benchLargo = r.largo;
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

function aplicarGrupo(data) {
  var r = _alinearContraSerie(data && data.serieGrupo, '', grupoLargo, grupoPuntos.length > 0);
  if (!r) return;
  grupoPuntos = r.puntos; grupoNombre = r.nombre; grupoLargo = r.largo;
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
  // La MISMA guarda que pintarVsBench y comparacionAnual (14/09/2026). Aca no
  // fallaba, pero solo por el ORDEN en que se pinta: el unico llamador
  // (htmlComparacion) corta antes si el pedido fallo y llama a aplicarAportes
  // primero. Eso es una proteccion por coreografia, no por chequeo: el dia que
  // alguien llame a esta fn desde otra pantalla, `aportesLista` vacia se lee
  // como 'no hubo aportes' y el rendimiento del grupo sale INFLADO, sin avisar.
  // Es exactamente lo que paso con el vs S&P del Inicio el 13/09/2026.
  if (!aportesCargados) return null;
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
    // El flujo al INICIO del tramo (15/09/2026): la misma regla que twrEnRango.
    if (!(vPrev + flujo > 0) || !(vHoy > 0)) { twrOk = false; break; }
    twr *= vHoy / (vPrev + flujo);
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

  // El encadenado vive en twrEnRango (9/09/2026): es la MISMA cuenta que el
  // "vs S&P" del Inicio, así los dos números coinciden por construcción.
  // `total`, no `grupo`: esta es la serie del patrimonio ENTERO (ver
  // aporteTotalDelDia).
  var t = twrEnRango(fullSerie.slice(i0));
  if (!t) return null;

  var b0 = benchEn(fullSerie[i0].fecha), bFin = benchEn(fullSerie[fullSerie.length - 1].fecha);
  var out = {
    desde: fullSerie[i0].fecha,
    pct: t.pct,
    bruto: (fin / base - 1) * 100,
    aportes: t.aportes,
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
  // Repintar el "vs S&P" (14/09/2026). Mientras la lista no estaba, esa linea
  // se escondia a proposito (ver pintarVsBench); ahora que llego, el numero se
  // puede calcular bien y tiene que aparecer YA, no en el sondeo de dentro de
  // un minuto. Es la MISMA fn que lo dibuja siempre, asi que no hay un segundo
  // camino que pueda decir otra cosa.
  try { if (typeof updateRangePct === 'function') updateRangePct(); } catch (e) {}
  // La vista en % del grafico tiene la misma espera (22/09/2026): sin la lista
  // decia "Loading your deposits…"; ahora se dibuja.
  try {
    if (typeof evoModo !== 'undefined' && evoModo === 'pct') {
      drawLineChart(filterSerie(currentRangeDias));
      if (document.getElementById('chartModal').style.display !== 'none') drawBigChart();
    }
  } catch (e2) {}
}
