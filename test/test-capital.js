// Arnés de la comparación del panel de Aportes (js/graficos.js): el índice de
// referencia alineado a la serie y comparacionGrupo(), el % real contra el %
// del índice sobre las cuentas cuyos aportes se conocen de verdad.
//
// HISTORIA: acá se probaban también el "capital aportado" (V1), el índice
// simulado del gráfico (V2) y cargarAportesGrafico. Los tres se BORRARON el
// 17/08/2026: no los llamaba nadie — se dibujaron una tarde (v50-v52), se
// sacaron a pedido de Guzmán y su reemplazo real es V7 (comparacionGrupo),
// que ya está en producción. Los asserts que los probaban no se borraron: se
// dieron vuelta (sección Z) para que nadie los reponga sin querer.
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var codigo = ruta.bloque(html,
  '// ---------- Aportes (estado compartido) ----------',
  '// ---------- Detalle desplegable por activo + grafico TradingView ----------');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

var DIA = 86400000;
function dia(y, m, d) { return new Date(y, m - 1, d).getTime(); }

function montar(opts) {
  opts = opts || {};
  var ctx = { Math: Math, Number: Number, String: String, Date: Date, isFinite: isFinite };
  // Copia propia: el codigo evaluado captura ESTE arreglo, asi que un test que
  // quiera simular "la serie sumo un punto" tiene que empujarlo aca dentro
  // (reasignar ctx.fullSerie despues no cambia lo que el codigo ya capturo).
  ctx.fullSerie = (opts.fullSerie || []).slice();
  var nombres = Object.keys(ctx);
  var salida = ['aplicarAportes', 'apISOaMs', 'aplicarBench', 'benchEn',
    'aplicarGrupo', 'comparacionGrupo', 'comparacionAnual'];
  var fn = new Function(nombres.join(','),
    codigo + '\nreturn {' + salida.map(function (n) { return n + ':' + n; }).join(',') +
    ', lista: function(){return aportesLista;}' +
    ', bench: function(){return benchPuntos;}, grupo: function(){return grupoPuntos;}};');
  var api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));
  api._ctx = ctx;
  return api;
}

console.log('\nZ) V1/V2 borrados el 17/08/2026: los asserts viejos, dados vuelta');
ok(html.indexOf('function serieCapital') === -1, 'serieCapital ya no existe (V1: lo reemplazo comparacionGrupo)');
ok(html.indexOf('function serieIndice') === -1, 'serieIndice ya no existe (V2: idem)');
ok(html.indexOf('function cargarAportesGrafico') === -1, 'cargarAportesGrafico ya no existe (los aportes los pide el panel)');
ok(html.indexOf('aportesPedidos') === -1, 'su bandera auxiliar (aportesPedidos) tampoco quedo');
// aportesDesde VOLVIO el 31/08/2026, y el assert se da vuelta por segunda
// vez. Se habia sacado el 17/08 porque solo lo leia serieCapital (borrado);
// ahora existe por un motivo distinto y mas fuerte: es la GUARDA del
// desglose "que movio mi saldo" (D3). Sin el, un rango que empieza antes de
// lo que la lista de aportes cubre atribuiria a "mercado" plata que en
// realidad Guzman deposito. Si alguien lo borra por parecer inutil, ese
// desglose empieza a mentir en silencio — de ahi que el assert lo exija.
ok(html.indexOf('aportesDesde') !== -1,
  'aportesDesde SIGUE existiendo: es la guarda del desglose de aportes vs mercado');
ok(/aportesDesde\s*=\s*\(r && r\.desde\)/.test(html),
  'y se llena desde la respuesta del backend, no se adivina');
ok(html.indexOf('COLOR_CAPITAL') === -1 && html.indexOf('COLOR_INDICE') === -1, 'los colores del area vieja tampoco');

