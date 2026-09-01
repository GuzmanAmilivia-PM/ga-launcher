// Deck deslizable, cache local, dividendos y aportes
// ---------- Torta: alternar por cuenta / por tipo ----------
// active-acento, no active-compra: este selector no es un compra/venta y
// usaba prestada la clase verde de Trades — salía SIEMPRE verde sin importar
// la paleta elegida (reporte de Guzmán, 26/08/2026, con captura).
document.getElementById('pieCuentaBtn').onclick = function () {
pieModo = 'cuenta';
this.classList.add('active-acento');
document.getElementById('pieTipoBtn').classList.remove('active-acento');
renderPortafolio();
};
document.getElementById('pieTipoBtn').onclick = function () {
pieModo = 'tipo';
this.classList.add('active-acento');
document.getElementById('pieCuentaBtn').classList.remove('active-acento');
renderPortafolio();
};

// ---------- Tarjeta deslizable: Evolución / Dividendos / Aportes ----------
var sweepIdx = 0, divCargado = false, apoCargado = false;
// La tarjeta mide lo que mide EL PANEL ACTIVO, no el mas alto de los tres.
// Los paneles van lado a lado (flex), asi que sin esto la tarjeta tomaba la
// altura del mas alto: apenas Dividendos se llenaba, la Evolucion quedaba con
// un vacio gigante abajo para siempre.
function ajustarAlturaDeck() {
var wrap = document.getElementById('sweepWrap');
var paneles = document.querySelectorAll('#sweepDeck .sweeppanel');
if (!wrap || !paneles.length || !paneles[sweepIdx]) return;
var alto = paneles[sweepIdx].offsetHeight;
if (alto > 0) wrap.style.height = alto + 'px';
}
function sweepGo(i) {
sweepIdx = Math.max(0, Math.min(2, i));
document.getElementById('sweepDeck').style.transform = 'translateX(-' + (sweepIdx * 100) + '%)';
document.querySelectorAll('.sweepdots .sdot').forEach(function (d, j) { d.classList.toggle('active', j === sweepIdx); });
if (sweepIdx === 1 && !divCargado) cargarDividendos(false);
if (sweepIdx === 2 && !apoCargado) cargarAportes();
ajustarAlturaDeck();
// El panel puede seguir creciendo mientras carga (spinner -> datos): se
// reajusta un toque despues por las dudas.
setTimeout(ajustarAlturaDeck, 350);
}
document.querySelectorAll('.sweepdots .sdot').forEach(function (d) {
d.addEventListener('click', function () { sweepGo(parseInt(d.getAttribute('data-sw'), 10)); });
});
// ¿El ultimo gesto sobre el carrusel fue un deslizamiento? Lo consulta quien
// tenga un onclick GRANDE adentro del deck. Antes no hacia falta: el unico
// control era un boton chico en un rincon. Desde que el area del grafico ES el
// control (v94), deslizar hacia Dividendos arrancando el dedo sobre el grafico
// puede llegar como clic y plegarlo de paso. Auditoria del 23/08/2026.
var huboSwipe = false;
(function () {
var wrap = document.getElementById('sweepWrap');
if (!wrap) return;
var x0 = null, y0 = null;
wrap.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
wrap.addEventListener('touchend', function (e) {
if (x0 === null) return;
var dx = e.changedTouches[0].clientX - x0;
var dy = e.changedTouches[0].clientY - y0;
x0 = null;
// El umbral para "esto fue un arrastre" es mas bajo que el del cambio de
// tarjeta a proposito: un dedo que se movio 20px no queria hacer clic,
// aunque no haya llegado a cambiar de panel.
if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
  huboSwipe = true;
  setTimeout(function () { huboSwipe = false; }, 400);
}
if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) sweepGo(sweepIdx + (dx < 0 ? 1 : -1));
}, { passive: true });
})();

