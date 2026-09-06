// El mapa de calor mensual (V5) y la tarjeta del anio (el numero lo calcula
// comparacionAnual, en graficos.js). Hasta el 6/09/2026 vivia dentro de
// graficos.js; se separo por pantalla, sin cambiar una linea.
// ---------- Mapa de calor mensual (V5) ----------
// Rendimiento de cada mes sobre la serie de patrimonio que YA llega: cierre
// del mes contra cierre del mes anterior. La serie compacta guarda un punto
// por mes hacia atras, asi que el cierre mensual existe tambien en la zona
// vieja. Sin mes anterior no se inventa nada (queda vacio); el mes en curso
// se mide hasta hoy (el ultimo punto de la serie es siempre el valor actual).
// OJO: es sobre el patrimonio TOTAL — un aporte o retiro grande cuenta como
// movimiento del mes; la nota debajo del mapa lo dice (regla U2).
function mapaCalorMensual(serie) {
if (!serie || serie.length < 2) return [];
var cierres = {}; // anio*12+mes -> ultimo valor del mes (la serie es ascendente)
serie.forEach(function (p) {
var d = new Date(p.fecha);
var v = Number(p.valor);
if (!isFinite(v)) return;
cierres[d.getFullYear() * 12 + d.getMonth()] = v;
});
var claves = Object.keys(cierres).map(Number).sort(function (a, b) { return a - b; });
var porAnio = {};
for (var i = 1; i < claves.length; i++) {
var k = claves[i];
if (claves[i - 1] !== k - 1) continue; // hueco: sin cierre del mes anterior
var prev = cierres[k - 1];
if (!(prev > 0)) continue;
var anio = Math.floor(k / 12), mes = k % 12;
if (!porAnio[anio]) { porAnio[anio] = []; for (var m = 0; m < 12; m++) porAnio[anio].push(null); }
porAnio[anio][mes] = Math.round((cierres[k] / prev - 1) * 10000) / 10000;
}
return Object.keys(porAnio).map(Number).sort(function (a, b) { return b - a; })
.map(function (a) { return { anio: a, meses: porAnio[a] }; });
}
var MC_MESES = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
function celdaCalor(pct) {
if (pct === null || pct === undefined) return '<span class="mc-celda mc-vacia"></span>';
var v = pct * 100;
// La intensidad crece con el tamano del movimiento y se planta en ±8%.
var alpha = Math.min(0.85, 0.18 + (Math.abs(v) / 8) * 0.6);
var rgb = v >= 0 ? '34,197,94' : '244,63,94';
var txt = (v >= 0 ? '+' : '') + (Math.abs(v) >= 9.95 ? v.toFixed(0) : v.toFixed(1));
return '<span class="mc-celda" style="background:rgba(' + rgb + ',' + alpha.toFixed(2) + ')">' + txt + '</span>';
}
// La tarjeta "Este año vs el mercado" (Portafolio). Si comparacionAnual()
// devuelve null la tarjeta NO se dibuja: preferimos que no este a que muestre
// un guion sin explicacion.
function renderAnual() {
var card = document.getElementById('anualCard');
var el = document.getElementById('anualBody');
if (!card || !el) return;
var c = null;
try { c = comparacionAnual(); } catch (e) { c = null; }
if (!c) { card.style.display = 'none'; return; }
card.style.display = '';

function pct(v) {
if (v === null || !isFinite(v)) return '<p class="capval">&mdash;</p>';
return '<p class="capval ' + (v >= 0 ? 'up' : 'down') + '">' + signoPct(v, 1) + '</p>';
}
var dif = (c.idxPct !== null && isFinite(c.idxPct)) ? (c.pct - c.idxPct) : null;

var h = '<div class="caprow">';
h += '<div><p class="lbl">Tu cartera</p>' + pct(c.pct) + '</div>';
h += '<div><p class="lbl">' + esc(c.idxNombre || 'Index') + '</p>' + pct(c.idxPct) + '</div>';
if (dif !== null) {
h += '<div><p class="lbl">Difference</p><p class="capval ' + (dif >= 0 ? 'up' : 'down') + '">' +
signoPct(dif, 1) + '</p></div>';
}
h += '</div>';

// La nota NO es relleno: sin ella el numero se lee como el cambio del
// patrimonio, que es otra cosa y siempre mas grande.
// Fecha SIN hora: fechaCortaMs trae la hora (sirve para "ultima sync"), y en
// una fecha de cierre de año "30/12 12:00" solo estorba.
var dDesde = new Date(c.desde);
var desdeTxt = ('0' + dDesde.getDate()).slice(-2) + '/' + ('0' + (dDesde.getMonth() + 1)).slice(-2) + '/' + dDesde.getFullYear();
h += '<p class="capnota">From ' + desdeTxt + ' to today. This is the return on your ' +
'investments <b>net of what you contributed</b>: your net worth went up ' +
signoPct(c.bruto, 1) + ', but ' + esc(fmtUsdEnt(c.aportes)) + ' of that you put in yourself, you didn&rsquo;t earn it. ' +
(c.idxPct !== null ? 'The index doesn&rsquo;t pay dividends and your accounts do.' : '') + '</p>';
el.innerHTML = h;
}

function renderMapaCalor() {
var el = document.getElementById('mapaCalor');
if (!el) return;
var filas = mapaCalorMensual(fullSerie || []);
if (!filas.length) { el.innerHTML = '<p class="newsempty">With one more month of history, the first month will appear.</p>'; return; }
var html = '<div class="mc-fila mc-head"><span class="mc-anio"></span>' +
MC_MESES.map(function (m) { return '<span class="mc-celda">' + m + '</span>'; }).join('') + '</div>';
filas.forEach(function (f) {
html += '<div class="mc-fila"><span class="mc-anio">' + f.anio + '</span>' + f.meses.map(celdaCalor).join('') + '</div>';
});
el.innerHTML = html;
}
