// Ojito de privacidad, carga de datos, poll de 60 s
// ---------- Ojito de privacidad ----------
document.getElementById('eyeBtn').onclick = function () {
montosOcultos = !montosOcultos;
try { localStorage.setItem('ga_montos_ocultos', montosOcultos ? '1' : '0'); } catch (e) {}
pintarOjo();
if (lastData) render(lastData);
if (lastAcc && lastAccData) renderAccount(lastAcc, lastAccData);
if (lastOps) renderOperaciones(lastOps);
};
pintarOjo();

// ---------- Carga de datos ----------
buildRangeBar('rangeBar');
buildRangeBar('rangeBarBig');
buildTradeForm();
buildCashForm();
// Pintado instantáneo: al abrir se muestran los últimos datos vistos
// (guardados en este dispositivo) y el refresco real corre por atrás.
function pintarCache() {
  var c = cacheLeer('ga_cache_data');
  if (!c || !c.data.cuentas) return false;
  render(c.data);
  pintarBadges('cache');
  return true;
}
if (getApiToken()) { pintarCache(); loadData(); } else { mostrarLock(); }
function render(data) {
hideSplash();
  try {
lastData = data;
animarTotal(document.getElementById('total'), data.total);
document.getElementById('liquidezVal').textContent = fmt(data.liquidez);
document.getElementById('liquidezPct').textContent = (data.liquidezPct ? (data.liquidezPct * 100).toFixed(2) : '0') + '%';
var listEl = document.getElementById('cuentasList');
listEl.innerHTML = '';
data.cuentas.forEach(function (c) {
var acc = accountByName(c.nombre);
var row = document.createElement('div');
row.className = 'row' + (acc ? ' clickable' : '');
row.innerHTML = '<span>' + esc(nombrePlataforma(c.nombre)) + '</span><span>' + fmt(c.valor) + (acc ? '<span class="chev">&rsaquo;</span>' : '') + '</span>';
if (acc) row.onclick = function () { showAccount(acc, 'inicio'); };
listEl.appendChild(row);
});
document.getElementById('cashTotal').textContent = fmt(data.liquidez);
var cashListEl = document.getElementById('cashList');
cashListEl.innerHTML = '';
data.cuentas.forEach(function (c) {
var row = document.createElement('div');
row.className = 'row';
row.innerHTML = '<span>' + esc(nombrePlataforma(c.nombre)) + '</span><span>' + fmt(c.liquido) + '</span>';
cashListEl.appendChild(row);
});
buildCashForm(data.cuentas);
// Avisos de la sincronizacion automatica de las 8:00: como corre sola y se
// traga los errores, sin esto un broker podia quedar dias sin sincronizar
// y los datos se veian normales.
var sa = document.getElementById('syncAviso');
if (sa) {
var avs = data.avisosSync || [];
if (avs.length) {
sa.innerHTML = avs.map(function (m) { return '<div class="tmsg err">&#9888; ' + esc(m) + '</div>'; }).join('');
sa.style.display = '';
} else {
sa.style.display = 'none';
sa.innerHTML = '';
}
}
fullSerie = data.serie;
currentTotal = data.total;
// El grafico va aparte: si Chart.js no cargo (o falla), antes se llevaba
// puesto todo lo que venia despues — posiciones, precios y el auto-sync de
// Binance quedaban sin pintar. Ahora falla solo el grafico.
try {
drawLineChart(filterSerie(currentRangeDias));
updateRangePct();
// El capital aportado (la linea de "lo que pusiste") se pide aparte y llega
// despues: consultar los brokers tarda y no puede frenar el arranque. Pinta
// del cache local al instante si ya lo vio alguna vez.
cargarAportesGrafico();
} catch (eChart) {
var cb = document.querySelector('.chartbox');
if (cb) cb.innerHTML = '<p class="newsempty">No se pudo dibujar el gr&aacute;fico.</p>';
}
renderHoldings(data.topHoldings);
if (typeof ajustarAlturaDeck === 'function') ajustarAlturaDeck();
actualizarSymbols();
if (document.getElementById('view-portafolio').style.display !== 'none') renderPortafolio();
bnbAutoSync();
  } catch(e) {
    document.getElementById('total').textContent = '—';
    avisoInicio('&#9888; No se pudo pintar la pantalla. Cerrá y abrí la app; si sigue, mandá captura del Diagnóstico.');
    try { console.error('render:', e); } catch (e2) {}
  } }
  // El poll de 60 s pide el payload SIN la serie histórica ({lite:true}): la
  // serie es un punto por día desde el inicio y era ~80% de lo que viajaba,
  // para un gráfico que no cambia en un minuto. La carga completa corre al
  // abrir y después a lo sumo cada 30 min (por si el histórico sumó el punto
  // del día). Un backend viejo ignora el argumento y manda todo: compatible.
  var CARGA_COMPLETA_MS = 30 * 60 * 1000;
  var ultimaCargaCompleta = 0;
  var ultimaHuella = '';
  // Huella del payload sin los campos que cambian solos en cada respuesta.
  // Con claves ORDENADAS: la respuesta lite trae las claves en otro orden (la
  // serie se le agrega al final), y un stringify directo daria huellas
  // distintas para datos iguales — o sea, repintaria siempre.
  function huellaDatos(d) {
    function estable(v) {
      if (v === null || typeof v !== 'object') return JSON.stringify(v);
      if (Object.prototype.toString.call(v) === '[object Array]') {
        return '[' + v.map(estable).join(',') + ']';
      }
      return '{' + Object.keys(v).sort().filter(function (k) {
        return k !== 'actualizado' && k !== 'lite';
      }).map(function (k) {
        return JSON.stringify(k) + ':' + estable(v[k]);
      }).join(',') + '}';
    }
    return estable(d);
  }
  function loadData(){
    var completa = !fullSerie || !fullSerie.length || (Date.now() - ultimaCargaCompleta > CARGA_COMPLETA_MS);
    google.script.run.withFailureHandler(function(err){
      hideSplash();
      // Con datos ya pintados (del caché), un fallo de red no rompe la vista:
      // se avisa y quedan los últimos datos guardados.
      pintarBadges('error');
      if (lastData) { avisoInicio('&#9888; Sin conexi&oacute;n con el servidor: mostrando los &uacute;ltimos datos guardados.'); return; }
      var t=document.getElementById('total'); if(t){ t.textContent='ERR: '+err.message; }
    }).withSuccessHandler(function(data){
      if (!data) return;
      if (data.serie && data.serie.length) ultimaCargaCompleta = Date.now();
      else data.serie = fullSerie; // respuesta lite: la serie no viajó, se conserva la última
      var av = document.getElementById('autoAviso');
      if (av && av.innerHTML.indexOf('Sin conexi') !== -1) { av.style.display='none'; av.innerHTML=''; }
      pintarBadges('ok');
      // Si nada cambió, no se toca el DOM: el poll dejaba de lado la batería,
      // parpadeaba la pantalla y cerraba el gráfico de TradingView que
      // estuvieras mirando, para pintar exactamente lo mismo.
      var h = huellaDatos(data);
      if (h === ultimaHuella) return;
      ultimaHuella = h;
      cacheGuardar('ga_cache_data', data);
      render(data);
    }).getPortfolioData(completa ? null : { lite: true });
  }
