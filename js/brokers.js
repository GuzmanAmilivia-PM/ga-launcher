// IBKR, helpers de sync, Binance manual, Schwab
// ---------- Configuración: conexión IBKR ----------
// ---------- Helpers compartidos de sincronizacion ----------
// Habia CUATRO traductores de error identicos (ibkrMsgErr, bnbMsgErr, csMsgErr,
// actErrMsg) que solo cambiaban el sujeto de la frase, y cada funcion nueva del
// backend pedia el suyo. Ahora es uno solo.
// Devuelve TEXTO PLANO (acentos reales, sin entidades): casi todos los
// llamadores lo pasan por esc(), y una entidad escapada se veia literal.
function msgErr(err, sujeto) {
var m = (err && err.message) ? err.message : String(err);
// Sin señal, Safari tira TypeError('Load failed') y eso se pintaba tal cual en
// media app. La traduccion vive en nucleo.js para que sea la misma en todos lados.
if (typeof esErrorDeRed === 'function' && esErrorDeRed(err)) return MSJ_SIN_RED;
if (m.indexOf('unknown_fn') === -1) return m;
return (sujeto ? sujeto + ' will be active' : 'This will be active') +
' with the server\u2019s next update. Ask Claude to deploy the backend.';
}
// El mismo mensaje, pero para una respuesta {ok:false, mensajes:[...]}.
function msgBackend(r) {
return ((r && r.mensajes) || ['could not sync']).join(' ');
}
// Cualquier sincronizacion en curso bloquea a las demas.
function syncEnCurso() {
return syncTodoEnCurso || ibkrSyncEnCurso || csEnCurso || bnbEnCurso;
}
function fechaCortaMs(ms) {
var d = new Date(ms);
function p2(n) { return (n < 10 ? '0' : '') + n; }
return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
}
// La linea "Ultima sincronizacion: ..." de las pantallas IBKR y Schwab era
// identica en las dos (auditoria 19/08/2026); el Diagnostico usa su propio
// formato (fechaSalud, sin detalle) a proposito.
function ultimaSyncHtml(u) {
if (!u || !u.cuando) return '';
return '<br>Last sync: ' + (u.ok ? '' : '&#9888; ') + esc(fechaCortaMs(u.cuando)) + ' &middot; ' + esc(u.detalle || '');
}
function cargarEstadoIBKR() {
var t = document.getElementById('ibkrEstadoTxt');
t.innerHTML = 'Checking configuration...';
google.script.run.withSuccessHandler(function (st) {
var wrap = document.getElementById('ibkrSyncWrap');
var syncCard = document.getElementById('ibkrSyncCard');
if (syncCard) syncCard.style.display = (st && st.configurada) ? '' : 'none';
if (st && st.configurada) {
var html = '&#10003; Connected to IBKR. The IB sheet updates itself once a day (~8:00).';
html += ultimaSyncHtml(st.ultimaSync);
if (st.triggerDiario === false) html += '<br>&#9888; The automatic daily sync is not active: save the connection again.';
html += st.actividadConfigurada
? '<br>&#10003; IBKR dividends included (activity query configured).'
: '<br>IBKR dividends: not configured &mdash; create the second Flex Query (step 6 of the help) and save its Query ID below.';
t.innerHTML = html;
wrap.style.display = '';
} else {
t.innerHTML = 'Not configured. Generate the token in the IBKR portal (steps below) and paste it: it&rsquo;s saved on your private Cloudflare server, never on this page. This access is read-only.';
wrap.style.display = 'none';
}
}).withFailureHandler(function (err) {
t.innerHTML = esc(msgErr(err, 'The IBKR connection'));
}).estadoIBKR();
}
// ---------- Guardar credenciales (conductor unico) ----------
// Las tres pantallas de credenciales (IBKR, Schwab, IA) hacian lo mismo con
// el esqueleto copiado (E6): deshabilitar el boton, llamar al backend, y
// segun el resultado vaciar los inputs + exito + refrescar el estado, o el
// error legible. De paso, los mensajes extra del backend en el exito ya no
// se pierden (Schwab los descartaba).
function guardarConBoton(cfg) {
var btn = cfg.btn, res = document.getElementById(cfg.resId);
btn.disabled = true;
cfg.pedir(function (r) {
btn.disabled = false;
if (r && r.ok) {
cfg.inputs.forEach(function (i) { i.value = ''; });
res.innerHTML = '<div class="tmsg ok">&#10003; ' + cfg.exito + ((r.mensajes && r.mensajes.length) ? ' ' + esc(r.mensajes.join(' ')) : '') + '</div>';
cfg.alOk();
} else {
res.innerHTML = '<div class="tmsg err">' + esc(msgBackend(r)) + '</div>';
}
}, function (err) {
btn.disabled = false;
res.innerHTML = '<div class="tmsg err">' + esc(msgErr(err, cfg.sujeto)) + '</div>';
});
}
document.getElementById('ibkrGuardar').onclick = function () {
var tk = document.getElementById('ibkrToken'), q = document.getElementById('ibkrQuery'), qa = document.getElementById('ibkrQueryAct');
guardarConBoton({
btn: this, inputs: [tk, q, qa], resId: 'ibkrKeyResultado',
sujeto: 'The IBKR connection', exito: 'Connection saved.',
alOk: cargarEstadoIBKR,
pedir: function (ok, fail) {
google.script.run.withSuccessHandler(ok).withFailureHandler(fail).guardarConfigIBKR({ token: tk.value, queryId: q.value, queryActId: qa.value });
}
});
};
// El backend frena solo las sincronizaciones que dejarian demasiadas
// posiciones en cero (reporte incompleto del broker). Si Guzman ya miro la
// comparacion y sabe que los cierres son reales, este confirm manda forzar.
function confirmarParcial(parcial, quien) {
if (!parcial) return false;
return window.confirm('Several positions would end up at ZERO.\n\nIf you sold all of that, it\u2019s fine. If not, the ' + quien + ' report came in incomplete and you probably shouldn\u2019t apply it.\n\nApply anyway?');
}
// Las tres pantallas de sincronizacion (IBKR, Binance, Schwab) eran tres
// copias del mismo flujo: candado, spinner, lista de cambios, aviso parcial,
// boton Aplicar con confirmacion. Ahora es UN conductor y cada broker es una
// configuracion. Los candados siguen siendo globales porque syncEnCurso() y
// el boton Sincronizar del menu los miran.
function pantallaSync(cfg) {
var parcial = false;
function correr(dryRun, forzar) {
if (syncEnCurso()) return;
cfg.lock(true);
var out = document.getElementById(cfg.pref + 'Cambios');
var btnAplicar = document.getElementById(cfg.pref + 'Aplicar');
var resEl = document.getElementById(cfg.pref + 'SyncResultado');
resEl.innerHTML = '';
if (dryRun) { btnAplicar.style.display = 'none'; if (cfg.alEmpezarDry) cfg.alEmpezarDry(); }
out.innerHTML = '<p class="loadingtxt">' + (dryRun ? cfg.cargandoDry : cfg.cargandoApply) + '</p>';
function fallo(err) {
cfg.lock(false);
out.innerHTML = '';
resEl.innerHTML = '<div class="tmsg err">' + esc(msgErr(err, cfg.sujeto)) + '</div>';
}
function pintar(r) {
cfg.lock(false);
if (!r || !r.ok) {
out.innerHTML = '';
resEl.innerHTML = '<div class="tmsg err">' + esc(msgBackend(r)) + '</div>';
return;
}
var html = '';
if (!r.cambios.length) {
html = '<p class="newsempty" style="margin-top:10px">&#10003; The ' + cfg.hoja + ' sheet already matches ' + cfg.broker + ' (' + esc(cfg.total(r)) + ' ' + cfg.unidad + '). Nothing to change.</p>';
} else {
html = '<p class="subtotal" style="margin:12px 0 6px">' + (dryRun ? 'Changes detected (nothing applied yet):' : 'Changes applied:') + '</p>';
r.cambios.forEach(function (c) {
var txt;
if (c.tipo === 'qty') txt = '<span class="sym">' + esc(c.symbol) + '</span> quantity ' + esc(c.antes) + ' &rarr; ' + esc(c.despues);
else if (c.tipo === 'cerrada') txt = '<span class="sym">' + esc(c.symbol) + '</span> ' + cfg.cerradaTxt + ' &rarr; now at 0';
else if (c.tipo === 'nueva') txt = '<span class="sym">' + esc(c.symbol) + '</span> new &middot; ' + esc(c.despues) + (c.descripcion ? ' &middot; ' + esc(c.descripcion) : '');
else if (c.tipo === 'cash') txt = '<span class="sym">CASH</span> ' + esc(c.antes) + ' &rarr; ' + esc(c.despues);
else if (c.tipo === 'costo') txt = '<span class="sym">' + esc(c.symbol) + '</span> buy price ' + (c.antes ? esc(c.antes) : '&mdash;') + ' &rarr; ' + esc(c.despues);
else txt = esc(c.tipo + ' ' + (c.symbol || ''));
html += '<div class="row"><span>' + txt + '</span></div>';
});
if (dryRun && cfg.hintDry) { var h = cfg.hintDry(r); if (h) html += h; }
}
(r.mensajes || []).forEach(function (m) { html += '<p class="newsempty">&#9888; ' + esc(m) + '</p>'; });
out.innerHTML = html;
if (dryRun) {
parcial = !!r.parcial;
btnAplicar.style.display = r.cambios.length ? '' : 'none';
} else {
parcial = false;
btnAplicar.style.display = 'none';
if (r.cambios.length) resEl.innerHTML = '<div class="tmsg ok">&#10003; Done. The ' + cfg.hoja + ' sheet now matches your ' + cfg.broker + ' account.</div>';
cfg.alAplicar();
loadData();
}
}
cfg.ejecutar(dryRun, !!forzar, pintar, fallo);
}
document.getElementById(cfg.pref + 'VerCambios').onclick = function () { correr(true); };
document.getElementById(cfg.pref + 'Aplicar').onclick = function () {
// Con reporte parcial, CANCELAR el confirm tiene que no hacer NADA: antes
// igual salia correr(false, false) — un pedido que el backend rechaza — y
// la lista de cambios detectados se borraba y aparecia un error rojo por
// haber elegido "no" (auditoria 31/08/2026).
if (parcial) {
if (!confirmarParcial(parcial, cfg.broker)) return;
correr(false, true);
return;
}
correr(false, false);
};
return correr;
}
var ibkrSyncEnCurso = false;
pantallaSync({
pref: 'ibkr', hoja: 'IB', broker: 'IBKR', unidad: 'positions',
sujeto: 'The IBKR connection',
cargandoDry: 'Checking IBKR... this can take half a minute (the report is generated on the spot).',
cargandoApply: 'Applying changes to the IB sheet...',
cerradaTxt: 'closed at IBKR',
total: function (r) { return r.posicionesBroker; },
lock: function (v) { ibkrSyncEnCurso = v; },
alAplicar: function () { cargarEstadoIBKR(); },
ejecutar: function (dryRun, forzar, ok, fail) {
google.script.run.withSuccessHandler(ok).withFailureHandler(fail).sincronizarIBKR({ dryRun: dryRun, forzar: forzar });
}
});
document.getElementById('ibkrBack').onclick = function () { setView('config'); };

