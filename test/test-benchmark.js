// Arnés de la línea del índice sobre el gráfico de Evolución (31/08/2026).
//
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
var indexHtml = fs.readFileSync(ruta.INDEX, 'utf8');

function montar(opts) {
  opts = opts || {};
  var pintado = { texto: '', clase: '', titulo: '' };
  var elVs = {
    set textContent(v) { pintado.texto = v; }, get textContent() { return pintado.texto; },
    set className(v) { pintado.clase = v; }, get className() { return pintado.clase; },
    set title(v) { pintado.titulo = v; }, get title() { return pintado.titulo; }
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
    colorAcento: function () { return '#d4af37'; },
    acentoRgba: function () { return 'rgba(1,1,1,.1)'; }
  };
  ctx.fullSerie = (opts.fullSerie || []).slice();
  var nombres = Object.keys(ctx);
  var salida = ['aplicarBench', 'benchEn', 'aplicarAportes', 'apISOaMs',
    'serieBench', 'aportesEnRango', 'benchPctEnRango', 'pintarVsBench', 'datasetsEvolucion',
    'movimientoDelSaldo'];
  var fn = new Function(nombres.join(','),
    graficos + '\nreturn {' + salida.map(function (n) { return n + ':' + n; }).join(',') + '};');
  var api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));
  api._pintado = pintado;
  api._mov = mov;
  return api;
}

// Tres días con números redondos, todo calculado a mano abajo.
var d1 = dia(2026, 3, 2), d2 = dia(2026, 3, 3), d3 = dia(2026, 3, 4);
var SERIE = [{ fecha: d1, valor: 100000 }, { fecha: d2, valor: 104000 }, { fecha: d3, valor: 110000 }];

console.log('\nA) el indice se re-escala al MISMO punto de partida que la cartera');
var api = montar({ fullSerie: SERIE });
api.aplicarBench({ bench: { nombre: 'S&P 500', valores: [5000, 5100, 5250] } });
var b = api.serieBench(SERIE);
ok(b.length === 3, 'un punto por cada dia de la serie (=' + b.length + ')');
ok(b[0].y === 100000, 'ARRANCA en el valor de la cartera, no en el nivel del indice (=' + b[0].y + ')');
// 5250/5000 = 1,05 -> 100000 * 1,05 = 105000
ok(Math.abs(b[2].y - 105000) < 0.01, 'y sigue la FORMA del indice: +5% del indice = 105.000 (=' + b[2].y + ')');
ok(b[0].x === d1 && b[2].x === d3, 'las fechas son las de la cartera, para que compartan eje X');

console.log('\nA2) el ancla es el primer punto DIBUJADO, no el primero de la serie');
// El grafico saltea fines de semana. Si la serie arranca un sabado, ese punto
// NO se dibuja: anclando ahi, las dos curvas empezaban separadas por un
// escaloncito. Se veia poco y mentia igual.
var sab = dia(2026, 3, 7), dom = dia(2026, 3, 8), lun = dia(2026, 3, 9), mar = dia(2026, 3, 10);
var conFinde = [{ fecha: sab, valor: 90000 }, { fecha: dom, valor: 90000 },
                { fecha: lun, valor: 100000 }, { fecha: mar, valor: 110000 }];
var apiF = montar({ fullSerie: conFinde });
apiF.aplicarBench({ bench: { nombre: 'S&P 500', valores: [4000, 4000, 5000, 5250] } });
var bf = apiF.serieBench(conFinde);
var dibujados = conFinde.filter(function (p, i) {
  if (i === conFinde.length - 1) return true;
  var d = new Date(p.fecha).getDay();
  return d !== 0 && d !== 6;
});
ok(bf.length === dibujados.length, 'tantos puntos como dias dibujados (' + bf.length + ' vs ' + dibujados.length + ')');
ok(bf[0].x === lun, 'arranca el LUNES, que es el primer dia que se ve');
ok(Math.abs(bf[0].y - 100000) < 0.01,
  'y en el valor de la cartera DE ESE DIA (100.000), no en el del sabado: ' + bf[0].y);

