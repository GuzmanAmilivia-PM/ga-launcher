// Protocolo Binance, boton Sincronizar, Deshacer
// El protocolo completo de Binance en UN solo lugar: leer los saldos en el
// telefono, comparar, frenar si parece que los fondos estan en Earn, aplicar y
// dejar la marca de "ultima". Antes estaba escrito dos veces (auto y menu) y el
// umbral de posiciones en cero tenia dos redacciones distintas.
var BNB_CERRADAS_FRENO = 2;
var BNB_AVISO_EARN = 'Binance: several positions show no balance (funds in Earn?). ' +
'Nothing was applied &mdash; check it in Keys &rarr; Platforms &rarr; Binance.';
function bnbSincronizar(cb) {
var alOk = cb.alOk || function () {};
var alError = cb.alError || function () {};
function fin() { bnbLock(false); }
bnbLock(true);
bnbLeerSaldos(function (saldos) {
google.script.run.withSuccessHandler(function (r) {
if (!r || !r.ok) { fin(); alError(msgBackend(r)); return; }
if (!r.cambios || !r.cambios.length) { fin(); alOk(r); return; }
var cerradas = r.cambios.filter(function (c) { return c.tipo === 'cerrada'; }).length;
if (cerradas >= BNB_CERRADAS_FRENO) { fin(); alError(BNB_AVISO_EARN); return; }
google.script.run.withSuccessHandler(function (r2) {
fin();
if (!r2 || !r2.ok) { alError(msgBackend(r2)); return; }
try { localStorage.setItem('ga_bnb_ultima', fechaCortaMs(Date.now())); } catch (e) {}
alOk(r2);
}).withFailureHandler(function (err) { fin(); alError(msgErr(err, 'The sync with Binance')); })
.sincronizarBNB({ balances: saldos, dryRun: false });
}).withFailureHandler(function (err) { fin(); alError(msgErr(err, 'The sync with Binance')); })
.sincronizarBNB({ balances: saldos, dryRun: true });
}, function () { fin(); alError('could not read balances from the phone.'); });
}
function bnbAutoSync() {
if (!bnbConfig() || !getApiToken() || syncEnCurso()) return;
var ts = 0;
try { ts = parseInt(localStorage.getItem('ga_bnb_auto_ts') || '0', 10) || 0; } catch (e) {}
if (Date.now() - ts < BNB_AUTO_MIN_MS) return;
try { localStorage.setItem('ga_bnb_auto_ts', String(Date.now())); } catch (e) {}
bnbSincronizar({
alOk: function (r) {
var n = (r.cambios || []).length;
if (!n) return; // sin cambios: no vale la pena molestar
loadData();
avisoInicio('&#10003; Binance synced: ' + n + ' change' + (n === 1 ? '' : 's') + ' applied.', true);
},
// La sync automatica es silenciosa salvo el caso de Earn, que es el unico
// que pide una decision del usuario.
alError: function (msg) { if (msg === BNB_AVISO_EARN) avisoInicio('&#9888; ' + msg); }
});
}

