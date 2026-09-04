// Arnés del mapa de calor mensual (V5, js/graficos.js): el rendimiento de
// cada mes sale del cierre del mes contra el cierre del anterior, sin
// inventar nada donde faltan datos, y la grilla se dibuja con divs.
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var codigo = ruta.bloque(html,
  '// ---------- Mapa de calor mensual (V5) ----------',
  '// ---------- Retirar / Depositar liquidez ----------');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

// DOM de mentira minimo: renderMapaCalor solo usa getElementById + innerHTML.
var elMapa = { innerHTML: '' };
var ctx = {
  document: { getElementById: function (id) { return id === 'mapaCalor' ? elMapa : null; } },
  fullSerie: [],
  Number: Number, isFinite: isFinite, Math: Math, Date: Date, Object: Object
};
var nombres = Object.keys(ctx);
var fn = new Function(nombres.join(','), codigo +
  '\nreturn { mapaCalorMensual: mapaCalorMensual, celdaCalor: celdaCalor, renderMapaCalor: renderMapaCalor, setSerie: function (s) { fullSerie = s; } };');
var api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));

function punto(y, m, d, valor) { return { fecha: new Date(y, m - 1, d).getTime(), valor: valor }; }

console.log('\nA) el rendimiento del mes: cierre contra cierre del anterior');
// Ene cierra 1000, Feb cierra 1100 (+10%), Mar cierra 990 (-10%).
var serie = [punto(2026, 1, 15, 950), punto(2026, 1, 31, 1000),
  punto(2026, 2, 10, 1040), punto(2026, 2, 28, 1100),
  punto(2026, 3, 20, 990)];
var filas = api.mapaCalorMensual(serie);
ok(filas.length === 1 && filas[0].anio === 2026, 'una fila para 2026');
ok(filas[0].meses[1] === 0.1, 'febrero +10% (=' + filas[0].meses[1] + ')');
ok(Math.abs(filas[0].meses[2] - (-0.1)) < 1e-9, 'marzo -10% (=' + filas[0].meses[2] + ')');
ok(filas[0].meses[0] === null, 'enero sin mes anterior: vacio, no un 0 inventado');
ok(filas[0].meses[11] === null, 'diciembre sin datos: vacio');

console.log('\nB) huecos y bordes');
// Hueco: hay enero y MARZO pero no febrero -> marzo no puede medirse.
var conHueco = [punto(2026, 1, 31, 1000), punto(2026, 3, 31, 1200)];
var fh = api.mapaCalorMensual(conHueco);
ok(!fh.length || fh[0].meses.every(function (m) { return m === null; }), 'sin mes anterior contiguo no se afirma rendimiento');
ok(api.mapaCalorMensual([]).length === 0, 'serie vacia -> nada');
ok(api.mapaCalorMensual([punto(2026, 1, 31, 1000)]).length === 0, 'un solo punto -> nada');
// Cruce de año: dic 2025 -> ene 2026 se mide.
var cruce = [punto(2025, 12, 31, 1000), punto(2026, 1, 31, 1050)];
var fc = api.mapaCalorMensual(cruce);
ok(fc.length === 1 && fc[0].anio === 2026 && fc[0].meses[0] === 0.05, 'enero se mide contra el cierre de diciembre (+5%)');
// Años ordenados del mas nuevo al mas viejo.
var dosAnios = [punto(2025, 11, 30, 900), punto(2025, 12, 31, 1000), punto(2026, 1, 31, 1050)];
var fd = api.mapaCalorMensual(dosAnios);
ok(fd.length === 2 && fd[0].anio === 2026 && fd[1].anio === 2025, 'el año mas nuevo va arriba');

console.log('\nC) las celdas: color por signo, intensidad por tamaño, vacio honesto');
ok(/rgba\(34,197,94/.test(api.celdaCalor(0.05)) && api.celdaCalor(0.05).indexOf('+5.0') !== -1, 'positivo en verde con signo');
ok(/rgba\(244,63,94/.test(api.celdaCalor(-0.031)) && api.celdaCalor(-0.031).indexOf('-3.1') !== -1, 'negativo en rojo');
ok(/mc-vacia/.test(api.celdaCalor(null)), 'sin dato: celda vacia, sin numero');
function alphaDe(s) { return parseFloat((s.match(/,(0\.\d+)\)/) || [])[1]); }
ok(alphaDe(api.celdaCalor(0.08)) > alphaDe(api.celdaCalor(0.01)), 'un mes grande pinta mas fuerte que uno chico');
ok(alphaDe(api.celdaCalor(0.5)) <= 0.85, 'la intensidad tiene techo');
ok(api.celdaCalor(0.156).indexOf('+16') !== -1, 'dos digitos van sin decimal (+16)');

console.log('\nD) el render: cabecera + una fila por año, y el vacio explica');
api.setSerie(serie);
api.renderMapaCalor();
ok(elMapa.innerHTML.indexOf('mc-head') !== -1, 'cabecera con las iniciales de los meses');
ok((elMapa.innerHTML.match(/mc-fila/g) || []).length === 2, 'cabecera + 1 fila de año');
ok(elMapa.innerHTML.indexOf('2026') !== -1, 'el año esta');
api.setSerie([]);
api.renderMapaCalor();
ok(/history/.test(elMapa.innerHTML), 'sin datos lo dice en criollo, no queda en blanco');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
