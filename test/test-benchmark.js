// Arnés de la comparación contra el índice en el gráfico de Evolución.
//
// 22/09/2026: la línea del índice sobre el gráfico en DÓLARES se sacó (pedido
// de Guzmán: esa curva incluye los depósitos y contra ella el índice nunca es
// comparable). La comparación vive ahora en la vista en %: el rendimiento sin
// depósitos de la cartera contra el % del índice, las dos desde 0 %. La
// sección A se DIO VUELTA (custodia que el gráfico en dólares no vuelva a
// dibujar el índice) y las B-C1c prueban la vista en %.
//
// Lo que sigue es la historia original (31/08/2026):
// El dato del S&P ya viajaba en el payload y lo usaban comparacionGrupo y
// comparacionAnual, pero el gráfico tenía UNA sola serie: nunca se dibujaba.
// Sale de comparar con IBKR (hasta 3 índices), Schwab (5) y Fidelity (26) —
// la comparación contra un índice está en 8 de cada 10 productos.
//
// LO QUE ESTE ARNÉS CUSTODIA, y es lo que puede salir mal en silencio:
//  1. Que el índice se re-escale al MISMO punto de partida que la cartera.
//     Sin eso las dos curvas viven en escalas distintas y el dibujo miente.
//  2. Que el delta se mida en PUNTOS porcentuales, no en porcentaje.
//  3. Que cuando hubo APORTES en el período se avise. Es el punto delicado:
//     la cartera sube en parte porque pusiste plata, y contra un índice
//     re-escalado eso se lee como que le ganaste al mercado.
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

// El bloque de graficos.js con las funciones nuevas vive antes del de
// aportes, asi que se toma el archivo entero y se evalua lo que hace falta.
var fs = require('fs');
var path = require('path');
var graficos = fs.readFileSync(path.join(ruta.RUTA, 'js', 'graficos.js'), 'utf8');
// Solo el index.html (leerIndex concatena tambien los js/): hace falta para
// verificar que el nodo y su CSS se fueron de la PANTALLA, no del codigo.
var indexHtml = ruta.leerIndexCrudo();

function montar(opts) {
  opts = opts || {};
  var pintado = { texto: '', clase: '', titulo: '' };
  var vistasPedidas = [];
  var elVs = {
    set textContent(v) { pintado.texto = v; }, get textContent() { return pintado.texto; },
    set className(v) { pintado.clase = v; }, get className() { return pintado.clase; },
    set title(v) { pintado.titulo = v; }, get title() { return pintado.titulo; },
    // Desde el 24/09/2026 la linea se toca (abre Performance): graficos.js le
    // engancha el click y el teclado al cargar. Se anotan para probarlos.
    oyentes: {}, addEventListener: function (t, f) { this.oyentes[t] = f; }
  };
  var mov = { html: '', clase: '' };
  var elMov = {
    set innerHTML(v) { mov.html = v; }, get innerHTML() { return mov.html; },
    set className(v) { mov.clase = v; }, get className() { return mov.clase; }
  };
  // graficos.js corre codigo de arranque que engancha botones del index. Un
  // getElementById que devuelve null lo hace explotar antes de llegar a lo
  // que queremos probar, asi que cualquier id desconocido recibe un nodo
  // inerte. El unico que importa de verdad es #vsBench.
  function nodoInerte() {
    var n = { style: {}, classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
      addEventListener: function () {}, removeEventListener: function () {},
      appendChild: function () {}, removeChild: function () {}, insertBefore: function () {},
      setAttribute: function () {}, getAttribute: function () { return null; },
      querySelector: function () { return nodoInerte(); }, querySelectorAll: function () { return []; },
      getContext: function () { return null; }, getBoundingClientRect: function () { return { width: 0, height: 0, top: 0, left: 0 }; },
      focus: function () {}, scrollIntoView: function () {}, closest: function () { return null; },
      textContent: '', innerHTML: '', className: '', children: [], dataset: {} };
    return n;
  }
  var ctx = {
    Math: Math, Number: Number, String: String, Date: Date, isFinite: isFinite,
    setTimeout: function () {}, clearTimeout: function () {},
    window: { addEventListener: function () {}, matchMedia: function () { return { matches: false, addEventListener: function () {} }; } },
    document: {
      getElementById: function (id) {
        if (id === 'vsBench') return elVs;
        if (id === 'movSaldo') return elMov;
        return nodoInerte();
      },
      querySelector: function () { return nodoInerte(); },
      querySelectorAll: function () { return []; },
      createElement: function () { return nodoInerte(); },
      addEventListener: function () {}
    },
    fmt: function (v) { return 'USD ' + Math.round(v).toLocaleString('en-US'); },
    esc: function (s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); },
    signoPct: function (v, d) { return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d) + '%'; },
    // Tocar la linea abre Performance (24/09/2026): se anota a donde se fue.
    setView: function (v) { vistasPedidas.push(v); },
    huboSwipe: !!opts.huboSwipe,
    colorAcento: function () { return '#d4af37'; },
    acentoRgba: function () { return 'rgba(1,1,1,.1)'; }
  };
  ctx.fullSerie = (opts.fullSerie || []).slice();
  var nombres = Object.keys(ctx);
  var salida = ['aplicarBench', 'benchEn', 'aplicarAportes', 'apISOaMs',
    'aportesEnRango', 'benchPctEnRango', 'pintarVsBench', 'datasetsEvolucion',
    'movimientoDelSaldo', 'serieRendimientoPct', 'datasetsRendimiento', 'pintarNotaEvo', 'twrEnRango'];
  var fn = new Function(nombres.join(','),
    graficos + '\nfunction __modo(m) { evoModo = m; }\nreturn {__modo: __modo,' + salida.map(function (n) { return n + ':' + n; }).join(',') + '};');
  var api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));
  api._pintado = pintado;
  api._vistas = vistasPedidas;
  api._vs = elVs;
  api._mov = mov;
  return api;
}

