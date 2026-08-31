// API (shim google.script.run), pantalla de clave, helpers, errorEnVista

// El acento (ga_paleta) y la tonalidad de fondo (ga_fondo) elegidos en la
// página Configuración se aplican ACA, lo antes posible: este es el primer
// archivo y los scripts van al final del body, así que a efectos prácticos
// corre antes del primer pintado. No se suman al snippet inline del tema
// porque ese está fijado por hash en la política de contenido y no se toca.
// La validación vive en config.js: un valor viejo que ya no exista no
// matchea ningún CSS y simplemente rigen el dorado y el Marino.
try {
  var paletaGuardada = localStorage.getItem('ga_paleta'); if (paletaGuardada) document.documentElement.setAttribute('data-paleta', paletaGuardada);
  var fondoGuardado = localStorage.getItem('ga_fondo'); if (fondoGuardado) document.documentElement.setAttribute('data-fondo', fondoGuardado);
} catch (e) {}

// ===== API (Cloudflare Workers como backend, autenticado por clave) =====
// El backend vive en Cloudflare Workers desde el 20/08/2026 (Fase 1 de la
// migracion: el codigo se mudo, los datos siguen en la MISMA Google Sheet).
// Apps Script quedo APAGADO el 22/08/2026 (/exec en "Solo yo" y sin
// activadores), asi que la linea de rollback y sus dominios en la CSP se
// fueron con el: apuntaban a algo que ya no atiende. Volver atras hoy exige
// reabrir el acceso del /exec y recrear los triggers primero — los pasos estan
// en el CLAUDE.md del repo ga-portfolio-tracker.
var API_URL = 'https://ga-portfolio-worker.ga-portfolio.workers.dev';
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
// Presupuesto de espera por pedido. Sin esto el fetch va pelado y queda a
// merced del timeout de red de WebKit: en el subte o con senal mala, la app se
// quedaba colgada sin cancelar ni avisar. 'noticias' baja quince feeds RSS y
// puede tardar minutos; el resto es rapido y no tiene por que esperar tanto.
var API_TIMEOUT_MS = 25000;
var API_TIMEOUT_LARGO_MS = 180000;
// Todas las que hablan con un tercero o reescriben la planilla. ia_analizar,
// bnb_sync, dividendos y aportes faltaban, y la de la IA era una contradiccion
// con la pantalla: ia.js le dice al usuario "puede tardar hasta un minuto"
// mientras el pedido se cortaba a los 25 s. Segunda auditoria del 22/08/2026.
var FNS_LENTAS = {
  noticias: 1, analisis: 1, refrescar: 1, restaurar: 1,
  ibkr_sync: 1, cs_sync: 1, bnb_sync: 1,
  ia_analizar: 1, dividendos: 1, aportes: 1, podcast: 1
};

// Un fallo de red de Safari llega como TypeError('Load failed'), y eso es lo
// que se pintaba tal cual en Noticias, Dividendos, Aportes, Analisis, Buscador
// y Diagnostico. Se traduce una sola vez, aca, para todas las vistas.
function esErrorDeRed(e) {
  var m = String((e && e.message) || e || '');
  if (esAborto(e)) return false;   // un aborto NO es falta de senal
  return (e instanceof TypeError) || /Load failed|Failed to fetch|NetworkError|network/i.test(m);
}
function esAborto(e) {
  var n = String((e && e.name) || '');
  var m = String((e && e.message) || e || '');
  return n === 'AbortError' || /abort/i.test(m);
}
var MSJ_SIN_RED = 'No connection. Try again once you have signal.';
var MSJ_TARDO = 'The server took too long. Try again in a minute.';

