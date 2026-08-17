// API (shim google.script.run), pantalla de clave, helpers, errorEnVista
// ===== API (Apps Script como backend, autenticado por clave) =====
var API_URL = 'https://script.google.com/macros/s/AKfycbyrMsdxH2PM0s1I5X2p48ottTNltbayYoKBfTE8npOLUk_hapjFcSMIWJ0hvkbF2XBV/exec';
function getApiToken() { try { return localStorage.getItem('ga_token') || ''; } catch (e) { return ''; } }
// hideSplash vive ACA (el primer archivo) y no en arranque.js: seguridad.js
// la referencia al CARGAR (setTimeout(hideSplash, 700) evalua el nombre en
// el momento) y con los archivos partidos eso era un ReferenceError que
// mataba el resto del bloqueo: quedaba "App bloqueada" sin botones ni clave.
// El splash es AHORA la unica pantalla de arranque: adentro viven el desbloqueo
// (biometria/clave local) y la clave de acceso a la API. Mientras algo de eso
// este pidiendo entrar, el splash NO se puede ir: appBloqueada frena a
// hideSplash, que se llama desde render() y desde el fallo de carga.
var appBloqueada = false;
var lockPendiente = null;
function hideSplash(){ if(appBloqueada) return; var s=document.getElementById('splash'); if(s && !s.classList.contains('hide')){ s.classList.add('hide'); setTimeout(function(){ if(s&&s.parentNode&&s.classList.contains('hide')){ s.style.display='none'; } },600); } }
function mostrarSplash(){ var s=document.getElementById('splash'); if(!s) return; s.classList.remove('hide'); s.style.display='flex'; }
function mostrarLock(msg) {
  // Con el bloqueo local en pantalla, la clave de la API espera su turno: si
  // no, aparecia ENCIMA del Face ID y parecian dos pantallas distintas.
  if (appBloqueada) { lockPendiente = msg || ''; return; }
  mostrarSplash();
  var caja = document.getElementById('splashLock');
  if (caja) caja.style.display = 'none';
  document.getElementById('splashToken').style.display = '';
  document.getElementById('lockErr').textContent = msg || '';
}
// La devuelve true si habia una pantalla de clave esperando (la muestra).
function mostrarLockPendiente() {
  if (lockPendiente === null) return false;
  var m = lockPendiente; lockPendiente = null;
  mostrarLock(m);
  return true;
}
function apiCall(fn, args) {
  return fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token: getApiToken(), fn: fn, args: args || null }) })
    .then(function (r) {
      // Apps Script no siempre responde JSON: con cuota excedida, deploy roto
      // o redireccion de login devuelve HTML, y un r.json() pelado explota con
      // "Unexpected token <", que no le dice nada a nadie.
      return r.text().then(function (t) {
        try { return JSON.parse(t); }
        catch (e) {
          throw new Error(r.ok
            ? 'El servidor respondio algo inesperado. Proba de nuevo en un minuto.'
            : 'El servidor no responde (error ' + r.status + '). Proba de nuevo en un minuto.');
        }
      });
    })
    .then(function (j) {
      if (j && j.error === 'auth') {
        // Este mensaje aparece cuando la clave GUARDADA dejo de servir (se
        // roto). Decirlo con todas las letras: se confundia con el bloqueo del
        // telefono y parecia que la biometria no habia funcionado.
        mostrarLock('La clave guardada ya no sirve: el servidor la rechaza. Ingres\u00e1 la nueva.');
        var eAuth = new Error('La clave de la app vencio: volve a ingresarla.');
        eAuth.auth = true;
        throw eAuth;
      }
      if (j && j.error) throw new Error(j.message || j.error);
      return j.data;
    });
}
// Shim compatible con google.script.run: el resto del codigo no cambia.
(function () {
  var MAP = { getPortfolioData: 'portfolio', getAccountData: 'account', getNoticias: 'noticias', getOperaciones: 'operaciones', registrarOperacion: 'trade', registrarMovimientoCash: 'cash', refrescarPrecios: 'refrescar', getPlataformas: 'plataformas', agregarPlataforma: 'plataforma_agregar', editarPlataforma: 'plataforma_editar', quitarPlataforma: 'plataforma_quitar', estadoIA: 'ia_estado', guardarClaveIA: 'ia_config', analizarConIA: 'ia_analizar', buscarTicker: 'buscar', estadoIBKR: 'ibkr_estado', guardarConfigIBKR: 'ibkr_config', sincronizarIBKR: 'ibkr_sync', sincronizarBNB: 'bnb_sync', estadoCS: 'cs_estado', guardarConfigCS: 'cs_config', portalCS: 'cs_portal', sincronizarCS: 'cs_sync', getDividendos: 'dividendos', getAportes: 'aportes', getAnalisis: 'analisis', listarBackups: 'backups', restaurarBackup: 'restaurar', getSalud: 'salud' };
  function mk(ok, fail) {
    var o = {
      withSuccessHandler: function (f) { return mk(f, fail); },
      withFailureHandler: function (f) { return mk(ok, f); }
    };
    Object.keys(MAP).forEach(function (name) {
      o[name] = function (arg) {
        var args = (name === 'getAccountData') ? { key: arg } : arg;
        // OJO: el handler de fallo se llama SIEMPRE, incluido el caso 'auth'.
        // Si no, cada vencimiento de clave dejaba trabados para siempre los
        // candados de sincronizacion y los botones deshabilitados, y la app
        // parecia rota hasta reiniciarla. La pantalla de clave ya la mostro
        // apiCall; aca solo hay que soltar lo que quedo en curso.
        apiCall(MAP[name], args).then(function (data) { if (ok) ok(data); })
          .catch(function (err) { (fail || fallaPorDefecto)(err, name); });
      };
    });
    return o;
  }
  // Sin handler de fallo, el error se tragaba en silencio y la pantalla quedaba
  // "Cargando..." para siempre. Que avisar sea lo que pasa por omision: cada
  // vista nueva nace cubierta, y withFailureHandler sigue pisando esto cuando
  // hace falta algo especifico.
  function fallaPorDefecto(err, name) {
    try {
      if (err && err.auth) return; // la pantalla de clave ya se mostro
      if (window.console && console.warn) console.warn('Fallo ' + name + ':', err);
      if (typeof avisoInicio === 'function' && typeof msgErr === 'function') {
        avisoInicio('&#9888; ' + esc(msgErr(err, 'Algo')));
      }
    } catch (e) {}
  }
  window.google = { script: { run: mk(null, null) } };
})();
// Pantalla de clave
document.getElementById('lockBtn').onclick = function () {
  var v = document.getElementById('lockInput').value.trim();
  if (!v) return;
  try { localStorage.setItem('ga_token', v); } catch (e) {}
  document.getElementById('splashToken').style.display = 'none';
  document.getElementById('lockErr').textContent = '';
  hideSplash();
  loadData();
};
document.getElementById('lockInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') document.getElementById('lockBtn').click(); });
// Service worker (carga instantanea / shell offline)
// Registro del SW + aviso de version nueva. Antes cada publicacion tardaba
// DOS aperturas en verse (el SW sirve el shell viejo mientras baja el nuevo y
// recien la proxima apertura lo usa). Ahora: cuando el SW nuevo toma control
// (controllerchange: el skipWaiting del sw.js es automatico), aparece un
// boton "Actualizar" \u2014 un toque y la app recarga ya con la version nueva.
// Todo el bloque va en try/catch: si algo aca lanza (un navegador raro), no
// puede llevarse puesto el resto de nucleo.js \u2014 abajo se define el shim de la
// API y sin el la app entera muere. Sin SW no hay offline, pero la app sigue.
try {
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(function (reg) {
    // Buscar actualizaciones tambien al volver a la app, no solo al abrirla:
    // las PWA de iOS quedan vivas dias enteros sin "abrirse" de verdad.
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') { try { reg.update(); } catch (e) {} }
    });
  }).catch(function () {});
  var swInicial = navigator.serviceWorker.controller; // null en la primera visita
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    // Sin controller previo es la PRIMERA instalacion, no una actualizacion.
    if (!swInicial) { swInicial = navigator.serviceWorker.controller; return; }
    var el = document.getElementById('updateAviso');
    if (el) el.style.display = '';
  });
}
} catch (eSw) { }
function aplicarActualizacion() { try { location.reload(); } catch (e) {} }
try { document.getElementById('updateBtn').onclick = aplicarActualizacion; } catch (e) {}
var ACCOUNTS = [
{ key: 'CS', nombre: 'Charles Schwab' },
{ key: 'IB', nombre: 'Interactive Brokers' },
{ key: 'BNB', nombre: 'Binance' },
{ key: 'ITAU', nombre: 'Itau Assets' }
];
var PIE_COLORS = ['#d4af37', '#5b8def', '#22c55e', '#a78bfa', '#38bdf8', '#f59e0b', '#f43f5e'];
var RANGES = [
{ key: '1S', dias: 7 },
{ key: '1M', dias: 30 },
{ key: '3M', dias: 91 },
{ key: '6M', dias: 182 },
{ key: 'YTD', dias: 'ytd' },
{ key: '1A', dias: 365 },
{ key: '2A', dias: 730 },
{ key: '5A', dias: 1825 }
];
var fullSerie = [];
var lineChartInstance = null;
var currentRangeDias = 'ytd';
var currentTotal = 0;
var lastData = null;
// Toda vista que carga datos necesita salida por error: si no, un corte de
// red la deja en "Cargando..." para siempre y no hay forma de reintentar.
function errorEnVista(idContenedor, err, que) {
var el = document.getElementById(idContenedor);
if (!el) return;
// Pasa por msgErr para traducir el backend sin desplegar; sin eso, estas
// cuatro vistas mostraban el cruptico "unknown_fn".
var msg = err ? msgErr(err, 'Esta pantalla') : ('No se pudieron cargar ' + que + '.');
el.innerHTML = '<p class="newsempty">' + esc(msg) + '<br>Volv&eacute; a entrar para reintentar.</p>';
}
var noticiasCargadas = false;
var opsCargadas = false;
var accountReturnView = 'portafolio';