// Tres días con números redondos, todo calculado a mano abajo.
var d1 = dia(2026, 3, 2), d2 = dia(2026, 3, 3), d3 = dia(2026, 3, 4);
var SERIE = [{ fecha: d1, valor: 100000 }, { fecha: d2, valor: 104000 }, { fecha: d3, valor: 110000 }];

console.log('\nA) (dado vuelta el 22/09/2026) el grafico en DOLARES ya no dibuja el indice');
// Hasta el 22/09/2026 aca se probaba que serieBench re-escalaba el indice al
// valor de la cartera. Esa curva incluye los depositos: el indice encima nunca
// fue comparable. Que no vuelva.
var api = montar({ fullSerie: SERIE });
api.aplicarBench({ bench: { nombre: 'S&P 500', valores: [5000, 5100, 5250] } });
ok(!/function serieBench\(/.test(graficos), 'serieBench ya no existe');
var dsValor = api.datasetsEvolucion([{ x: d1, y: 1 }]);
ok(dsValor.length === 1, 'con el indice CARGADO, el grafico en dolares tiene UNA sola curva (=' + dsValor.length + ')');
ok(dsValor[0].fill === true && dsValor[0].borderColor === '#d4af37', 'la del patrimonio, con su relleno y el acento vivo');

console.log('\nB) la vista en %: sin la lista de aportes no se dibuja');
var pctSin = montar({ fullSerie: SERIE });
pctSin.aplicarBench({ bench: { nombre: 'S&P 500', valores: [5000, 5100, 5250] } });
ok(pctSin.serieRendimientoPct(SERIE).sinDatos === 'aportes', 'sin la lista, sinDatos = aportes (un deposito se dibujaria como rendimiento)');

console.log('\nC) la vista en %: dos curvas desde 0 %, y la punta es el "pp vs S&P"');
api.aplicarAportes({ lista: [{ fecha: '2026-03-03', grupo: 5000, total: 5000 }], desde: '2026-03-01' });
var rp = api.serieRendimientoPct(SERIE);
ok(!rp.sinDatos && rp.cartera.length === 3 && rp.indice.length === 3, 'un punto por dia en las dos curvas');
ok(rp.cartera[0].y === 0 && rp.indice[0].y === 0, 'las dos ARRANCAN en 0 %');
// Desde el 24/09/2026 (auditoria A17) el aporte va al FIN de su dia, como en
// el Worker: el del 03/03 es DESPUES de la foto de ese dia (la de las 8:00),
// asi que entra en el tramo 2. Tramo 1: 104.000 / 100.000 (mercado);
// tramo 2: 110.000 / (104.000 + 5.000) = 1,00917.
ok(Math.abs(rp.cartera[1].y - (104000 / 100000 - 1) * 100) < 1e-9, 'la foto del dia 2 es de ANTES del deposito: +4 % de mercado (=' + rp.cartera[1].y.toFixed(3) + ')');
ok(Math.abs(rp.cartera[2].y - (1.04 * 110000 / 109000 - 1) * 100) < 1e-9, 'y el deposito NO es rendimiento: el tramo 2 lo descuenta (' + rp.cartera[2].y.toFixed(3) + ')');
ok(Math.abs(rp.cartera[2].y - api.twrEnRango(SERIE).pct) < 1e-9, 'la punta de la cartera es EXACTAMENTE twrEnRango (el % sin depositos de arriba)');
ok(Math.abs(rp.indice[2].y - 5) < 1e-9, 'y la del indice, +5 %');
api.pintarVsBench(SERIE, 10);
var gap = rp.cartera[2].y - rp.indice[2].y;
ok(/−0\.0 pp/.test(api._pintado.texto) && Math.abs(gap - (-0.046)) < 0.01, 'la distancia entre las puntas es el "pp vs S&P" del Inicio: ' + api._pintado.texto + ' / ' + gap.toFixed(3));
var dsPct = api.datasetsRendimiento(rp.cartera, rp.indice);
ok(dsPct.length === 2 && !!dsPct[1].borderDash && dsPct[1].fill === false, 'dos curvas; el indice PUNTEADO y sin relleno');
ok(dsPct[0].fill === false && dsPct[0].borderColor === '#d4af37', 'la cartera con el acento y SIN relleno (las rachas negativas no se pintan como area ganada)');
ok(api.datasetsRendimiento(rp.cartera, []).length === 1, 'sin dato del indice, solo la cartera: no se inventa una linea');

console.log('\nC1) la vista en %: los fines de semana se saltean, pero el 0 % no');
var sab = dia(2026, 3, 7), dom = dia(2026, 3, 8), lun = dia(2026, 3, 9), mar = dia(2026, 3, 10);
var conFinde = [{ fecha: sab, valor: 90000 }, { fecha: dom, valor: 90000 }, { fecha: lun, valor: 100000 }, { fecha: mar, valor: 110000 }];
var apiF = montar({ fullSerie: conFinde });
apiF.aplicarBench({ bench: { nombre: 'S&P 500', valores: [4000, 4000, 5000, 5250] } });
apiF.aplicarAportes({ lista: [], desde: '2026-01-01' });
var rf = apiF.serieRendimientoPct(conFinde);
ok(rf.cartera.length === 3 && rf.cartera[0].x === sab && rf.cartera[1].x === lun, 'el primer punto (sabado) va igual —es la base—, el domingo no');

console.log('\nC1b) la vista en %: un rango mas largo que la lista de aportes no se dibuja');
var apiR = montar({ fullSerie: SERIE });
apiR.aplicarBench({ bench: { nombre: 'S&P 500', valores: [5000, 5100, 5250] } });
apiR.aplicarAportes({ lista: [], desde: '2026-03-20' });
var rr = apiR.serieRendimientoPct(SERIE);
ok(rr.sinDatos === 'rango' && rr.desde === apiR.apISOaMs('2026-03-20'), 'sinDatos = rango, y dice desde cuando se conocen los depositos');

console.log('\nC1c) la nota debajo del dibujo');
var nota = { hidden: true, innerHTML: '', textContent: '' };
api.__modo('pct');
api.pintarNotaEvo(nota, rp);
ok(nota.hidden === false && /without deposits/.test(nota.innerHTML) && /S&amp;P 500/.test(nota.innerHTML), 'en % la leyenda dice que es sin depositos y contra que indice: ' + nota.innerHTML.slice(0, 80));
api.pintarNotaEvo(nota, { sinDatos: 'aportes' });
ok(/Loading your deposits/.test(nota.textContent), 'sin la lista, dice que la esta esperando');
api.pintarNotaEvo(nota, rr);
ok(/shorter range/.test(nota.textContent) && /2026/.test(nota.textContent), 'con el rango largo, dice hasta donde llega y que hacer: ' + nota.textContent);
api.__modo('valor');
api.pintarNotaEvo(nota, null);
ok(nota.hidden === true, 'en dolares la nota no se ve');
api.aplicarAportes({ lista: [], desde: '2026-01-01' });

console.log('\nC2) SIN la lista de aportes no se pinta NADA (14/09/2026)');
// El defecto que encontro Guzman mirando la pantalla el 13/09/2026: el Inicio
// decia +21,6 pp vs S&P 500 cuando la ventaja real era 10,7. Sin la lista de
// aportes no se pueden descontar los 8.500 que habia depositado, y el % crudo
// contra el indice da el DOBLE. Era INTERMITENTE: la lista llega al abrir el
// panel de Aportes, o al arrancar solo si el cache del servidor esta caliente,
// asi que el mismo dia mostraba un numero u otro sin nada que los distinguiera.
// Ahora se esconde hasta saberlo, que es la MISMA guarda que comparacionAnual
// ya tenia y que aca faltaba. ESTE ASSERT ES EL CANDADO.
var sinAportes = montar({ fullSerie: SERIE });
sinAportes.aplicarBench({ bench: { nombre: 'S&P 500', valores: [5000, 5100, 5250] } });
sinAportes.pintarVsBench(SERIE, 10);
ok(sinAportes._pintado.texto === '',
  'sin la lista de aportes la linea queda VACIA, no pinta el +10% crudo: ' + sinAportes._pintado.texto);
// Y en cuanto la lista llega aparece sola, sin esperar el sondeo del minuto.
sinAportes.aplicarAportes({ lista: [], desde: '2026-01-01' });
sinAportes.pintarVsBench(SERIE, 10);
ok(/5\.0 pp/.test(sinAportes._pintado.texto),
  'y con la lista cargada ya pinta el delta: ' + sinAportes._pintado.texto);
// Que ADEMAS se repinte sola al llegar la lista no lo puede ejecutar este
// arnes: updateRangePct vive fuera del bloque que monta. ALCANCE: mira el
// codigo escrito. Sin esa llamada la linea existe pero queda vacia hasta el
// sondeo del minuto siguiente, y el hueco se leeria como un defecto nuevo.
var iFlag = codigo.indexOf('if (r) aportesCargados = true;');
var iRepinta = codigo.indexOf('updateRangePct()', iFlag);
ok(iFlag !== -1 && iRepinta !== -1 && (iRepinta - iFlag) < 700,
  'y aplicarAportes pide el repintado, para que aparezca sin esperar el sondeo');

console.log('\nD) el delta va en PUNTOS porcentuales, no en porcentaje');
// La lista vacia CARGADA no es lo mismo que la lista sin cargar (ver C2): aca
// se sabe que no hubo aportes, asi que el % crudo SI es comparable.
api.aplicarAportes({ lista: [], desde: '2026-01-01' });
// Cartera: 100.000 -> 110.000 = +10%. Indice: 5000 -> 5250 = +5%. Delta = 5 pp.
ok(Math.abs(api.benchPctEnRango(SERIE) - 5) < 0.001, 'el indice hizo +5% en el rango');
api.pintarVsBench(SERIE, 10);
ok(/5\.0 pp/.test(api._pintado.texto), 'el delta dice "pp" y vale 5,0: ' + api._pintado.texto);
ok(/^\+/.test(api._pintado.texto), 'con signo adelante');
ok(/S&P 500/.test(api._pintado.texto), 'y nombra el indice: ' + api._pintado.texto);
ok(/up/.test(api._pintado.clase), 'marcado como a favor');

console.log('\nE) por debajo del indice: el signo se da vuelta');
api.pintarVsBench(SERIE, 3);   // cartera +3%, indice +5% -> -2 pp
ok(/−2\.0 pp/.test(api._pintado.texto), 'delta negativo: ' + api._pintado.texto);
ok(/down/.test(api._pintado.clase), 'marcado como en contra');

console.log('\nF) LO DELICADO: si hubo aportes en el periodo, se avisa');
// La cartera crece en parte porque pusiste plata. Contra un indice
// re-escalado eso se lee como rendimiento propio. No se puede callar.
var conAportes = montar({ fullSerie: SERIE });
conAportes.aplicarBench({ bench: { nombre: 'S&P 500', valores: [5000, 5100, 5250] } });
conAportes.aplicarAportes({ lista: [{ fecha: '2026-03-03', grupo: 5000, total: 5000 }], desde: '2026-03-01' });
ok(conAportes.aportesEnRango(SERIE) === 5000, 'detecta los 5.000 aportados dentro del rango');
conAportes.pintarVsBench(SERIE, 10);
// Desde D3 (31/08/2026) este caso mejoro: en vez de un asterisco vago, se
// DESCUENTAN los aportes y se compara el rendimiento limpio. La cartera
// subio +10% crudo, pero 5.000 los puso el: el rendimiento real es
// (110.000 − 100.000 − 5.000) / 105.000 = 4,76%, contra un indice de +5%.
ok(!/\*/.test(conAportes._pintado.texto),
  'ya NO hace falta el asterisco: se descuenta y se dice el numero real');
// Desde el 9/09/2026 el limpio es el ENCADENADO (twrEnRango), el mismo de la
// tarjeta del año. Y desde el 15/09/2026 el flujo entra AL INICIO de su
// tramo (la convención de IBKR, verificada contra PortfolioAnalyst): tramo 1
// 104.000 / (100.000 + 5.000) = 0,9905; tramo 2 110.000 / 104.000 = 1,0577;
// 0,9905 × 1,0577 − 1 = +4,76%, contra +5% = −0,2 pp. (Con el flujo al
// cierre daba 4,71%; la cuenta vieja "(final−inicial−aportes)/(inicial+aportes)"
// coincide con esta solo por casualidad de dos puntos.)
// Y desde el 24/09/2026 (A17) el aporte del 03/03 va al FIN de su dia, como
// en el Worker: despues de la foto de ese dia, en el tramo 2. Tramo 1
// 104.000 / 100.000 = 1,04; tramo 2 110.000 / 109.000 = 1,00917 → +4,95%,
// contra +5% = −0,05 pp.
ok(/−0\.0 pp/.test(conAportes._pintado.texto),
  'el delta usa el rendimiento limpio encadenado (4,95% − 5%), no el +10% crudo: ' + conAportes._pintado.texto);
ok(/WITHOUT the/.test(conAportes._pintado.titulo) && /5,000/.test(conAportes._pintado.titulo),
  'y la explicacion dice cuanto se descuento: ' + conAportes._pintado.titulo.slice(0, 70));
// Esa explicacion vive en un `title`, y el iPhone no muestra titles: al lado
// del "+10% in YTD" (el patrimonio entero, deposito incluido) quedaba
// "−0.2 pp" a secas y se leia que el indice habia hecho +10,2%. Desde el
// 23/09/2026 la linea dice el rendimiento sin depositos EN EL TEXTO
// (auditoria general, punto 15).
ok(/^\+5\.0% without deposits · −0\.0 pp vs S&P 500$/.test(conAportes._pintado.texto),
  'con aportes, la linea dice tambien el % sin depositos, a la vista: ' + conAportes._pintado.texto);

console.log('\nG) un aporte FUERA del rango no ensucia el aviso');
var fuera = montar({ fullSerie: SERIE });
fuera.aplicarBench({ bench: { nombre: 'S&P 500', valores: [5000, 5100, 5250] } });
fuera.aplicarAportes({ lista: [{ fecha: '2026-01-15', grupo: 9000 }], desde: '2026-01-01' });
ok(fuera.aportesEnRango(SERIE) === 0, 'un aporte de enero no cuenta en un rango de marzo');
fuera.pintarVsBench(SERIE, 10);
ok(!/\*/.test(fuera._pintado.texto), 'sin asterisco: ' + fuera._pintado.texto);
ok(!/without deposits/.test(fuera._pintado.texto), 'y sin aportes en el rango no agrega el "without deposits": el % de arriba ya es limpio');
ok(/same money/.test(fuera._pintado.titulo), 'y la explicacion es la limpia');

console.log('\nH) las guardas: nada de dividir por cero ni pintar basura');
var raro = montar({ fullSerie: [] });
raro.aplicarBench({ bench: { nombre: 'X', valores: [] } });
ok(raro.serieRendimientoPct([]).sinDatos === 'serie', 'serie vacia: la vista en % no dibuja');
ok(raro.benchPctEnRango([]) === null, 'sin rango, null (no un cero)');
raro.pintarVsBench([], 10);
ok(raro._pintado.texto === '', 'sin dato no se pinta nada, y no queda texto viejo');
// (22/09/2026) Aca se probaba que el ancla de serieBench saltaba un primer
// punto en cero. En la vista en % un valor en cero no tiene rendimiento
// medible: se dice, no se inventa una base.
var enCero = [{ fecha: d1, valor: 0 }, { fecha: d2, valor: 100 }, { fecha: d3, valor: 110 }];
var base0 = montar({ fullSerie: enCero });
base0.aplicarBench({ bench: { nombre: 'X', valores: [10, 10, 11] } });
base0.aplicarAportes({ lista: [], desde: '2026-01-01' });
ok(base0.serieRendimientoPct(enCero).sinDatos === 'serie', 'un tramo desde cero no se mide: sinDatos = serie');

// =========================================================================
// D3 — "¿Qué movió mi saldo?": separar aportes de rendimiento.
// La cuenta es simple; lo que importa son las guardas. Sin ellas, la plata
// que Guzmán depositó se lee como rendimiento, que es exactamente el error
// que Fidelity, IBKR y Schwab resolvieron cada uno por su lado.
// =========================================================================
console.log('\nI) el desglose: inicial + aportes + mercado = final');
var apiM = montar({ fullSerie: SERIE });
apiM.aplicarAportes({ lista: [{ fecha: '2026-03-03', grupo: 4000, total: 4000 }], desde: '2026-03-01' });
var m = apiM.movimientoDelSaldo(SERIE);
// 100.000 -> 110.000 son +10.000, pero 4.000 los pusiste vos: rindio 6.000.
ok(m.inicial === 100000 && m.final === 110000, 'toma los extremos del rango');
ok(m.aportes === 4000, 'los aportes del periodo');
ok(m.mercado === 6000, 'y el mercado se despeja por diferencia: 10.000 − 4.000 = 6.000');
// Encadenado (9/09/2026), con el aporte al FIN de su dia como el Worker
// (24/09/2026, A17): el del 03/03 va despues de la foto de ese dia. Tramo 1
// 104.000 / 100.000 = 1,04; tramo 2 110.000 / (104.000 + 4.000) = 1,0185 →
// +5,93%. Es la misma definición que comparacionAnual y que el backend.
ok(Math.abs(m.mercadoPct - (1.04 * 110000 / 108000 * 100 - 100)) < 0.01,
  'el % es el encadenado que descuenta el aporte de su tramo: ' + m.mercadoPct.toFixed(2) + '%');

console.log('\nJ) un RETIRO da vuelta el signo sin romper la cuenta');
var apiR = montar({ fullSerie: SERIE });
apiR.aplicarAportes({ lista: [{ fecha: '2026-03-03', grupo: -3000, total: -3000 }], desde: '2026-03-01' });
var mr = apiR.movimientoDelSaldo(SERIE);
ok(mr.aportes === -3000, 'los retiros vienen negativos (asi los manda el backend)');
ok(mr.mercado === 13000, 'y el mercado sube: subiste 10.000 HABIENDO sacado 3.000');

console.log('\nJ2) un deposito a BTG (grupo 0, total 1.500) SE DESCUENTA: la serie es la del patrimonio entero');
// El caso real del 7/09/2026: Guzman puso 1.500 de sueldo en BTG. BTG no es
// del grupo comparable, asi que viaja con grupo 0 — y leyendo `grupo`, el
// Inicio lo mostraba como rendimiento: "+1,25 pp vs S&P" con plata recien
// puesta. Sobre la serie TOTAL el campo es `total`.
var apiBtg = montar({ fullSerie: SERIE });
apiBtg.aplicarBench({ bench: { nombre: 'S&P 500', valores: [5000, 5100, 5250] } });
apiBtg.aplicarAportes({ lista: [{ fecha: '2026-03-03', grupo: 0, total: 1500 }], desde: '2026-03-01' });
ok(apiBtg.aportesEnRango(SERIE) === 1500, 'aportesEnRango lee `total`: 1.500, no el 0 del grupo');
var mb = apiBtg.movimientoDelSaldo(SERIE);
ok(mb.aportes === 1500 && mb.mercado === 8500, 'el desglose: subio 10.000, 1.500 los pusiste, 8.500 fueron mercado');
apiBtg.pintarVsBench(SERIE, 10);
// Limpio: 8.500 / 101.500 = 8,37%, contra un indice de +5% = +3,4 pp.
ok(/\+3\.4 pp/.test(apiBtg._pintado.texto), 'el delta usa el rendimiento limpio (8,37% − 5%), no el +10% crudo: ' + apiBtg._pintado.texto);
ok(/WITHOUT the/.test(apiBtg._pintado.titulo) && /1,500/.test(apiBtg._pintado.titulo), 'y la explicacion dice que se descontaron los 1.500');
// Un cache local anterior al campo (sin `total`) cae a `grupo`: es lo que se
// leia hasta hoy — peor que el dato nuevo, mejor que atribuir todo al mercado.
var apiViejo = montar({ fullSerie: SERIE });
apiViejo.aplicarAportes({ lista: [{ fecha: '2026-03-03', grupo: 4000 }], desde: '2026-03-01' });
ok(apiViejo.aportesEnRango(SERIE) === 4000, 'sin `total` (cache viejo) sigue leyendo `grupo`');

console.log('\nK) GUARDA 1 — sin la lista de aportes no se inventa un cero');
// Sin ella, TODO el cambio se atribuiria a mercado: diria que ganaste
// 10.000 cuando 4.000 los pusiste vos.
var apiSin = montar({ fullSerie: SERIE });
apiSin.aplicarBench({ bench: { nombre: 'S&P 500', valores: [5000, 5100, 5250] } });
var mSin = apiSin.movimientoDelSaldo(SERIE);
ok(mSin && mSin.sinDatos === 'aportes', 'declara que le falta el dato, no devuelve numeros');
ok(mSin.mercado === undefined, 'y NO trae un mercado calculado a ciegas');

console.log('\nL) GUARDA 2 — un rango que empieza ANTES de lo que la lista cubre');
// Los aportes de ese tramo no estan y caerian enteros en "mercado".
var apiAntes = montar({ fullSerie: SERIE });
apiAntes.aplicarAportes({ lista: [{ fecha: '2026-03-04', grupo: 1000, total: 1000 }], desde: '2026-06-01' });
var mAntes = apiAntes.movimientoDelSaldo(SERIE);
ok(mAntes && mAntes.sinDatos === 'rango', 'detecta que el rango excede lo que la lista conoce');

console.log('\nM) el desglose en pantalla se SACO (02/09/2026) — asserts DADOS VUELTA');
// Pedido de Guzman: "sacale el start added + 187 market +19% abajo de la
// grafica". Los asserts que probaban ese render NO se borran: se dan vuelta,
// asi nadie lo repone sin querer (regla del proyecto).
//
// Lo que SI tiene que seguir vivo es movimientoDelSaldo, arriba: es la que le
// da a pintarVsBench el rendimiento LIMPIO, sin los aportes. Si alguien la
// borrara "de paso" al sacar la linea, la comparacion contra el indice
// volveria al % crudo — que infla la cartera con la plata que pusiste — y
// ningun assert de este archivo lo notaria si no fuera por los de abajo.
// ESTE ASSERT ESTABA MUERTO y lo cazo la auditoria del 02/09/2026 por mutacion:
// `pintarMovimiento` se saco de la lista `salida` de montar(), asi que apiM
// NUNCA expone esa clave — exista o no la funcion en produccion. Reponer la
// funcion entera dejaba el arnes en verde. Es exactamente la trampa de
// "verifica un valor que el propio test fabrico". Ahora mira el FUENTE, como
// su hermano de la linea de abajo.
ok(graficos.indexOf('function pintarMovimiento') === -1, 'pintarMovimiento ya no existe');
ok(graficos.indexOf('movSaldo') === -1, 'ni queda el nodo movSaldo en el codigo');
ok(indexHtml.indexOf('id="movSaldo"') === -1, 'ni el div en el index.html');
ok(indexHtml.indexOf('.movsaldo') === -1, 'ni su CSS huerfano');
ok(typeof apiM.movimientoDelSaldo === 'function',
  'pero movimientoDelSaldo SIGUE viva: es la que descuenta los aportes para el indice');

console.log('\nÑ) el benchmark ahora compara el rendimiento LIMPIO, y se acabo el asterisco');
// Antes: cartera +10% (que incluye 4.000 aportados) vs indice +5% = "+5 pp *".
// Ahora: rendimiento limpio 5,93% vs indice 5% = +0,9 pp, SIN asterisco
// (el aporte al fin de su dia, como el Worker: ver I).
apiM.aplicarBench({ bench: { nombre: 'S&P 500', valores: [5000, 5100, 5250] } });
apiM.pintarVsBench(SERIE, 10);
ok(!/\*/.test(apiM._pintado.texto), 'sin asterisco: ya no hace falta advertir, se descuenta: ' + apiM._pintado.texto);
ok(/\+0\.9 pp/.test(apiM._pintado.texto),
  'y el delta usa el rendimiento limpio (5,93% − 5%), no el +10% crudo: ' + apiM._pintado.texto);
ok(/WITHOUT the/.test(apiM._pintado.titulo), 'la explicacion dice que descuenta los aportes');

console.log('\nO) si NO se puede desglosar, el asterisco vuelve');
apiAntes.aplicarBench({ bench: { nombre: 'S&P 500', valores: [5000, 5100, 5250] } });
apiAntes.pintarVsBench(SERIE, 10);
ok(/\*/.test(apiAntes._pintado.texto), 'con aportes que no se pueden separar, se advierte: ' + apiAntes._pintado.texto);
ok(/could not be separated/.test(apiAntes._pintado.titulo), 'y la explicacion es honesta sobre por que');

console.log('\nN) tocar la linea abre Performance (24/09/2026, auditoria A5/A7)');
var apiT = montar({ fullSerie: SERIE });
ok(typeof apiT._vs.oyentes.click === 'function' && typeof apiT._vs.oyentes.keydown === 'function', 'la linea escucha el toque y el teclado');
apiT._vs.oyentes.click();
ok(apiT._vistas.length === 0, 'vacia (sin comparacion que mostrar) no lleva a ningun lado');
apiT.aplicarBench({ bench: { nombre: 'S&P 500', valores: [5000, 5100, 5250] } });
apiT.aplicarAportes({ lista: [], desde: '2026-01-01' });
apiT.pintarVsBench(SERIE, 10);
apiT._vs.oyentes.click();
ok(apiT._vistas[0] === 'rendanual', 'con texto, abre Performance: ' + apiT._vistas.join(','));
var tecla = { key: 'Enter', preventDefault: function () {} };
apiT._vs.oyentes.keydown(tecla);
ok(apiT._vistas[1] === 'rendanual', 'y con Enter, desde el teclado');
var apiS = montar({ fullSerie: SERIE, huboSwipe: true });
apiS.aplicarBench({ bench: { nombre: 'S&P 500', valores: [5000, 5100, 5250] } });
apiS.aplicarAportes({ lista: [], desde: '2026-01-01' });
apiS.pintarVsBench(SERIE, 10);
apiS._vs.oyentes.click();
ok(apiS._vistas.length === 0, 'un dedo que venia deslizando el carrusel no cuenta como toque');
ok(/\.vsbench:not\(:empty\)::after \{[^}]*content/.test(indexHtml + fs.readFileSync(path.join(ruta.RUTA, 'css', 'estilos.css'), 'utf8')), 'la flecha › aparece solo con texto (regla escrita)');
ok(/id="vsBench" role="button" tabindex="0"/.test(indexHtml), 'y es un boton alcanzable con Tab');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
