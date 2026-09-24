// La pagina Exposure (24/09/2026, A28): las 10 empresas con mas exposicion,
// lo directo mas lo que hay dentro de cada fondo.
//
// Este arnes EJECUTA js/exposicion.js con un DOM de mentira y un payload con
// la forma que produce el Worker (business/Exposicion.js), y CRUZA cada campo
// que la pantalla lee contra el fuente del Worker: si alla se renombra, esto
// se pone rojo antes de que el telefono muestre guiones. Los numeros son
// INVENTADOS (el repo es publico).
var fs = require('fs');
var path = require('path');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

var RUTA = process.env.GA_LAUNCHER || path.join(__dirname, '..');
var src = fs.readFileSync(path.join(RUTA, 'js', 'exposicion.js'), 'utf8');
var html = fs.readFileSync(path.join(RUTA, 'index.html'), 'utf8');
var vistasSrc = fs.readFileSync(path.join(RUTA, 'js', 'vistas.js'), 'utf8');
var WORKER = process.env.GA_WORKER || path.join(RUTA, '..', 'ga-portfolio-worker');
var fuenteWorker = fs.existsSync(path.join(WORKER, 'src', 'business', 'Exposicion.js'))
  ? fs.readFileSync(path.join(WORKER, 'src', 'business', 'Exposicion.js'), 'utf8') : null;

var elementos = {};
function elemento(id) {
  if (!elementos[id]) elementos[id] = { id: id, innerHTML: '', onclick: null };
  return elementos[id];
}
var pedidos = 0, respuesta = null, vueltas = [];
var ocultos = false;
var google = { script: { run: {
  withSuccessHandler: function (f) { this._ok = f; return this; },
  withFailureHandler: function (f) { this._fail = f; return this; },
  getExposicion: function () { pedidos++; respuesta = { ok: this._ok, fail: this._fail }; }
} } };
var api = new Function('document', 'esc', 'fmt', 'msgErr', 'msgBackend', 'volver', 'google',
  src + '\nreturn { cargar: cargarExposicion, render: renderExposicion, fecha: expFecha };')(
  { getElementById: function (id) { return /^exp/.test(id) ? elemento(id) : null; } },
  function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); },
  function (n) { return ocultos ? '****' : 'USD ' + Math.round(n).toLocaleString('en-US'); },
  function (e) { return 'ERR ' + (e && e.message); },
  function (r) { return (r && r.mensajes || ['could not load']).join(' '); },
  function (v) { vueltas.push(v); },
  google);

var PAYLOAD = {
  ok: true, total: 50000, fuente: 'stockanalysis.com', cargado: '2026-09-24',
  empresas: [
    { s: 'NVDA', nombre: 'NVIDIA', valor: 2000, pct: 4, directo: 0, fondos: [{ s: 'VOO', valor: 1200 }, { s: 'QQQ', valor: 800 }] },
    { s: 'META', nombre: 'Meta Platforms', valor: 1500, pct: 3, directo: 1000, fondos: [{ s: 'VOO', valor: 300 }, { s: 'QQQ', valor: 200 }] },
    { s: 'CNSWF', nombre: 'Constellation <Software>', valor: 500, pct: 1, directo: 500, fondos: [] }
  ],
  fondos: [
    { s: 'VOO', valor: 15000, visto: 51.6, fecha: '2026-08-31', total: 516 },
    { s: 'QQQ', valor: 9000, visto: 72.4, fecha: '2026-09-22', total: 104 }
  ],
  sinTabla: []
};

console.log('\nA) la forma del Worker');
if (fuenteWorker) {
  ['empresas', 'fondos', 'sinTabla', 'directo', 'visto', 'fecha', 'pct', 'nombre', 'fuente', 'cargado'].forEach(function (c) {
    ok(fuenteWorker.indexOf(c + ':') !== -1, "el Worker escribe '" + c + "'");
  });
} else {
  console.log('  (sin el repo del Worker al lado: se saltea el cruce)');
}