// --- Modo escritorio: los tres paneles a la vista (31/08/2026) ------------
// En el telefono, Dividendos y Aportes se piden reciEn cuando el dedo llega
// a su panel (sweepGo). En pantalla ancha el carrusel se despliega por CSS y
// los tres se ven de una: sin ese gesto, dos de los tres se quedarian para
// siempre en "Swipe to load...". O sea que el desplegado visual y la carga
// tienen que viajar juntos, o la pantalla queda peor que antes.
//
// El umbral es el MISMO 1100px del @media, escrito una sola vez acA y
// consultado con matchMedia: dos numeros iguales en dos archivos distintos
// se despegan al primer retoque, y el sIntoma serIa justamente este —
// paneles visibles y vacIos.
var ESCRITORIO_MIN_PX = 1100;
function esEscritorio() {
  try { return window.matchMedia('(min-width: ' + ESCRITORIO_MIN_PX + 'px)').matches; }
  catch (e) { return false; }   // navegador sin matchMedia: se comporta como telefono
}
function cargarPanelesDeEscritorio() {
  if (!esEscritorio()) return;
  if (!divCargado && typeof cargarDividendos === 'function') cargarDividendos(false);
  if (!apoCargado && typeof cargarAportes === 'function') cargarAportes();
  // La asignacion (D4): en el telefono se pide al entrar a Portfolio; en el
  // tablero esta a la vista desde el arranque, asi que hay que pedirla.
  if (typeof anaCargado !== 'undefined' && !anaCargado && typeof cargarAnalisis === 'function') {
    cargarAnalisis(false);
  }
}
// Al arrancar, y tambien si la ventana se agranda despues (pasar de una
// ventana angosta a pantalla completa es lo mismo que llegar deslizando).
(function () {
  try {
    var mq = window.matchMedia('(min-width: ' + ESCRITORIO_MIN_PX + 'px)');
    var alCambiar = function () { cargarPanelesDeEscritorio(); };
    if (mq.addEventListener) mq.addEventListener('change', alCambiar);
    else if (mq.addListener) mq.addListener(alCambiar);   // Safari viejo
  } catch (e) {}
})();

var MESES_CORTOS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Cache local de los paneles lentos (dividendos y aportes): consultar los
// brokers tarda varios segundos, asi que se pinta al instante lo ultimo visto
// y se refresca por atras. Mismo criterio que pintarCache() en el arranque.
// GA_CACHES: TODAS las claves de cache local con datos del portafolio. El
// borrado de emergencia (seguridad.js) la recorre; una clave nueva que no se
// anote aca queda viva despues de "Olvide mi clave".
var GA_CACHES = ['ga_cache_data', 'ga_cache_div', 'ga_cache_apo', 'ga_cache_ops', 'ga_cache_ana', 'ga_cache_wl'];
function cacheLeer(clave) {
try {
var j = JSON.parse(localStorage.getItem(clave) || 'null');
return (j && j.data) ? j : null;
} catch (e) { return null; }
}
function cacheGuardar(clave, data) {
try { localStorage.setItem(clave, JSON.stringify({ t: Date.now(), data: data })); } catch (e) {}
}
function marcaActualizando(id, cuando, cola) {
var el = document.getElementById(id);
if (!el) return;
el.innerHTML = '<p class="newsempty">Data from ' + fechaCortaMs(cuando) +
' &middot; ' + (cola || 'updating...') + '</p>';
el.style.display = '';
}
function limpiarMarca(id) {
var el = document.getElementById(id);
if (el) { el.style.display = 'none'; el.innerHTML = ''; }
}
/**
 * Panel que se pinta desde el cache local y se refresca por atras.
 * Dividendos y aportes eran la misma funcion copiada, y ya habian divergido
 * (dividendos respetaba el boton de refrescar y aportes no).
 */
function cargarConCache(cfg) {
var cache = cfg.forzar ? null : cacheLeer(cfg.clave);
if (cache) {
cfg.render(cache.data);
marcaActualizando(cfg.avisoId, cache.t);
} else {
if (cfg.limpiar) cfg.limpiar();
document.getElementById(cfg.bodyId).innerHTML = '<p class="loadingtxt">' + cfg.cargando + '</p>';
}
ajustarAlturaDeck();
cfg.pedir(function (r) {
limpiarMarca(cfg.avisoId);
if (r && r.ok) cacheGuardar(cfg.clave, r);
cfg.render(r);
// El panel cambio de altura (spinner -> tabla): la tarjeta lo sigue.
ajustarAlturaDeck();
}, function (err) {
limpiarMarca(cfg.avisoId);
// Con datos ya pintados, un fallo de red no borra la pantalla.
if (cache) { marcaActualizando(cfg.avisoId, cache.t, 'could not update'); return; }
if (cfg.alFallar) cfg.alFallar();
document.getElementById(cfg.bodyId).innerHTML =
'<p class="newsempty">' + esc(msgErr(err, 'This screen')) + '</p>';
ajustarAlturaDeck();
});
}