// ---------- Binance: saldos en vivo (WebSocket + clave de solo lectura) ----------
// El REST de Binance no pasa el CORS del navegador (el preflight no habilita
// el header de la API key), pero su API por WebSocket sí funciona. La clave
// vive SOLO en este dispositivo (localStorage ga_bnb, detrás del bloqueo de
// la app); el backend nunca la ve: recibe únicamente la lista de saldos.
function bnbConfig() {
try { var j = JSON.parse(localStorage.getItem('ga_bnb') || 'null'); if (j && j.key && j.secret) return j; } catch (e) {}
return null;
}
function prepararBNB() {
var cfg = bnbConfig();
var t = document.getElementById('bnbEstadoTxt');
document.getElementById('bnbSyncCard').style.display = cfg ? '' : 'none';
document.getElementById('bnbBorrar').style.display = cfg ? '' : 'none';
var html = cfg
? '&#10003; Key saved on this device. Balances are read directly from Binance on your phone and sync automatically when the app opens (at most every 30 min); the key can only read, never trade or withdraw.'
: 'Not connected. Create a <b>read-only</b> API key in the Binance app (steps further below) and save it here: it stays only on this phone.';
var u = null; try { u = localStorage.getItem('ga_bnb_ultima'); } catch (e) {}
if (cfg && u) html += '<br>Last sync applied: ' + esc(u);
t.innerHTML = html;
}
document.getElementById('bnbGuardar').onclick = function () {
var k = document.getElementById('bnbKey').value.trim();
var s = document.getElementById('bnbSecret').value.trim();
var res = document.getElementById('bnbKeyResultado');
if (k.length < 10 || s.length < 10) {
res.innerHTML = '<div class="tmsg err">Paste the full API Key and Secret Key.</div>';
return;
}
try { localStorage.setItem('ga_bnb', JSON.stringify({ key: k, secret: s })); } catch (e) {}
document.getElementById('bnbKey').value = '';
document.getElementById('bnbSecret').value = '';
res.innerHTML = '<div class="tmsg ok">&#10003; Key saved on the device.</div>';
prepararBNB();
};
document.getElementById('bnbBorrar').onclick = function () {
try { localStorage.removeItem('ga_bnb'); localStorage.removeItem('ga_bnb_ultima'); } catch (e) {}
document.getElementById('bnbKeyResultado').innerHTML = '<div class="tmsg ok">Key deleted from this device.</div>';
prepararBNB();
};
document.getElementById('bnbBack').onclick = function () { setView('config'); };