console.log('\nD) aplicarAportes guarda la lista para comparacionGrupo');
var api = montar();
api.aplicarAportes({ lista: [{ fecha: '2026-04-15', grupo: 5000 }], desde: '2026-04-01' });
// `grupo`, que es el campo REAL del payload (getAportes manda {fecha,
// grupo}). Este assert decia `monto`, un nombre que el backend no manda
// desde hace tiempo — el mismo desvio que tenia aportesEnRango y que la
// hacia devolver siempre 0. Ver test-contrato-aportes en test-html.js.
ok(api.lista().length === 1 && api.lista()[0].grupo === 5000, 'la lista queda guardada');
api.aplicarAportes(null);
ok(api.lista().length === 0, 'una respuesta vacia la limpia en vez de explotar');

console.log('\nG) el indice de referencia alineado a la serie');
// Tres dias con numeros redondos; el indice de 5000 a 5500. Todo se calcula a
// mano abajo, para que el assert falle si la simulacion cambia de criterio.
var d1 = dia(2026, 3, 2), d2 = dia(2026, 3, 3), d3 = dia(2026, 3, 4);
var serieG = [{ fecha: d1, valor: 100000 }, { fecha: d2, valor: 102000 }, { fecha: d3, valor: 104000 }];
function montarG(valores) {
  var a = montar({ fullSerie: serieG });
  a.aplicarAportes({ lista: [{ fecha: '2026-03-03', grupo: 5000 }], desde: '2026-03-02' });
  a.aplicarBench({ bench: { nombre: 'S&P 500', valores: valores } });
  return a;
}
api = montarG([5000, 5250, 5500]);
ok(api.bench().length === 3, 'toma los tres cierres del indice');
ok(api.benchEn(d2) === 5250 && api.benchEn(d2 + 3600000) === 5250, 'el cierre de un dia vale hasta el siguiente');
ok(api.benchEn(d1 - 86400000) === null, 'antes del primer cierre, null');

console.log('\nI) las guardas de alineacion del indice');
// La guarda que mas importa: si el backend manda una cantidad de valores que no
// coincide con la serie, los indices NO corresponden y todo quedaria corrido.
api = montarG([5000, 5250]);
ok(api.bench().length === 0, 'bench de largo distinto a la serie -> se descarta entero');
// Un hueco en el indice (null) no corre el resto.
api = montarG([null, 5250, 5500]);
ok(api.bench().length === 2, 'los null no entran');

console.log('\nJ) el indice que ya llego no se borra por una respuesta sin el');
// Mientras la hoja del backend se llena, varias respuestas vienen sin indice.
// Si cada una borrara lo que hay, la linea apareceria y desapareceria sola.
api = montarG([5000, 5250, 5500]);
ok(api.bench().length === 3, 'primero llega con indice');
api.aplicarBench({ bench: null });
ok(api.bench().length === 3, 'una respuesta sin indice NO lo borra (misma serie)');
// Pero si la serie cambio de largo, lo que quedaba ya no corresponde a esas
// fechas: ahi si se descarta.
api._ctx.fullSerie.push({ fecha: dia(2026, 3, 5), valor: 105000 });
api.aplicarBench({ bench: null });
ok(api.bench().length === 0, 'si la serie cambio de largo, el indice viejo se descarta');

console.log('\nK) la comparacion del panel de Aportes (V7): % real vs % del indice');
// Tres dias. El grupo (Schwab + IBKR + Binance) recien tiene historia desde el
// dia 2: el 1 es null porque el guardado por cuenta no existia todavia.
// Grupo: 80.000 -> 86.000, con un aporte de 5.000 el dia 3.
function montarK(valoresGrupo, aportes) {
  var a = montar({ fullSerie: serieG });
  a.aplicarAportes({ lista: aportes || [{ fecha: '2026-03-04', monto: 5000, grupo: 5000 }], desde: '2026-03-02' });
  a.aplicarBench({ bench: { nombre: 'S&P 500', valores: [5000, 5250, 5500] } });
  a.aplicarGrupo({ serieGrupo: { nombre: 'Schwab + IBKR + Binance', valores: valoresGrupo } });
  return a;
}
api = montarK([null, 80000, 86000]);
ok(api.grupo().length === 2, 'toma solo los dias con dato guardado (el null no cuenta)');
var comp = api.comparacionGrupo();
ok(comp && !comp.pocos, 'con dos dias ya calcula');
ok(comp.desde === d2, 'la ventana arranca el primer dia guardado, no el de la serie');
ok(comp.capital === 85000, 'capital = valor al arrancar (80.000) + aporte al grupo (5.000) (=' + comp.capital + ')');
ok(comp.valor === 86000, 'el valor de hoy es el del grupo, no el patrimonio total');
ok(Math.abs(comp.pct - (86000 / 85000 - 1) * 100) < 0.001, 'porcentaje real (=' + comp.pct.toFixed(2) + '%)');
// Indice con el MISMO aporte el MISMO dia, medido contra el MISMO capital.
var uK = 80000 / 5250 + 5000 / 5500;
ok(Math.abs(comp.idxPct - ((uK * 5500) / 85000 - 1) * 100) < 0.001, 'porcentaje del indice (=' + comp.idxPct.toFixed(2) + '%)');
ok(comp.idxNombre === 'S&P 500', 'dice contra que indice compara');

