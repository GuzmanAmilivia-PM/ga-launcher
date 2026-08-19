// Buscador de tickers
// ---------- Buscador de tickers (lupa) ----------
var busReturnView = 'inicio';
document.getElementById('searchBtn').onclick = function () {
if (currentView !== 'buscar') busReturnView = currentView;
setView('buscar');
var inp = document.getElementById('busInput');
try { inp.focus(); inp.select(); } catch (e) {}
};
document.getElementById('busBack').onclick = function () { setView(busReturnView || 'inicio'); };
// Montos grandes tipo market cap: 2.95 T / 540 B / 12 M
function fmtBig(n) {
if (n === null || n === undefined || !isFinite(n)) return '—';
if (n >= 1e12) return (n / 1e12).toFixed(2) + ' T';
if (n >= 1e9) return (n / 1e9).toFixed(1) + ' B';
if (n >= 1e6) return (n / 1e6).toFixed(1) + ' M';
return String(Math.round(n));
}
function busFila(nombre, valorHtml) {
return '<tr><td>' + nombre + '</td><td><b>' + valorHtml + '</b></td></tr>';
}
function fichaBuscarHtml(r) {
var chip = '';
if (r.cambioDia !== null && r.cambioDia !== undefined && isFinite(Number(r.cambioDia))) {
var v = Number(r.cambioDia);
chip = '<span class="bus-chip ' + (v >= 0 ? 'up' : 'down') + '">' + (v >= 0 ? '+' : '') + v.toFixed(2) + '% ' + (r.cripto ? '(24h)' : 'hoy') + '</span>';
}
var h = '<div class="card"><div class="bus-head"><span><span class="sym" style="font-size:18px">' + esc(r.symbol) + '</span><span class="desc">' + esc(r.nombre || '') + '</span></span>' + chip + '</div>';
h += '<p class="bus-precio">USD ' + esc(fmtNum(r.precio)) + '</p>';
h += '<div class="tvwrap" id="busTv"></div>';
var filas = '';
if (r.pe !== null && r.pe !== undefined) filas += busFila('P/E (precio / ganancia)', esc(fmtNum(r.pe)));
if (r.eps !== null && r.eps !== undefined) filas += busFila('EPS (ganancia por acci&oacute;n)', esc(fmtNum(r.eps)));
if (r.marketcap !== null && r.marketcap !== undefined) filas += busFila('Market cap', esc(fmtBig(r.marketcap)));
if (r.high52 !== null && r.high52 !== undefined && r.low52 !== null && r.low52 !== undefined) {
filas += busFila('Rango 52 semanas', esc(fmtNum(r.low52)) + ' &ndash; ' + esc(fmtNum(r.high52)));
}
if (r.beta !== null && r.beta !== undefined) filas += busFila('Beta (volatilidad vs mercado)', esc(fmtNum(r.beta)));
if (r.cripto && r.minDia !== null && r.minDia !== undefined && r.maxDia) {
filas += busFila('Rango 24 h', esc(fmtNum(r.minDia)) + ' &ndash; ' + esc(fmtNum(r.maxDia)));
}
if (filas) h += '<div style="overflow-x:auto;margin-top:12px"><table class="holdtable"><tbody>' + filas + '</tbody></table></div>';
if (r.enCartera) {
var ec = r.enCartera;
h += '<p class="tmonto" style="margin-top:14px">&#10003; Ya lo ten&eacute;s en cartera: <b>' + esc(fmtNum(ec.qty)) + '</b> unidades (' + fmt(ec.valor) + (ec.precioCompra ? ', comprado a ' + esc(fmtNum(ec.precioCompra)) : '') + ')</p>';
}
h += '</div>';
return h;
}
function buscarActivo() {
var q = document.getElementById('busInput').value.trim().toUpperCase();
var out = document.getElementById('busResultado');
if (!q) return;
if (!/^[A-Z0-9.\-:]{1,15}$/.test(q)) { out.innerHTML = '<div class="tmsg err">Ticker inv&aacute;lido.</div>'; return; }
var btn = document.getElementById('busGo');
btn.disabled = true;
out.innerHTML = '<div class="card"><p class="loadingtxt">Buscando ' + esc(q) + '... si es la primera vez puede tardar unos segundos.</p></div>';
google.script.run.withSuccessHandler(function (r) {
btn.disabled = false;
if (!r || !r.ok) {
out.innerHTML = '<div class="card"><p class="newsempty">' + esc(((r && r.mensajes) || ['No se encontró.']).join(' ')) + '</p></div>';
return;
}
out.innerHTML = fichaBuscarHtml(r);
var tvEl = document.getElementById('busTv');
if (tvEl) crearTvWidget(tvEl, r.cripto ? ('BINANCE:' + r.symbol + 'USDT') : r.symbol);
}).withFailureHandler(function (err) {
btn.disabled = false;
// La traduccion de unknown_fn vive en msgErr (brokers.js): era el quinto
// traductor copiado a mano y ya habia divergido del resto.
out.innerHTML = '<div class="card"><p class="newsempty">' + esc(msgErr(err, 'El buscador')) + '</p></div>';
}).buscarTicker({ symbol: q });
}
document.getElementById('busGo').onclick = buscarActivo;
document.getElementById('busInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); buscarActivo(); } });

