// El desglose del fondo de Itaú: cada compra con su fecha y su retorno
// (13/09/2026). Pedido de Guzmán: "me debería dejar acceder desde portafolio a
// la página de itau y ver el desglose de itau assets, con compras, fechas y
// retorno".
//
// Los precios de la cuotaparte y del dólar son los de ese día (119,51 el 27/05,
// 120,49 el 13/08, 121,03 hoy, el dólar a 40,27); las CANTIDADES son
// inventadas (las reales se sacaron el 24/09/2026: este repo es público).
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var asserts = 0, fallos = 0;
function ok(cond, msg) { asserts++; if (!cond) { fallos++; console.log('  FALLA: ' + msg); } else console.log('  ok   ' + msg); }

function trozo(re, nombre) {
  var m = html.match(re);
  if (!m) { console.log('  FALLA: no encuentro ' + nombre); process.exit(1); }
  return m[0];
}
var fuente = trozo(/function fechaCortaItau[\s\S]*?\n\}/, 'fechaCortaItau') + '\n' +
  trozo(/function comprasItauHtml[\s\S]*?\n\}/, 'comprasItauHtml') + '\n' +
  trozo(/function signoPct[^\n]*\}/, 'signoPct') + '\n' +
  trozo(/function esc\(s\)[\s\S]*?\n\}/, 'esc');
var api = new Function('Number,String,Date,Math,isFinite',
  'function fmt(v) { return "USD " + Number(v).toFixed(2); }\n' +
  'function fmtNum(v) { return String(Number(v)); }\n' + fuente +
  '\nreturn { compras: comprasItauHtml, fecha: fechaCortaItau };'
)(Number, String, Date, Math, isFinite);

var DATOS = { posiciones: [
  { symbol: 'ITAU', qty: 1000.5, precioCompra: 119.51, precioActual: 121.03, fechaInicio: '2026-05-27' },
  { symbol: 'ITAU', qty: 250.25, precioCompra: 120.49, precioActual: null, fechaInicio: '2026-08-13' },
  { symbol: 'LIQUIDEZ', qty: null, valor: 0 }
] };
var RESUMEN = { tcHoy: 40.270978 };

console.log('\nA) las dos compras, cada una con su fecha');
var out = api.compras(DATOS, RESUMEN);
ok(out.indexOf('May 27, 2026') !== -1, 'la compra de mayo lleva su fecha');
ok(out.indexOf('Aug 13, 2026') !== -1, 'y la de agosto la suya');
ok((out.match(/<tr>/g) || []).length === 2, 'son DOS filas: las compras no se promedian en una');
ok(out.indexOf('LIQUIDEZ') === -1 && (out.match(/units @/g) || []).length === 2, 'la fila de cash no es una compra');
ok(out.indexOf('1000.5 units @ 119.51 UYU') !== -1, 'las unidades y el precio pagado, en pesos y dicho');

console.log('\nB) el retorno POR COMPRA es el del fondo en pesos');
// 121.03 / 119.51 - 1 = +1.27% ; 121.03 / 120.49 - 1 = +0.45%
ok(out.indexOf('+1.27%') !== -1, 'la compra de mayo rindio +1.27% en pesos');
ok(out.indexOf('+0.45%') !== -1, 'la de agosto, +0.45%: cada una contra SU precio de compra');
// El precio de hoy es uno solo y la hoja lo escribe en la primera fila: la
// segunda lo espeja. Si se leyera de la fila, la de agosto quedaria sin dato.
ok((out.match(/%<\/span>/g) || []).length === 2, 'las DOS compras tienen retorno: la segunda no queda en blanco por no traer el precio de hoy');
// Valor de hoy en dolares: 1000.5 x 121.03 / 40.270978 = 3006.89
ok(out.indexOf('USD 3006.') !== -1, 'y el valor de hoy en dolares, que si sale del tipo de cambio de hoy');
ok(/In pesos/.test(out), 'la pantalla dice que ese retorno es en pesos, no en dolares');
// Corto a proposito (13/09/2026, Guzman: "hay mucha info tuya, minimalizaria
// un poco nomas"). Lo unico que no se puede sacar es que el retorno es en
// pesos: sin eso, el numero se lee como dolares y no lo es.
ok(out.indexOf('days') === -1, 'sin los dias: el bloque es corto');
ok(out.length < 1100, 'y el bloque entero mide menos de 1100 caracteres (' + out.length + ')');