console.log('\nL) solo cuenta la parte del aporte que fue a esas cuentas');
// Un deposito a Itau: viaja en `monto` pero con `grupo` en 0. Si se contara,
// el capital subiria sin que el valor del grupo suba, y el rendimiento se
// hundiria por una plata que nunca entro ahi.
api = montarK([null, 80000, 86000], [{ fecha: '2026-03-04', monto: 9000, grupo: 0 }]);
comp = api.comparacionGrupo();
ok(comp.capital === 80000, 'un aporte a Itau NO entra al capital del grupo (=' + comp.capital + ')');
ok(Math.abs(comp.pct - (86000 / 80000 - 1) * 100) < 0.001, 'y el porcentaje sale de las cuentas del grupo solas');

console.log('\nO) aporte fechado el MISMO dia del primer snapshot: ambiguo, se corre la base');
// El snapshot base se toma en un momento del dia (trigger 8:00, o el boton
// Actualizar); un aporte fechado ESE dia puede haber pasado antes o despues y
// no hay forma de saberlo con solo la fecha. Tratarlo como "ya en la base" sin
// poder probarlo fue el bug real: el aporte aparecia contado como rendimiento
// porque el valor final SI lo tenia pero el capital no.
// 3 dias: d1(76000) -- aporte de 5000 fechado d1 (ambiguo) -- d2(80000) -- d3(86000).
api = montarK([76000, 80000, 86000], [{ fecha: '2026-03-02', monto: 5000, grupo: 5000 }]);
ok(api.grupo().length === 3, 'los tres dias tienen dato');
comp = api.comparacionGrupo();
ok(comp && !comp.pocos, 'igual calcula: queda un dia limpio para usar de base');
ok(comp.desde === d2, 'la base se corre a d2 (d1 quedo ambiguo), NO arranca en d1 (=' + new Date(comp.desde).toDateString() + ')');
ok(comp.capital === 80000, 'el aporte ambiguo NO entra al capital (ya esta adentro de la base de d2) (=' + comp.capital + ')');
ok(Math.abs(comp.pct - (86000 / 80000 - 1) * 100) < 0.001, 'porcentaje sin el aporte contado como ganancia (=' + comp.pct.toFixed(2) + '%)');

console.log('\nP) el mismo aporte, un dia despues del snapshot: sin ambiguedad, cuenta normal');
// Control: el aporte fechado d2 (no el dia del primer snapshot) no dispara el
// corrimiento — es exactamente el escenario K de siempre.
api = montarK([76000, 80000, 86000], [{ fecha: '2026-03-03', monto: 5000, grupo: 5000 }]);
comp = api.comparacionGrupo();
ok(comp.desde === d1, 'la base NO se corre: d1 no tiene ningun aporte ese dia (=' + new Date(comp.desde).toDateString() + ')');
ok(comp.capital === 81000, 'el aporte de d2 SI entra al capital (76000 + 5000) (=' + comp.capital + ')');

console.log('\nQ) si TODOS los dias salvo el ultimo quedan ambiguos, mejor honesto que inventado');
// Solo 2 dias con dato (d2 y d3, igual que en K) y el primero es ambiguo: no
// queda ningun dia limpio para usar de base, así que no se puede afirmar nada
// — mismo criterio que "pocos dias".
api = montarK([null, 80000, 86000], [{ fecha: '2026-03-03', monto: 5000, grupo: 5000 }]);
comp = api.comparacionGrupo();
ok(comp && comp.pocos === true, 'sin ningun dia limpio, avisa en vez de calcular');

