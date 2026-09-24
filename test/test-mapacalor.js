// Arnés del mapa de calor mensual (V5, js/calor.js). Desde el 23/09/2026 es
// LA grilla mes a mes de la app, y va SIN los depositos: el rendimiento de
// cada mes es el encadenado de _twrCadena (graficos.js, la cuenta "sin
// depositos" de toda la app) sobre los puntos del mes. Hasta ese dia habia dos
// grillas: esta, con el cierre contra el cierre (un deposito pintaba el mes de
// verde), y la de Analysis (D10), que restaba los aportes con otra cuenta. Los
// casos que custodiaba aquella (test-heatmap.js; hoy con numeros inventados) viven
// ahora aca, contra esta.
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

// Las piezas REALES de graficos.js que usa el mapa: la cadena y los dos
// ayudantes de los aportes. Con un doble, el arnes probaria su propia idea de
// "sin depositos", que es justo lo que no hay que duplicar.
function fuente(re, nombre) {
  var m = html.match(re);
  if (!m) { console.log('  FALLA: no encuentro ' + nombre + ' en graficos.js'); process.exit(1); }
  return m[0];
}
var piezas = [
  fuente(/function apISOaMs\(s\) \{[\s\S]*?\n\}/, 'apISOaMs'),
  fuente(/function aporteTotalDelDia\(a\) \{[\s\S]*?\n\}/, 'aporteTotalDelDia'),
  fuente(/function _twrCadena\(serie\) \{[\s\S]*?\n\}/, '_twrCadena')
].join('\n');

// DOM de mentira minimo: renderMapaCalor solo usa getElementById + innerHTML.
var elMapa = { innerHTML: '' };
var ctx = {
  document: { getElementById: function (id) { return id === 'mapaCalor' ? elMapa : null; } },
  fullSerie: [],
  Number: Number, isFinite: isFinite, Math: Math, Date: Date, Object: Object, String: String
};
var nombres = Object.keys(ctx);
var fn = new Function(nombres.join(','),
  'var aportesLista = [], aportesDesde = null, aportesCargados = true, aportesFallo = false;\n' + piezas + '\n' + codigo +
  '\nreturn { mapaCalorMensual: mapaCalorMensual, celdaCalor: celdaCalor, renderMapaCalor: renderMapaCalor,' +
  ' setSerie: function (s) { fullSerie = s; },' +
  ' setAportes: function (lista, desde, cargados) { aportesLista = lista || []; aportesDesde = desde === undefined ? null : desde; aportesCargados = cargados !== false; }, setFallo: function (v) { aportesFallo = v; } };');
var api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));

function punto(y, m, d, valor) { return { fecha: new Date(y, m - 1, d).getTime(), valor: valor }; }
// Ultimo dia del mes, en hora LOCAL: el codigo agrupa con getFullYear() y
// getMonth(), que son locales.
function cierre(anio, mes, valor) { return { fecha: new Date(anio, mes, 0, 18, 0, 0).getTime(), valor: valor }; }

console.log('\nA) sin aportes, el mes es el cierre contra el cierre del anterior');
// Ene cierra 1000, Feb cierra 1100 (+10%), Mar cierra 990 (-10%).
var serie = [punto(2026, 1, 15, 950), punto(2026, 1, 31, 1000),
  punto(2026, 2, 10, 1040), punto(2026, 2, 28, 1100),
  punto(2026, 3, 20, 990)];
var filas = api.mapaCalorMensual(serie);
ok(filas.length === 1 && filas[0].anio === 2026, 'una fila para 2026');
ok(filas[0].meses[1] === 0.1, 'febrero +10%: el encadenado de un mes sin aportes es cierre / cierre (=' + filas[0].meses[1] + ')');
ok(Math.abs(filas[0].meses[2] - (-0.1)) < 1e-9, 'marzo -10% (=' + filas[0].meses[2] + ')');
ok(filas[0].meses[0] === null, 'enero sin mes anterior: vacio, no un 0 inventado');
ok(filas[0].meses[11] === null, 'diciembre sin datos: vacio');
ok(filas[0].conFlujo.every(function (x) { return x === false; }), 'sin aportes, ningun mes marcado');

console.log('\nB) huecos y bordes');
var conHueco = [punto(2026, 1, 31, 1000), punto(2026, 3, 31, 1200)];
var fh = api.mapaCalorMensual(conHueco);
ok(!fh.length || fh[0].meses.every(function (m) { return m === null; }), 'sin mes anterior contiguo no se afirma rendimiento');
ok(api.mapaCalorMensual([]).length === 0, 'serie vacia -> nada');
ok(api.mapaCalorMensual([punto(2026, 1, 31, 1000)]).length === 0, 'un solo punto -> nada');
var cruce = [punto(2025, 12, 31, 1000), punto(2026, 1, 31, 1050)];
var fc = api.mapaCalorMensual(cruce);
ok(fc.length === 1 && fc[0].anio === 2026 && fc[0].meses[0] === 0.05, 'enero se mide contra el cierre de diciembre (+5%)');
var dosAnios = [punto(2025, 11, 30, 900), punto(2025, 12, 31, 1000), punto(2026, 1, 31, 1050)];
var fd = api.mapaCalorMensual(dosAnios);
ok(fd.length === 2 && fd[0].anio === 2026 && fd[1].anio === 2025, 'el año mas nuevo va arriba');