console.log('\nB) abrir la pagina pide una vez y dibuja');
api.cargar(false);
ok(pedidos === 1, 'pide exposicion');
respuesta.ok(PAYLOAD);
var h = elemento('expBody').innerHTML;
ok((h.match(/class="exprow"/g) || []).length === 3, 'una fila por empresa');
ok(h.indexOf('<span class="exprank">1</span><span class="expname">NVIDIA <em>NVDA</em></span><b class="exppct">4.0%</b>') !== -1, 'puesto, nombre, simbolo y % de la cartera');
ok(h.indexOf('<span>USD 2,000</span> &middot; <span>VOO USD 1,200</span> &middot; <span>QQQ USD 800</span>') !== -1, 'NVIDIA: el total y de que fondo viene cada parte, cada una sin cortarse');
ok(h.indexOf('<span>USD 1,500</span> &middot; <span>Direct USD 1,000</span> &middot; <span>VOO USD 300</span>') !== -1, 'META: primero lo directo');
ok(h.indexOf('<span>USD 500</span> &middot; <span>all direct</span>') !== -1 && h.indexOf('Direct USD 500') === -1, 'sin fondos no repite el monto: all direct');
ok(/expbar-dir" style="width:50\.0%"/.test(h) && /expbar-fondo" style="width:25\.0%"/.test(h), 'la barra de META, partida y medida contra la primera fila');
ok(h.indexOf('<i class="expbar-fondo" style="width:100.0%"></i>') !== -1 && !/NVDA[\s\S]*?expbar-dir[\s\S]*?META/.test(h), 'NVIDIA sin tramo directo: la barra entera es de fondos');
ok(h.indexOf('Constellation &lt;Software>') !== -1, 'el nombre pasa por esc');
ok(/VOO 52% seen \(as of Aug 31\), QQQ 72% seen \(as of Sep 22\)/.test(h), 'cuanto de cada fondo se ve y de cuando es la lista');
ok(/figures are a floor/.test(h) && /Source: stockanalysis\.com, loaded 2026-09-24/.test(h), 'dice que es un piso, la fuente y la carga');
ok(/% of the whole portfolio/.test(h), 'aclara sobre que se mide el %');

console.log('\nC) el ojito, un fondo sin lista, y los fallos');
ocultos = true; api.render();
ok(elemento('expBody').innerHTML.indexOf('USD 2,000') === -1 && elemento('expBody').innerHTML.indexOf('****') !== -1, 'con el ojito cerrado no hay montos');
ok(/4\.0%/.test(elemento('expBody').innerHTML), 'los % siguen (no son montos)');
ocultos = false;
api.cargar(true); respuesta.ok(Object.assign({}, PAYLOAD, { sinTabla: ['VTI'] }));
ok(/Not looked into \(holdings not loaded\): VTI/.test(elemento('expBody').innerHTML), 'un fondo sin lista se nombra');
var pintado = elemento('expBody').innerHTML;
api.cargar(true); respuesta.fail(new Error('red'));
ok(elemento('expBody').innerHTML === pintado, 'un fallo de red con datos pintados no borra la pagina');
api.cargar(true); respuesta.ok({ ok: false, mensajes: ['No portfolio data yet.'] });
ok(/No portfolio data yet/.test(elemento('expBody').innerHTML), 'un rechazo del Worker se muestra tal cual');
api.cargar(true); respuesta.ok({ ok: true, empresas: [], fondos: [], sinTabla: [] });
ok(/No companies in the portfolio yet/.test(elemento('expBody').innerHTML), 'sin empresas lo dice');
ok(api.fecha('2026-08-31') === 'Aug 31' && api.fecha('2026-12-05') === 'Dec 5', 'la fecha corta de cada lista');

console.log('\nD) el menu, la vista y la vuelta');
ok(/<button class="mtile" id="mExpo">[\s\S]*?Exposure<\/button>/.test(html), 'el boton Exposure en el menu del costado');
ok(/<div id="view-exposicion" style="display:none">/.test(html) && /id="expBody"/.test(html) && /id="expBack"/.test(html), 'la vista con su cuerpo y su Back');
ok(/'rendanual', 'exposicion'/.test(vistasSrc), 'exposicion esta en VIEWS');
ok(/if \(name === 'exposicion'\) cargarExposicion\(false\);/.test(vistasSrc), 'entrar a la vista la carga');
ok(/getElementById\('mExpo'\)\.onclick = function \(\) \{ toggleMenu\(false\); setView\('exposicion'\); \}/.test(vistasSrc), 'el boton cierra el menu y abre la vista');
elemento('expBack').onclick();
ok(vueltas[0] === 'inicio', 'Back vuelve');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
