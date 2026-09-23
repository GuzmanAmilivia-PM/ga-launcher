// ---------- Rendimiento historico por cuenta (V17) ----------
// La entrada "Historical performance" de la pagina de IBKR y de Schwab
// (15/09/2026), pedido de Guzman: lo que PortfolioAnalyst le muestra, sin
// entrar a la web del broker, y con dos preguntas separadas:
//   1. Me fue bien con MI plata?  -> el MWR (mis depositos, en mis fechas) y
//      "la misma plata en SPY" (los mismos depositos y retiros, en las mismas
//      fechas, puestos en el indice), con la diferencia en dolares.
//   2. Mis elecciones le ganan al indice? -> el TWR (sin el efecto de los
//      depositos) contra el SPY del mismo tramo.
//
// LA FORMA (pedido de Guzman del 16/09/2026): la tarjeta arranca PLEGADA y
// muestra una sola cosa, el YTD contra el S&P 500, con una tabla minima de
// dos columnas (vos / el indice). Un desplegable abre el resto: los rangos
// (1M, YTD, 1Y, 5Y, desde el inicio), los anualizados, los flujos, el
// efectivo promedio y el grafico. Solo se ofrecen los rangos MEDIBLES: uno
// que pida mas historia de la que hay no se lista (para Schwab, cuya historia
// arranca el 17/08/2026, quedan YTD y "All" y los dos dicen desde cuando).
// Antes los cinco rangos de Schwab mostraban lo mismo sin explicar por que.
//
// TODA la cuenta la hace el Worker (`rendimiento_cuenta`, business/
// Rendimiento.js): la historia por cuenta no viaja al telefono, y la leccion
// del YTD del 9/09 es que calcule uno solo. Aca solo se dibuja. El indice es
// SPY con dividendos reinvertidos, la misma serie que el resto de la app
// desde el 15/09/2026 (lo dice `indice.nota`).
//
// CARGA DESPUES de paneles.js y ANTES de arranque.js. Lo llama showAccount
// (vistas.js) SIEMPRE dentro de una funcion, nunca al cargar; usa Chart
// (gagraf.js), buildChartOptions (graficos.js) y los formateadores de
// nucleo.js, que ya estan cargados cuando alguien abre una cuenta.
var rendDatos = null;        // la ultima respuesta del Worker
var rendCuenta = null;       // la clave de la cuenta cuyo pedido esta EN VUELO / a la vista
var rendRango = 'ytd';       // el rango elegido; YTD es el estandar
var rendAbierto = false;     // el desplegable: plegado al abrir una cuenta
var rendChartInstance = null;
var REND_RANGOS = [
  { key: '1m', label: '1M' },
  { key: 'ytd', label: 'YTD' },
  { key: '1a', label: '1Y' },
  { key: '5a', label: '5Y' },
  { key: 'origen', label: 'All' }
];

// IBKR, Schwab y, desde el 22/09/2026, Binance (pedido de Guzman: "lo de
// Binance tambien comparalo"). La cuenta de Binance ya estaba hecha en el
// Worker; sus flujos son los depositos que Guzman registra en la app (Binance
// no los informa). Antes de sumarla se verifico que su historia no esconde
// plata: valuando las cantidades de hoy con los precios de cada dia desde el
// 17/08, el valor calza con lo estampado — el +36 % de ese mes fue mercado.
// BTG e Itau no: el sueldo y el plazo fijo no se comparan contra un indice.
function rendEsCuenta(acc) {
  var k = String((acc && acc.key) || '');
  return k === 'IB' || k === 'CS' || k === 'BNB';
}

// Los rangos que se pueden medir con la historia que hay: los que no piden
// mas atras que el primer punto. YTD y "All" van siempre (YTD es el estandar
// y dice desde cuando si es parcial; All es la historia entera por definicion).
function rendRangosMedibles(r) {
  return REND_RANGOS.filter(function (rg) {
    var g = r && r.rangos && r.rangos[rg.key];
    if (!g) return false;
    if (rg.key === 'ytd' || rg.key === 'origen') return true;
    return !g.pocos && !g.parcial;
  });
}

