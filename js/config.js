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
function buildCashForm() {
var sel = document.getElementById('cashCuenta');
sel.innerHTML = '';
ACCOUNTS.forEach(function (a) {
var o = document.createElement('option');
o.value = a.key; o.textContent = nombrePlataforma(a.nombre);
sel.appendChild(o);
});
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
google.script.run.withSuccessHandler(renderTransacciones).getTransacciones();
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
function temaChart() {
return esTemaClaro()
? { tick: '#5d6c85', grid: 'rgba(20,40,80,.08)', pieBorder: '#ffffff' }
: { tick: '#90a0b8', grid: 'rgba(255,255,255,.05)', pieBorder: '#0d1420' };
}
function pintarTemaBtns() {
var claro = esTemaClaro();
document.getElementById('temaOscuroBtn').className = 'tipobtn' + (claro ? '' : ' active-compra');
document.getElementById('temaClaroBtn').className = 'tipobtn' + (claro ? ' active-compra' : '');
}
function setTema(claro) {
document.documentElement.classList.toggle('light', claro);
try { localStorage.setItem('ga_tema', claro ? 'claro' : 'oscuro'); } catch (e) {}
pintarTemaBtns();
if (lastData) render(lastData);
if (lastAcc && lastAccData) renderAccount(lastAcc, lastAccData);
}
document.getElementById('temaOscuroBtn').onclick = function () { setTema(false); };
document.getElementById('temaClaroBtn').onclick = function () { setTema(true); };
pintarTemaBtns();

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
if (bq._confirm) {
google.script.run.withSuccessHandler(function (res) {
platsMsg(esc(((res && res.mensajes) || []).join(' ')), res && res.ok);
cargarPlataformas(); loadData();
}).withFailureHandler(function (err) { platsMsg('Error: ' + esc(err.message), false); }).quitarPlataforma({ nombre: pl.nombre });
} else {
bq._confirm = true; bq.textContent = '\u00bfSeguro?';
setTimeout(function () { bq._confirm = false; bq.textContent = 'Quitar'; }, 3000);
}
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