console.log('\nC) lo que NO se inventa');
// Sin tipo de cambio no hay valor en dolares, pero el retorno en pesos sigue.
var sinTC = api.compras(DATOS, null);
ok(sinTC.indexOf('+1.27%') !== -1, 'sin tipo de cambio, el retorno en pesos se muestra igual');
ok(sinTC.indexOf('USD') === -1, 'pero el valor en dolares no se inventa');
// Una compra sin fecha no rompe nada ni se le pone una.
var sinFecha = api.compras({ posiciones: [{ symbol: 'ITAU', qty: 10, precioCompra: 100, precioActual: 110 }] }, RESUMEN);
ok(sinFecha.indexOf('&mdash;') !== -1 || sinFecha.indexOf('—') !== -1, 'sin fecha queda la rayita, no una fecha inventada');
ok(api.compras({ posiciones: [] }, RESUMEN) === '', 'sin compras no se dibuja un bloque vacio');

console.log('\nD) la fecha se lee LOCAL, no en UTC');
// new Date('2026-05-27') es medianoche UTC: en Montevideo (UTC-3) se leeria
// el 26. Un dia de menos en una compra es un error que no se ve como error.
ok(api.fecha('2026-01-01').indexOf('Jan 1, 2026') === 0, 'el 1 de enero es el 1, no el 31 de diciembre');
ok(api.fecha('') === '' && api.fecha(null) === '', 'sin fecha, nada');

console.log('\nE) el camino a la pantalla de Itau');
// La base guarda la cuenta como "Itau" y la hoja de posiciones como "Itau
// Assets": sin el alias, la fila de la torta de Portafolio no encontraba su
// cuenta y no se podia ABRIR la pantalla de Itau desde ahi.
ok(/\{ key: 'ITAU', nombre: 'Itau Assets', alias: \['Itau'\] \}/.test(html), 'ACCOUNTS declara el alias de Itau');
// Hasta 'return null;': la funcion tiene llaves de cierre al principio de
// linea, y cortar en la primera dejaba media funcion (la misma trampa que
// documenta renderAccount).
var byName = (html.match(/function accountByName[\s\S]*?return null;\n\}/) || [''])[0];
ok(/ACCOUNTS\[i\]\.alias/.test(byName), 'y accountByName mira los alias, no solo el nombre exacto');
var fn = new Function('ACCOUNTS,String', byName + '\nreturn accountByName;')(
  [{ key: 'CS', nombre: 'Charles Schwab' }, { key: 'ITAU', nombre: 'Itau Assets', alias: ['Itau'] }], String);
ok(fn('Itau') && fn('Itau').key === 'ITAU', '"Itau" (como viene del resumen) encuentra la cuenta ITAU');
ok(fn('Itau Assets') && fn('Itau Assets').key === 'ITAU', 'y "Itau Assets" tambien');
ok(fn('Charles Schwab').key === 'CS' && fn('HSBC') === null, 'el resto no cambia: sin alias, nombre exacto');

console.log('\nF) el fondo no se dibuja DOS veces');
var render = (html.match(/function renderAccount\(acc, data\) \{[\s\S]*?\n\}\n/) || [''])[0];
ok(/itauEsCuenta\(acc\) && String\(h\.symbol[\s\S]{0,120}=== 'ITAU'/.test(render),
  'la tabla de posiciones saltea las filas del fondo: viven arriba, con su fecha y su retorno');
ok(/typeof comprasItauHtml === 'function'/.test(render),
  'y solo las saltea si el bloque de arriba existe: nunca deja la cuenta vacia');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
