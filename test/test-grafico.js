// Arnés de js/gagraf.js — el reemplazo propio de Chart.js (196 KB → ~7 KB).
// Verifica la matemática de escalas, que los tres tipos dibujen sin explotar
// con un canvas de mentira, y que el onClick de las barras acierte el índice.
var ruta = require('./_ruta');
var fs = require('fs');
var path = require('path');

var codigo = fs.readFileSync(path.join(ruta.RUTA, 'js', 'gagraf.js'), 'utf8');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

// canvas de mentira que registra las operaciones
function canvasFalso() {
  var ops = [];
  // Los colores de cada stroke: la grilla del eje Y tambien traza, asi que
  // contar 'stroke' a secas mezcla grilla con series.
  var colores = [];
  var ctx = {
    canvas: {}, _ops: ops, _colores: colores,
    setTransform: function () {}, clearRect: function () { ops.push('clear'); },
    beginPath: function () {}, closePath: function () {}, moveTo: function () {}, lineTo: function () {},
    quadraticCurveTo: function () {}, arc: function () { ops.push('arc'); },
    stroke: function () { ops.push('stroke'); colores.push(ctx.strokeStyle); }, fill: function () { ops.push('fill'); },
    fillRect: function () { ops.push('barra'); }, fillText: function (t) { ops.push('txt:' + t); },
    measureText: function (t) { return { width: String(t).length * 6 }; },
    setLineDash: function (d) { ops.push('dash:' + (d && d.length ? d.join('-') : 'no')); }
  };
  var listeners = {};
  var cv = {
    width: 0, height: 0, style: {},
    getContext: function () { return ctx; },
    addEventListener: function (ev, fn) { listeners[ev] = fn; },
    removeEventListener: function (ev) { delete listeners[ev]; },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 300, height: 150 }; },
    parentNode: { getBoundingClientRect: function () { return { width: 300, height: 150 }; } },
    _listeners: listeners, _ctx: ctx
  };
  return cv;
}

var ctxGlobal = {
  window: { devicePixelRatio: 2, addEventListener: function () {}, removeEventListener: function () {} },
  Math: Math, isFinite: isFinite, Number: Number, String: String, parseFloat: parseFloat
};
ctxGlobal.window.Chart = null;
var nombres = Object.keys(ctxGlobal);
var fn = new Function(nombres.join(','), codigo + '\nreturn window.Chart;');
var Chart = fn.apply(null, nombres.map(function (n) { return ctxGlobal[n]; }));

console.log('\nA) la escala "linda"');
var e = Chart._escalaLinda(98000, 121000, 4);
ok(e.paso === 10000 && e.min === 90000 && e.max === 130000, 'pasos redondos para el patrimonio (' + e.min + '..' + e.max + ' de a ' + e.paso + ')');
e = Chart._escalaLinda(0, 887, 4);
ok(e.min === 0 && e.max >= 887 && e.paso >= 100, 'dividendos anuales (' + e.max + ' de a ' + e.paso + ')');
e = Chart._escalaLinda(5, 5, 4);
ok(isFinite(e.paso) && e.max > e.min, 'serie plana no divide por cero');
e = Chart._escalaLinda(NaN, 10, 4);
ok(e.paso === 1, 'entrada invalida cae a algo sano');

console.log('\nB) los tres tipos dibujan sin explotar');
var cv = canvasFalso();
var linea = new Chart(cv, { type: 'line', data: { datasets: [{ data: [{ x: 1, y: 100 }, { x: 2, y: 110 }, { x: 3, y: 105 }], fill: true, borderColor: '#d4af37' }] }, options: { scales: { x: { ticks: { callback: function (v) { return 'f' + v; } } }, y: {} } } });
ok(cv._ctx._ops.indexOf('stroke') !== -1 && cv._ctx._ops.indexOf('fill') !== -1, 'linea: traza y rellena');
ok(cv._ctx._ops.some(function (o) { return o.indexOf('txt:f') === 0; }), 'linea: usa el callback de fechas del eje X');
ok(cv.width === 600 && cv.height === 300, 'respeta el devicePixelRatio (2x)');
linea.destroy();

cv = canvasFalso();
new Chart(cv, { type: 'doughnut', data: { labels: ['a', 'b'], datasets: [{ data: [70, 30], backgroundColor: ['#111', '#222'], borderWidth: 3, borderColor: '#000' }] }, options: { cutout: '62%' } });
ok(cv._ctx._ops.filter(function (o) { return o === 'arc'; }).length >= 4, 'torta: dos porciones con agujero (4 arcos)');

cv = canvasFalso();
var clicks = [];
new Chart(cv, {
  type: 'bar',
  data: {
    labels: ['Ene', 'Feb', 'Mar'],
    datasets: [
      { data: [10, 0, 5], backgroundColor: '#5b8def', stack: 'd' },
      { data: [2, 3, 0], backgroundColor: '#888', stack: 'd' },
      { type: 'line', data: [6, 6, 6], borderColor: '#38bdf8' }
    ]
  },
  options: { onClick: function (ev, els) { clicks.push(els[0].index); }, scales: { x: {}, y: {} } }
});
ok(cv._ctx._ops.some(function (o) { return o === 'barra' || o === 'fill'; }), 'barras: dibuja las barras');
ok(cv._ctx._ops.indexOf('txt:Ene') !== -1, 'barras: etiquetas de los meses');
ok(typeof cv._listeners.click === 'function', 'barras: registra el click');