// Firma HMAC-SHA256 en hexadecimal, calculada en el propio teléfono.
function bnbFirmar(secret, payload) {
var enc = new TextEncoder();
return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
.then(function (k) { return crypto.subtle.sign('HMAC', k, enc.encode(payload)); })
.then(function (buf) {
return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
});
}
// Lee los saldos spot con una petición firmada de account.status.
function bnbLeerSaldos(cb, fail) {
var cfg = bnbConfig();
if (!cfg) { fail(new Error('The Binance API key needs to be saved first.')); return; }
var ws = null, done = false;
function terminar(err, saldos) {
if (done) return;
done = true;
clearTimeout(timer);
try { if (ws) ws.close(); } catch (e) {}
if (err) fail(err); else cb(saldos);
}
var timer = setTimeout(function () { terminar(new Error('Binance did not respond (timed out). Try again.')); }, 15000);
try { ws = new WebSocket('wss://ws-api.binance.com/ws-api/v3'); } catch (e) { terminar(e); return; }
ws.onerror = function () { terminar(new Error('Could not connect to Binance. Check your internet connection.')); };
ws.onopen = function () {
var ts = Date.now();
// Los parámetros van ordenados alfabéticamente en la firma.
var payload = 'apiKey=' + cfg.key + '&recvWindow=10000&timestamp=' + ts;
bnbFirmar(cfg.secret, payload).then(function (sig) {
ws.send(JSON.stringify({ id: 'ga-' + ts, method: 'account.status', params: { apiKey: cfg.key, recvWindow: 10000, timestamp: ts, signature: sig } }));
}).catch(function (e) { terminar(e); });
};
ws.onmessage = function (ev) {
var j = null;
try { j = JSON.parse(ev.data); } catch (e) { return; }
if (!j || j.id === undefined) return;
if (j.status === 200 && j.result && j.result.balances) {
var saldos = [];
j.result.balances.forEach(function (b) {
var qty = (parseFloat(b.free) || 0) + (parseFloat(b.locked) || 0);
if (qty > 1e-8) saldos.push({ symbol: String(b.asset || '').toUpperCase(), qty: qty });
});
terminar(null, saldos);
return;
}
var code = j.error && j.error.code;
var msg = (j.error && j.error.msg) ? j.error.msg : ('Binance responded with an error (' + (j.status || '?') + ').');
if (code === -2015 || code === -2014) msg = 'Binance rejected the API key: check it was pasted correctly and has read permission enabled.';
if (code === -1022) msg = 'The signature did not validate: check the Secret Key (delete it and paste it again).';
if (code === -1021) msg = 'Your phone\u2019s clock differs from Binance\u2019s: enable automatic date and time.';
terminar(new Error(msg));
};
}
var bnbEnCurso = false;
// UNICO punto de escritura del candado de Binance: lo usan la pantalla de
// sync (cfg.lock) y el protocolo bnbSincronizar (sincronizar.js). Tenia tres
// escritores sueltos en dos archivos, y este candado ya tiene historial de
// quedar trabado para siempre (auditoria 19/08/2026).
function bnbLock(v) { bnbEnCurso = v; }
// Binance difiere en el origen de los datos: los saldos se leen EN EL
// TELEFONO (dry run) y se reusan al aplicar. El resto del flujo es el
// conductor comun — incluida la confirmacion de reporte parcial, que a esta
// pantalla ANTES le faltaba: solo avisaba y dejaba aplicar igual.
var bnbSaldosLeidos = null;
pantallaSync({
pref: 'bnb', hoja: 'BNB', broker: 'Binance', unidad: 'balances',
sujeto: 'The sync with Binance',
cargandoDry: 'Reading your real Binance balances...',
cargandoApply: 'Applying to the BNB sheet...',
cerradaTxt: 'no balance on Binance',
total: function (r) { return r.saldosBinance; },
lock: bnbLock,
alEmpezarDry: function () { bnbSaldosLeidos = null; },
alAplicar: function () {
try { localStorage.setItem('ga_bnb_ultima', fechaCortaMs(Date.now())); } catch (e) {}
prepararBNB();
},
hintDry: function (r) {
var cerradas = r.cambios.filter(function (c) { return c.tipo === 'cerrada'; }).length;
// El umbral es EL MISMO que frena la sync automatica (BNB_CERRADAS_FRENO,
// sincronizar.js — corre en runtime, el orden de carga no molesta).
if (cerradas < BNB_CERRADAS_FRENO) return '';
return '<p class="newsempty">&#9888; Several positions show no balance. Careful: the key only sees the <b>spot</b> wallet; if you have funds in Binance Earn or another wallet, do NOT apply and ask Claude.</p>';
},
ejecutar: function (dryRun, forzar, ok, fail) {
if (dryRun) {
bnbLeerSaldos(function (saldos) {
bnbSaldosLeidos = saldos;
google.script.run.withSuccessHandler(ok).withFailureHandler(fail).sincronizarBNB({ balances: saldos, dryRun: true });
}, fail);
} else {
if (!bnbSaldosLeidos) { bnbLock(false); return; }
google.script.run.withSuccessHandler(ok).withFailureHandler(fail).sincronizarBNB({ balances: bnbSaldosLeidos, dryRun: false, forzar: forzar });
}
}
});