// ---------- R1: agregados que llegan con el dashboard ----------
// El payload completo puede traer `extras` (dividendos, aportes y analisis ya
// calculados, si el cache del servidor estaba caliente). Se guardan en los
// caches locales, se pintan los paneles aunque esten fuera de pantalla y se
// marcan como cargados: el primer deslizado a Dividendos o Aportes y la
// tarjeta de analisis aparecen SIN su propia llamada al backend. Si extras no
// vino (cache frio o backend viejo), cada panel se pide aparte como siempre.
// Solo se acepta un payload sano (ok:true): un error no pisa datos buenos.
function aplicarExtras(ex) {
try {
if (ex.dividendos && ex.dividendos.ok) {
cacheGuardar('ga_cache_div', ex.dividendos);
renderDividendos(ex.dividendos);
limpiarMarca('divCacheAviso');
divCargado = true;
}
if (ex.aportes && ex.aportes.ok) {
cacheGuardar('ga_cache_apo', ex.aportes);
renderAportes(ex.aportes);
limpiarMarca('apoCacheAviso');
apoCargado = true;
}
if (ex.analisis && ex.analisis.ok) {
cacheGuardar('ga_cache_ana', ex.analisis);
// Las MISMAS tres pantallas que pinta cargarAnalisis, no solo la tarjeta:
// antes esto marcaba anaCargado sin setear anaUltima ni pintar el detalle,
// y entrar a Analysis en el telefono quedaba con los spinners del HTML para
// siempre — cargarAnalisisDetalle veia anaCargado=true (no pide) y
// anaUltima=null (no pinta). Auditoria 31/08/2026.
anaUltima = ex.analisis;
renderAnalisis(ex.analisis);
renderAnalisisDetalle(ex.analisis);
renderAsignacionTablero(ex.analisis);
limpiarMarca('anaCacheAviso');
anaCargado = true;
}
ajustarAlturaDeck();
} catch (e) { try { console.error('aplicarExtras:', e); } catch (e2) {} }
}

var divChartInstance = null, divDatos = null;
function cargarDividendos(forzar) {
divCargado = true;
cargarConCache({
clave: 'ga_cache_div',
avisoId: 'divCacheAviso',
bodyId: 'divBody',
cargando: 'Reading dividends from your brokers...',
forzar: !!forzar,
limpiar: function () {
['divStats', 'divChartBox', 'divHint'].forEach(function (id) { document.getElementById(id).style.display = 'none'; });
document.getElementById('divDetalle').innerHTML = '';
document.getElementById('divDetalle').removeAttribute('data-mes');
},
render: renderDividendos,
alFallar: function () { divCargado = false; },
pedir: function (ok, fail) {
google.script.run.withSuccessHandler(ok).withFailureHandler(fail).getDividendos({ forzar: !!forzar });
}
});
}
// Vista estilo resumen de ingresos del broker: estimado anual grande,
// promedio mensual con su línea, y barras por mes (lleno = cobrado,
// gris = a cobrar). Tocar una barra abre el detalle del mes.
function renderDividendos(r) {
var body = document.getElementById('divBody');
if (!r || !r.ok) {
divCargado = false;
body.innerHTML = '<p class="newsempty">' + esc(msgBackend(r)) + '</p>';
return;
}
divDatos = r;
document.getElementById('divAnio').textContent = r.anio;
var totalAnio = Math.round(((r.totalCobrado || 0) + (r.totalProximo || 0)) * 100) / 100;
var prom = Math.round(totalAnio / 12 * 100) / 100;
document.getElementById('divStats').style.display = '';
document.getElementById('divTotalAnio').textContent = fmtUsd(totalAnio);
document.getElementById('divPromedio').innerHTML =
'Monthly average: <b>' + esc(fmtUsd(prom)) + '</b><br>' +
'Received: ' + esc(fmtUsd(r.totalCobrado)) + ' &middot; Upcoming: ' + esc(fmtUsd(r.totalProximo));
document.getElementById('divChartBox').style.display = '';
document.getElementById('divHint').style.display = '';
// La proyección se pide recién acá: es una segunda llamada al backend y no
// tiene sentido gastarla si el panel de dividendos ni siquiera cargó.
cargarProyeccion();
var cobrados = (r.meses || []).map(function (m) { return m.cobrado || 0; });
var proximos = (r.meses || []).map(function (m) { return m.proximo || 0; });
var t = temaChart();
if (divChartInstance) divChartInstance.destroy();
divChartInstance = new Chart(document.getElementById('divChart'), {
type: 'bar',
data: {
labels: MESES_CORTOS,
datasets: [
{ label: 'Received', data: cobrados, backgroundColor: '#5b8def', stack: 'd', borderRadius: 3 },
{ label: 'Upcoming', data: proximos, backgroundColor: 'rgba(144,160,184,.45)', stack: 'd', borderRadius: 3 },
{ label: 'Average', type: 'line', data: MESES_CORTOS.map(function () { return prom; }), borderColor: '#38bdf8', borderWidth: 1.5, pointRadius: 0 }
]
},
options: {
responsive: true,
maintainAspectRatio: false,
onClick: function (evt, els) { if (els && els.length) mostrarDetalleDiv(els[0].index + 1); },
plugins: { legend: { display: false } },
scales: {
x: { stacked: true, grid: { display: false }, ticks: { color: t.tick, font: { size: 10 } } },
y: { stacked: true, grid: { color: t.grid }, ticks: { color: t.tick, font: { size: 10 }, callback: function (v) { return montosOcultos ? '' : v; } } }
}
}
});
var html = '';
(r.avisos || []).forEach(function (a) { html += '<p class="newsempty" style="font-size:12px">&#9888; ' + esc(a) + '</p>'; });
body.innerHTML = html;
renderDivModal(); // si la ventana ampliada está abierta, se actualiza sola
}
function mostrarDetalleDiv(mes) {
var box = document.getElementById('divDetalle');
if (box.getAttribute('data-mes') === String(mes)) {
box.innerHTML = '';
box.removeAttribute('data-mes');
return;
}
box.setAttribute('data-mes', String(mes));
var det = (divDatos && divDatos.detalle && divDatos.detalle[mes]) || [];
var filas = det.map(function (d) {
var etiqueta = d.estado === 'proximo' ? (d.estimado ? ' <span class="desc">~ estimated</span>' : ' <span class="desc">upcoming</span>') : '';
// nombrePlataforma como en el modal: antes "Interactive Brokers" no se
// acortaba a IBKR en el panel chico (inconsistencia cazada en E6).
return esc(nombrePlataforma(d.broker)) + ' &middot; <span class="sym">' + esc(d.symbol || 'CASH') + '</span> &middot; ' + esc(fmtUsd(d.monto)) + etiqueta;
}).join('<br>');
box.innerHTML = '<div class="divdetbox"><b>' + MESES_CORTOS[mes - 1] + ' ' + esc((divDatos && divDatos.anio) || '') + '</b><br>' + (filas || '<span class="desc">No activity that month</span>') + '</div>';
ajustarAlturaDeck();
}
document.getElementById('divRefreshBtn').onclick = function () { cargarDividendos(true); };

