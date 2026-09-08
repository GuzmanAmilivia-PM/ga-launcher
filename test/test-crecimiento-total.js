// El bloque "Whole portfolio, without contributions" del panel de aportes (8/09/2026).
var vm = require('vm');
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var asserts = 0, fallos = 0;
function ok(cond, msg) { asserts++; if (!cond) { fallos++; console.log('  FALLA: ' + msg); } else console.log('  ok   ' + msg); }

var src = [
  (html.match(/function signoPct[^\n]*\n/) || [''])[0],
  (html.match(/function htmlCrecimientoTotal\(r\) \{[\s\S]*?\nreturn h;\n\}/) || [''])[0]
].join('\n');
ok(/function htmlCrecimientoTotal/.test(src), 'encuentro htmlCrecimientoTotal');
var ctx = { Number: Number, isFinite: isFinite, String: String, esc: function (s) { return String(s); }, mask: function (s) { return s; },
  fmtUsdEnt: function (n) { return 'US$ ' + Math.round(Number(n)).toLocaleString('en-US'); }, fechaCortaMs: function () { return '30/01'; } };
vm.createContext(ctx); vm.runInContext(src, ctx);

var h = ctx.htmlCrecimientoTotal({ anio: 2026, crecimiento: { pct: 20.78, desde: 1, hasta: 2, base: 94418, valor: 120980.61, aportes: 6000, dias: 41 }, cierresAnuales: [] });
ok(/Whole portfolio, without contributions/.test(h), 'el titulo');
ok(/2026 so far/.test(h) && /capval up">\+20\.8%/.test(h), 'el % del anio en curso, en verde');
ok(/US\$ 94,418/.test(h) && /US\$ 120,981/.test(h), 'de donde arranco y donde esta');
ok(/US\$ 6,000 net this year/.test(h), 'los flujos descontados, dichos');
ok(/banks included/.test(h) && /year-end value is saved/.test(h), 'y la nota explica que es todo el patrimonio y que el cierre se guarda');
var h2 = ctx.htmlCrecimientoTotal({ anio: 2027, crecimiento: { pocos: true, dias: 1 }, cierresAnuales: [{ anio: 2026, pct: 12.3, valor: 130000 }] });
ok(/at least two days/.test(h2), 'con un punto en el anio nuevo lo dice');
ok(/<span>2026<\/span><b class="up">\+12\.3% &middot; US\$ 130,000<\/b>/.test(h2), 'y el anio cerrado aparece con su % y su valor de cierre');
ok(ctx.htmlCrecimientoTotal({ anio: 2026, crecimiento: null, cierresAnuales: [] }) === '', 'sin dato ni anios cerrados, nada');
var h3 = ctx.htmlCrecimientoTotal({ anio: 2026, crecimiento: { pct: null, base: 1, valor: 1, aportes: 0 }, cierresAnuales: [] });
ok(/Whole portfolio/.test(h3) && !/capval/.test(h3), 'pct null: el titulo sin inventar un numero');
ok(/html \+= htmlCrecimientoTotal\(r\);/.test(html), 'renderAportes lo pinta debajo de la comparacion del grupo');

console.log(asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