// ---------- Charles Schwab: conexión automática vía SnapTrade ----------
function cargarEstadoCS() {
var t = document.getElementById('csEstadoTxt');
t.innerHTML = 'Checking configuration...';
document.getElementById('csConectarResultado').innerHTML = '';
google.script.run.withSuccessHandler(function (st) {
var sync = document.getElementById('csSyncCard');
var btnCon = document.getElementById('csConectar');
if (!st || !st.configurada) {
t.innerHTML = 'Not configured. Create a free account at <b>snaptrade.com</b>, copy the clientId and consumerKey from the dashboard (steps below) and save them: they go to your private Cloudflare server, never to this page.';
sync.style.display = 'none';
btnCon.style.display = 'none';
return;
}
if (!st.conectada) {
t.innerHTML = 'Credentials saved &#10003;. One last step is missing: connect your Schwab account (just once).' + (st.errorCuentas ? '<br>&#9888; ' + esc(st.errorCuentas) : '');
sync.style.display = 'none';
btnCon.style.display = '';
return;
}
var html = '&#10003; Connected to Schwab via SnapTrade (' + esc((st.cuentas || []).join(', ') || 'connected account') + '). The CS sheet updates itself once a day (~8:00).';
html += ultimaSyncHtml(st.ultimaSync);
t.innerHTML = html;
sync.style.display = '';
btnCon.style.display = 'none';
}).withFailureHandler(function (err) {
t.innerHTML = esc(msgErr(err, 'The Schwab connection'));
}).estadoCS();
}
document.getElementById('csGuardar').onclick = function () {
var ci = document.getElementById('csClientId'), ck = document.getElementById('csConsumerKey');
guardarConBoton({
btn: this, inputs: [ci, ck], resId: 'csKeyResultado',
sujeto: 'The Schwab connection', exito: 'Credentials saved. Now tap "Connect Schwab account".',
alOk: cargarEstadoCS,
pedir: function (ok, fail) {
google.script.run.withSuccessHandler(ok).withFailureHandler(fail).guardarConfigCS({ clientId: ci.value, consumerKey: ck.value });
}
});
};
document.getElementById('csConectar').onclick = function () {
var btn = this, res = document.getElementById('csConectarResultado');
btn.disabled = true;
res.innerHTML = '<p class="loadingtxt">Generating the secure connection link...</p>';
google.script.run.withSuccessHandler(function (r) {
btn.disabled = false;
if (r && r.ok && r.url) {
res.innerHTML = '<div class="tmsg ok">The SnapTrade portal opened in another tab: log in with your Schwab user and authorize read access. When you\u2019re done, come back here and reopen this screen.</div>';
try { window.open(safeUrl(r.url), '_blank'); } catch (e) {
res.innerHTML = '<div class="tmsg err">Could not open the tab. Copy the link manually: ' + esc(r.url) + '</div>';
}
} else {
res.innerHTML = '<div class="tmsg err">' + esc(((r && r.mensajes) || ['Error']).join(' ')) + '</div>';
}
}).withFailureHandler(function (err) {
btn.disabled = false;
res.innerHTML = '<div class="tmsg err">' + esc(msgErr(err, 'The Schwab connection')) + '</div>';
}).portalCS();
};
var csEnCurso = false;
pantallaSync({
pref: 'cs', hoja: 'CS', broker: 'Schwab', unidad: 'positions',
sujeto: 'The Schwab connection',
cargandoDry: 'Checking your Schwab positions...',
cargandoApply: 'Applying changes to the CS sheet...',
cerradaTxt: 'closed at Schwab',
total: function (r) { return r.posicionesBroker; },
lock: function (v) { csEnCurso = v; },
alAplicar: function () { cargarEstadoCS(); },
ejecutar: function (dryRun, forzar, ok, fail) {
google.script.run.withSuccessHandler(ok).withFailureHandler(fail).sincronizarCS({ dryRun: dryRun, forzar: forzar });
}
});
document.getElementById('csBack').onclick = function () { setView('config'); };