// Al abrir una cuenta: muestra u oculta la tarjeta, la pliega, y pide los
// numeros. La respuesta de OTRA cuenta (abrir IBKR, volver, abrir Schwab
// antes de que conteste) se descarta: el mismo cuidado que accPedida en
// showAccount.
function mostrarRendimiento(acc) {
  var box = document.getElementById('accRend');
  if (!box) return;
  if (!rendEsCuenta(acc)) { box.hidden = true; rendCuenta = null; return; }
  box.hidden = false;
  rendCuenta = acc.key;
  rendAbierto = false;
  rendRango = 'ytd';
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

function rendPct(v, dec) {
  if (v === null || v === undefined || !isFinite(v)) return '&mdash;';
  return '<b class="' + (v >= 0 ? 'up' : 'down') + '">' + signoPct(Number(v), dec === undefined ? 1 : dec) + '</b>';
}
function rendUsdConSigno(v) {
  var n = Math.round(Number(v) || 0);
  return mask((n >= 0 ? '+' : '−') + 'US$ ' + Math.abs(n).toLocaleString('en-US'));
}
// "x% a year" solo cuando el Worker lo anualizo (rangos de un ano o mas: los
// cortos van crudos, como en PortfolioAnalyst).
function rendAnual(m) {
  if (!m || m.anualizado === null || m.anualizado === undefined) return '';
  return ' <span class="rendsub">' + signoPct(Number(m.anualizado), 1) + ' a year</span>';
}
// Año por año (22/09/2026, pedido de Guzman: "estos retornos que tuve
// anualmente deberian guardarse en alguna pagina"). Sin depositos contra el
// indice, en puntos. La cuenta la hace el Worker (aniosDe, Rendimiento.js) con
// la misma de los rangos: el año en curso es el YTD de arriba. Los años a
// medias (el primero, el actual) se dicen debajo, no en la celda: la columna
// del año no tiene ancho para una fecha en el telefono.
// titulo: undefined = el de la tarjeta; '' = sin titulo (la pagina Performance
// ya lo dice en la cabecera de cada tarjeta).
// En una tabla de AÑOS la fecha lleva el año y no la hora (fechaCortaMs da
// "30/12 12:00": se leia como un dato cualquiera del año en curso).
function rendFechaConAnio(ms) {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function rendTablaAnios(anios, idx, titulo) {
  if (!anios || !anios.length) return '';
  var t = (titulo === undefined) ? 'Year by year, without deposits' : titulo;
  var h = t ? '<p class="detlbl" style="margin-top:16px">' + esc(t) + '</p>' : '';
  h += '<table class="rendtabla"><thead><tr><th>Year</th><th>You</th><th>' + esc(idx) + '</th><th>vs</th></tr></thead><tbody>';
  var notas = [];
  anios.forEach(function (a) {
    var marca = (a.enCurso || a.parcial) ? '*' : '';
    if (a.enCurso) notas.push(a.anio + ' is year to date');
    else if (a.parcial) notas.push(a.anio + ' counts from ' + rendFechaConAnio(a.desde));
    var pp = (a.pp === null || a.pp === undefined) ? '&mdash;'
      : '<span class="rendpp ' + (a.pp >= 0 ? 'up' : 'down') + '">' + (a.pp >= 0 ? '+' : '−') + Math.abs(a.pp).toFixed(1) + ' pp</span>';
    h += '<tr><td>' + a.anio + marca + '</td><td>' + rendPct(a.twr) + '</td><td>' + rendPct(a.spy) + '</td><td>' + pp + '</td></tr>';
  });
  h += '</tbody></table>';
  if (notas.length) h += '<p class="capnota">* ' + esc(notas.join('; ')) + '.</p>';
  return h;
}
function rendEtiqueta(key) {
  for (var i = 0; i < REND_RANGOS.length; i++) if (REND_RANGOS[i].key === key) return REND_RANGOS[i].label;
  return key;
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
  var medibles = rendRangosMedibles(r);
  if (!medibles.some(function (rg) { return rg.key === rendRango; })) rendRango = 'ytd';
  var g = r.rangos && r.rangos[rendRango];
  var idx = (r.indice && r.indice.nombre) || 'S&P 500';
  var mp = g && g.spy && g.spy.mismaPlata;

  // La cabecera: que rango se esta mirando, y el desplegable.
  h += '<div class="rendcab"><span class="detlbl">' + esc(rendEtiqueta(rendRango)) + ' vs ' + esc(idx) + '</span>' +
    '<button type="button" class="expandbtn" id="rendToggle" title="' + (rendAbierto ? 'Less' : 'More') + '" aria-expanded="' + (rendAbierto ? 'true' : 'false') + '">' + (rendAbierto ? '&#9652;' : '&#9662;') + '</button></div>';

  if (!g || g.pocos) {
    h += '<p class="capnota">Not enough history in this range yet' +
      (g && g.desdeDisponible ? ' (it starts ' + esc(fechaCortaMs(g.desdeDisponible)) + ')' : '') + '.</p>';
  } else {
    // El titular: tus elecciones contra el indice, en puntos.
    var pp = (g.twr.pct !== null && g.spy && g.spy.pct !== null) ? g.twr.pct - g.spy.pct : null;
    h += '<p class="rendtitular">' + rendPct(g.twr.pct) + ' <span class="desc">you</span> &nbsp;vs&nbsp; ' +
      rendPct(g.spy && g.spy.pct) + ' <span class="desc">' + esc(idx) + '</span>' +
      (pp !== null ? ' <span class="rendpp ' + (pp >= 0 ? 'up' : 'down') + '">' + (pp >= 0 ? '+' : '−') + Math.abs(pp).toFixed(1) + ' pp</span>' : '') + '</p>';
    // La tabla minima: vos / el indice.
    h += '<table class="rendtabla"><thead><tr><th></th><th>You</th><th>' + esc(idx) + '</th></tr></thead><tbody>';
    h += '<tr><td>Without deposits</td><td>' + rendPct(g.twr.pct) + (rendAbierto ? rendAnual(g.twr) : '') + '</td><td>' + rendPct(g.spy && g.spy.pct) + (rendAbierto ? rendAnual(g.spy) : '') + '</td></tr>';
    h += '<tr><td>With your money</td><td>' + rendPct(g.mwr && g.mwr.pct) + (rendAbierto ? rendAnual(g.mwr) : '') + '</td><td>' + rendPct(mp && mp.mwr && mp.mwr.pct) + (rendAbierto ? rendAnual(mp && mp.mwr) : '') + '</td></tr>';
    h += '<tr><td>Same money, today</td><td>' + esc(mask(fmtUsdEnt(g.valor))) + '</td><td>' + (mp ? esc(mask(fmtUsdEnt(mp.valor))) : '&mdash;') + '</td></tr>';
    h += '<tr><td>Difference</td><td colspan="2"><b class="' + ((g.spy && g.spy.diferenciaUsd >= 0) ? 'up' : 'down') + '">' +
      (g.spy && g.spy.diferenciaUsd !== null ? esc(rendUsdConSigno(g.spy.diferenciaUsd)) : '&mdash;') + '</b></td></tr>';
    h += '</tbody></table>';
    var desdeTxt = 'Since ' + fechaCortaMs(g.desde) + (g.parcial ? ' (that is where the history starts)' : '') + '.';
    if (!rendAbierto) {
      h += '<p class="capnota">' + esc(desdeTxt) + '</p>';
    } else {
      // Lo desplegado: los rangos medibles, los flujos, el efectivo, el grafico.
      h += '<div class="rangebar" id="rendRangos" style="margin-top:12px">';
      medibles.forEach(function (rg) {
        h += '<button type="button" class="rangebtn' + (rg.key === rendRango ? ' active' : '') + '" data-rango="' + rg.key + '">' + rg.label + '</button>';
      });
      h += '</div>';
      h += '<div style="margin-top:10px">';
      h += '<div class="apostat"><span>Deposits</span><b>' + esc(fmtUsdEnt(g.depositos)) + '</b></div>';
      h += '<div class="apostat"><span>Withdrawals</span><b>' + esc(fmtUsdEnt(g.retiros)) + '</b></div>';
      h += '<div class="apostat"><span>Net</span><b>' + esc(fmtUsdEnt(g.neto)) + '</b></div>';
      if (g.efectivo) {
        h += '<div class="apostat"><span>Cash on average</span><b>' + esc(Number(g.efectivo.promedioPct).toFixed(1)) + '%' +
          (g.efectivo.dias < g.dias ? ' <span class="desc">since ' + esc(fechaCortaMs(g.efectivo.desde)) + '</span>' : '') + '</b></div>';
      }
      h += '</div>';
      h += '<div class="chartbox" style="margin-top:12px"><canvas id="rendChart"></canvas></div>';
      h += '<p class="rendleyenda"><span class="rendlin rendlin-cta"></span>your account <span class="rendlin rendlin-idx"></span>same money in ' + esc(idx) + '</p>';
      h += rendTablaAnios(r.anios, idx);
      // La lectura en una frase (U1) y lo que falta, dicho en la cara (U2).
      var nota = desdeTxt + ' From ' + fmtUsdEnt(g.base) + '.';
      if (r.indice && r.indice.nota) nota += ' Index: ' + r.indice.nota + '.';
      if (r.historia && r.historia.importado) nota += ' History before ' + fechaCortaMs(apISOaMs(r.historia.appDesde)) + ' comes from the broker’s own records.';
      nota += ' Ranges that ask for more history than there is are not offered.';
      h += '<p class="capnota">' + esc(nota) + '</p>';
    }
  }
  if (rendAbierto) (r.avisos || []).forEach(function (a) { h += '<p class="newsempty" style="font-size:12px">&#9888; ' + esc(a) + '</p>'; });
  body.innerHTML = h;
  // Sin manejadores inline (la CSP los bloquea): el desplegable y los rangos.
  var tg = document.getElementById('rendToggle');
  if (tg) tg.addEventListener('click', function () { rendAbierto = !rendAbierto; renderRendimiento(); });
  var btns = body.querySelectorAll('#rendRangos .rangebtn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener('click', function (ev) {
      rendRango = ev.currentTarget.getAttribute('data-rango');
      renderRendimiento();
    });
  }
  if (rendAbierto && g && !g.pocos) dibujarRendimiento(g);
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

// ---------- La pagina Performance (22/09/2026) ----------
// Pedido de Guzman: "la visualizacion total de mi cartera vs S&P 500, una
// pagina directa para ver todos los años, en el menu del costado"; y "lo
// importante es que quede bien armado para los proximos años". Arriba la
// cartera ENTERA, abajo cada broker que tiene historia, las dos con la MISMA
// tabla que la tarjeta de cada cuenta (rendTablaAnios).
//
// Por que aguanta los años que vienen sin tocar nada: la cartera sale de
// cierres_anuales (Worker, Anual.js), una fila por año que el cron pisa cada
// dia y que el 1 de enero queda quieta; el indice, de la tabla bench del
// mismo tramo. Las dos son permanentes y se respaldan todos los dias. Un año
// nuevo aparece solo como una fila mas.
var ranDatos = null;
var ranPidiendo = false;
function cargarRendAnual(forzar) {
  if (ranDatos && !forzar) renderRendAnual();
  if (ranPidiendo) return;
  ranPidiendo = true;
  google.script.run.withSuccessHandler(function (r) {
    ranPidiendo = false;
    ranDatos = r;
    renderRendAnual();
  }).withFailureHandler(function (err) {
    ranPidiendo = false;
    if (ranDatos) return;   // con datos ya pintados, un fallo de red no borra la pantalla
    var el = document.getElementById('ranCartera');
    if (el) el.innerHTML = '<p class="newsempty">' + esc(msgErr(err, 'Performance')) + '</p>';
  }).getRendimientoAnual(forzar ? { forzar: true } : {});
}
function renderRendAnual() {
  var elC = document.getElementById('ranCartera');
  var elA = document.getElementById('ranCuentas');
  if (!elC || !elA) return;
  var r = ranDatos;
  if (!r) return;
  if (!r.ok) { elC.innerHTML = '<p class="newsempty">' + esc(msgBackend(r)) + '</p>'; elA.innerHTML = ''; return; }
  var idx = (r.indice && r.indice.nombre) || 'S&P 500';
  var cartera = r.cartera || [];
  var h = '';
  if (!cartera.length) {
    h += '<p class="capnota">The first year closes on December 31: until then there is nothing to compare.</p>';
  } else {
    // El titular: el año mas nuevo, en puntos contra el indice.
    var a = cartera[0];
    var pp = (a.pp === null || a.pp === undefined) ? null : a.pp;
    h += '<p class="rendtitular">' + rendPct(a.twr) + ' <span class="desc">you in ' + a.anio + (a.enCurso ? ' so far' : '') + '</span> &nbsp;vs&nbsp; ' +
      rendPct(a.spy) + ' <span class="desc">' + esc(idx) + '</span>' +
      (pp !== null ? ' <span class="rendpp ' + (pp >= 0 ? 'up' : 'down') + '">' + (pp >= 0 ? '+' : '−') + Math.abs(pp).toFixed(1) + ' pp</span>' : '') + '</p>';
    h += rendTablaAnios(cartera, idx, '');
    var ultimo = cartera[cartera.length - 1];
    h += '<p class="capnota">All accounts, banks included, without deposits. The whole portfolio is measured from ' +
      esc(rendFechaConAnio(ultimo.desde)) + ', when the app started keeping it; a new year is added every January 1.' +
      (r.indice && r.indice.nota ? ' Index: ' + esc(r.indice.nota) + '.' : '') + '</p>';
  }
  (r.avisos || []).forEach(function (x) { h += '<p class="newsempty" style="font-size:12px">&#9888; ' + esc(x) + '</p>'; });
  elC.innerHTML = h;
  // Cada broker con historia propia, en su tarjeta.
  var hc = '';
  (r.cuentas || []).forEach(function (c) {
    hc += '<div class="card"><div class="cardtop"><h2>' + esc(nombrePlataforma(c.nombre)) + '</h2></div>';
    hc += rendTablaAnios(c.anios, idx, '');
    hc += '<p class="capnota">Since ' + esc(rendFechaConAnio(c.desde)) +
      (c.importado ? ', with the broker’s own records before the app' : '') + '. Without deposits, like the whole portfolio.</p></div>';
  });
  elA.innerHTML = hc;
}
(function () {
  var back = document.getElementById('ranBack');
  if (back) back.onclick = function () { setView('inicio'); };
  var ref = document.getElementById('ranRefresh');
  if (ref) ref.onclick = function () { cargarRendAnual(true); };
})();