console.log('\nM) mientras no alcance, lo dice en vez de mostrar un numero');
api = montarK([null, null, 86000]);
comp = api.comparacionGrupo();
ok(comp && comp.pocos === true, 'con un solo dia guardado avisa que recien empieza');
ok(comp.dias === 1, 'y dice cuantos dias hay (=' + comp.dias + ')');
api = montarK([null, null, null]);
ok(api.comparacionGrupo() === null, 'sin ningun dia guardado no muestra nada');

// Guarda de alineacion, igual que el indice.
api = montarK([80000, 86000]);
ok(api.grupo().length === 0, 'serieGrupo de largo distinto a la serie -> se descarta entera');
// Y no se borra por una respuesta que no lo traiga.
api = montarK([null, 80000, 86000]);
api.aplicarGrupo({ serieGrupo: null });
ok(api.grupo().length === 2, 'una respuesta sin serieGrupo no borra la que estaba');

console.log('\nR) "la cartera" vs "rindio": el rendimiento sin el efecto del timing (V6)');
// El caso que separa los dos numeros: la cartera sube 10%, entra un aporte
// GRANDE, y despues cae 5%. La cartera como tal rindio 1.10 x 0.95 = +4,5%;
// el inversor, que puso lo gordo justo antes de la caida, gano menos.
// d1=100.000 -> d2=110.000 (+10%) -> aporte 100.000 -> d3 la cartera cae 5%:
// 110.000x0,95 = 104.500 de lo viejo + 95.000?? NO: el aporte entra al cierre
// de d3, asi que d3 = 110.000x0,95 + 100.000 = 204.500.
api = montarK([100000, 110000, 204500], [{ fecha: '2026-03-04', monto: 100000, grupo: 100000 }]);
comp = api.comparacionGrupo();
ok(Math.abs(comp.twrPct - 4.5) < 0.001, 'la cartera rindio +4,5% (1.10 x 0.95) (=' + comp.twrPct.toFixed(2) + '%)');
ok(Math.abs(comp.pct - 2.25) < 0.001, 'tu resultado fue +2,25% (204.500 / 200.000): lo gordo entro antes de la caida');
ok(comp.twrPct > comp.pct, 'los dos numeros cuentan historias distintas, y aca el timing costo plata');

// Sin aportes en la ventana, los dos numeros son el mismo.
api = montarK([null, 80000, 86000], []);
comp = api.comparacionGrupo();
ok(Math.abs(comp.twrPct - comp.pct) < 0.001, 'sin aportes, cartera y resultado coinciden (=' + comp.twrPct.toFixed(2) + '%)');

// Un retiro tambien se descuenta de su tramo (suma al valor sin flujo).
api = montarK([100000, 110000, 60500], [{ fecha: '2026-03-04', monto: -50000, grupo: -50000 }]);
comp = api.comparacionGrupo();
ok(Math.abs(comp.twrPct - 10.5) < 0.01, 'con un retiro en el medio, la cartera rinde 1.10 x 1.0045 = +10,5% (=' + comp.twrPct.toFixed(2) + '%)');

// Un tramo que no se puede medir con honestidad -> null, no un invento.
api = montarK([null, 80000, 4000], [{ fecha: '2026-03-04', monto: 5000, grupo: 5000 }]);
comp = api.comparacionGrupo();
ok(comp.twrPct === null, 'si el aporte del tramo es mayor que el valor del dia, twr viaja null');

console.log('\nN) el rendimiento del panel sale del grupo, nunca del total');
// El numero "total − inicio del año − aportes" se mostro y era FALSO (17/08):
// una transferencia de Itau/BTG hacia IBKR cuenta como deposito del broker sin
// que el patrimonio cambie, y cada transferencia interna restaba rendimiento
// de mentira — daba "perdidas" en un año ganador. Estos asserts verifican el
// FUENTE de paneles.js: si alguien repone esa resta, fallan.
var fsN = require('fs'), pathN = require('path');
var panelesSrc = fsN.readFileSync(pathN.join(ruta.RUTA, 'js', 'paneles.js'), 'utf8');
ok(panelesSrc.indexOf('inicio.valor - r.neto') === -1 && !/currentTotal\s*-\s*inicio/.test(panelesSrc),
  'renderAportes ya no resta aportes del patrimonio TOTAL');