// ---------- D5: ingreso proyectado a 12 meses ----------
// Va DEBAJO del año calendario y separado por una línea a propósito: arriba
// está lo cobrado y por cobrar de ESTE año; acá, lo que viene. Son dos
// números parecidos que responden preguntas distintas.
var proyCargado = false;
function cargarProyeccion() {
if (proyCargado) return;
proyCargado = true;
google.script.run
.withSuccessHandler(renderProyeccion)
.withFailureHandler(function () {
// Sin proyección el panel de dividendos sigue completo, así que el
// bloque se esconde en vez de gritar un error por algo secundario.
proyCargado = false;
var el = document.getElementById('proyBloque');
if (el) el.style.display = 'none';
})
.getDividendosProyectados({});
}
// El periodo elegido y si la lista por activo esta desplegada. Los dos viven
// afuera del render porque sobreviven a un re-dibujo (pedido de Guzman,
// 01/09/2026: "deberia ser algo que despliegue si quiero saber mas, no de una
// y por defecto deberia estar lo del proximo mes y poder elegir hasta fin de
// ano"). Arranca en 'mes' y con la lista PLEGADA.
var proyPeriodo = 'mes';       // 'mes' | 'anio'
var proyAbierto = false;
var proyUltimo = null;

// Los meses que abarca el periodo, dentro del ano calendario que conoce
// divDatos. Devuelve null cuando el periodo cae FUERA de esa ventana, que es
// el caso real de diciembre: "el proximo mes" es enero del ano que viene y de
// eso no tenemos ni un dato. Un cero ahi diria "no cobras nada", que es una
// afirmacion y no un dato que falta.
function proyRango(periodo) {
  var mesActual = new Date().getMonth() + 1;   // zona del dispositivo, como el resto del panel
  var desde = mesActual + 1;
  if (desde > 12) return null;                 // diciembre: el proximo mes ya es otro ano
  return { desde: desde, hasta: (periodo === 'mes') ? desde : 12 };
}