console.log('\nC) los depositos NO cuentan como ganancia (23/09/2026)');
// Numeros INVENTADOS con la misma forma que el caso real del 1/09/2026 (los
// reales se sacaron el 24/09/2026: este repo es publico).
var SERIE = [cierre(2025, 12, 60000), cierre(2026, 1, 63000), cierre(2026, 2, 62400),
  cierre(2026, 3, 60100), cierre(2026, 4, 68500)];
var APORTES = [
  { fecha: '2026-01-15', grupo: 1600, total: 1600 },
  { fecha: '2026-02-10', grupo: 1000, total: 1000 },
  { fecha: '2026-03-05', grupo: 1000, total: 1000 }
];
api.setAportes(APORTES, null, true);
var fr = api.mapaCalorMensual(SERIE)[0];
// El flujo entra al INICIO de su tramo (la convencion de toda la app):
// enero = 63.000 / (60.000 + 1.600) − 1 = +2,27 %. En crudo daria +5,00 %.
ok(Math.abs(fr.meses[0] - (63000 / (60000 + 1600) - 1)) < 1e-4, 'enero neto: +2,27 %, no el +5,00 % crudo (=' + (fr.meses[0] * 100).toFixed(2) + ')');
ok(Math.abs(fr.meses[1] - (62400 / (63000 + 1000) - 1)) < 1e-4, 'febrero: ' + (fr.meses[1] * 100).toFixed(2) + ' %');
ok(Math.abs(fr.meses[2] - (60100 / (62400 + 1000) - 1)) < 1e-4, 'marzo: ' + (fr.meses[2] * 100).toFixed(2) + ' %');
ok(Math.abs(fr.meses[3] - (68500 / 60100 - 1)) < 1e-4, 'abril, sin aportes: crudo y neto coinciden (' + (fr.meses[3] * 100).toFixed(2) + ' %)');
ok(fr.conFlujo[0] && fr.conFlujo[1] && fr.conFlujo[2] && !fr.conFlujo[3], 'marca los meses con movimiento de plata');

// El caso que justifica todo (con la forma del junio real): 70.000 -> 70.350
// con 1.000 de aporte. Crudo +0,50 %; neto −0,92 %. Sin la resta, la grilla lo
// pinta VERDE.
api.setAportes([{ fecha: '2026-06-11', grupo: 1000, total: 1000 }], null, true);
var jun = api.mapaCalorMensual([cierre(2026, 5, 70000), cierre(2026, 6, 70350)])[0];
ok(jun.meses[5] < 0, 'junio da NEGATIVO una vez descontado el aporte (=' + (jun.meses[5] * 100).toFixed(2) + ')');
ok(/244,63,94/.test(api.celdaCalor(jun.meses[5], true)), 'y la celda se pinta ROJA, no verde');
// Un deposito a BTG: grupo 0, total 1.000. La serie es la del patrimonio
// ENTERO, asi que manda `total` (7/09/2026).
api.setAportes([{ fecha: '2026-06-11', grupo: 0, total: 1000 }], null, true);
ok(api.mapaCalorMensual([cierre(2026, 5, 70000), cierre(2026, 6, 70350)])[0].meses[5] < 0, 'un deposito a BTG (grupo 0) tambien se descuenta: lee `total`');
// Un cache local anterior al campo `total` cae a `grupo`.
api.setAportes([{ fecha: '2026-06-11', grupo: 1000 }], null, true);
ok(api.mapaCalorMensual([cierre(2026, 5, 70000), cierre(2026, 6, 70350)])[0].meses[5] < 0, 'sin `total` (cache viejo) sigue leyendo `grupo`');

console.log('\nD) un mes que la lista de aportes no cubre queda VACIO');
// La lista solo da fe desde `desde` (la ventana de los brokers). Un mes que
// arranca antes no se puede separar: mostrar el crudo seria el error de
// siempre. La misma guarda que el "pp vs S&P" (movimientoDelSaldo).
api.setAportes([], new Date(2026, 2, 15).getTime(), true);
var fl = api.mapaCalorMensual(SERIE)[0];
ok(fl.meses[0] === null && fl.meses[1] === null && fl.meses[2] === null, 'enero a marzo arrancan antes de la lista: vacios');
ok(fl.sinLista[0] && fl.sinLista[2], 'y quedan marcados como fuera de la lista');
ok(fl.meses[3] !== null && !fl.sinLista[3], 'abril arranca dentro: se mide');

