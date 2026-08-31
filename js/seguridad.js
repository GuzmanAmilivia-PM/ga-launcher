// Bloqueo local: biometria y clave
// ---------- Seguridad (bloqueo local: biometr\u00eda y/o clave) ----------
// La clave se guarda como hash SHA-256 y la biometr\u00eda como credencial WebAuthn
// del dispositivo (Face ID / huella). Es un bloqueo de acceso local en este
// dispositivo; los datos siguen protegidos por la clave de la API.
function secLeer() { try { return JSON.parse(localStorage.getItem('ga_sec') || '{}'); } catch (e) { return {}; } }
function secGuardar(s) { try { localStorage.setItem('ga_sec', JSON.stringify(s)); } catch (e) {} }
function b64u(buf) { var a = new Uint8Array(buf), s = ''; for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64uBytes(b) { b = b.replace(/-/g, '+').replace(/_/g, '/'); var s = atob(b), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
function hashPinLegacy(pin) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode('ga-sec|' + pin)).then(b64u); }
// PBKDF2 con sal aleatoria por instalacion (100k iteraciones): el hash viejo
// (SHA-256 sin sal) era fuerza-brutable offline en milisegundos si alguien
// leia el localStorage. hashPinLegacy queda solo para migrar un PIN guardado
// antes de este cambio (ver secPinGo).
function hashPin(pin, saltB64) {
var enc = new TextEncoder();
return crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']).then(function (key) {
return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: b64uBytes(saltB64), iterations: 100000, hash: 'SHA-256' }, key, 256);
}).then(b64u);
}
function nuevaSal() { return b64u(crypto.getRandomValues(new Uint8Array(16))); }
function bioDisponible() {
if (!window.PublicKeyCredential || !navigator.credentials || !window.isSecureContext) return Promise.resolve(false);
try { return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function () { return false; }); } catch (e) { return Promise.resolve(false); }
}
function bioRegistrar() {
return navigator.credentials.create({ publicKey: {
challenge: crypto.getRandomValues(new Uint8Array(32)),
rp: { name: 'Guzmana', id: location.hostname },
user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'GA', displayName: 'Guzmana' },
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
var extra = haySalida ? ' Use the passcode.' : ' If it keeps failing, tap "I can\u2019t get in".';
if (n === 'NotAllowedError') return 'Canceled or no response from the sensor.' + extra;
if (n === 'InvalidStateError') return 'This credential no longer exists on the device.' + extra;
if (n === 'NotSupportedError' || n === 'SecurityError' || n === 'AbortError') return 'Biometrics is not available here (' + n + ').' + extra;
return 'Could not verify' + (n ? ' (' + n + ')' : '') + '.' + extra;
}
function segMsg(id, txt, esOk) {
document.getElementById(id).innerHTML = txt ? '<div class="tmsg ' + (esOk ? 'ok' : 'err') + '">' + txt + '</div>' : '';
}
function prepararSeguridad() {
var s = secLeer();
var partes = [];
if (s.bio) partes.push('biometrics');
if (s.pin) partes.push('passcode');
document.getElementById('segEstado').textContent = partes.length
? 'Lock enabled with ' + partes.join(' and ') + '. It\u2019s requested every time you open the app on this device.'
: 'No lock: the app opens directly. Enable biometrics or a passcode.';
document.getElementById('segPinQuitar').style.display = s.pin ? '' : 'none';
document.getElementById('segPinBtn').textContent = s.pin ? 'Change passcode' : 'Save passcode';
segMsg('segBioMsg', ''); segMsg('segPinMsg', '');
var bioBtn = document.getElementById('segBioBtn');
if (s.bio) { bioBtn.textContent = 'Disable biometrics'; bioBtn.disabled = false; }
else {
bioBtn.textContent = 'Enable biometrics'; bioBtn.disabled = true;
bioDisponible().then(function (dispo) {
if (dispo) bioBtn.disabled = false;
else bioBtn.textContent = 'Biometrics not available here';
});
}
}
document.getElementById('segBack').onclick = function () { setView('inicio'); };
document.getElementById('segBioBtn').onclick = function () {
var s = secLeer(), btn = this;
if (s.bio) { delete s.bio; secGuardar(s); prepararSeguridad(); segMsg('segBioMsg', '&#10003; Biometrics disabled.', true); return; }
btn.disabled = true;
bioRegistrar().then(function (cred) {
s.bio = b64u(cred.rawId);
secGuardar(s); prepararSeguridad();
segMsg('segBioMsg', '&#10003; Done: the app will ask for your biometrics when opening.', true);
}).catch(function () {
btn.disabled = false;
segMsg('segBioMsg', 'Could not enable it. Try again.', false);
});
};
document.getElementById('segPinBtn').onclick = function () {
var p1 = document.getElementById('segPin1').value, p2 = document.getElementById('segPin2').value;
if (!/^[0-9]{4,8}$/.test(p1)) { segMsg('segPinMsg', 'The passcode must be 4 to 8 digits.', false); return; }
if (p1 !== p2) { segMsg('segPinMsg', 'The passcodes don\u2019t match.', false); return; }
var btn = this;
btn.disabled = true;
var sal = nuevaSal();
hashPin(p1, sal).then(function (h) {
var s = secLeer(); s.pin = h; s.pinSal = sal; secGuardar(s);
btn.disabled = false;
document.getElementById('segPin1').value = ''; document.getElementById('segPin2').value = '';
prepararSeguridad();
segMsg('segPinMsg', '&#10003; Passcode saved.', true);
}).catch(function () { btn.disabled = false; segMsg('segPinMsg', 'Could not save the passcode.', false); });
};
document.getElementById('segPinQuitar').onclick = function () {
var s = secLeer(); delete s.pin; secGuardar(s); prepararSeguridad();
segMsg('segPinMsg', '&#10003; Passcode removed.', true);
};
// Pide el desbloqueo (Face ID o clave). Se llama al cargar Y al volver del
// segundo plano tras un rato: antes esto era un IIFE que corria UNA sola vez,
// al parsear el archivo, asi que una PWA de iOS —que vive dias— quedaba
// desbloqueada para siempre despues del primer ingreso. Mandarla al fondo y
// volver entraba directo a los montos. Segunda auditoria del 22/08/2026.
var _listenersDelBloqueo = false;
function activarBloqueo() {
var s = secLeer();
if (!(s.pin || s.bio) || !getApiToken()) return;
if (appBloqueada) return;   // ya esta pidiendo entrar
// El bloqueo vive DENTRO del splash: una sola pantalla de arranque. Mientras
// appBloqueada este en true, hideSplash() no hace nada (nucleo.js), asi que el
// logo no se va hasta que se entra.
appBloqueada = true;
var el = document.getElementById('splash');
var caja = document.getElementById('splashLock');
caja.style.display = '';
// UN solo camino a la vista: manda la biometria. La clave NO se ofrece de
// entrada; aparece cuando el Face ID falla (link al primer fallo, y sola
// despues de FALLOS_PARA_CLAVE).
var FALLOS_PARA_CLAVE = 3;
var fallos = 0;
var elBio = document.getElementById('secBioGo');
var elPin = document.getElementById('secPinWrap');
var elModo = document.getElementById('secModo');
var modoBio = !!s.bio; // el modo activo, tambien frena el tap-para-Face-ID
function pintarModo() {
elBio.style.display = modoBio ? '' : 'none';
elPin.style.display = modoBio ? 'none' : '';
elModo.textContent = modoBio ? 'Use the passcode' : 'Use Face ID';
elModo.style.display = (s.bio && s.pin && (fallos > 0 || !modoBio)) ? '' : 'none';
document.getElementById('secErr').textContent = '';
if (!modoBio) { try { document.getElementById('secPinInput').focus(); } catch (e) {} }
}
if (s.bio && s.pin) elModo.onclick = function () { modoBio = !modoBio; pintarModo(); };
pintarModo();
// La salida de emergencia se muestra SIEMPRE que haya bloqueo: con solo
// biometria y el sensor fallando, antes no quedaba forma de entrar.
var olv = document.getElementById('secOlvide');
var olvTxt = s.pin ? 'I forgot my passcode' : 'I can\u2019t get in';
olv.textContent = olvTxt;
olv.style.display = '';
function abrir() {
caja.style.display = 'none';
document.getElementById('secErr').textContent = '';
appBloqueada = false;
// Si mientras estaba bloqueada la API contesto "clave vencida", esa pantalla
// quedo esperando: se muestra ACA, en la misma pantalla, no encima del logo.
if (!mostrarLockPendiente()) hideSplash();
}
// Intento de biometria. `auto` = disparado solo al abrir la app, sin toque:
// Safari exige un gesto del usuario para WebAuthn, asi que si ese intento se
// rechaza no se muestra error, queda el boton para reintentar a mano.
// `forzado` = el boton Desbloquear: el UNICO que puede abortar una peticion
// viva y reintentar (la salida para una peticion colgada).
// Con una hoja de Face ID YA abierta, un intento nuevo la abortaba y la
// volvia a abrir: Face ID aparecia DOS veces seguidas (reporte de Guzman,
// 19/08/2026 \u2014 el toque de abrir la app caia sobre la pantalla de bloqueo
// mientras el intento automatico ya estaba en vuelo). Por eso: si hay un
// intento en curso, los toques y el automatico NO hacen nada.
var bioEnCurso = false;
var bioIntento = 0;
function intentarBio(auto, forzado) {
if (bioEnCurso && !forzado) return;
var mio = ++bioIntento;
bioEnCurso = true;
var t0 = Date.now();
var err = document.getElementById('secErr');
if (!auto) err.textContent = '';
var btn = document.getElementById('secBioGo');
if (!auto) btn.textContent = 'Verifying...';
return bioVerificar(s.bio).then(function () {
// Un intento abortado por el boton puede responder tarde: se ignora entero
// (su exito o su error son de una peticion que ya no existe para el user).
if (mio !== bioIntento) return;
bioEnCurso = false;
btn.textContent = 'Unlock with Face ID';
abrir();
}).catch(function (e) {
if (mio !== bioIntento) return;
bioEnCurso = false;
// Si el intento automatico se rechaza es, casi siempre, porque iOS pide un
// gesto: se invita a tocar en vez de mostrar un error, y NO cuenta como
// fallo (el sensor ni llego a mirarlo).
btn.textContent = auto ? 'Unlock with Face ID' : 'Retry';
if (auto) {
// NotAllowedError en un intento AUTOMATICO suele ser "el sistema pidio un
// gesto". Se ANOTA para que las proximas aperturas no pierdan el ciclo \u2014 es
// lo que Guzman veia como "parece que precarga la biometria pero igual tengo
// que tocar" (22/08/2026).
//
// Pero el MISMO error lo tira el navegador cuando el usuario CANCELA la hoja
// del sistema o cuando la peticion expira (timeout de 60 s). En Windows Hello
// y Android \u2014donde el automatico si abre el dialogo\u2014 una sola cancelacion
// apagaba el desbloqueo sin tocar nada para siempre, justo donde era util.
// La senal barata para distinguirlos es el tiempo: un rechazo por falta de
// gesto vuelve en milisegundos, una persona tarda segundos.
// Auditoria del 23/08/2026.
if (e && e.name === 'NotAllowedError' && (Date.now() - t0) < 1000) {
  try { localStorage.setItem('ga_bio_auto', '0'); } catch (e2) {}
}
return;
}
fallos++;
// Que no te reconozca no puede dejarte afuera: al primer fallo aparece el
// link a la clave, y despues de varios se pasa solo.
if (s.pin && fallos >= FALLOS_PARA_CLAVE) {
modoBio = false;
pintarModo();
err.textContent = 'Didn\u2019t recognize you ' + fallos + ' times. Enter with your passcode.';
return;
}
pintarModo();
err.textContent = bioErrTxt(e, !!s.pin);
});
}
if (s.bio) bioDisponible().then(function (dispo) {
if (!dispo) {
// Sin sensor en este navegador: si hay clave, cambiar de modo SOLO (no
// tiene sentido mostrar un boton de Face ID que no puede funcionar).
if (s.pin) { modoBio = false; pintarModo(); return; }
document.getElementById('secErr').textContent = 'Biometrics is not available in this browser. Tap "I can\u2019t get in".';
return;
}
// Arranque directo con la biometria, sin tocar el boton — DONDE SE PUEDA.
// En iOS el sistema exige un gesto del usuario para WebAuthn, asi que ese
// intento se rechaza SIEMPRE y lo unico que lograba era un ciclo perdido y un
// cartel que cambiaba solo. En vez de adivinar el sistema operativo, se
// APRENDE: al primer rechazo por falta de gesto se anota y no se vuelve a
// intentar en este dispositivo. Donde si funciona (Windows Hello, Android),
// sigue abriendo sin tocar nada.
var autoSirve = true;
try { autoSirve = localStorage.getItem('ga_bio_auto') !== '0'; } catch (e) {}
if (autoSirve) setTimeout(function () { if (appBloqueada && modoBio) intentarBio(true); }, 350);
});
// El boton NUNCA se deshabilita y es el unico FORZADO: si la peticion quedo
// colgada (el caso que dejaba la app trancada), tocarlo aborta y reintenta.
document.getElementById('secBioGo').onclick = function () { intentarBio(false, true); };
// Si iOS rechaza el intento automatico por falta de gesto, cualquier toque en
// la pantalla de bloqueo sirve: no hay que apuntarle al boton.
el.addEventListener('click', function (ev) {
// Solo mientras el bloqueo pide entrar y en modo biometria: si el usuario
// eligio "Usar la clave" (o ya esta en la pantalla de la clave de acceso),
// un toque perdido no tiene que abrirle la hoja de Face ID encima.
if (!s.bio || !modoBio || !appBloqueada) return;
var id = (ev.target && ev.target.id) || '';
if (id === 'secBioGo' || id === 'secOlvide' || id === 'secPinInput' || id === 'secPinGo' || id === 'secModo') return;
intentarBio(false);
});
document.getElementById('secPinGo').onclick = function () {
var v = document.getElementById('secPinInput').value;
if (!v) return;
// PIN guardado antes de la sal (sin s.pinSal): se valida contra el hash
// legacy y, si coincide, se migra al formato con sal sin pedirselo a nadie.
var comparar = s.pinSal ? hashPin(v, s.pinSal) : hashPinLegacy(v);
comparar.then(function (h) {
if (h === s.pin) {
if (!s.pinSal) {
var todos = secLeer(), sal = nuevaSal();
hashPin(v, sal).then(function (h2) { todos.pin = h2; todos.pinSal = sal; secGuardar(todos); });
}
abrir();
} else { document.getElementById('secPinInput').value = ''; document.getElementById('secErr').textContent = 'Incorrect passcode.'; }
});
};
if (!_listenersDelBloqueo) {
_listenersDelBloqueo = true;
document.getElementById('secPinInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') document.getElementById('secPinGo').click(); });
}
document.getElementById('secOlvide').onclick = function () {
var l = document.getElementById('secOlvide');
confirmarDosToques(l, 'This clears the lock and you\u2019ll have to enter the API passcode again. Sure?', olvTxt, 6000, function () {
// Fallar CERRADO del todo: tambien la clave de Binance y TODOS los caches
// con el portafolio (GA_CACHES, en paneles.js — la lista unica evita que un
// cache nuevo quede vivo). Re-pegar la clave cuesta un minuto; dejarla, un riesgo.
try {
['ga_sec', 'ga_token', 'ga_bnb', 'ga_bnb_ultima', 'ga_bio_auto'].concat(GA_CACHES).forEach(function (k) { localStorage.removeItem(k); });
} catch (e) {}
try { location.reload(); } catch (e) {}
});
};
}

// Al cargar.
activarBloqueo();

// Y al volver del segundo plano, si estuvo afuera un rato. El umbral es corto
// a proposito: cambiar de app un segundo para copiar un dato no tiene que
// pedir Face ID, pero dejar el telefono sobre la mesa si.
var BLOQUEO_TRAS_MS = 5 * 60 * 1000;
var _seFueALasSombras = 0;
document.addEventListener('visibilitychange', function () {
if (document.visibilityState === 'hidden') { _seFueALasSombras = Date.now(); return; }
if (!_seFueALasSombras) return;
var afuera = Date.now() - _seFueALasSombras;
_seFueALasSombras = 0;
if (afuera >= BLOQUEO_TRAS_MS) activarBloqueo();
});