// ---------- Sincronizar todo (menu) ----------
// Corre en cadena IBKR -> Schwab -> Binance -> refrescar precios. Cada broker
// que no este configurado se saltea en silencio (sinConfig del backend, o
// bnbConfig() vacio en el caso de Binance, que se lee desde el telefono).
// Nunca corre en paralelo con las sincronizaciones manuales de cada plataforma.
// syncTodoEnCurso es el UNICO candado de la cadena: las sincronizaciones
// manuales ya lo miran en su guarda de entrada. Antes esta funcion ponia y
// sacaba a mano los tres candados ajenos en 11 puntos, y cada rama de error
// nueva era una chance de dejar uno trabado para siempre.
var syncTodoEnCurso = false;
function sincronizarTodo() {
if (syncEnCurso()) return;
syncTodoEnCurso = true;
var txt = document.getElementById('mRefrescarTxt');
var lineas = [], huboError = false;
function paso(n) { txt.textContent = n; }
function ok(nombre, r) {
var n = ((r && r.cambios) || []).length;
lineas.push('&#10003; ' + nombre + ': ' + (n ? n + ' change' + (n === 1 ? '' : 's') : 'no changes'));
}
function error(nombre, msg) {
huboError = true;
lineas.push('&#9888; ' + nombre + ': ' + esc(msg));
}
function terminar() {
syncTodoEnCurso = false;
txt.textContent = 'Sync';
toggleMenu(false);
loadData();
if (lineas.length) avisoInicio(lineas.join('<br>'), !huboError);
}
// Un paso de broker: saltea si no esta configurado, anota el resultado y
// sigue con el siguiente pase lo que pase.
function paso1Broker(cfg, sig) {
paso('Syncing ' + cfg.nombre + '...');
google.script.run.withSuccessHandler(function (r) {
if (r && r.sinConfig) { sig(); return; }
if (!r || !r.ok) error(cfg.nombre, msgBackend(r));
else { ok(cfg.nombre, r); if (cfg.alOk) cfg.alOk(); }
sig();
}).withFailureHandler(function (err) {
error(cfg.nombre, msgErr(err, cfg.nombre));
sig();
})[cfg.fn]({ dryRun: false });
}
function precios() {
// Desde el 5/09/2026 el paso final ya no refresca formulas (no hay): estampa
// el historico del dia con los totales frescos. El nombre de la fn del
// contrato (refrescarPrecios -> 'refrescar') se conserva.
paso("Saving today's totals...");
google.script.run.withSuccessHandler(terminar).withFailureHandler(function () {
error("History", "could not save today's totals.");
terminar();
}).refrescarPrecios();
}
function binance() {
if (!bnbConfig()) { precios(); return; }
paso('Syncing Binance...');
bnbSincronizar({
alOk: function (r) { ok('Binance', r); precios(); },
alError: function (msg) { error('Binance', msg); precios(); }
});
}
function schwab() {
paso1Broker({ nombre: 'Schwab', fn: 'sincronizarCS', alOk: refrescarVistaCS }, binance);
}
paso1Broker({ nombre: 'IBKR', fn: 'sincronizarIBKR', alOk: refrescarVistaIBKR }, schwab);
}
// Las pantallas de estado de cada broker solo se refrescan si estan a la
// vista: si no, es un viaje al backend (y en Schwab una llamada externa a
// SnapTrade) para pintar algo que nadie mira.
function refrescarVistaCS() { if (currentView === 'cs') cargarEstadoCS(); }
function refrescarVistaIBKR() { if (currentView === 'ibkr') cargarEstadoIBKR(); }

// ---------- Deshacer: respaldos de las hojas ----------
// El backend guarda una foto de la hoja antes de cada escritura automatica.
// Aca se listan y se puede volver atras. Restaurar tambien deja respaldo, asi
// que tocarlo por error se deshace tocandolo de nuevo.
// (fechaBackup era una copia de fechaSalud, config.js; se unificaron en E6.)
var bakEnCurso = false;
function cargarBackups() {
var cont = document.getElementById('bakList');
if (!cont) return;
cont.innerHTML = '<p class="loadingtxt">Loading...</p>';
google.script.run.withSuccessHandler(function (r) {
if (!r || !r.ok) { errorEnVista('bakList', null, 'las copias'); return; }
if (!r.backups.length) { cont.innerHTML = '<div class="vacio"><span class="vic">&#128190;</span><b>No backups yet</b>They save automatically before each sync or operation.</div>'; return; }
cont.innerHTML = r.backups.map(function (b) {
return '<div class="row"><span>' + esc(nombrePlataforma(b.hoja)) +
'<br><span class="newsempty">' + esc(fechaSalud(b.cuando)) + (b.motivo ? ' &middot; ' + esc(b.motivo) : '') + '</span></span>' +
'<button class="ghostbtn bakBtn" data-hoja="' + esc(b.hoja) + '" data-cuando="' + esc(b.cuando) + '" style="width:auto;padding:6px 12px;margin:0">Revert to this</button></div>';
}).join('');
Array.prototype.forEach.call(cont.querySelectorAll('.bakBtn'), function (btn) {
btn.onclick = function () { restaurarHoja(btn.getAttribute('data-hoja'), btn.getAttribute('data-cuando')); };
});
}).withFailureHandler(function (err) {
errorEnVista('bakList', err, 'las copias');
}).listarBackups();
}
function restaurarHoja(hoja, cuando) {
if (bakEnCurso) return;
if (!window.confirm('The ' + hoja + ' sheet will go back to how it was in that backup.\n\nWhat\u2019s there now gets saved too, so this can also be undone.\n\nContinue?')) return;
bakEnCurso = true;
var res = document.getElementById('bakResultado');
res.innerHTML = '<p class="loadingtxt">Restoring ' + esc(hoja) + '...</p>';
google.script.run.withSuccessHandler(function (r) {
bakEnCurso = false;
if (!r || !r.ok) {
res.innerHTML = '<div class="tmsg err">' + esc(((r && r.mensajes) || ['Could not restore.']).join(' ')) + '</div>';
return;
}
res.innerHTML = '<div class="tmsg ok">&#10003; ' + esc((r.mensajes || ['Done.']).join(' ')) + '</div>';
cargarBackups();
loadData();
}).withFailureHandler(function (err) {
bakEnCurso = false;
res.innerHTML = '<div class="tmsg err">' + esc(err && err.message ? err.message : 'Could not restore.') + '</div>';
}).restaurarBackup({ hoja: hoja, cuando: cuando || '' });
}