// Lo que se cobra en ese rango, por simbolo. Sale de `divDatos.detalle`, el
// MISMO dato que pinta las barras grises del grafico de arriba y el detalle
// que se abre al tocar una barra — no de una segunda cuenta paralela que
// podria discrepar con lo que ya se ve en pantalla.
function proyDelRango(rango) {
  var out = { total: 0, porSimbolo: [], hayEstimado: false, pagos: 0 };
  if (!rango || !divDatos || !divDatos.detalle) return out;
  var acum = {};
  for (var m = rango.desde; m <= rango.hasta; m++) {
    (divDatos.detalle[m] || []).forEach(function (d) {
      if (d.estado !== 'proximo') return;      // lo ya cobrado no es "lo que viene"
      var s = String(d.symbol || 'CASH').toUpperCase();
      // Un mismo simbolo puede venir de dos brokers: se suman, no se listan
      // dos veces (la fila dice el activo, no la cuenta).
      if (!acum[s]) acum[s] = { symbol: s, monto: 0, estimado: false };
      acum[s].monto += Number(d.monto) || 0;
      if (d.estimado) { acum[s].estimado = true; out.hayEstimado = true; }
      out.total += Number(d.monto) || 0;
      out.pagos++;
    });
  }
  out.total = Math.round(out.total * 100) / 100;
  out.porSimbolo = Object.keys(acum).map(function (k) { return acum[k]; })
    .sort(function (a, b) { return b.monto - a.monto; });
  return out;
}

function renderProyeccion(r) {
if (r) proyUltimo = r;
r = proyUltimo;
var el = document.getElementById('proyBloque');
if (!el) return;
if (!r || !r.ok || !r.lista || !r.lista.length) { el.style.display = 'none'; return; }

// Nombre por simbolo: `detalle` trae el monto pero no el nombre, y la lista
// de la proyeccion trae el nombre. Se cruzan por simbolo.
var nombreDe = {};
r.lista.forEach(function (x) { nombreDe[String(x.symbol).toUpperCase()] = x.nombre || ''; });

var rango = proyRango(proyPeriodo);
var dat = proyDelRango(rango);
var etiquetaPeriodo = proyPeriodo === 'mes'
  ? (rango ? MESES_CORTOS[rango.desde - 1] : '')
  : (rango ? MESES_CORTOS[rango.desde - 1] + '&ndash;' + MESES_CORTOS[11] : '');

var h = '<div class="proybox">';
h += '<p class="lbl">Upcoming income</p>';
h += '<div class="proyper">' +
  '<button type="button" class="tipobtn' + (proyPeriodo === 'mes' ? ' active-acento' : '') + '" data-proyper="mes">Next month</button>' +
  '<button type="button" class="tipobtn' + (proyPeriodo === 'anio' ? ' active-acento' : '') + '" data-proyper="anio">Rest of year</button>' +
  '</div>';

if (!rango) {
  // Diciembre. Se dice, no se pinta un cero.
  h += '<p class="proyvacio">Next month falls in ' + ((new Date().getFullYear()) + 1) +
    ', and the schedule only runs to the end of ' + esc(divDatos && divDatos.anio ? divDatos.anio : 'this year') + '.</p>';
} else {
  h += '<div class="proyfila"><span class="proybig">' + esc(fmtUsd(dat.total)) + '</span>' +
    '<span class="proyyield">' + etiquetaPeriodo +
    (dat.pagos ? ' &middot; ' + dat.pagos + ' payment' + (dat.pagos === 1 ? '' : 's') : '') +
    '</span></div>';
  if (!dat.pagos) {
    h += '<p class="proyvacio">No payments scheduled for this period.</p>';
  }
}

// El ritmo anual queda como linea CHICA y aparte (decision de Guzman). Es el
// unico que da el rendimiento sobre la cartera, y se calcula con OTRO metodo
// —las tasas anunciadas— asi que puede no coincidir con la suma de los meses
// de arriba. Por eso dice de donde sale en vez de quedar como un tercer
// numero suelto que se lee como si fuera la misma cuenta.
h += '<p class="proyrate">Annual run-rate: <b>' + esc(fmtUsd(r.anual)) + '</b> &middot; ' +
  esc(fmtUsd(r.mensual)) + '/mo' +
  // anaPct solo entiende 0 o 1 decimal: con 0 el 0,70% de la cartera se
  // redondearia a "1%", que es otra cosa.
  (typeof r.yieldCartera === 'number' ? ' &middot; ' + esc(anaPct(r.yieldCartera / 100, 1)) + ' of portfolio' : '') +
  '</p>';

// La lista por activo, PLEGADA por defecto. Es un <button> de verdad (no un
// div con onclick) para que llegue por teclado y lo anuncie un lector de
// pantalla, y lleva aria-expanded como el resto de los desplegables.
if (rango && dat.porSimbolo.length) {
  h += '<button type="button" class="proytoggle" id="proyToggle" aria-expanded="' + (proyAbierto ? 'true' : 'false') + '">' +
    '<span class="proyflecha">' + (proyAbierto ? '&#9662;' : '&#9656;') + '</span> Per asset' +
    '<span class="proycuenta">' + dat.porSimbolo.length + '</span></button>';
  h += '<div class="proylista"' + (proyAbierto ? '' : ' style="display:none"') + '>';
  dat.porSimbolo.forEach(function (x) {
    h += '<div class="proyrow">' +
      '<span class="psym">' + esc(x.symbol) + (x.estimado ? '<span class="pparcial">~</span>' : '') + '</span>' +
      '<span class="pnom">' + esc(nombreDe[x.symbol] || '') + '</span>' +
      '<span class="pmonto">' + esc(fmtUsd(x.monto)) + '</span>' +
      '</div>';
  });
  h += '</div>';
}

// Las cosas que hacen honesto a los números de arriba. Ninguna se omite
// cuando aplica: sin ellas la proyección se lee como una promesa exacta.
var notas = [];
// El "~" del periodo va PRIMERO porque explica el numero grande, que es el
// que Guzman mira. Las de abajo hablan del ritmo anual, que ahora es la
// linea chica.
if (dat.hayEstimado) {
notas.push('~ Estimated from each position’s payment cadence, not an announced date.');
}
// El corte va casi pegado a 1 y no en 0,95: la cartera real da exactamente
// 0,95, y con el umbral en 0,95 un hueco verdadero del 5% quedaba mudo. Lo
// que se quiere callar es el ruido de redondeo, no un veinteavo de la cartera.
if (typeof r.cobertura === 'number' && r.cobertura < 0.99) {
notas.push('The run-rate covers ' + esc(anaPct(r.cobertura, 0)) + ' of your stocks and ETFs.');
}
if (r.pctAnunciado > 0) {
notas.push(esc(anaPct(r.pctAnunciado / 100, 0)) + ' of it comes from announced rates, before withholding tax; ' +
  'the rest is what these positions actually paid you over the last 12 months.');
} else {
notas.push('It is based on what these positions actually paid you over the last 12 months.');
}
h += '<p class="proynota">' + notas.join(' ') + '</p>';

h += '</div>';
el.innerHTML = h;
el.style.display = '';

// Los manejadores se enganchan desde JS, nunca con onclick inline: la
// politica de contenido los bloquea y quedarian como codigo muerto que falla
// en silencio (regla dura de CLAUDE.md, ya pasó con el respaldo de los logos).
var botones = el.querySelectorAll('[data-proyper]');
for (var i = 0; i < botones.length; i++) {
botones[i].addEventListener('click', function () {
  var p = this.getAttribute('data-proyper');
  if (p === proyPeriodo) return;
  proyPeriodo = p;
  renderProyeccion();          // sin argumento: reusa proyUltimo
});
}
var tog = document.getElementById('proyToggle');
if (tog) tog.addEventListener('click', function () { proyAbierto = !proyAbierto; renderProyeccion(); });

if (typeof ajustarAlturaDeck === 'function') ajustarAlturaDeck();
}