// Poll adaptativo: cada 60 s con la bolsa de EE.UU. abierta, cada 5 min
// cerrada. De noche pedia datos cada minuto igual que a las 15:00 de un dia de
// rueda — puro gasto de bateria y de cuota para precios congelados (la cripto
// se mueve 24/7, por eso cerrado no es "nunca": es 5 min). La franja se evalua
// en UTC, 13:00-21:30 de lunes a viernes: cubre la rueda de NY completa en
// horario de verano y de invierno sin meterse con zonas horarias.
var POLL_ABIERTO_MS = 60000, POLL_CERRADO_MS = 5 * 60000;
function mercadoAbierto(ahora) {
  var d = new Date(ahora);
  var dia = d.getUTCDay();
  if (dia === 0 || dia === 6) return false;
  var min = d.getUTCHours() * 60 + d.getUTCMinutes();
  return min >= 13 * 60 && min <= 21 * 60 + 30;
}
var ultimoPoll = Date.now();
setInterval(function () {
  if (document.visibilityState !== 'visible') return;
  var intervalo = mercadoAbierto(Date.now()) ? POLL_ABIERTO_MS : POLL_CERRADO_MS;
  if (Date.now() - ultimoPoll < intervalo - 500) return;
  ultimoPoll = Date.now();
  loadData();
}, 60000);
document.addEventListener('visibilitychange', function(){ if(document.visibilityState==='visible'){ ultimoPoll = Date.now(); loadData(); } });