console.log('\nE) las celdas: color por signo, intensidad por tamaño, vacio honesto, punto del flujo');
ok(/rgba\(34,197,94/.test(api.celdaCalor(0.05)) && api.celdaCalor(0.05).indexOf('+5.0') !== -1, 'positivo en verde con signo');
ok(/rgba\(244,63,94/.test(api.celdaCalor(-0.031)) && api.celdaCalor(-0.031).indexOf('-3.1') !== -1, 'negativo en rojo');
ok(/mc-vacia/.test(api.celdaCalor(null)), 'sin dato: celda vacia, sin numero');
function alphaDe(s) { return parseFloat((s.match(/,(0\.\d+)\)/) || [])[1]); }
ok(alphaDe(api.celdaCalor(0.08)) > alphaDe(api.celdaCalor(0.01)), 'un mes grande pinta mas fuerte que uno chico');
ok(alphaDe(api.celdaCalor(0.5)) <= 0.85, 'la intensidad tiene techo');
ok(api.celdaCalor(0.156).indexOf('+16') !== -1, 'dos digitos van sin decimal (+16)');
ok(/mc-flujo/.test(api.celdaCalor(0.01, true)) && !/mc-flujo/.test(api.celdaCalor(0.01, false)), 'el mes con plata que entro o salio lleva su punto; los otros no');
ok(/\.mc-flujo::after \{[^}]*position:\s*absolute/.test(html), 'el punto va en la esquina (regla escrita: el arnes no mide)');

console.log('\nF) el render: sin la lista NO se pinta; con ella, cabecera + filas + notas');
api.setAportes([], null, false);
api.setSerie(serie);
api.renderMapaCalor();
ok(/Loading your deposits/.test(elMapa.innerHTML) && elMapa.innerHTML.indexOf('mc-fila') === -1,
  'sin la lista de aportes cargada no dibuja los crudos: dice que la espera');
// Si el pedido FALLO, no se queda en "Loading..." para siempre (24/09/2026,
// auditoria A15): dice que no se pudo.
api.setFallo(true);
api.renderMapaCalor();
ok(/could not be loaded/.test(elMapa.innerHTML) && !/Loading/.test(elMapa.innerHTML) && elMapa.innerHTML.indexOf('mc-fila') === -1,
  'con el pedido de aportes fallido lo dice, y tampoco dibuja los crudos: ' + elMapa.innerHTML);
api.setFallo(false);
api.setAportes([], null, true);
api.renderMapaCalor();
ok(elMapa.innerHTML.indexOf('mc-head') !== -1, 'cargada (aunque vacia: no hubo aportes) se dibuja, con la cabecera');
ok((elMapa.innerHTML.match(/mc-fila/g) || []).length === 2, 'cabecera + 1 fila de año');
ok(elMapa.innerHTML.indexOf('2026') !== -1, 'el año esta');
ok(!/The dot marks/.test(elMapa.innerHTML), 'sin ningun mes con plata, el punto no se explica (un aviso que esta siempre se ignora)');
ok(!/still in progress/.test(elMapa.innerHTML), 'con el ultimo dato en un mes viejo, no dice "en curso"');
var hoyT = new Date();
var mesPrev = new Date(hoyT.getFullYear(), hoyT.getMonth(), 0, 18, 0, 0);
api.setSerie([{ fecha: mesPrev.getTime(), valor: 100000 }, { fecha: hoyT.getTime(), valor: 101000 }]);
api.renderMapaCalor();
ok(/still in progress/.test(elMapa.innerHTML), 'con el ultimo dato de este mes, el mes en curso se declara a medias');
api.setSerie(serie);
api.setAportes(APORTES, null, true);
api.setSerie(SERIE);
api.renderMapaCalor();
ok(/The dot marks months where money went in or out/.test(elMapa.innerHTML), 'con meses con plata, explica el punto');
ok((elMapa.innerHTML.match(/mc-flujo/g) || []).length === 3, 'y marca los tres');
api.setAportes([], new Date(2026, 2, 15).getTime(), true);
api.renderMapaCalor();
ok(/Blank months are older than the deposits/.test(elMapa.innerHTML), 'los meses fuera de la lista se explican');
api.setSerie([]);
api.renderMapaCalor();
ok(/history/.test(elMapa.innerHTML), 'sin datos lo dice en criollo, no queda en blanco');
// La nota fija de la tarjeta decia "on total net worth. A large deposit or
// withdrawal counts as movement": ya no es asi.
ok(/Month over month, net of deposits and withdrawals/.test(html) && !/on total net worth/.test(html), 'la nota fija de la tarjeta dice que va sin depositos');
// Que renderAportes lo repinte al llegar la lista lo prueba test-inicio-ux.js
// (E2) con la app cargada entera: aca el bloque no llega hasta paneles.js.

console.log('\nG) la interfaz va en INGLES');
api.setAportes(APORTES, new Date(2026, 1, 15).getTime(), true);
api.setSerie(SERIE);
api.renderMapaCalor();
['aportes', 'meses', 'depósitos', 'Mes '].forEach(function (p) { ok(elMapa.innerHTML.indexOf(p) === -1, 'no se colo "' + p + '"'); });

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