ok(/Rendimiento del a/.test(panelesSrc) === false, 'la fila "Rendimiento del año" (la del numero falso) no existe');
ok(/c\.valor\s*-\s*c\.capital/.test(panelesSrc), 'el rendimiento en US$ sale de comparacionGrupo (valor del grupo menos su capital)');
ok(/htmlComparacion/.test(panelesSrc), 'el panel sigue mostrando la comparacion del grupo');

console.log('\nAA) el año contra el indice (Portafolio): descuenta los aportes');
// Pedido de Guzman (22/08/2026): "que aparezcan comparaciones vs sp500 ytd".
// El riesgo de este numero NO es el calculo, es confundirlo con el cambio del
// patrimonio — que incluye la plata que uno puso y siempre da mas.
function dic(d) { return new Date(2025, 11, d).getTime(); }
function ene(d) { return new Date(2026, 0, d).getTime(); }
var serieA = [
  { fecha: dic(31), valor: 1000 },   // cierre del año pasado: la BASE
  { fecha: ene(10), valor: 1100 },   // +10% real
  { fecha: ene(20), valor: 2100 },   // aporte de 1000 el 15 -> el tramo NO rindio (1100+1000)
  { fecha: ene(30), valor: 2310 }    // +10% real
];
var A = montar({ fullSerie: serieA });
A.aplicarBench({ bench: { nombre: 'S&P 500', valores: [100, 105, 105, 110] } });

// Sin aportes cargados NO se dibuja nada: la lista vacia de "todavia no
// llegaron" es identica a la de "no hubo ninguno", y confundirlas mostraria el
// cambio BRUTO (+142%) presentado como rendimiento.
ok(A.comparacionAnual() === null, 'sin los aportes cargados no devuelve nada (mejor nada que un numero inflado)');

A.aplicarAportes({ lista: [{ fecha: '2026-01-15', grupo: 1000 }] });
var r = A.comparacionAnual();
ok(r !== null, 'con los aportes cargados ya calcula');
ok(Math.abs(r.pct - 21) < 0.01, 'el rendimiento REAL encadena los tramos y descuenta el aporte: +21% (' + (r ? r.pct.toFixed(2) : '-') + ')');
ok(Math.abs(r.bruto - 131) < 0.01, 'y guarda aparte el cambio BRUTO del patrimonio, +131%, que es otra cosa (' + (r ? r.bruto.toFixed(2) : '-') + ')');
ok(r.pct < r.bruto, 'el rendimiento SIEMPRE es menor que el bruto cuando hubo aportes: es la trampa que este numero evita');
ok(r.aportes === 1000, 'informa cuanto se aporto, para poder explicar la diferencia');
ok(Math.abs(r.idxPct - 10) < 0.01, 'el indice va del cierre del año pasado a hoy: +10% (' + (r ? r.idxPct.toFixed(2) : '-') + ')');
ok(new Date(r.desde).getFullYear() === 2025, 'la base es el ultimo punto del año PASADO, no el primero de este');

// Una serie que arranca dentro del año no tiene punto de partida: no se
// inventa uno (seria comparar contra el primer dato que haya, no contra el
// cierre del año).
var B = montar({ fullSerie: [{ fecha: ene(10), valor: 100 }, { fecha: ene(20), valor: 120 }] });
B.aplicarAportes({ lista: [] });
ok(B.comparacionAnual() === null, 'sin un punto del año pasado no hay con que comparar: null');

// Sin indice alineado el numero propio SIGUE valiendo; lo que falta es el
// termino de comparacion.
var C = montar({ fullSerie: serieA });
C.aplicarAportes({ lista: [{ fecha: '2026-01-15', grupo: 1000 }] });
var rc = C.comparacionAnual();
ok(rc !== null && rc.idxPct === null, 'sin indice, el rendimiento propio se calcula igual y el indice queda en null');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
