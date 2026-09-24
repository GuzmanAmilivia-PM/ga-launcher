// El mapa de calor mensual (V5) y la tarjeta del anio (el numero lo calcula
// comparacionAnual, en graficos.js). Hasta el 6/09/2026 vivia dentro de
// graficos.js; se separo por pantalla, sin cambiar una linea.
// ---------- Mapa de calor mensual (V5) ----------
// El rendimiento de cada mes SIN los depositos (23/09/2026). Hasta ese dia
// era el cierre del mes contra el del anterior, sobre el patrimonio entero:
// un deposito pintaba el mes de verde. Y la app tenia DOS grillas mes a mes
// que se contradecian: esta, y la de la pagina Analysis (D10), que restaba
// los aportes con otra cuenta ((fin − aportes) / inicio). Quedo UNA, esta,
// con LA cuenta "sin depositos" de la app: _twrCadena (graficos.js), el
// encadenado punto a punto con cada flujo al INICIO de su tramo — la misma
// del "pp vs S&P" del Inicio, la tarjeta del año y el backend. Sin aportes en
// el mes, el encadenado da exactamente cierre / cierre anterior − 1.
//
// Cada mes va del ULTIMO punto del mes anterior al ultimo del mes (la serie
// compacta guarda un punto por mes hacia atras, asi que el cierre existe
// tambien en la zona vieja). Sin mes anterior no se inventa nada (vacio); el
// mes en curso se mide hasta hoy. Un mes que arranca antes de lo que la lista
// de aportes conoce (`aportesDesde`, la ventana de los brokers) queda VACIO:
// no se puede separar lo depositado de lo ganado. La misma guarda que
// movimientoDelSaldo.
function mapaCalorMensual(serie) {
if (!serie || serie.length < 2) return [];
var ultimo = {}; // anio*12+mes -> indice del ultimo punto del mes (la serie es ascendente)
serie.forEach(function (p, i) {
if (!isFinite(Number(p.valor))) return;
var d = new Date(p.fecha);
ultimo[d.getFullYear() * 12 + d.getMonth()] = i;
});
var claves = Object.keys(ultimo).map(Number).sort(function (a, b) { return a - b; });
var porAnio = {};
for (var i = 1; i < claves.length; i++) {
var k = claves[i];
if (claves[i - 1] !== k - 1) continue; // hueco: sin cierre del mes anterior
var tramo = serie.slice(ultimo[k - 1], ultimo[k] + 1);
var fueraDeLista = aportesDesde !== null && tramo[0].fecha < aportesDesde - 86400000;
var c = fueraDeLista ? null : _twrCadena(tramo);
var anio = Math.floor(k / 12), mes = k % 12;
if (!porAnio[anio]) {
porAnio[anio] = { meses: [], conFlujo: [], sinLista: [] };
for (var m = 0; m < 12; m++) { porAnio[anio].meses.push(null); porAnio[anio].conFlujo.push(false); porAnio[anio].sinLista.push(false); }
}
porAnio[anio].meses[mes] = c ? Math.round((c.factores[c.factores.length - 1] - 1) * 10000) / 10000 : null;
porAnio[anio].conFlujo[mes] = !!(c && c.aportes !== 0);
porAnio[anio].sinLista[mes] = fueraDeLista;
}
return Object.keys(porAnio).map(Number).sort(function (a, b) { return b - a; })
.map(function (a) { return { anio: a, meses: porAnio[a].meses, conFlujo: porAnio[a].conFlujo, sinLista: porAnio[a].sinLista }; });
}
var MC_MESES = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
// `conFlujo`: ese mes entro o salio plata. Se marca con un punto en la
// esquina (no al lado del numero: la celda mide ~24px a 375 y no entra).
function celdaCalor(pct, conFlujo) {
if (pct === null || pct === undefined) return '<span class="mc-celda mc-vacia"></span>';
var v = pct * 100;
// La intensidad crece con el tamano del movimiento y se planta en ±8%.
var alpha = Math.min(0.85, 0.18 + (Math.abs(v) / 8) * 0.6);
var rgb = v >= 0 ? '34,197,94' : '244,63,94';
var txt = (v >= 0 ? '+' : '') + (Math.abs(v) >= 9.95 ? v.toFixed(0) : v.toFixed(1));
return '<span class="mc-celda' + (conFlujo ? ' mc-flujo' : '') + '" style="background:rgba(' + rgb + ',' + alpha.toFixed(2) + ')"' +
  (conFlujo ? ' title="Money went in or out this month"' : '') + '>' + txt + '</span>';
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
h += '<div><p class="lbl">Your portfolio</p>' + pct(c.pct) + '</div>';
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
// Decia "The index doesn't pay dividends and your accounts do": falso desde
// el 15/09/2026 (V17), cuando el indice paso a ser SPY con los dividendos
// reinvertidos en toda la app. Corregido el 23/09/2026.
(c.idxPct !== null ? 'The index counts its dividends reinvested, like your accounts do.' : '') + '</p>';
el.innerHTML = h;
}

function renderMapaCalor() {
var el = document.getElementById('mapaCalor');
if (!el) return;
// Sin la lista de aportes NO se pinta (23/09/2026): sin ella el encadenado
// no descuenta nada y un deposito volveria a pintar el mes de verde. Es la
// guarda del "pp vs S&P" y de la tarjeta del año; la lista llega sola al
// abrir (arranque.js) y renderAportes vuelve a llamar aca.
if (!aportesCargados) {
  el.innerHTML = '<p class="newsempty">' + (aportesFallo
    ? 'Your deposits could not be loaded, so the months cannot be shown without them yet.'
    : 'Loading your deposits&hellip;') + '</p>';
  return;
}
var filas = mapaCalorMensual(fullSerie || []);
if (!filas.length) { el.innerHTML = '<p class="newsempty">With one more month of history, the first month will appear.</p>'; return; }
var html = '<div class="mc-fila mc-head"><span class="mc-anio"></span>' +
MC_MESES.map(function (m) { return '<span class="mc-celda">' + m + '</span>'; }).join('') + '</div>';
var hayFlujo = false, haySinLista = false;
filas.forEach(function (f) {
html += '<div class="mc-fila"><span class="mc-anio">' + f.anio + '</span>' +
  f.meses.map(function (p, m) { return celdaCalor(p, f.conFlujo[m]); }).join('') + '</div>';
if (f.conFlujo.some(Boolean)) hayFlujo = true;
if (f.sinLista.some(Boolean)) haySinLista = true;
});
var notas = [];
if (hayFlujo) notas.push('The dot marks months where money went in or out.');
if (haySinLista) notas.push('Blank months are older than the deposits your brokers report, so the gain can&rsquo;t be separated from what you put in.');
// El mes en curso esta a medias (lo decia la grilla de Analysis, D10): el
// dia 2 una celda de "octubre" es un dia, no un mes. Solo si el ultimo dato
// ES de este mes (en produccion siempre: el ultimo punto es el de hoy).
var ultP = (fullSerie || [])[(fullSerie || []).length - 1];
var dU = ultP ? new Date(ultP.fecha) : null, dH = new Date();
if (dU && dU.getFullYear() === dH.getFullYear() && dU.getMonth() === dH.getMonth()) notas.push('The current month is still in progress.');
el.innerHTML = html + '<p class="capnota" style="margin-top:8px">' + notas.join(' ') + '</p>';
}
