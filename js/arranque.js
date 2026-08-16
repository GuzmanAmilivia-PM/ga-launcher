// Ojito de privacidad, carga de datos, poll de 60 s
// ---------- Ojito de privacidad ----------
document.getElementById('eyeBtn').onclick = function () {
montosOcultos = !montosOcultos;
try { localStorage.setItem('ga_montos_ocultos', montosOcultos ? '1' : '0'); } catch (e) {}
pintarOjo();
if (lastData) render(lastData);
if (lastAcc && lastAccData) renderAccount(lastAcc, lastAccData);
if (lastTx) renderTransacciones(lastTx);
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
document.getElementById('total').textContent = fmt(data.total);
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
} catch (eChart) {
var cb = document.querySelector('.chartbox');
if (cb) cb.innerHTML = '<p class="newsempty">No se pudo dibujar el gr&aacute;fico.</p>';
}
renderHoldings(data.topHoldings);
actualizarSymbols();
if (document.getElementById('view-portafolio').style.display !== 'none') renderPortafolio();
bnbAutoSync();
  } catch(e) { document.getElementById('total').textContent = 'ERR2: ' + String(e); } }
  function loadData(){
    google.script.run.withFailureHandler(function(err){
      hideSplash();
      // Con datos ya pintados (del caché), un fallo de red no rompe la vista:
      // se avisa y quedan los últimos datos guardados.
      pintarBadges('error');
      if (lastData) { avisoInicio('&#9888; Sin conexi&oacute;n con el servidor: mostrando los &uacute;ltimos datos guardados.'); return; }
      var t=document.getElementById('total'); if(t){ t.textContent='ERR: '+err.message; }
    }).withSuccessHandler(function(data){
      cacheGuardar('ga_cache_data', data);
      var av = document.getElementById('autoAviso');
      if (av && av.innerHTML.indexOf('Sin conexi') !== -1) { av.style.display='none'; av.innerHTML=''; }
      pintarBadges('ok');
      render(data);
    }).getPortfolioData();
  }
setInterval(function(){ if(document.visibilityState==='visible'){ loadData(); } }, 60000);
document.addEventListener('visibilitychange', function(){ if(document.visibilityState==='visible'){ loadData(); } });