console.log('\nB) sin dato del indice no se inventa una linea');
var vacio = montar({ fullSerie: SERIE });
ok(vacio.serieBench(SERIE).length === 0, 'sin bench cargado, ninguna linea');
ok(vacio.datasetsEvolucion([{ x: d1, y: 1 }], SERIE).length === 1,
  'y el grafico queda con UNA sola serie, como antes');

console.log('\nC) con dato, el grafico dibuja DOS series y la del indice se distingue sin color');
var ds = api.datasetsEvolucion([{ x: d1, y: 1 }], SERIE);
ok(ds.length === 2, 'dos datasets');
ok(!!ds[1].borderDash, 'la del indice va PUNTEADA: se distingue aunque no se vea el color');
ok(ds[1].fill === false, 'y sin relleno, para no tapar la de la cartera');
ok(ds[0].borderColor === '#d4af37', 'la cartera conserva el color del acento vivo');

console.log('\nD) el delta va en PUNTOS porcentuales, no en porcentaje');
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
conAportes.aplicarAportes({ lista: [{ fecha: '2026-03-03', grupo: 5000 }], desde: '2026-03-02' });
ok(conAportes.aportesEnRango(SERIE) === 5000, 'detecta los 5.000 aportados dentro del rango');
conAportes.pintarVsBench(SERIE, 10);
// Desde D3 (31/08/2026) este caso mejoro: en vez de un asterisco vago, se
// DESCUENTAN los aportes y se compara el rendimiento limpio. La cartera
// subio +10% crudo, pero 5.000 los puso el: el rendimiento real es
// (110.000 − 100.000 − 5.000) / 105.000 = 4,76%, contra un indice de +5%.
ok(!/\*/.test(conAportes._pintado.texto),
  'ya NO hace falta el asterisco: se descuenta y se dice el numero real');
ok(/−0\.2 pp/.test(conAportes._pintado.texto),
  'el delta usa el rendimiento limpio (4,76% − 5%), no el +10% crudo: ' + conAportes._pintado.texto);
ok(/WITHOUT the/.test(conAportes._pintado.titulo) && /5,000/.test(conAportes._pintado.titulo),
  'y la explicacion dice cuanto se descuento: ' + conAportes._pintado.titulo.slice(0, 70));

console.log('\nG) un aporte FUERA del rango no ensucia el aviso');
var fuera = montar({ fullSerie: SERIE });
fuera.aplicarBench({ bench: { nombre: 'S&P 500', valores: [5000, 5100, 5250] } });
fuera.aplicarAportes({ lista: [{ fecha: '2026-01-15', grupo: 9000 }], desde: '2026-01-01' });
ok(fuera.aportesEnRango(SERIE) === 0, 'un aporte de enero no cuenta en un rango de marzo');
fuera.pintarVsBench(SERIE, 10);
ok(!/\*/.test(fuera._pintado.texto), 'sin asterisco: ' + fuera._pintado.texto);
ok(/same money/.test(fuera._pintado.titulo), 'y la explicacion es la limpia');

console.log('\nH) las guardas: nada de dividir por cero ni pintar basura');
var raro = montar({ fullSerie: [] });
raro.aplicarBench({ bench: { nombre: 'X', valores: [] } });
ok(raro.serieBench([]).length === 0, 'serie vacia');
ok(raro.benchPctEnRango([]) === null, 'sin rango, null (no un cero)');
raro.pintarVsBench([], 10);
ok(raro._pintado.texto === '', 'sin dato no se pinta nada, y no queda texto viejo');
// Un primer punto en cero NO tumba la linea: el ancla salta al primer punto
// que sirve. Renunciar seria peor — el historico arranca en cero el dia que
// se abrio la primera cuenta, y ahi la comparacion se perderia entera.
var enCero = [{ fecha: d1, valor: 0 }, { fecha: d2, valor: 100 }, { fecha: d3, valor: 110 }];
var base0 = montar({ fullSerie: enCero });
base0.aplicarBench({ bench: { nombre: 'X', valores: [10, 10, 11] } });
var b0 = base0.serieBench(enCero);
ok(b0.length > 0, 'una cartera que arranca en cero NO pierde la linea del indice');
ok(Math.abs(b0[0].y - 100) < 0.01, 'ancla en el primer punto con valor (100), no en el cero: ' + b0[0].y);
ok(Math.abs(b0[b0.length - 1].y - 110) < 0.01, 'y el indice +10% desde ahi da 110: ' + b0[b0.length - 1].y);
// Lo que SI tiene que devolver vacio: cuando ningun punto sirve.
var todoCero = [{ fecha: d1, valor: 0 }, { fecha: d2, valor: 0 }];
var apiCero = montar({ fullSerie: todoCero });
apiCero.aplicarBench({ bench: { nombre: 'X', valores: [10, 11] } });
ok(apiCero.serieBench(todoCero).length === 0, 'con TODO en cero no hay de donde anclar: sin linea');