function apiCall(fn, args) {
  var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var limite = FNS_LENTAS[fn] ? API_TIMEOUT_LARGO_MS : API_TIMEOUT_MS;
  var vencio = false;
  // El cuerpo se arma ANTES del reloj: si JSON.stringify tirara, apiCall
  // lanzaria de forma sincrona y el temporizador quedaria vivo para siempre.
  var opciones = { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token: getApiToken(), fn: fn, args: args || null }) };
  var reloj = setTimeout(function () { vencio = true; if (ctrl) ctrl.abort(); }, limite);
  if (ctrl) opciones.signal = ctrl.signal;
  return fetch(API_URL, opciones)
    .then(function (r) {
      // Un backend no siempre responde JSON: Apps Script devolvia HTML con la
      // cuota excedida, y Cloudflare devuelve su pagina de error en un 5xx. Un
      // r.json() pelado explotaria con "Unexpected token <": la defensa se queda.
      return r.text().then(function (t) {
        try { return JSON.parse(t); }
        catch (e) {
          throw new Error(r.ok
            ? 'The server sent back something unexpected. Try again in a minute.'
            : 'The server is not responding (error ' + r.status + '). Try again in a minute.');
        }
      });
    })
    .then(function (j) {
      if (j && j.error === 'auth') {
        // Este mensaje aparece cuando la clave GUARDADA dejo de servir (se
        // roto). Decirlo con todas las letras: se confundia con el bloqueo del
        // telefono y parecia que la biometria no habia funcionado.
        mostrarLock('The saved passcode no longer works: the server rejected it. Enter the new one.');
        var eAuth = new Error('The app passcode expired: enter it again.');
        eAuth.auth = true;
        throw eAuth;
      }
      // Codigos del servidor que tienen que llegar en castellano y no como
      // etiqueta interna. 'demasiados_pedidos' es el freno por IP que se puso
      // el 21/08; sin esto la pantalla decia literalmente "demasiados_pedidos".
      var TRADUCIDOS = {
        demasiados_pedidos: 'Too many requests in a row. Wait a minute and try again.',
        cuerpo_grande: 'The request was too large.',
        origen: 'The server did not accept the origin of this request.'
      };
      if (j && j.error && TRADUCIDOS[j.error]) throw new Error(TRADUCIDOS[j.error]);
      if (j && j.error) throw new Error(j.message || j.error);
      return j.data;
    })
    .then(
      function (d) { clearTimeout(reloj); return d; },
      function (e) {
        clearTimeout(reloj);
        // La traduccion va ACA, al final, y no colgada del fetch: el aborto por
        // vencimiento puede llegar mientras se DRENA el cuerpo (r.text()), o
        // sea por debajo de un catch puesto sobre el fetch. Asi se perdia el
        // mensaje amable justo en el caso para el que existe: senal mala y
        // respuesta grande. Segunda auditoria del 22/08/2026.
        if (e && e.auth) throw e;                       // clave vencida: intacto
        if (vencio || esAborto(e)) throw new Error(MSJ_TARDO);
        if (esErrorDeRed(e)) throw new Error(MSJ_SIN_RED);
        throw e;
      }
    );
}
// Shim compatible con google.script.run: el resto del codigo no cambia.
(function () {
  var MAP = { getPortfolioData: 'portfolio', getAccountData: 'account', getNoticias: 'noticias', getOperaciones: 'operaciones', registrarOperacion: 'trade', registrarMovimientoCash: 'cash', refrescarPrecios: 'refrescar', getPlataformas: 'plataformas', agregarPlataforma: 'plataforma_agregar', editarPlataforma: 'plataforma_editar', quitarPlataforma: 'plataforma_quitar', estadoIA: 'ia_estado', guardarClaveIA: 'ia_config', estadoFinnhub: 'finnhub_estado', guardarClaveFinnhub: 'finnhub_config', getResultados: 'resultados', analizarConIA: 'ia_analizar', buscarTicker: 'buscar', estadoIBKR: 'ibkr_estado', guardarConfigIBKR: 'ibkr_config', sincronizarIBKR: 'ibkr_sync', sincronizarBNB: 'bnb_sync', estadoCS: 'cs_estado', guardarConfigCS: 'cs_config', portalCS: 'cs_portal', sincronizarCS: 'cs_sync', getDividendos: 'dividendos', getDividendosProyectados: 'dividendos_proyectados', getAportes: 'aportes', getAnalisis: 'analisis', getPerfil: 'perfil', guardarPerfil: 'perfil_set', getFundamentales: 'fundamentales', listarBackups: 'backups', restaurarBackup: 'restaurar', getSalud: 'salud', getWatchlist: 'watchlist', agregarWatchlist: 'watchlist_agregar', quitarWatchlist: 'watchlist_quitar', alertaWatchlist: 'watchlist_alerta', registrarPush: 'push_registrar', editarPrecioManual: 'posicion_editar', quitarPush: 'push_quitar', probarPush: 'push_probar', getPodcast: 'podcast' };
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
// Colores del diseño leídos de la variable CSS viva: los gráficos se dibujan
// por canvas y no heredan var() solos. Si no se puede leer (arnés, navegador
// raro), cada uno cae a su valor de siempre.
function leerVarCss(nombre, fallback) {
  try {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
    if (v) return v;
  } catch (e) {}
  return fallback;
}
function colorAcento() { return leerVarCss('--gold', '#d4af37'); }
function acentoRgba(alpha) { return 'rgba(' + leerVarCss('--gold-rgb', '212,175,55') + ',' + alpha + ')'; }
// Los colores de tortas y series con el acento VIVO en el primer lugar: con
// el dorado clavado de PIE_COLORS, la torta seguía dorada con cualquier
// paleta. Se llama al pintar (no una vez) para que el cambio de paleta se
// vea sin recargar.
function coloresPie() { var c = PIE_COLORS.slice(); c[0] = colorAcento(); return c; }
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
var msg = err ? msgErr(err, 'This screen') : ('Could not load ' + que + '.');
el.innerHTML = '<p class="newsempty">' + esc(msg) + '<br>Come back in to retry.</p>';
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
return 'USD ' + Math.round(n).toLocaleString('en-US');
}
function fmtNum(n) {
if (n === null || n === undefined || n === '') return '\u2014';
// Era el UNICO numero de toda la app sin pasar por toLocaleString (miles sin
// separador) \u2014 fmt/fmtUsd/fmtUsdEnt ya lo hacian. Un precio de 1763.76
// salia pelado en vez de con el separador de miles. Pedido de Guzman
// (22/08/2026): "en TradingView se ve un poco mejor los numeros". Locale
// 'en-US' desde el 26/08/2026 (formato ingles: coma en los miles, punto en
// los decimales), junto con el resto de la app.
return (typeof n === 'number') ? (Math.round(n * 100) / 100).toLocaleString('en-US') : n;
}
// Montos de los paneles (dividendos/aportes), con el ojito de privacidad ya
// aplicado. La misma cadena mask('US$ ' + ...) estaba repetida 15 veces en
// paneles.js. fmtUsd: 2 decimales; fmtUsdEnt: redondeado, con miles (en-US).
// La etiqueta difiere A PROPOSITO: el patrimonio y los trades dicen "USD"
// (fmt/opsMonto), los paneles de ingresos "US$" (auditoria 19/08/2026).
function fmtUsd(n) { return mask('US$ ' + (Number(n) || 0).toFixed(2)); }
function fmtUsdEnt(n) { return mask('US$ ' + Math.round(Number(n) || 0).toLocaleString('en-US')); }
// fmtPctRaw y chipClass se fueron el 18/08/2026: su unico llamador era la
// tabla del detalle de cuenta, que se podo a los mismos helpers del Inicio
// (daychgHtml/gananciaHtml en graficos.js).
// Confirmacion destructiva en dos toques: el primero pregunta y se desarma
// solo; el segundo, dentro de la ventana, ejecuta. Estaba copiado en "Quitar
// plataforma" (config.js) y "Olvide mi clave" (seguridad.js) — auditoria
// 19/08/2026. (restaurarHoja y confirmarParcial usan window.confirm porque
// necesitan bloquear: son pasos de un flujo, no un boton suelto.)
function confirmarDosToques(el, pregunta, normal, ms, accion) {
if (el._confirm) { el._confirm = false; accion(); return; }
el._confirm = true;
el.textContent = pregunta;
setTimeout(function () { el._confirm = false; el.textContent = normal; }, ms);
}
// El nucleo del porcentaje firmado, SIN envoltorio: cada pantalla le pone el
// suyo (chip del buscador, comparacion, resultado del detalle, bruscos). El
// signo y los decimales salen de un solo lugar (auditoria 19/08/2026: el
// patron estaba rearmado a mano en cinco sitios).
function signoPct(v, dec) { return (v >= 0 ? '+' : '') + v.toFixed(dec) + '%'; }
// Chip de porcentaje firmado (verde/rojo): la linea estaba copiada identica
// en daychgHtml y gananciaHtml (E6).
function pctHtml(v, dec) {
return '<span class="daychg ' + (v >= 0 ? 'up' : 'down') + '">' + signoPct(v, dec) + '</span>';
}
// Etiqueta visual de una plataforma. La Sheet y el backend conservan el
// nombre real ("Interactive Brokers", anclado a su hoja); ac\u00e1 solo se
// muestra la marca oficial corta.
function nombrePlataforma(n) {
return /interactive brokers/i.test(String(n || '')) ? 'IBKR' : String(n || '');
}

