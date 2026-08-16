// IBKR, helpers de sync, Binance manual, Schwab
// ---------- Configuración: conexión IBKR ----------
// ---------- Helpers compartidos de sincronizacion ----------
// Habia CUATRO traductores de error identicos (ibkrMsgErr, bnbMsgErr, csMsgErr,
// actErrMsg) que solo cambiaban el sujeto de la frase, y cada funcion nueva del
// backend pedia el suyo. Ahora es uno solo.
function msgErr(err, sujeto) {
var m = (err && err.message) ? err.message : String(err);
if (m.indexOf('unknown_fn') === -1) return m;
return (sujeto ? sujeto + ' se activa' : 'Se activa') +
' con la pr&oacute;xima actualizaci&oacute;n del servidor. Avisale a Claude que despliegue el backend.';
}
// El mismo mensaje, pero para una respuesta {ok:false, mensajes:[...]}.
function msgBackend(r) {
return ((r && r.mensajes) || ['no se pudo sincronizar']).join(' ');
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
function cargarEstadoIBKR() {
var t = document.getElementById('ibkrEstadoTxt');
t.innerHTML = 'Comprobando configuraci&oacute;n...';
google.script.run.withSuccessHandler(function (st) {
var wrap = document.getElementById('ibkrSyncWrap');
var syncCard = document.getElementById('ibkrSyncCard');
if (syncCard) syncCard.style.display = (st && st.configurada) ? '' : 'none';
if (st && st.configurada) {
var html = '&#10003; Conectado a IBKR. La hoja IB se actualiza sola una vez por d&iacute;a (~8:00).';
if (st.ultimaSync && st.ultimaSync.cuando) {
html += '<br>&Uacute;ltima sincronizaci&oacute;n: ' + (st.ultimaSync.ok ? '' : '&#9888; ') + esc(fechaCortaMs(st.ultimaSync.cuando)) + ' &middot; ' + esc(st.ultimaSync.detalle || '');
}
if (st.triggerDiario === false) html += '<br>&#9888; La sincronizaci&oacute;n diaria autom&aacute;tica no est&aacute; activa: volv&eacute; a guardar la conexi&oacute;n.';
html += st.actividadConfigurada
? '<br>&#10003; Dividendos de IBKR incluidos (consulta de actividad configurada).'
: '<br>Dividendos de IBKR: sin configurar &mdash; cre&aacute; la segunda Flex Query (paso 6 de la ayuda) y guard&aacute; su Query ID abajo.';
t.innerHTML = html;
wrap.style.display = '';
} else {
t.innerHTML = 'Sin configurar. Gener&aacute; el token en el portal de IBKR (pasos ac&aacute; abajo) y pegalo: se guarda en tu Apps Script privado, nunca en esta p&aacute;gina. El acceso es de solo lectura.';
wrap.style.display = 'none';
}
}).withFailureHandler(function (err) {
t.innerHTML = esc(msgErr(err, 'La conexión IBKR'));
}).estadoIBKR();
}
document.getElementById('ibkrGuardar').onclick = function () {
var btn = this, tk = document.getElementById('ibkrToken'), q = document.getElementById('ibkrQuery'), qa = document.getElementById('ibkrQueryAct'), res = document.getElementById('ibkrKeyResultado');
btn.disabled = true;
google.script.run.withSuccessHandler(function (r) {
btn.disabled = false;
if (r && r.ok) {
tk.value = ''; q.value = ''; qa.value = '';
res.innerHTML = '<div class="tmsg ok">&#10003; Conexi&oacute;n guardada.' + ((r.mensajes && r.mensajes.length) ? ' ' + esc(r.mensajes.join(' ')) : '') + '</div>';
cargarEstadoIBKR();
} else {
res.innerHTML = '<div class="tmsg err">' + esc(((r && r.mensajes) || ['Error']).join(' ')) + '</div>';
}
}).withFailureHandler(function (err) {
btn.disabled = false;
res.innerHTML = '<div class="tmsg err">' + esc(msgErr(err, 'La conexión IBKR')) + '</div>';
}).guardarConfigIBKR({ token: tk.value, queryId: q.value, queryActId: qa.value });
};
// El backend frena solo las sincronizaciones que dejarian demasiadas
// posiciones en cero (reporte incompleto del broker). Si Guzman ya miro la
// comparacion y sabe que los cierres son reales, este confirm manda forzar.
function confirmarParcial(parcial, quien) {
if (!parcial) return false;
return window.confirm('Varias posiciones quedarían en CERO.\n\nSi vendiste todo eso, está bien. Si no, el reporte de ' + quien + ' vino incompleto y conviene no aplicar.\n\n¿Aplicar igual?');
}
var ibkrSyncEnCurso = false, ibkrParcial = false;
function correrSyncIBKR(dryRun, forzar) {
if (syncEnCurso()) return;
ibkrSyncEnCurso = true;
var out = document.getElementById('ibkrCambios');
var btnAplicar = document.getElementById('ibkrAplicar');
var resEl = document.getElementById('ibkrSyncResultado');
resEl.innerHTML = '';
if (dryRun) btnAplicar.style.display = 'none';
out.innerHTML = '<p class="loadingtxt">' + (dryRun ? 'Consultando IBKR... puede tardar medio minuto (el reporte se genera al momento).' : 'Aplicando cambios en la hoja IB...') + '</p>';
google.script.run.withSuccessHandler(function (r) {
ibkrSyncEnCurso = false;
if (!r || !r.ok) {
out.innerHTML = '';
resEl.innerHTML = '<div class="tmsg err">' + esc(((r && r.mensajes) || ['Error']).join(' ')) + '</div>';
return;
}
var html = '';
if (!r.cambios.length) {
html = '<p class="newsempty" style="margin-top:10px">&#10003; La hoja IB ya coincide con IBKR (' + esc(r.posicionesIBKR) + ' posiciones). Nada para cambiar.</p>';
} else {
html = '<p class="subtotal" style="margin:12px 0 6px">' + (dryRun ? 'Cambios detectados (todav&iacute;a no se aplic&oacute; nada):' : 'Cambios aplicados:') + '</p>';
r.cambios.forEach(function (c) {
var txt;
if (c.tipo === 'qty') txt = '<span class="sym">' + esc(c.symbol) + '</span> cantidad ' + esc(c.antes) + ' &rarr; ' + esc(c.despues);
else if (c.tipo === 'cerrada') txt = '<span class="sym">' + esc(c.symbol) + '</span> cerrada en IBKR &rarr; queda en 0';
else if (c.tipo === 'nueva') txt = '<span class="sym">' + esc(c.symbol) + '</span> nueva &middot; ' + esc(c.despues) + (c.descripcion ? ' &middot; ' + esc(c.descripcion) : '');
else if (c.tipo === 'cash') txt = '<span class="sym">CASH</span> ' + esc(c.antes) + ' &rarr; ' + esc(c.despues);
else txt = esc(c.tipo + ' ' + (c.symbol || ''));
html += '<div class="row"><span>' + txt + '</span></div>';
});
}
(r.mensajes || []).forEach(function (m) { html += '<p class="newsempty">&#9888; ' + esc(m) + '</p>'; });
out.innerHTML = html;
if (dryRun) {
ibkrParcial = !!r.parcial;
btnAplicar.style.display = r.cambios.length ? '' : 'none';
} else {
ibkrParcial = false;
btnAplicar.style.display = 'none';
if (r.cambios.length) resEl.innerHTML = '<div class="tmsg ok">&#10003; Listo. La hoja IB qued&oacute; igual que tu cuenta de IBKR.</div>';
cargarEstadoIBKR();
loadData();
}
}).withFailureHandler(function (err) {
ibkrSyncEnCurso = false;
out.innerHTML = '';
resEl.innerHTML = '<div class="tmsg err">' + esc(msgErr(err, 'La conexión IBKR')) + '</div>';
}).sincronizarIBKR({ dryRun: !!dryRun, forzar: !!forzar });
}
document.getElementById('ibkrVerCambios').onclick = function () { correrSyncIBKR(true); };
document.getElementById('ibkrAplicar').onclick = function () { correrSyncIBKR(false, confirmarParcial(ibkrParcial, 'IBKR')); };
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
? '&#10003; Clave guardada en este dispositivo. Los saldos se leen directo de Binance desde tu tel&eacute;fono y se sincronizan solos al abrir la app (como mucho cada 30 min); la clave solo puede leer, nunca operar ni retirar.'
: 'Sin conectar. Cre&aacute; una clave API de <b>solo lectura</b> en la app de Binance (pasos m&aacute;s abajo) y guardala ac&aacute;: queda &uacute;nicamente en este tel&eacute;fono.';
var u = null; try { u = localStorage.getItem('ga_bnb_ultima'); } catch (e) {}
if (cfg && u) html += '<br>&Uacute;ltima sincronizaci&oacute;n aplicada: ' + esc(u);
t.innerHTML = html;
}
document.getElementById('bnbGuardar').onclick = function () {
var k = document.getElementById('bnbKey').value.trim();
var s = document.getElementById('bnbSecret').value.trim();
var res = document.getElementById('bnbKeyResultado');
if (k.length < 10 || s.length < 10) {
res.innerHTML = '<div class="tmsg err">Peg&aacute; la API Key y la Secret Key completas.</div>';
return;
}
try { localStorage.setItem('ga_bnb', JSON.stringify({ key: k, secret: s })); } catch (e) {}
document.getElementById('bnbKey').value = '';
document.getElementById('bnbSecret').value = '';
res.innerHTML = '<div class="tmsg ok">&#10003; Clave guardada en el dispositivo.</div>';
prepararBNB();
};
document.getElementById('bnbBorrar').onclick = function () {
try { localStorage.removeItem('ga_bnb'); localStorage.removeItem('ga_bnb_ultima'); } catch (e) {}
document.getElementById('bnbKeyResultado').innerHTML = '<div class="tmsg ok">Clave borrada de este dispositivo.</div>';
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
if (!cfg) { fail(new Error('Falta guardar la clave API de Binance.')); return; }
var ws = null, done = false;
function terminar(err, saldos) {
if (done) return;
done = true;
clearTimeout(timer);
try { if (ws) ws.close(); } catch (e) {}
if (err) fail(err); else cb(saldos);
}
var timer = setTimeout(function () { terminar(new Error('Binance no respondió (se agotó el tiempo). Probá de nuevo.')); }, 15000);
try { ws = new WebSocket('wss://ws-api.binance.com/ws-api/v3'); } catch (e) { terminar(e); return; }
ws.onerror = function () { terminar(new Error('No pude conectar con Binance. Revisá tu conexión a internet.')); };
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
var msg = (j.error && j.error.msg) ? j.error.msg : ('Binance respondió con error (' + (j.status || '?') + ').');
if (code === -2015 || code === -2014) msg = 'Binance rechazó la clave API: revisá que esté bien pegada y con el permiso de lectura activo.';
if (code === -1022) msg = 'La firma no validó: revisá la Secret Key (borrala y pegala de nuevo).';
if (code === -1021) msg = 'La hora del teléfono difiere de la de Binance: activá fecha y hora automáticas.';
terminar(new Error(msg));
};
}
var bnbEnCurso = false, bnbSaldos = null;
function correrSyncBNB(dryRun) {
if (syncEnCurso()) return;
bnbEnCurso = true;
var out = document.getElementById('bnbCambios');
var btnAplicar = document.getElementById('bnbAplicar');
var resEl = document.getElementById('bnbSyncResultado');
resEl.innerHTML = '';
if (dryRun) { btnAplicar.style.display = 'none'; bnbSaldos = null; }
out.innerHTML = '<p class="loadingtxt">' + (dryRun ? 'Leyendo tus saldos reales de Binance...' : 'Aplicando en la hoja BNB...') + '</p>';
function fallo(err) {
bnbEnCurso = false;
out.innerHTML = '';
resEl.innerHTML = '<div class="tmsg err">' + esc(msgErr(err, 'La sincronización con Binance')) + '</div>';
}
function render(r) {
bnbEnCurso = false;
if (!r || !r.ok) {
out.innerHTML = '';
resEl.innerHTML = '<div class="tmsg err">' + esc(((r && r.mensajes) || ['Error']).join(' ')) + '</div>';
return;
}
var html = '';
if (!r.cambios.length) {
html = '<p class="newsempty" style="margin-top:10px">&#10003; La hoja BNB ya coincide con Binance (' + esc(r.saldosBinance) + ' saldos). Nada para cambiar.</p>';
} else {
html = '<p class="subtotal" style="margin:12px 0 6px">' + (dryRun ? 'Cambios detectados (todav&iacute;a no se aplic&oacute; nada):' : 'Cambios aplicados:') + '</p>';
r.cambios.forEach(function (c) {
var txt;
if (c.tipo === 'qty') txt = '<span class="sym">' + esc(c.symbol) + '</span> cantidad ' + esc(c.antes) + ' &rarr; ' + esc(c.despues);
else if (c.tipo === 'cerrada') txt = '<span class="sym">' + esc(c.symbol) + '</span> sin saldo en Binance &rarr; queda en 0';
else if (c.tipo === 'nueva') txt = '<span class="sym">' + esc(c.symbol) + '</span> nueva &middot; ' + esc(c.despues);
else txt = esc(c.tipo + ' ' + (c.symbol || ''));
html += '<div class="row"><span>' + txt + '</span></div>';
});
var cerradas = r.cambios.filter(function (c) { return c.tipo === 'cerrada'; }).length;
if (dryRun && cerradas >= 2) {
html += '<p class="newsempty">&#9888; Varias posiciones aparecen sin saldo. Ojo: la clave solo ve la billetera <b>spot</b>; si ten&eacute;s fondos en Binance Earn u otra billetera, NO apliques y avisale a Claude.</p>';
}
}
(r.mensajes || []).forEach(function (m) { html += '<p class="newsempty">&#9888; ' + esc(m) + '</p>'; });
out.innerHTML = html;
if (dryRun) {
btnAplicar.style.display = r.cambios.length ? '' : 'none';
} else {
btnAplicar.style.display = 'none';
if (r.cambios.length) resEl.innerHTML = '<div class="tmsg ok">&#10003; Listo. La hoja BNB qued&oacute; igual que tu cuenta de Binance.</div>';
try { localStorage.setItem('ga_bnb_ultima', fechaCortaMs(Date.now())); } catch (e) {}
prepararBNB();
loadData();
}
}
if (dryRun) {
bnbLeerSaldos(function (saldos) {
bnbSaldos = saldos;
google.script.run.withSuccessHandler(render).withFailureHandler(fallo).sincronizarBNB({ balances: saldos, dryRun: true });
}, fallo);
} else {
if (!bnbSaldos) { bnbEnCurso = false; return; }
google.script.run.withSuccessHandler(render).withFailureHandler(fallo).sincronizarBNB({ balances: bnbSaldos, dryRun: false });
}
}
document.getElementById('bnbVerCambios').onclick = function () { correrSyncBNB(true); };
document.getElementById('bnbAplicar').onclick = function () { correrSyncBNB(false); };