// =========================================================================
// D3 — "¿Qué movió mi saldo?": separar aportes de rendimiento.
// La cuenta es simple; lo que importa son las guardas. Sin ellas, la plata
// que Guzmán depositó se lee como rendimiento, que es exactamente el error
// que Fidelity, IBKR y Schwab resolvieron cada uno por su lado.
// =========================================================================
console.log('\nI) el desglose: inicial + aportes + mercado = final');
var apiM = montar({ fullSerie: SERIE });
apiM.aplicarAportes({ lista: [{ fecha: '2026-03-03', grupo: 4000 }], desde: '2026-03-01' });
var m = apiM.movimientoDelSaldo(SERIE);
// 100.000 -> 110.000 son +10.000, pero 4.000 los pusiste vos: rindio 6.000.
ok(m.inicial === 100000 && m.final === 110000, 'toma los extremos del rango');
ok(m.aportes === 4000, 'los aportes del periodo');
ok(m.mercado === 6000, 'y el mercado se despeja por diferencia: 10.000 − 4.000 = 6.000');
ok(Math.abs(m.mercadoPct - (6000 / 104000 * 100)) < 0.01,
  'el % se mide sobre el capital que estuvo puesto (104.000), no sobre el inicial: ' + m.mercadoPct.toFixed(2) + '%');

console.log('\nJ) un RETIRO da vuelta el signo sin romper la cuenta');
var apiR = montar({ fullSerie: SERIE });
apiR.aplicarAportes({ lista: [{ fecha: '2026-03-03', grupo: -3000 }], desde: '2026-03-01' });
var mr = apiR.movimientoDelSaldo(SERIE);
ok(mr.aportes === -3000, 'los retiros vienen negativos (asi los manda el backend)');
ok(mr.mercado === 13000, 'y el mercado sube: subiste 10.000 HABIENDO sacado 3.000');

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
apiAntes.aplicarAportes({ lista: [{ fecha: '2026-03-04', grupo: 1000 }], desde: '2026-06-01' });
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
// Ahora: rendimiento limpio 5,77% vs indice 5% = +0,8 pp, SIN asterisco.
apiM.aplicarBench({ bench: { nombre: 'S&P 500', valores: [5000, 5100, 5250] } });
apiM.pintarVsBench(SERIE, 10);
ok(!/\*/.test(apiM._pintado.texto), 'sin asterisco: ya no hace falta advertir, se descuenta: ' + apiM._pintado.texto);
ok(/0\.8 pp/.test(apiM._pintado.texto),
  'y el delta usa el rendimiento limpio (5,77% − 5%), no el +10% crudo: ' + apiM._pintado.texto);
ok(/WITHOUT the/.test(apiM._pintado.titulo), 'la explicacion dice que descuenta los aportes');

console.log('\nO) si NO se puede desglosar, el asterisco vuelve');
apiAntes.aplicarBench({ bench: { nombre: 'S&P 500', valores: [5000, 5100, 5250] } });
apiAntes.pintarVsBench(SERIE, 10);
ok(/\*/.test(apiAntes._pintado.texto), 'con aportes que no se pueden separar, se advierte: ' + apiAntes._pintado.texto);
ok(/could not be separated/.test(apiAntes._pintado.titulo), 'y la explicacion es honesta sobre por que');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