console.log('\nC) el click acierta la barra');
// ancho 300, padIzq depende del measureText; el area util arranca tras el pad.
// Click bien a la derecha => ultima barra (indice 2).
cv._listeners.click({ clientX: 290, clientY: 100 });
ok(clicks.length === 1 && clicks[0] === 2, 'click a la derecha -> mes 3 (indice ' + clicks[0] + ')');
cv._listeners.click({ clientX: 60, clientY: 100 });
ok(clicks.length === 2 && clicks[1] === 0, 'click a la izquierda -> mes 1 (indice ' + clicks[1] + ')');

console.log('\nD) datos vacios no explotan');
var vacios = [
  { type: 'line', data: { datasets: [{ data: [] }] }, options: {} },
  { type: 'doughnut', data: { datasets: [{ data: [0, 0] }] }, options: {} },
  { type: 'bar', data: { labels: [], datasets: [] }, options: {} }
];
var explotaron = 0;
vacios.forEach(function (c) { try { new Chart(canvasFalso(), c); } catch (err) { explotaron++; } });
ok(explotaron === 0, 'los tres tipos aguantan datos vacios');

console.log('\nE) varias series en el mismo grafico (V1 + V2)');
// El grafico de patrimonio superpone tres series: patrimonio (linea), capital
// aportado (area) e indice simulado (punteado).
cv = canvasFalso();
var tres = new Chart(cv, {
  type: 'line',
  data: { datasets: [
    { data: [{ x: 1, y: 100 }, { x: 2, y: 130 }], borderColor: '#d4af37', borderWidth: 2.5 },
    { data: [{ x: 1, y: 100 }, { x: 2, y: 110 }], borderColor: '#8c96aa', fill: true, backgroundColor: 'rgba(140,150,170,.28)' },
    { data: [{ x: 1, y: 100 }, { x: 2, y: 118 }], borderColor: '#5b8def', borderDash: [5, 4] }
  ] },
  options: { scales: { x: {}, y: {} } }
});
var ops = cv._ctx._ops;
var series = ['#d4af37', '#8c96aa', '#5b8def'];
function trazadas(c) { return c._ctx._colores.filter(function (col) { return series.indexOf(col) !== -1; }); }
ok(trazadas(cv).length === 3, 'traza las TRES series (=' + trazadas(cv).length + ')');
ok(ops.filter(function (o) { return o === 'fill'; }).length === 1, 'rellena solo la que pide fill');
// El primer stroke de una SERIE tiene que venir despues del relleno; los
// strokes anteriores son la grilla del eje.
var primerSerie = ops.indexOf('stroke', ops.indexOf('fill'));
ok(ops.indexOf('fill') < primerSerie && primerSerie !== -1, 'los rellenos van antes de los trazos (si no, el area tapa la linea)');
ok(ops.indexOf('dash:5-4') !== -1, 'el indice se dibuja punteado');
ok(ops.lastIndexOf('dash:no') > ops.indexOf('dash:5-4'), 'apaga el punteado despues (el contexto es compartido)');
// La escala mira TODAS las series: con el patrimonio en 130 el techo no puede
// quedar en 110 (la linea se saldria del cuadro).
var techo = 0;
ops.forEach(function (o) {
  if (o.indexOf('txt:') !== 0) return;
  var n = parseFloat(o.slice(4));
  if (isFinite(n) && n > techo) techo = n;
});
ok(techo >= 130, 'la escala Y cubre la serie mas alta (techo ' + techo + ')');
tres.destroy();

// Una serie vacia entre dos con datos no puede matar el grafico.
cv = canvasFalso();
new Chart(cv, { type: 'line', data: { datasets: [
  { data: [{ x: 1, y: 10 }, { x: 2, y: 12 }], borderColor: '#d4af37' },
  { data: [], borderColor: '#8c96aa', fill: true },
  { data: [{ x: 1, y: 9 }, { x: 2, y: 11 }], borderColor: '#5b8def' }
] }, options: { scales: { x: {}, y: {} } } });
ok(trazadas(cv).length === 2, 'una serie sin datos se saltea, las otras se dibujan (=' + trazadas(cv).length + ')');
ok(cv._ctx._ops.indexOf('fill') === -1, 'la serie vacia no deja un relleno fantasma');

console.log('');
console.log('X) las etiquetas repetidas del eje X no se dibujan dos veces');
// Las marcas se reparten parejo por el eje, no por mes. Con el formato corto
// (solo el mes, 02/09/2026) un rango de 3 meses con 6 marcas cada 15 dias
// escribia 'Jun Jun Jul Jul Aug Aug'. Dejar el hueco se lee bien; repetir el
// mismo mes dos veces seguidas se lee como un error del grafico.
var cvX = canvasFalso();
new Chart(cvX, {
  type: 'line',
  data: { datasets: [{ data: [{x:1,y:5},{x:2,y:6},{x:3,y:7},{x:4,y:8},{x:5,y:9},{x:6,y:10}], borderColor: '#d4af37' }] },
  options: { scales: { x: { ticks: { callback: function () { return 'Jun'; } } }, y: {} } }
});
var etiquetasJun = cvX._ctx._ops.filter(function (o) { return o === 'txt:Jun'; });
ok(etiquetasJun.length === 1, 'seis marcas con la MISMA etiqueta se dibujan una sola vez (=' + etiquetasJun.length + ')');

var cvY = canvasFalso();
new Chart(cvY, {
  type: 'line',
  data: { datasets: [{ data: [{x:1,y:5},{x:2,y:6},{x:3,y:7},{x:4,y:8},{x:5,y:9},{x:6,y:10}], borderColor: '#d4af37' }] },
  options: { scales: { x: { ticks: { callback: function (v) { return 'd' + Math.round(v); } } }, y: {} } }
});
var distintas = cvY._ctx._ops.filter(function (o) { return o.indexOf('txt:d') === 0; });
ok(distintas.length > 1, 'pero las etiquetas DISTINTAS se siguen dibujando todas (=' + distintas.length + ')');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