// ---------- Dividendos ampliados: cuánto viene de cada app ----------
var divChartBigInstance = null;
function abrirDivModal() {
document.getElementById('divModal').style.display = 'flex';
if (!divDatos && !divCargado) cargarDividendos(false);
renderDivModal();
}
function cerrarDivModal() {
document.getElementById('divModal').style.display = 'none';
document.getElementById('divModalDetalle').innerHTML = '';
document.getElementById('divModalDetalle').removeAttribute('data-mes');
}
function renderDivModal() {
if (document.getElementById('divModal').style.display === 'none') return;
var brokersBox = document.getElementById('divModalBrokers');
if (!divDatos) { brokersBox.innerHTML = '<p class="loadingtxt">Reading dividends...</p>'; return; }
var r = divDatos;
document.getElementById('divModalAnio').textContent = r.anio;
var totalAnio = Math.round(((r.totalCobrado || 0) + (r.totalProximo || 0)) * 100) / 100;
document.getElementById('divModalTotales').innerHTML =
'Estimated this year: <b>' + esc(fmtUsd(totalAnio)) + '</b> &middot; Received: ' + esc(fmtUsd(r.totalCobrado)) + ' &middot; Upcoming: ' + esc(fmtUsd(r.totalProximo));
var brokers = Object.keys(r.porBroker || {});
brokersBox.innerHTML = brokers.length ? brokers.map(function (b, i) {
var pb = r.porBroker[b];
var tot = Math.round((pb.cobrado + pb.proximo) * 100) / 100;
return '<div class="apostat"><span><span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:7px;background:' + coloresPie()[i % PIE_COLORS.length] + '"></span>' + esc(nombrePlataforma(b)) + '<span class="desc" style="margin-left:8px">received ' + esc(fmtUsd(pb.cobrado)) + ' &middot; upcoming ' + esc(fmtUsd(pb.proximo)) + '</span></span><b>' + esc(fmtUsd(tot)) + '</b></div>';
}).join('') : '<p class="newsempty">No data by broker yet.</p>';
var t = temaChart();
if (divChartBigInstance) divChartBigInstance.destroy();
divChartBigInstance = new Chart(document.getElementById('divChartBig'), {
type: 'bar',
data: {
labels: MESES_CORTOS,
datasets: brokers.map(function (b, i) {
var pb = r.porBroker[b];
return {
label: nombrePlataforma(b),
data: pb.meses.map(function (mm) { return Math.round((mm.cobrado + mm.proximo) * 100) / 100; }),
backgroundColor: coloresPie()[i % PIE_COLORS.length],
stack: 'b',
borderRadius: 3
};
})
},
options: {
responsive: true,
maintainAspectRatio: false,
onClick: function (evt, els) { if (els && els.length) mostrarDetalleDivModal(els[0].index + 1); },
plugins: { legend: { display: true, labels: { color: t.tick, boxWidth: 10, font: { size: 11 } } } },
scales: {
x: { stacked: true, grid: { display: false }, ticks: { color: t.tick, font: { size: 10 } } },
y: { stacked: true, grid: { color: t.grid }, ticks: { color: t.tick, font: { size: 10 }, callback: function (v) { return montosOcultos ? '' : v; } } }
}
}
});
}
function mostrarDetalleDivModal(mes) {
var box = document.getElementById('divModalDetalle');
if (box.getAttribute('data-mes') === String(mes)) {
box.innerHTML = '';
box.removeAttribute('data-mes');
return;
}
box.setAttribute('data-mes', String(mes));
var det = (divDatos && divDatos.detalle && divDatos.detalle[mes]) || [];
var filas = det.map(function (d) {
var etiqueta = d.estado === 'proximo' ? (d.estimado ? ' <span class="desc">~ estimated</span>' : ' <span class="desc">upcoming</span>') : '';
return esc(nombrePlataforma(d.broker)) + ' &middot; <span class="sym">' + esc(d.symbol || 'CASH') + '</span> &middot; ' + esc(fmtUsd(d.monto)) + etiqueta;
}).join('<br>');
box.innerHTML = '<div class="divdetbox"><b>' + MESES_CORTOS[mes - 1] + ' ' + esc((divDatos && divDatos.anio) || '') + '</b><br>' + (filas || '<span class="desc">No activity that month</span>') + '</div>';
}
document.getElementById('divExpandBtn').onclick = abrirDivModal;
document.getElementById('divModalClose').onclick = cerrarDivModal;