// ---------- Charles Schwab: conexión automática vía SnapTrade ----------
function cargarEstadoCS() {
var t = document.getElementById('csEstadoTxt');
t.innerHTML = 'Comprobando configuraci&oacute;n...';
document.getElementById('csConectarResultado').innerHTML = '';
google.script.run.withSuccessHandler(function (st) {
var sync = document.getElementById('csSyncCard');
var btnCon = document.getElementById('csConectar');
if (!st || !st.configurada) {
t.innerHTML = 'Sin configurar. Cre&aacute; tu cuenta gratis en <b>snaptrade.com</b>, copi&aacute; el clientId y la consumerKey del panel (pasos ac&aacute; abajo) y guardalas: van a tu Apps Script privado, nunca a esta p&aacute;gina.';
sync.style.display = 'none';
btnCon.style.display = 'none';
return;
}
if (!st.conectada) {
t.innerHTML = 'Credenciales guardadas &#10003;. Falta el &uacute;ltimo paso: conectar tu cuenta de Schwab (una sola vez).' + (st.errorCuentas ? '<br>&#9888; ' + esc(st.errorCuentas) : '');
sync.style.display = 'none';
btnCon.style.display = '';
return;
}
var html = '&#10003; Conectado a Schwab v&iacute;a SnapTrade (' + esc((st.cuentas || []).join(', ') || 'cuenta conectada') + '). La hoja CS se actualiza sola una vez por d&iacute;a (~8:00).';
if (st.ultimaSync && st.ultimaSync.cuando) {
html += '<br>&Uacute;ltima sincronizaci&oacute;n: ' + (st.ultimaSync.ok ? '' : '&#9888; ') + esc(fechaCortaMs(st.ultimaSync.cuando)) + ' &middot; ' + esc(st.ultimaSync.detalle || '');
}
t.innerHTML = html;
sync.style.display = '';
btnCon.style.display = 'none';
}).withFailureHandler(function (err) {
t.innerHTML = esc(msgErr(err, 'La conexión con Schwab'));
}).estadoCS();
}
document.getElementById('csGuardar').onclick = function () {
var btn = this, ci = document.getElementById('csClientId'), ck = document.getElementById('csConsumerKey'), res = document.getElementById('csKeyResultado');
btn.disabled = true;
google.script.run.withSuccessHandler(function (r) {
btn.disabled = false;
if (r && r.ok) {
ci.value = ''; ck.value = '';
res.innerHTML = '<div class="tmsg ok">&#10003; Credenciales guardadas. Ahora toc&aacute; "Conectar cuenta Schwab".</div>';
cargarEstadoCS();
} else {
res.innerHTML = '<div class="tmsg err">' + esc(((r && r.mensajes) || ['Error']).join(' ')) + '</div>';
}
}).withFailureHandler(function (err) {
btn.disabled = false;
res.innerHTML = '<div class="tmsg err">' + esc(msgErr(err, 'La conexión con Schwab')) + '</div>';
}).guardarConfigCS({ clientId: ci.value, consumerKey: ck.value });
};
document.getElementById('csConectar').onclick = function () {
var btn = this, res = document.getElementById('csConectarResultado');
btn.disabled = true;
res.innerHTML = '<p class="loadingtxt">Generando el link seguro de conexi&oacute;n...</p>';
google.script.run.withSuccessHandler(function (r) {
btn.disabled = false;
if (r && r.ok && r.url) {
res.innerHTML = '<div class="tmsg ok">Se abri&oacute; el portal de SnapTrade en otra pesta&ntilde;a: entr&aacute; con tu usuario de Schwab y autoriz&aacute; la lectura. Cuando termines, volv&eacute; ac&aacute; y reabr&iacute; esta pantalla.</div>';
try { window.open(safeUrl(r.url), '_blank'); } catch (e) {
res.innerHTML = '<div class="tmsg err">No pude abrir la pesta&ntilde;a. Copi&aacute; el link a mano: ' + esc(r.url) + '</div>';
}
} else {
res.innerHTML = '<div class="tmsg err">' + esc(((r && r.mensajes) || ['Error']).join(' ')) + '</div>';
}
}).withFailureHandler(function (err) {
btn.disabled = false;
res.innerHTML = '<div class="tmsg err">' + esc(msgErr(err, 'La conexión con Schwab')) + '</div>';
}).portalCS();
};
var csEnCurso = false, csParcial = false;
function correrSyncCS(dryRun, forzar) {
if (syncEnCurso()) return;
csEnCurso = true;
var out = document.getElementById('csCambios');
var btnAplicar = document.getElementById('csAplicar');
var resEl = document.getElementById('csSyncResultado');
resEl.innerHTML = '';
if (dryRun) btnAplicar.style.display = 'none';
out.innerHTML = '<p class="loadingtxt">' + (dryRun ? 'Consultando tus posiciones de Schwab...' : 'Aplicando cambios en la hoja CS...') + '</p>';
google.script.run.withSuccessHandler(function (r) {
csEnCurso = false;
if (!r || !r.ok) {
out.innerHTML = '';
resEl.innerHTML = '<div class="tmsg err">' + esc(((r && r.mensajes) || ['Error']).join(' ')) + '</div>';
return;
}
var html = '';
if (!r.cambios.length) {
html = '<p class="newsempty" style="margin-top:10px">&#10003; La hoja CS ya coincide con Schwab (' + esc(r.posicionesIBKR) + ' posiciones). Nada para cambiar.</p>';
} else {
html = '<p class="subtotal" style="margin:12px 0 6px">' + (dryRun ? 'Cambios detectados (todav&iacute;a no se aplic&oacute; nada):' : 'Cambios aplicados:') + '</p>';
r.cambios.forEach(function (c) {
var txt;
if (c.tipo === 'qty') txt = '<span class="sym">' + esc(c.symbol) + '</span> cantidad ' + esc(c.antes) + ' &rarr; ' + esc(c.despues);
else if (c.tipo === 'cerrada') txt = '<span class="sym">' + esc(c.symbol) + '</span> cerrada en Schwab &rarr; queda en 0';
else if (c.tipo === 'nueva') txt = '<span class="sym">' + esc(c.symbol) + '</span> nueva &middot; ' + esc(c.despues) + (c.descripcion ? ' &middot; ' + esc(c.descripcion) : '');
else if (c.tipo === 'cash') txt = '<span class="sym">CASH</span> ' + esc(c.antes) + ' &rarr; ' + esc(c.despues);
else txt = esc(c.tipo + ' ' + (c.symbol || ''));
html += '<div class="row"><span>' + txt + '</span></div>';
});
}
(r.mensajes || []).forEach(function (m) { html += '<p class="newsempty">&#9888; ' + esc(m) + '</p>'; });
out.innerHTML = html;
if (dryRun) {
csParcial = !!r.parcial;
btnAplicar.style.display = r.cambios.length ? '' : 'none';
} else {
csParcial = false;
btnAplicar.style.display = 'none';
if (r.cambios.length) resEl.innerHTML = '<div class="tmsg ok">&#10003; Listo. La hoja CS qued&oacute; igual que tu cuenta de Schwab.</div>';
cargarEstadoCS();
loadData();
}
}).withFailureHandler(function (err) {
csEnCurso = false;
out.innerHTML = '';
resEl.innerHTML = '<div class="tmsg err">' + esc(msgErr(err, 'La conexión con Schwab')) + '</div>';
}).sincronizarCS({ dryRun: !!dryRun, forzar: !!forzar });
}
document.getElementById('csVerCambios').onclick = function () { correrSyncCS(true); };
document.getElementById('csAplicar').onclick = function () { correrSyncCS(false, confirmarParcial(csParcial, 'Schwab')); };
document.getElementById('csBack').onclick = function () { setView('config'); };

