// Los formatos de plata (9/10/2026, auditoria).
//
// fmtUsd era el unico monto de la app sin separador de miles ("US$ 12450.25"
// en Tax book, "US$ 1253.35" en Dividends), y los negativos salian con el
// signo despues de la moneda ("USD -150" en BTG, "US$ -320" en Available to
// invest) mientras el resto dice "−USD 95". Corre las funciones REALES de
// nucleo.js con la app entera (_entorno.js).
var entorno = require('./_entorno');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

var c = entorno.cargar({});
ok(c.errores.length === 0, 'la app carga entera' + (c.errores.length ? ': ' + c.errores.join(' | ') : ''));
var g = c.ambito;
function igual(real, esperado, que) { ok(real === esperado, que + ': ' + JSON.stringify(real) + (real === esperado ? '' : ' (esperaba ' + JSON.stringify(esperado) + ')')); }

console.log('\nA) fmtUsd: dos decimales, con miles y el signo adelante');
igual(g.fmtUsd(12450.25), 'US$ 12,450.25', 'miles con coma');
igual(g.fmtUsd(1253.355), 'US$ 1,253.36', 'redondea a centavos');
igual(g.fmtUsd(7), 'US$ 7.00', 'siempre dos decimales');
igual(g.fmtUsd(-4.5), '−US$ 4.50', 'un negativo lleva el menos adelante');
igual(g.fmtUsd(-0.001), 'US$ 0.00', 'lo que redondea a cero no lleva signo');
igual(g.fmtUsd(null), 'US$ 0.00', 'sin dato, cero (como antes)');

console.log('\nB) fmtUsdEnt y fmt: enteros, con miles y el signo adelante');
igual(g.fmtUsdEnt(-320), '−US$ 320', 'fmtUsdEnt negativo');
igual(g.fmtUsdEnt(5500.4), 'US$ 5,500', 'fmtUsdEnt positivo');
igual(g.fmtUsdEnt(-0.4), 'US$ 0', 'fmtUsdEnt: un −0 no lleva signo');
igual(g.fmt(-150), '−USD 150', 'fmt negativo (BTG decia "USD -150")');
igual(g.fmt(98249.6), 'USD 98,250', 'fmt positivo, como siempre');
igual(g.fmt(null), '—', 'fmt sin dato');
igual(g.fmtSigno(-95), '−USD 95', 'fmtSigno sigue igual');

console.log('\nB2) el "Return" de Contributions (htmlComparacion, paneles.js)');
g.comparacionGrupo = function () {
  return { nombre: 'Schwab, IBKR and Binance', valor: 9680, capital: 10000, pct: -3.2, twrPct: -3, idxPct: 1, idxNombre: 'S&P 500', desde: new Date(2026, 0, 2).getTime() };
};
var hc = g.htmlComparacion();
ok(/<b class="down">−US\$ 320<\/b>/.test(hc), 'una perdida dice "−US$ 320" (decia "US$ -320"): ' + ((hc.match(/Return<\/span><b[^>]*>[^<]*/) || [''])[0]));
g.comparacionGrupo = function () {
  return { nombre: 'x', valor: 11250, capital: 10000, pct: 12.5, twrPct: 12, idxPct: 10, idxNombre: 'S&P 500', desde: new Date(2026, 0, 2).getTime() };
};
ok(/<b class="up">\+US\$ 1,250<\/b>/.test(g.htmlComparacion()), 'una ganancia, "+US$ 1,250"');

console.log('\nC) el ojito los tapa a todos');
g.montosOcultos = true;
igual(g.fmtUsd(-4.5), '****', 'fmtUsd');
igual(g.fmtUsdEnt(320), '****', 'fmtUsdEnt');
igual(g.fmt(-150), '****', 'fmt');
g.montosOcultos = false;

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