function cargarAportes(forzar) {
apoCargado = true;
cargarConCache({
clave: 'ga_cache_apo',
avisoId: 'apoCacheAviso',
bodyId: 'apoBody',
cargando: 'Calculating this year\u2019s contributions...',
forzar: !!forzar,
render: renderAportes,
alFallar: function () { apoCargado = false; },
pedir: function (ok, fail) {
google.script.run.withSuccessHandler(ok).withFailureHandler(fail).getAportes();
}
});
}
function renderAportes(r) {
var body = document.getElementById('apoBody');
if (!r || !r.ok) {
apoCargado = false;
body.innerHTML = '<p class="newsempty">' + esc(msgBackend(r)) + '</p>';
return;
}
document.getElementById('apoAnio').textContent = r.anio;
// La lista de aportes queda guardada en graficos.js porque la comparacion
// del grupo (htmlComparacion -> comparacionGrupo) la necesita mas abajo.
try { aplicarAportes(r); } catch (e) {}
// Y la tarjeta "Este año vs el mercado" (Portafolio) se repinta: hasta que los
// aportes no llegan NO se dibuja, porque sin los flujos el numero seria el
// cambio bruto del patrimonio. Si ya estabas parado en Portafolio, aparece
// sola en cuanto llegan.
try { if (typeof renderAnual === 'function') renderAnual(); } catch (e) {}
var html = '';
html += '<div class="apostat"><span>Went into your apps</span><b>' + esc(fmtUsdEnt(r.aportes)) + '</b></div>';
html += '<div class="apostat"><span>Came out of your apps</span><b>' + esc(fmtUsdEnt(r.retiros)) + '</b></div>';
html += '<div class="apostat"><span>Net this year</span><b>' + esc(fmtUsdEnt(r.neto)) + '</b></div>';
// OJO — ac&aacute; NO va "rendimiento = total &minus; inicio &minus; neto". Ese
// numero se mostro y era FALSO (reporte de Guzman, 17/08/2026): una
// transferencia de Itau/BTG (que estan DENTRO del total) hacia IBKR cuenta
// como deposito para el broker sin que el patrimonio haya cambiado — la plata
// solo se mudo de bolsillo — y cada transferencia interna restaba rendimiento
// de mentira, hasta dar "perdidas" en un a&ntilde;o ganador. El rendimiento
// real vive en htmlComparacion(): solo las apps, contra sus propios aportes.
html += htmlComparacion();
(r.avisos || []).forEach(function (a) { html += '<p class="newsempty" style="font-size:12px">&#9888; ' + esc(a) + '</p>'; });
body.innerHTML = html;
}