// Escapa texto que se inserta via innerHTML (symbols, descripciones, titulares
// de RSS, etc. son datos externos: nunca insertarlos crudos).
function esc(s) {
  return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
// Solo deja pasar links http(s); cualquier otra cosa se anula.
function safeUrl(u) {
  return /^https?:\/\//i.test(String(u || '')) ? String(u) : '#';
}
// Modo privacidad: ojito que reemplaza todos los montos por asteriscos.
var montosOcultos = false;
try { montosOcultos = localStorage.getItem('ga_montos_ocultos') === '1'; } catch (e) {}
var EYE_ON = '<svg viewBox="0 0 24 24"><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></svg>';
var EYE_OFF = '<svg viewBox="0 0 24 24"><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/><path d="M4 4l16 16"/></svg>';
function pintarOjo() {
var b = document.getElementById('eyeBtn');
if (b) b.innerHTML = montosOcultos ? EYE_OFF : EYE_ON;
}
function mask(s) { return montosOcultos ? '****' : s; }
var _animTotalRaf = null, _ultimoTotalPintado = null;
function animarTotal(el, hasta) {
if (_animTotalRaf) { cancelAnimationFrame(_animTotalRaf); _animTotalRaf = null; }
var desde = _ultimoTotalPintado;
_ultimoTotalPintado = hasta;
var sinAnimar = montosOcultos || desde === null || !isFinite(hasta) ||
  (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) ||
  Math.abs(hasta - desde) > Math.abs(desde) * 0.5; // salto enorme: pintar directo
if (sinAnimar) { el.textContent = fmt(hasta); return; }
var t0 = null, DURACION = 350;
function paso(t) {
if (!t0) t0 = t;
var k = Math.min(1, (t - t0) / DURACION);
k = 1 - (1 - k) * (1 - k); // arranca rapido, frena al final
el.textContent = fmt(desde + (hasta - desde) * k);
if (k < 1) _animTotalRaf = requestAnimationFrame(paso);
else _animTotalRaf = null;
}
_animTotalRaf = requestAnimationFrame(paso);
// Garantia: si los frames no corren (iOS pausa requestAnimationFrame cuando
// la pantalla no compone), el valor FINAL queda puesto igual.
setTimeout(function () {
if (_animTotalRaf) { cancelAnimationFrame(_animTotalRaf); _animTotalRaf = null; }
el.textContent = fmt(_ultimoTotalPintado);
}, DURACION + 150);
}
function fmt(n) {
if (montosOcultos) return '****';
if (n === null || n === undefined || isNaN(n)) return '\u2014';
return 'USD ' + Math.round(n).toLocaleString('es-UY');
}
function fmtNum(n) {
if (n === null || n === undefined || n === '') return '\u2014';
return (typeof n === 'number') ? (Math.round(n * 100) / 100) : n;
}
function fmtPctRaw(n) {
if (n === null || n === undefined || n === '') return '\u2014';
if (typeof n === 'number') return (n * 100).toFixed(2) + '%';
return n;
}
function chipClass(n) {
if (n === null || n === undefined) return '';
return n >= 0 ? 'up' : 'down';
}
// Etiqueta visual de una plataforma. La Sheet y el backend conservan el
// nombre real ("Interactive Brokers", anclado a su hoja); ac\u00e1 solo se
// muestra la marca oficial corta.
function nombrePlataforma(n) {
return /interactive brokers/i.test(String(n || '')) ? 'IBKR' : String(n || '');
}

