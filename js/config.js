// Retirar/depositar, tema claro/oscuro, plataformas
// ---------- Retirar / Depositar liquidez ----------
var cashTipo = 'deposito';
function abrirCashPanel(tipo) {
cashTipo = tipo;
document.getElementById('cashTitle').textContent = (tipo === 'deposito' ? 'Depositar' : 'Retirar') + ' cash';
document.getElementById('cashResultado').innerHTML = '';
var panel = document.getElementById('cashPanel');
panel.style.display = '';
panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
document.getElementById('btnDepositar').onclick = function () { abrirCashPanel('deposito'); };
document.getElementById('btnRetirar').onclick = function () { abrirCashPanel('retiro'); };
document.getElementById('cashCancelar').onclick = function () {
document.getElementById('cashPanel').style.display = 'none';
document.getElementById('cashMonto').value = '';
};
// El selector lleva las cuentas con hoja propia (por su key) y ademas las
// plataformas que existen SOLO como fila del resumen (BTG y las agregadas a
// mano), que viajan por NOMBRE: el backend las resuelve contra esa fila. Sin
// esto no habia forma de depositar/retirar en ellas desde la app.
function buildCashForm(cuentas) {
var sel = document.getElementById('cashCuenta');
var elegida = sel.value;
sel.innerHTML = '';
function opcion(valor, texto) {
var o = document.createElement('option');
o.value = valor; o.textContent = texto;
sel.appendChild(o);
}
ACCOUNTS.forEach(function (a) { opcion(a.key, nombrePlataforma(a.nombre)); });
(cuentas || []).forEach(function (c) {
if (!accountByName(c.nombre)) opcion(c.nombre, nombrePlataforma(c.nombre));
});
// Solo si la opcion sigue existiendo: asignar un value inexistente deja el
// select en blanco y el proximo Confirmar mandaria cuenta vacia.
if (elegida) {
for (var i = 0; i < sel.options.length; i++) {
if (sel.options[i].value === elegida) { sel.value = elegida; break; }
}
}
}
document.getElementById('cashConfirmar').onclick = function () {
var monto = parseFloat(document.getElementById('cashMonto').value);
var resEl = document.getElementById('cashResultado');
if (!isFinite(monto) || monto <= 0) {
resEl.innerHTML = '<div class="tmsg err">Monto inv&aacute;lido.</div>';
return;
}
var btn = this;
btn.disabled = true; btn.textContent = 'Registrando...';
google.script.run.withSuccessHandler(function (res) {
btn.disabled = false; btn.textContent = 'Confirmar';
if (res && res.ok) {
var r = res.resumen;
resEl.innerHTML = '<div class="tmsg ok">&#10003; ' + (r.tipo === 'deposito' ? 'Dep&oacute;sito' : 'Retiro') + ' de ' + esc(mask('USD ' + r.monto)) + ' en ' + esc(r.cuenta) + ' registrado.</div>';
document.getElementById('cashMonto').value = '';
loadData();
} else {
resEl.innerHTML = '<div class="tmsg err">' + esc((res && res.mensajes || ['Error desconocido.']).join(' ')) + '</div>';
}
}).withFailureHandler(function (err) {
btn.disabled = false; btn.textContent = 'Confirmar';
resEl.innerHTML = '<div class="tmsg err">Error: ' + esc(err.message) + '</div>';
}).registrarMovimientoCash({ cuenta: document.getElementById('cashCuenta').value, tipo: cashTipo, monto: monto });
};

// ---------- Tema (oscuro / claro) ----------
function esTemaClaro() { return document.documentElement.classList.contains('light'); }
// pieBorder acompaña a la tonalidad elegida (leerVarCss, nucleo.js): con el
// navy clavado, los bordes de la torta delataban el Marino bajo Grafito/Nord.
function temaChart() {
return esTemaClaro()
? { tick: '#5d6c85', grid: 'rgba(20,40,80,.08)', pieBorder: leerVarCss('--navy2', '#ffffff') }
: { tick: '#90a0b8', grid: 'rgba(255,255,255,.05)', pieBorder: leerVarCss('--navy', '#0d1420') };
}
// El control vivió en el panel lateral (v111-v114); desde el 25/08/2026 son
// los dos botones de la página Configuración (view-diseno), junto con el
// acento y la tonalidad. La preferencia se guarda igual que siempre (ga_tema,
// que el snippet inline del <head> lee al arrancar — ese snippet NO se toca:
// está fijado por hash en la política de contenido).
function setTema(claro) {
document.documentElement.classList.toggle('light', claro);
try { localStorage.setItem('ga_tema', claro ? 'claro' : 'oscuro'); } catch (e) {}
pintarDiseno();
if (lastData) render(lastData);
if (lastAcc && lastAccData) renderAccount(lastAcc, lastAccData);
}

// ---------- Configuración (diseño): tema, acento y tonalidad ----------
// La página Configuración (view-diseno; la de APIs pasó a llamarse Keys el
// 25/08/2026) junta las tres elecciones de aspecto:
//   - Tema claro/oscuro (clase light + ga_tema);
//   - Color de acento (data-paleta + ga_paleta): la familia --gold*;
//   - Tonalidad de fondo (data-fondo + ga_fondo): la familia --navy*/texto.
// Acento y tonalidad son ORTOGONALES (tocan variables distintas): cualquier
// combinación es válida, y cada una tiene su par claro en el CSS. Los colores
// viven en el CSS; acá solo se elige cuál rige. nucleo.js aplica los dos
// atributos al arrancar, antes de pintar.
var PALETAS = ['', 'oceano', 'esmeralda', 'violeta'];
var FONDOS = ['', 'grafito', 'nord', 'bosque'];
function _eleccion(attr, lista) {
var v = document.documentElement.getAttribute(attr) || '';
return lista.indexOf(v) === -1 ? '' : v;
}
function paletaActual() { return _eleccion('data-paleta', PALETAS); }
function fondoActual() { return _eleccion('data-fondo', FONDOS); }
function _setEleccion(attr, clave, lista, v) {
if (lista.indexOf(v) === -1) v = '';
if (v) document.documentElement.setAttribute(attr, v);
else document.documentElement.removeAttribute(attr);
try { if (v) localStorage.setItem(clave, v); else localStorage.removeItem(clave); } catch (e) {}
pintarDiseno();
// Los gráficos pintan sus colores por canvas: se repintan igual que al
// cambiar de tema, para que la línea, la torta y los bordes tomen lo nuevo.
if (lastData) render(lastData);
if (lastAcc && lastAccData) renderAccount(lastAcc, lastAccData);
}
function setPaleta(p) { _setEleccion('data-paleta', 'ga_paleta', PALETAS, p); }
function setFondo(f) { _setEleccion('data-fondo', 'ga_fondo', FONDOS, f); }
function _marcarDots(grupo, attr, actual) {
var dots = document.querySelectorAll(grupo + ' .pdot');
for (var i = 0; i < dots.length; i++) {
var es = (dots[i].getAttribute(attr) || '') === actual;
dots[i].classList.toggle('sel', es);
dots[i].setAttribute('aria-pressed', es ? 'true' : 'false');
}
}
function pintarDiseno() {
_marcarDots('#mPaleta', 'data-paleta', paletaActual());
_marcarDots('#mFondo', 'data-fondo', fondoActual());
var osc = document.getElementById('temaOscuroBtn');
var cla = document.getElementById('temaClaroBtn');
if (osc) osc.classList.toggle('active-tema', !esTemaClaro());
if (cla) cla.classList.toggle('active-tema', esTemaClaro());
}
function _wireDots(grupo, attr, setter) {
var dots = document.querySelectorAll(grupo + ' .pdot');
for (var i = 0; i < dots.length; i++) {
(function (d) { d.onclick = function () { setter(d.getAttribute(attr) || ''); }; })(dots[i]);
}
}
_wireDots('#mPaleta', 'data-paleta', setPaleta);
_wireDots('#mFondo', 'data-fondo', setFondo);
document.getElementById('temaOscuroBtn').onclick = function () { setTema(false); };
document.getElementById('temaClaroBtn').onclick = function () { setTema(true); };
pintarDiseno();

// ---------- Configuración: plataformas ----------
var platModo = 'agregar';
function platsMsg(html, esOk) {
document.getElementById('platResultado').innerHTML = html ? '<div class="tmsg ' + (esOk ? 'ok' : 'err') + '">' + html + '</div>' : '';
}
function cargarPlataformas() {
google.script.run.withSuccessHandler(renderPlataformas)
.withFailureHandler(function (err) { errorEnVista('platList', err, 'las plataformas'); }).getPlataformas();
}
function renderPlataformas(lista) {
var el = document.getElementById('platList');
el.innerHTML = '';
(lista || []).forEach(function (pl) {
var esIB = /interactive brokers/i.test(pl.nombre);
var esBNB = /^binance$/i.test(pl.nombre);
var esCS = /charles schwab/i.test(pl.nombre);
var row = document.createElement('div');
row.className = 'platrow';
row.innerHTML = '<span>' + esc(nombrePlataforma(pl.nombre)) +
'<span class="platmeta">' + fmt(pl.valor) + ((esIB || esCS) ? ' &middot; conexi&oacute;n autom&aacute;tica' : (esBNB ? ' &middot; saldos en vivo' : (pl.gestionada ? ' &middot; con hoja de posiciones' : ' &middot; manual'))) + '</span></span>' +
'<span class="platbtns"></span>';
var btns = row.querySelector('.platbtns');
// Plataformas con pantalla de conexi\u00f3n propia: la fila entera navega ah\u00ed.
var vistaConexion = esIB ? 'ibkr' : (esBNB ? 'bnb' : (esCS ? 'cs' : null));
if (vistaConexion) {
var bc = document.createElement('button');
bc.innerHTML = 'Conexi&oacute;n &rsaquo;';
bc.onclick = function (ev) { ev.stopPropagation(); setView(vistaConexion); };
btns.appendChild(bc);
row.style.cursor = 'pointer';
row.onclick = function () { setView(vistaConexion); };
}
var be = document.createElement('button');
be.textContent = 'Editar';
be.onclick = function (ev) { ev.stopPropagation(); abrirPlatForm(pl); };
btns.appendChild(be);
if (!pl.gestionada) {
var bq = document.createElement('button');
bq.textContent = 'Quitar';
bq.onclick = function (ev) {
ev.stopPropagation();
confirmarDosToques(bq, '\u00bfSeguro?', 'Quitar', 3000, function () {
google.script.run.withSuccessHandler(function (res) {
platsMsg(esc(((res && res.mensajes) || []).join(' ')), res && res.ok);
cargarPlataformas(); loadData();
}).withFailureHandler(function (err) { platsMsg('Error: ' + esc(err.message), false); }).quitarPlataforma({ nombre: pl.nombre });
});
};
btns.appendChild(bq);
}
el.appendChild(row);
});
}
function abrirPlatForm(pl) {
platModo = pl ? pl.nombre : 'agregar';
document.getElementById('platForm').style.display = '';
document.getElementById('pNombre').value = pl ? pl.nombre : '';
document.getElementById('pNombre').disabled = !!(pl && pl.gestionada);
document.getElementById('pValor').value = pl ? pl.valor : '';
document.getElementById('pLiquido').value = (pl && pl.liquido !== null && pl.liquido !== undefined) ? pl.liquido : '';
platsMsg('');
}
document.getElementById('platNuevaBtn').onclick = function () { abrirPlatForm(null); };
document.getElementById('platCancelar').onclick = function () { document.getElementById('platForm').style.display = 'none'; };
document.getElementById('platGuardar').onclick = function () {
var btn = this;
var esNueva = platModo === 'agregar';
var payload = esNueva
? { nombre: document.getElementById('pNombre').value, valor: document.getElementById('pValor').value, liquido: document.getElementById('pLiquido').value }
: { nombreActual: platModo, nombreNuevo: document.getElementById('pNombre').value, valor: document.getElementById('pValor').value, liquido: document.getElementById('pLiquido').value };
btn.disabled = true;
var runner = google.script.run.withSuccessHandler(function (res) {
btn.disabled = false;
if (res && res.ok) {
document.getElementById('platForm').style.display = 'none';
platsMsg('&#10003; Guardado. ' + esc((res.mensajes || []).join(' ')), true);
cargarPlataformas(); loadData();
} else {
platsMsg(esc(((res && res.mensajes) || ['Error']).join(' ')), false);
}
}).withFailureHandler(function (err) { btn.disabled = false; platsMsg('Error: ' + esc(err.message), false); });
if (esNueva) runner.agregarPlataforma(payload); else runner.editarPlataforma(payload);
};
document.getElementById('cfgBack').onclick = function () { setView('inicio'); };


// ---------- Diagnostico ----------
// Lado APP al entrar (todo local, instantaneo); lado SERVIDOR a pedido, que
// cuesta el viaje al backend y las lecturas de la Sheet.
function filaSalud(etiqueta, valor, esOk) {
var color = esOk === undefined ? '' : (esOk ? ' style="color:var(--green)"' : ' style="color:var(--red)"');
return '<div class="row"><span>' + etiqueta + '</span><span' + color + '>' + valor + '</span></div>';
}
function edadCache(clave) {
var c = cacheLeer(clave);
if (!c || !c.t) return 'sin datos';
var min = Math.round((Date.now() - c.t) / 60000);
return min < 1 ? 'hace <1 min' : min < 60 ? 'hace ' + min + ' min' : 'hace ' + Math.round(min / 60) + ' h';
}
function pintarSaludApp() {
var el = document.getElementById('saludApp');
if (!el) return;
var html = '';
var sw = navigator.serviceWorker && navigator.serviceWorker.controller;
html += filaSalud('Modo offline', sw ? 'activo' : 'inactivo', !!sw);
html += filaSalud('Datos del portafolio', edadCache('ga_cache_data'));
html += filaSalud('Dividendos guardados', edadCache('ga_cache_div'));
html += filaSalud('Binance en este tel&eacute;fono', bnbConfig() ? 'configurado' : 'sin configurar');
html += filaSalud('Bloqueo de seguridad', (function () { try { var s = JSON.parse(localStorage.getItem('ga_sec') || '{}'); return (s.pin || s.bio) ? 'activado' : 'desactivado'; } catch (e) { return '?'; } })());
el.innerHTML = html;
versionShell(function (ver) {
el.innerHTML = filaSalud('Versi&oacute;n de la app', ver || '?') + el.innerHTML;
});
}
function fechaSalud(iso) {
var d = new Date(iso);
return isNaN(d.getTime()) ? String(iso || '—') : fechaCortaMs(d.getTime());
}
document.getElementById('saludBtn').onclick = function () {
var btn = this, out = document.getElementById('saludServidor');
if (btn._busy) return;
btn._busy = true;
out.innerHTML = '<p class="loadingtxt">Consultando el servidor...</p>';
google.script.run.withSuccessHandler(function (s) {
btn._busy = false;
if (!s || !s.ok) { out.innerHTML = '<p class="newsempty">El servidor no respondi&oacute; bien.</p>'; return; }
var html = '';
html += filaSalud('Hora del servidor', esc(fechaSalud(s.ahora)));
html += filaSalud('Sincronizaci&oacute;n autom&aacute;tica (8:00)', s.triggerDiario === null ? 'sin dato' : (s.triggerDiario ? 'programada' : 'NO existe'), s.triggerDiario !== false);
function broker(nombre, b) {
if (!b.configurada) return filaSalud(nombre, 'sin conectar');
if (!b.ultimaSync) return filaSalud(nombre, 'conectado, nunca sincroniz&oacute;');
return filaSalud(nombre, (b.ultimaSync.ok ? '&#10003; ' : '&#9888; ') + esc(fechaSalud(b.ultimaSync.cuando)), b.ultimaSync.ok);
}
html += broker('IBKR', s.brokers.ibkr);
html += broker('Schwab', s.brokers.schwab);
html += filaSalud('Dividendos de IBKR', s.brokers.ibkr.actividad ? 'configurados' : 'sin configurar');
html += filaSalud('IA Insights', s.iaConfigurada ? 'configurada' : 'sin configurar');
if (s.historico && !s.historico.error) {
html += filaSalud('Hist&oacute;rico', s.historico.filas + ' d&iacute;as, &uacute;ltimo: ' + esc(s.historico.ultimaFecha));
} else {
html += filaSalud('Hist&oacute;rico', esc((s.historico && s.historico.error) || '?'), false);
}
// Lo que la lectura del resumen no encontro (bloque de cuentas, fila del
// total, fila de Liquidez). Esta pantalla es "¿esta bien mi planilla?" y era
// el unico lugar donde esos avisos no llegaban. Con la planilla sana la lista
// viene vacia y no se dibuja nada: un aviso que aparece siempre es ruido.
// Auditoria del 23/08/2026.
var avs = (s.avisosResumen && s.avisosResumen.length) ? s.avisosResumen : null;
html += filaSalud('Hoja "resumen"', avs ? (avs.length + ' aviso(s)') : '&#10003; sin avisos', !avs);
if (avs) {
avs.forEach(function (a) { html += '<p class="newsempty" style="margin:2px 0 0">' + esc(a) + '</p>'; });
}
out.innerHTML = html;
}).withFailureHandler(function (err) {
btn._busy = false;
out.innerHTML = '<p class="newsempty">' + esc(msgErr(err, 'El diagnóstico')) + '</p>';
}).getSalud();
};

// ---------- Configuración: la clave de Finnhub ----------
// (Fase 2, paso 3: la puerta de entrada. El backend PRUEBA la clave contra
// Finnhub antes de guardarla — aca solo se pega y se muestra el resultado.
// Va a alimentar los precios y el calendario de resultados cuando existan.)
var fhConfigurada = null;
function cargarEstadoFinnhub() {
google.script.run.withSuccessHandler(function (st) {
fhConfigurada = !!(st && st.configurada);
var t = document.getElementById('fhEstadoTxt');
if (t) t.innerHTML = fhConfigurada
? '&#10003; Clave configurada. Va a alimentar los precios y el calendario de resultados de las empresas.'
: 'Sin configurar. Entr&aacute; a <b>finnhub.io</b> con tu cuenta, copi&aacute; la "API Key" y pegala ac&aacute;. Antes de guardarla se prueba contra Finnhub; se guarda en tu servidor privado de Cloudflare, nunca en esta p&aacute;gina.';
}).withFailureHandler(function () {}).estadoFinnhub();
}
document.getElementById('fhKeyGuardar').onclick = function () {
var inp = document.getElementById('fhKey');
// guardarConBoton vive en brokers.js (el conductor unico de credenciales);
// se referencia recien al tocar el boton, cuando ya cargo todo.
guardarConBoton({
btn: this, inputs: [inp], resId: 'fhKeyResultado',
sujeto: 'La clave de Finnhub', exito: 'Clave verificada y guardada.',
alOk: cargarEstadoFinnhub,
pedir: function (ok, fail) {
google.script.run.withSuccessHandler(ok).withFailureHandler(fail).guardarClaveFinnhub({ apiKey: inp.value });
}
});
};