/**
 * Tu porcentaje contra el del S&P 500, sobre las cuentas cuyos aportes se
 * conocen de verdad. Vive acá y no en el gráfico de Evolución porque el
 * patrimonio TOTAL incluye Itaú y BTG, cuyos aportes no están cargados: ahí el
 * rendimiento salía inflado (17/08/2026, reporte de Guzmán).
 * La cuenta la hace comparacionGrupo() en graficos.js; acá solo se pinta.
 */
function htmlComparacion() {
var c;
try { c = comparacionGrupo(); } catch (e) { return ''; }
if (!c) return '';
var h = '<p class="lbl" style="margin-top:14px">' + esc(c.nombre || 'Accounts with known contributions') + '</p>';
if (c.pocos) {
// Un guion sin explicacion no sirve: hay que decir que esto recien arranca.
h += '<p class="capnota">Return is measured only over your investment apps (banks don\u2019t earn a return, they\u2019re capital), and that history started being saved today. With one more day the first number will appear.</p>';
return h;
}
function pct(v, esNum) {
if (v === null || !isFinite(v)) return '<p class="capval">&mdash;</p>';
return '<p class="capval ' + (v >= 0 ? 'up' : 'down') + '">' + signoPct(v, 1) + '</p>';
}
// El rendimiento en plata: lo que las apps valen hoy menos su capital (el
// valor con el que arrancó la medición más lo que entró después).
var rendUsd = Math.round(c.valor - c.capital);
h += '<div class="apostat"><span>Return</span><b class="' + (rendUsd >= 0 ? 'up' : 'down') + '">' + esc(mask((rendUsd >= 0 ? '+' : '') + 'US$ ' + rendUsd.toLocaleString('en-US'))) + '</b></div>';
h += '<div class="caprow">';
h += '<div><p class="lbl">Returned</p>' + pct(c.pct) + '</div>';
h += '<div><p class="lbl">The portfolio</p>' + pct(c.twrPct) + '</div>';
h += '<div><p class="lbl">' + esc(c.idxNombre || 'Index') + '</p>' + pct(c.idxPct) + '</div>';
h += '</div>';
h += '<p class="capnota">Since ' + fechaCortaMs(c.desde) + ', over ' +
esc(fmtUsdEnt(c.capital)) + ' of capital. \u201cReturned\u201d is YOUR result (your money, your contribution dates); \u201cthe portfolio\u201d is how the investments performed without the effect of that timing. The banks (Ita\u00fa, BTG) are not included: they don\u2019t earn a return, and moving money from them into the apps counts as a contribution, not a gain.' +
(c.idxPct !== null ? ' The index doesn\u2019t pay dividends and your accounts do.' : '') + '</p>';
return h;
}

// Sincronización automática: al abrir la app (y al volver a ella) lee Binance
// en silencio y aplica solo los cambios seguros. Con >=2 posiciones "cerradas"
// (probable billetera Earn fuera de la vista de la clave) NO aplica y avisa.
// Cualquier fallo es silencioso: queda siempre el camino manual en view-bnb.
var BNB_AUTO_MIN_MS = 30 * 60 * 1000;
function avisoInicio(msg, esOk) {
var el = document.getElementById('autoAviso');
if (!el) return;
el.innerHTML = '<div class="tmsg ' + (esOk ? 'ok' : 'err') + '">' + msg + '</div>';
el.style.display = '';
if (esOk) setTimeout(function () { el.style.display = 'none'; el.innerHTML = ''; }, 8000);
}
