// Ojito de privacidad, carga de datos, poll de 60 s
// ---------- Ojito de privacidad ----------
document.getElementById('eyeBtn').onclick = function () {
montosOcultos = !montosOcultos;
try { localStorage.setItem('ga_montos_ocultos', montosOcultos ? '1' : '0'); } catch (e) {}
pintarOjo();
if (lastData) render(lastData);
if (lastAcc && lastAccData) renderAccount(lastAcc, lastAccData);
if (lastOps) renderOperaciones(lastOps);
// Los paneles lentos tambien obedecen al ojito (auditoria 19/08/2026): sin
// esto, si los extras no viajaron en el ultimo payload, Dividendos, Aportes
// y Analisis seguian mostrando los montos con el ojo cerrado. Se repinta
// desde el cache local (siempre tiene lo ultimo pintado); la bandera evita
// tapar un error o un spinner con datos viejos.
function repintarPanel(cargado, clave, render) {
var c = cargado && cacheLeer(clave);
if (c) render(c.data);
}
repintarPanel(divCargado, 'ga_cache_div', renderDividendos);
repintarPanel(apoCargado, 'ga_cache_apo', renderAportes);
repintarPanel(anaCargado, 'ga_cache_ana', renderAnalisis);
};
pintarOjo();

// ---------- Carga de datos ----------
buildRangeBar('rangeBar');
buildRangeBar('rangeBarBig');
buildTradeForm();
buildCashForm();
// El presupuesto del poll se declara ANTES del arranque: la primera llamada a
// loadData sale de la linea de abajo, y con las declaraciones despues (como
// estaban) esa llamada corria con los dos undefined — "completa al abrir"
// quedaba librado a un NaN, y un cache viejo de dias arrancaba lite igual.
var CARGA_COMPLETA_MS = 30 * 60 * 1000;
var ultimaCargaCompleta = 0;
var ultimaHuella = '';
// Pintado instantáneo: al abrir se muestran los últimos datos vistos
// (guardados en este dispositivo) y el refresco real corre por atrás.
function pintarCache() {
  var c = cacheLeer('ga_cache_data');
  if (!c || !c.data.cuentas) return false;
  render(c.data);
  // Arranque lite-first (R4): si el cache pintado es fresco (<30 min) y trae
  // el juego completo (serie + bench + serieGrupo), cuenta como "ultima carga
  // completa": la primera llamada sale lite (~80% menos payload) y el grafico
  // usa la serie que ya se pinto. La completa llega sola cuando el cache
  // cumpla los 30 min. Sin bench o sin serieGrupo no se arriesga: carga
  // completa como siempre (un cache anterior a v63 no los guardaba).
  if (c.t && (Date.now() - c.t) < CARGA_COMPLETA_MS &&
      c.data.serie && c.data.serie.length && c.data.bench && c.data.serieGrupo) {
    ultimaCargaCompleta = c.t;
  }
  pintarBadges('cache');
  return true;
}
if (getApiToken()) { pintarCache(); loadData(); } else { mostrarLock(); }
// En pantalla ancha el carrusel del Inicio se despliega y los tres paneles se
// ven de una: Dividendos y Aportes hay que pedirlos, porque su carga colgaba
// del gesto de deslizar (paneles.js). En el telefono esto no hace nada.
if (typeof cargarPanelesDeEscritorio === 'function') cargarPanelesDeEscritorio();
function render(data) {
hideSplash();
  try {
lastData = data;
animarTotal(document.getElementById('total'), data.total);
pintarKpis(data);
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
// El indice y la serie del grupo se aplican siempre que vengan en el payload
// (aplicarBench/aplicarGrupo son defensivos: una respuesta sin el dato no
// borra el que estaba alineado). Antes los lite se salteaban, pero desde v63
// el cache local guarda bench y serieGrupo re-adjuntados, y al arrancar del
// cache hay que aplicarlos o el panel de Aportes queda sin comparacion. No se
// dibujan en este grafico — los usa la comparacion del panel de Aportes.
aplicarBench(data); aplicarGrupo(data);
drawLineChart(filterSerie(currentRangeDias));
updateRangePct();
renderEvoMini();
} catch (eChart) {
// El aviso va donde SE VE. Antes iba al primer `.chartbox` del documento, que
// desde v92 es la caja de Evolucion y arranca PLEGADA: con el grafico cerrado
// —el estado por omision— el error se escribia en un div oculto, la app se
// veia normal y no decia nada. Peor: reemplazaba el <canvas>, asi que al
// expandir despues tiraba otra excepcion, esa sin try alrededor.
// Auditoria del 23/08/2026.
var cb = document.getElementById('evoMini');
if (cb) cb.innerHTML = '<span class="evomini-vacio">Could not draw the chart.</span>';
}
aplicarSparks(data);
renderHoldings(data.topHoldings);
// R1: si el payload trajo los agregados de los paneles ya calculados, se
// aplican aca (despues de fullSerie/serieGrupo: la comparacion los usa).
if (data.extras) aplicarExtras(data.extras);
if (typeof ajustarAlturaDeck === 'function') ajustarAlturaDeck();
actualizarSymbols();
if (document.getElementById('view-portafolio').style.display !== 'none') renderPortafolio();
// La lista completa de Posiciones se repinta igual que Portafolio: solo si
// está a la vista (el poll de 60 s trae precios nuevos y la tabla los muestra).
var vPos = document.getElementById('view-posiciones');
if (vPos && vPos.style.display !== 'none') renderPosiciones();
bnbAutoSync();
  } catch(e) {
    document.getElementById('total').textContent = '—';
    avisoInicio('&#9888; The screen could not be rendered. Close and reopen the app; if it keeps happening, send a screenshot of Diagnostics.');
    try { console.error('render:', e); } catch (e2) {}
  } }
  // El poll de 60 s pide el payload SIN la serie histórica ({lite:true}): la
  // serie es un punto por día desde el inicio y era ~80% de lo que viajaba,
  // para un gráfico que no cambia en un minuto. La carga completa corre al
  // abrir —salvo cache fresco y completo, ver pintarCache— y después a lo
  // sumo cada 30 min (por si el histórico sumó el punto del día). Un backend
  // viejo ignora el argumento y manda todo: compatible.
  // (CARGA_COMPLETA_MS / ultimaCargaCompleta / ultimaHuella se declaran arriba
  // del arranque, que las usa antes de que esta zona del archivo ejecute.)
  // Huella del payload sin los campos que cambian solos en cada respuesta.
  // Con claves ORDENADAS: la respuesta lite trae las claves en otro orden (la
  // serie se le agrega al final), y un stringify directo daria huellas
  // distintas para datos iguales — o sea, repintaria siempre.
  // La serie (y sus gemelas alineadas bench/serieGrupo) queda AFUERA de la
  // huella: solo viaja en la carga completa —que repinta siempre, ver
  // vinoSerie en loadData— y serializar ~100 KB en cada poll era puro CPU.
  function huellaDatos(d) {
    function estable(v, esRaiz) {
      if (v === null || typeof v !== 'object') return JSON.stringify(v);
      if (Object.prototype.toString.call(v) === '[object Array]') {
        return '[' + v.map(function (x) { return estable(x, false); }).join(',') + ']';
      }
      return '{' + Object.keys(v).sort().filter(function (k) {
        if (k === 'actualizado' || k === 'lite') return false;
        // extras (R1) tampoco entra: solo viaja en cargas completas (que
        // repintan siempre) y serializarlo en cada poll seria puro CPU.
        if (esRaiz && (k === 'serie' || k === 'bench' || k === 'serieGrupo' || k === 'extras')) return false;
        return true;
      }).map(function (k) {
        return JSON.stringify(k) + ':' + estable(v[k], false);
      }).join(',') + '}';
    }
    return estable(d, true);
  }
  function loadData(){
    var completa = !fullSerie || !fullSerie.length || (Date.now() - ultimaCargaCompleta > CARGA_COMPLETA_MS);
    google.script.run.withFailureHandler(function(err){
      // OJO con el orden: cuando el servidor rechaza la clave, apiCall ya
      // llamo a mostrarLock() y la pantalla para escribir la clave nueva
      // ESTA arriba. Un hideSplash() aca la tapaba de inmediato, asi que
      // Guzman veia el aviso y los datos viejos sin ninguna forma de
      // escribir la clave: la app pedia algo y se lo escondia en el mismo
      // suspiro. Se pasaba la tarde cambiando una clave que nunca llegaba
      // a entrar (31/08/2026).
      if (err && err.auth) { pintarBadges('error'); return; }
      hideSplash();
      // Con datos ya pintados (del caché), un fallo no rompe la vista: se
      // avisa y quedan los últimos datos guardados.
      pintarBadges('error');
      if (lastData) {
        // El aviso DICE la causa. Antes decia "No connection to the server"
        // para CUALQUIER fallo, ignorando el error que acababa de recibir:
        // un rechazo de origen, una clave vencida o un freno por demasiados
        // pedidos se veian los tres como "no hay senal". Guzman cambio la
        // clave varias veces peleando contra un mensaje que no tenia nada
        // que ver con lo que pasaba (31/08/2026). Un aviso que miente sobre
        // la causa es peor que uno feo: manda a arreglar lo que no esta roto.
        var motivo = (err && err.message) ? String(err.message) : '';
        avisoInicio('&#9888; ' + esc(motivo || 'Could not reach the server') +
          ' &mdash; showing the last saved data.');
        return;
      }
      var t=document.getElementById('total'); if(t){ t.textContent='ERR: '+err.message; }
    }).withSuccessHandler(function(data){
      if (!data) return;
      var vinoSerie = !!(data.serie && data.serie.length);
      if (vinoSerie) ultimaCargaCompleta = Date.now();
      else {
        // Respuesta lite: la serie no viajó, se conserva la última. Bench y
        // serieGrupo tampoco viajan y siguen valiendo (la serie no cambió):
        // se re-adjuntan para que el cache local quede COMPLETO — es lo que
        // habilita el arranque lite-first de la próxima apertura.
        data.serie = fullSerie;
        if (lastData) {
          if (!data.bench && lastData.bench) data.bench = lastData.bench;
          if (!data.serieGrupo && lastData.serieGrupo) data.serieGrupo = lastData.serieGrupo;
          // Los cierres del mini-grafico (V6) tampoco viajan en el lite y
          // siguen valiendo. Faltaba re-adjuntarlos y por eso el cache local
          // quedaba SIN ellos: al reabrir la app, la columna "Mes" salia vacia
          // hasta que tocara una carga completa (hasta media hora despues).
          // La defensa de aplicarSparks vive solo en memoria y el cache la
          // saltea. Auditoria del 22/08/2026.
          if (!data.sparks && lastData.sparks) data.sparks = lastData.sparks;
        }
      }
      var av = document.getElementById('autoAviso');
      if (av && av.innerHTML.indexOf('No connection') !== -1) { av.style.display='none'; av.innerHTML=''; }
      pintarBadges('ok');
      // Si nada cambió, no se toca el DOM: el poll dejaba de lado la batería,
      // parpadeaba la pantalla y cerraba el gráfico de TradingView que
      // estuvieras mirando, para pintar exactamente lo mismo. Una respuesta
      // CON serie (carga completa) repinta siempre: la serie no entra en la
      // huella y puede haber sumado el punto del día.
      var h = huellaDatos(data);
      if (h === ultimaHuella && !vinoSerie) return;
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
