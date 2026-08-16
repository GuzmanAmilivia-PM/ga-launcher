// Bloqueo local: biometria y clave
// ---------- Seguridad (bloqueo local: biometría y/o clave) ----------
// La clave se guarda como hash SHA-256 y la biometría como credencial WebAuthn
// del dispositivo (Face ID / huella). Es un bloqueo de acceso local en este
// dispositivo; los datos siguen protegidos por la clave de la API.
function secLeer() { try { return JSON.parse(localStorage.getItem('ga_sec') || '{}'); } catch (e) { return {}; } }
function secGuardar(s) { try { localStorage.setItem('ga_sec', JSON.stringify(s)); } catch (e) {} }
function b64u(buf) { var a = new Uint8Array(buf), s = ''; for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64uBytes(b) { b = b.replace(/-/g, '+').replace(/_/g, '/'); var s = atob(b), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
function hashPin(pin) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode('ga-sec|' + pin)).then(b64u); }
function bioDisponible() {
if (!window.PublicKeyCredential || !navigator.credentials || !window.isSecureContext) return Promise.resolve(false);
try { return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function () { return false; }); } catch (e) { return Promise.resolve(false); }
}
function bioRegistrar() {
return navigator.credentials.create({ publicKey: {
challenge: crypto.getRandomValues(new Uint8Array(32)),
rp: { name: 'GA Portfolio', id: location.hostname },
user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'GA', displayName: 'GA Portfolio' },
pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
timeout: 60000
} });
}
// Una sola peticion de WebAuthn viva a la vez: si queda una pendiente (el
// usuario cerro la hoja de Face ID sin responder, o el intento automatico
// sigue abierto), el navegador rechaza las siguientes al toque y el sensor
// no vuelve a aparecer. Por eso se aborta la anterior antes de pedir otra.
var bioAbort = null;
function bioVerificar(idB64) {
try { if (bioAbort) bioAbort.abort(); } catch (e) {}
bioAbort = (typeof AbortController !== 'undefined') ? new AbortController() : null;
var opts = { publicKey: {
challenge: crypto.getRandomValues(new Uint8Array(32)),
rpId: location.hostname,
allowCredentials: [{ type: 'public-key', id: b64uBytes(idB64) }],
userVerification: 'required',
timeout: 60000
} };
if (bioAbort) opts.signal = bioAbort.signal;
return navigator.credentials.get(opts);
}
// Mensaje segun el error real de WebAuthn (antes se tragaba el motivo y siempre
// decia lo mismo, imposible de diagnosticar desde el celular).
function bioErrTxt(err, haySalida) {
var n = (err && err.name) ? err.name : '';
var extra = haySalida ? ' Us\u00e1 la clave.' : ' Si sigue fallando, toc\u00e1 "No puedo entrar".';
if (n === 'NotAllowedError') return 'Cancelado o sin respuesta del sensor.' + extra;
if (n === 'InvalidStateError') return 'Esta credencial ya no existe en el dispositivo.' + extra;
if (n === 'NotSupportedError' || n === 'SecurityError' || n === 'AbortError') return 'La biometr\u00eda no est\u00e1 disponible ac\u00e1 (' + n + ').' + extra;
return 'No se pudo verificar' + (n ? ' (' + n + ')' : '') + '.' + extra;
}
function segMsg(id, txt, esOk) {
document.getElementById(id).innerHTML = txt ? '<div class="tmsg ' + (esOk ? 'ok' : 'err') + '">' + txt + '</div>' : '';
}
function prepararSeguridad() {
var s = secLeer();
var partes = [];
if (s.bio) partes.push('biometr\u00eda');
if (s.pin) partes.push('clave');
document.getElementById('segEstado').textContent = partes.length
? 'Bloqueo activado con ' + partes.join(' y ') + '. Se pide cada vez que abr\u00eds la app en este dispositivo.'
: 'Sin bloqueo: la app abre directo. Activ\u00e1 la biometr\u00eda o una clave.';
document.getElementById('segPinQuitar').style.display = s.pin ? '' : 'none';
document.getElementById('segPinBtn').textContent = s.pin ? 'Cambiar clave' : 'Guardar clave';
segMsg('segBioMsg', ''); segMsg('segPinMsg', '');
var bioBtn = document.getElementById('segBioBtn');
if (s.bio) { bioBtn.textContent = 'Desactivar biometr\u00eda'; bioBtn.disabled = false; }
else {
bioBtn.textContent = 'Activar biometr\u00eda'; bioBtn.disabled = true;
bioDisponible().then(function (dispo) {
if (dispo) bioBtn.disabled = false;
else bioBtn.textContent = 'Biometr\u00eda no disponible ac\u00e1';
});
}
}
document.getElementById('segBack').onclick = function () { setView('inicio'); };
document.getElementById('segBioBtn').onclick = function () {
var s = secLeer(), btn = this;
if (s.bio) { delete s.bio; secGuardar(s); prepararSeguridad(); segMsg('segBioMsg', '&#10003; Biometr\u00eda desactivada.', true); return; }
btn.disabled = true;
bioRegistrar().then(function (cred) {
s.bio = b64u(cred.rawId);
secGuardar(s); prepararSeguridad();
segMsg('segBioMsg', '&#10003; Listo: la app va a pedir tu biometr\u00eda al abrir.', true);
}).catch(function () {
btn.disabled = false;
segMsg('segBioMsg', 'No se pudo activar. Prob\u00e1 de nuevo.', false);
});
};
document.getElementById('segPinBtn').onclick = function () {
var p1 = document.getElementById('segPin1').value, p2 = document.getElementById('segPin2').value;
if (!/^[0-9]{4,8}$/.test(p1)) { segMsg('segPinMsg', 'La clave debe tener de 4 a 8 d\u00edgitos.', false); return; }
if (p1 !== p2) { segMsg('segPinMsg', 'Las claves no coinciden.', false); return; }
var btn = this;
btn.disabled = true;
hashPin(p1).then(function (h) {
var s = secLeer(); s.pin = h; secGuardar(s);
btn.disabled = false;
document.getElementById('segPin1').value = ''; document.getElementById('segPin2').value = '';
prepararSeguridad();
segMsg('segPinMsg', '&#10003; Clave guardada.', true);
}).catch(function () { btn.disabled = false; segMsg('segPinMsg', 'No se pudo guardar la clave.', false); });
};
document.getElementById('segPinQuitar').onclick = function () {
var s = secLeer(); delete s.pin; secGuardar(s); prepararSeguridad();
segMsg('segPinMsg', '&#10003; Clave quitada.', true);
};
// Arranque: si hay bloqueo configurado y ya hay token, pedir desbloqueo
(function () {
var s = secLeer();
if (!(s.pin || s.bio) || !getApiToken()) return;
var el = document.getElementById('seclock');
el.style.display = 'flex';
// El splash (z 9999) tapa este lock (z 9997) y solo se iba al terminar de
// cargar datos: sin red la app quedaba congelada en el logo. Ahora el lock
// aparece siempre, pase lo que pase con la API.
setTimeout(hideSplash, 700);
// UN solo camino visible por vez. Con biometria Y clave configuradas se
// mostraban dos botones apilados (Desbloquear + Entrar): al pedo. Ahora manda
// la biometria y la clave queda detras del link "Usar la clave".
var elBio = document.getElementById('secBioGo');
var elPin = document.getElementById('secPinWrap');
var elModo = document.getElementById('secModo');
var modoBio = !!s.bio; // el modo activo, tambien frena el tap-para-Face-ID
function pintarModo() {
elBio.style.display = modoBio ? '' : 'none';
elPin.style.display = modoBio ? 'none' : '';
elModo.textContent = modoBio ? 'Usar la clave' : 'Usar Face ID';
document.getElementById('secErr').textContent = '';
if (!modoBio) { try { document.getElementById('secPinInput').focus(); } catch (e) {} }
}
if (s.bio && s.pin) {
elModo.style.display = '';
elModo.onclick = function () { modoBio = !modoBio; pintarModo(); };
}
pintarModo();
// La salida de emergencia se muestra SIEMPRE que haya bloqueo: con solo
// biometria y el sensor fallando, antes no quedaba forma de entrar.
var olv = document.getElementById('secOlvide');
var olvTxt = s.pin ? 'Olvid\u00e9 mi clave' : 'No puedo entrar';
olv.textContent = olvTxt;
olv.style.display = '';
function abrir() { el.style.display = 'none'; document.getElementById('secErr').textContent = ''; hideSplash(); }
// Intento de biometria. `auto` = disparado solo al abrir la app, sin toque:
// Safari exige un gesto del usuario para WebAuthn, asi que si ese intento se
// rechaza no se muestra error, queda el boton para reintentar a mano.
function intentarBio(auto) {
var err = document.getElementById('secErr');
if (!auto) err.textContent = '';
// El boton NUNCA se deshabilita: si la peticion queda colgada (el caso que
// dejaba la app trancada), volver a tocarlo aborta la anterior y reintenta.
var btn = document.getElementById('secBioGo');
if (!auto) btn.textContent = 'Verificando...';
return bioVerificar(s.bio).then(function () {
btn.textContent = 'Desbloquear';
abrir();
}).catch(function (e) {
// Si el intento automatico se rechaza es, casi siempre, porque iOS pide un
// gesto: se invita a tocar en vez de mostrar un error.
btn.textContent = auto ? 'Toc\u00e1 para desbloquear' : 'Reintentar';
if (!auto) err.textContent = bioErrTxt(e, !!s.pin);
});
}
if (s.bio) bioDisponible().then(function (dispo) {
if (!dispo) {
// Sin sensor en este navegador: si hay clave, cambiar de modo SOLO (no
// tiene sentido mostrar un boton de Face ID que no puede funcionar).
if (s.pin) { modoBio = false; pintarModo(); return; }
document.getElementById('secErr').textContent = 'La biometr\u00eda no est\u00e1 disponible en este navegador. Toc\u00e1 "No puedo entrar".';
return;
}
// Arranque directo con la biometria, sin tocar el boton. Un solo intento
// automatico por apertura (si no, cancelar la hoja del sistema la vuelve
// a abrir en loop).
setTimeout(function () { if (el.style.display !== 'none' && modoBio) intentarBio(true); }, 350);
});
document.getElementById('secBioGo').onclick = function () { intentarBio(false); };
// Si iOS rechaza el intento automatico por falta de gesto, cualquier toque en
// la pantalla de bloqueo sirve: no hay que apuntarle al boton.
el.addEventListener('click', function (ev) {
// Solo en modo biometria: si el usuario eligio "Usar la clave", un toque
// perdido no tiene que abrirle la hoja de Face ID encima del teclado.
if (!s.bio || !modoBio) return;
var id = (ev.target && ev.target.id) || '';
if (id === 'secBioGo' || id === 'secOlvide' || id === 'secPinInput' || id === 'secPinGo' || id === 'secModo') return;
intentarBio(false);
});
document.getElementById('secPinGo').onclick = function () {
var v = document.getElementById('secPinInput').value;
if (!v) return;
hashPin(v).then(function (h) {
if (h === s.pin) abrir();
else { document.getElementById('secPinInput').value = ''; document.getElementById('secErr').textContent = 'Clave incorrecta.'; }
});
};
document.getElementById('secPinInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') document.getElementById('secPinGo').click(); });
document.getElementById('secOlvide').onclick = function () {
var l = document.getElementById('secOlvide');
if (!l._confirm) {
l._confirm = true;
l.textContent = 'Se borra el bloqueo y vas a tener que poner de nuevo la clave de la API. \u00bfSeguro?';
setTimeout(function () { l._confirm = false; l.textContent = olvTxt; }, 6000);
return;
}
try { localStorage.removeItem('ga_sec'); localStorage.removeItem('ga_token'); } catch (e) {}
try { location.reload(); } catch (e) {}
};
})();

