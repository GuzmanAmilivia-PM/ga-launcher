// La pantalla de BTG, EJECUTADA (14/09/2026).
//
// La decima radiografia: "BTG en la app: cero tests que ejecuten nada. Es la
// cuenta del sueldo." Habia un solo assert, de texto. Aca se corre el codigo
// REAL de bancos.js (esBtg, renderBtg, el formulario, mostrarBtg,
// restaurarVistaCuenta) con un DOM de mentira y un google.script.run de
// mentira que anota que se pidio y deja disparar la respuesta.
//
// OJO CON LA FORMA (leccion del mismo dia, dos veces): el payload que recibe
// renderBtg es EL QUE PRODUCE getBtg en el Worker —{ultimo:{fecha, filas,
// totales:{liquido,plazo,total}}, cambio:{desde,hasta,delta,efectoFx,flujo}}—
// y lo que manda el formulario tiene que ser lo que lee normalizarEntrada.
// Por eso la seccion D cruza los nombres de los campos contra el fuente del
// Worker en vez de darlos por sabidos.
var ruta = require('./_ruta');
var fs = require('fs');
var path = require('path');
var html = ruta.leerIndex();

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}
function fuente(nombre, regex) {
  var m = html.match(regex);
  if (!m) { console.log('  FALLA: no encuentro ' + nombre); process.exit(1); }
  return m[0];
}

// El bloque de BTG de bancos.js: desde esBtg hasta el final del archivo.
var bancos = fs.readFileSync(path.join(ruta.RUTA, 'js', 'bancos.js'), 'utf8');
var iBtg = bancos.indexOf('function esBtg(acc) {');
if (iBtg < 0) { console.log('  FALLA: no encuentro esBtg en bancos.js'); process.exit(1); }
var codigo = bancos.slice(iBtg);

var preambulo = 'var montosOcultos = false;\n' +
  fuente('esc', /function esc\(s\) \{[\s\S]*?\n\}/) + '\n' +
  fuente('fmt', /function fmt\(n\) \{[\s\S]*?\n\}/) + '\n';

// ---- DOM de mentira ----
function elemento(id) {
  var e = { id: id, style: {}, className: '', hidden: false, disabled: false, value: '', checked: false, _html: '', _txt: '' };
  Object.defineProperty(e, 'innerHTML', { get: function () { return e._html; }, set: function (v) { e._html = String(v); } });
  Object.defineProperty(e, 'textContent', { get: function () { return e._txt; }, set: function (v) { e._txt = String(v); } });
  e.click = function () { if (e.onclick) e.onclick(); };
  return e;
}
function montar() {
  var els = {};
  var pedidos = [];   // {fn, args, ok, err}
  var espias = { showAccount: [], sincronizarTodo: 0, errorEnVista: [] };
  var run = {
    _ok: null, _err: null,
    withSuccessHandler: function (fn) { run._ok = fn; return run; },
    withFailureHandler: function (fn) { run._err = fn; return run; },
    guardarBtg: function (args) { pedidos.push({ fn: 'guardarBtg', args: args, ok: run._ok, err: run._err }); },
    getBtg: function () { pedidos.push({ fn: 'getBtg', ok: run._ok, err: run._err }); }
  };
  var ctx = {
    document: { getElementById: function (id) { return els[id] || (els[id] = elemento(id)); } },
    google: { script: { run: run } },
    lastAcc: { key: 'BTG', nombre: 'BTG' }, accountReturnView: 'portafolio', accPedida: 'BTG',
    showAccount: function (acc, v) { espias.showAccount.push([acc, v]); },
    sincronizarTodo: function () { espias.sincronizarTodo++; },
    errorEnVista: function (id, err, que) { espias.errorEnVista.push([id, que]); },
    msgBackend: function (r) { return ((r && r.mensajes) || []).join(' '); },
    msgErr: function (err, que) { return que + ' failed: ' + String(err && err.message || err); },
    Number: Number, isFinite: isFinite, String: String, Date: Date, Math: Math
  };
  var nombres = Object.keys(ctx);
  var fn = new Function(nombres.join(','), preambulo + codigo +
    '\nreturn { esBtg: esBtg, renderBtg: renderBtg, mostrarBtg: mostrarBtg, restaurarVistaCuenta: restaurarVistaCuenta, setPedida: function (k) { accPedida = k; } };');
  var api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));
  return { api: api, els: els, pedidos: pedidos, espias: espias, el: function (id) { return ctx.document.getElementById(id); } };
}

// El payload TAL CUAL lo produce getBtg (Btg.js): un corte al 13/09 con USD y
// pesos, y el cambio contra el anterior partido en flujo y efecto del peso.
var PAYLOAD = {
  cortes: [], anterior: { fecha: '2026-08-31' },
  ultimo: {
    fecha: '2026-09-13',
    filas: [{ fecha: '2026-09-13', tipo: 'liquido', moneda: 'USD', monto: 2662.87, tc: 1 },
            { fecha: '2026-09-13', tipo: 'liquido', moneda: 'UYU', monto: 206554.92, tc: 40.2 }],
    totales: { liquido: 7801.19, plazo: 0, total: 7801.19, porMoneda: { USD: 2662.87, UYU: 5138.32 } }
  },
  cambio: { desde: '2026-08-31', hasta: '2026-09-13', delta: -23.81, efectoFx: -25.4, flujo: 1.59 }
};

// ===========================================================================
console.log('\nA) renderBtg con el payload real');
// ===========================================================================
var m = montar();
m.api.renderBtg(PAYLOAD);
var box = m.el('accBtg');
ok(box.hidden === false, 'el bloque de BTG se muestra');
ok(/Snapshot of 2026-09-13/.test(box.innerHTML), 'dice de que fecha es el corte');
ok(/Liquid<\/span><b>[^<]*7,801/.test(box.innerHTML), 'el liquido en dolares (7.801)');
ok(/Fixed deposit<\/span><b>[^<]*0/.test(box.innerHTML), 'el plazo fijo en cero, que es un dato');
// fmt() redondea a dolares enteros: +1.59 se ve "+USD 2" y -25.4, "-USD 25".
ok(/Since 2026-08-31/.test(box.innerHTML) && /You put in \/ took out<\/span><b>\+USD 2</.test(box.innerHTML),
   'el cambio contra el corte anterior, con el FLUJO aparte (+1.59 -> "+USD 2"): ' + (box.innerHTML.match(/took out<\/span><b>[^<]*/) || [''])[0]);
// (fmt pone el signo despues de la moneda: "USD -25".)
ok(/Peso vs dollar<\/span><b class="down">USD -25</.test(box.innerHTML), 'y el efecto del peso aparte, en rojo (-25.4 -> "USD -25")');
ok(/id="btgAbrir"/.test(box.innerHTML) && typeof m.el('btgAbrir').onclick === 'function', 'el boton de cargar un corte nuevo queda cableado');

var m0 = montar();
m0.api.renderBtg({ cortes: [], ultimo: null, anterior: null, cambio: null });
ok(/No month-end snapshot yet/.test(m0.el('accBtg').innerHTML) && typeof m0.el('btgAbrir').onclick === 'function',
   'sin cortes todavia: lo dice y ofrece cargar el primero');

// ===========================================================================
console.log('\nB) el formulario: abrir, validar, mandar');
// ===========================================================================
m.el('btgAbrir').click();
var form = m.el('accBtgForm');
ok(form.hidden === false, 'tocar el boton abre el formulario');
var fechaPropuesta = m.el('btgFecha').value;
var fp = new Date(fechaPropuesta + 'T00:00:00Z');
ok(/^\d{4}-\d{2}-\d{2}$/.test(fechaPropuesta) && new Date(fp.getTime() + 86400000).getUTCDate() === 1,
   'la fecha propuesta es el ULTIMO dia de un mes (' + fechaPropuesta + ')');

// Nada cargado: no manda.
m.el('btgGuardar').click();
ok(m.pedidos.length === 0 && /at least one balance/.test(m.el('btgMsg').textContent), 'sin saldos no manda nada y lo dice');

// Un negativo: no manda.
m.el('btgLiqUsd').value = '-5';
m.el('btgGuardar').click();
ok(m.pedidos.length === 0 && /Check the amounts/.test(m.el('btgMsg').textContent), 'un monto negativo se frena antes de mandar');

// Lo normal: USD y pesos liquidos, el plazo en USD en CERO (dato) y el de
// pesos VACIO (no tengo). Casilla del flujo destildada.
m.el('btgLiqUsd').value = '2662.87';
m.el('btgLiqUyu').value = '206554.92';
m.el('btgPfUsd').value = '0';
m.el('btgPfUyu').value = '';
m.el('btgFlujo').checked = false;
m.el('btgGuardar').click();
ok(m.pedidos.length === 1 && m.pedidos[0].fn === 'guardarBtg', 'con saldos, manda guardarBtg');
var args = m.pedidos[0].args || {};
ok(args.fecha === fechaPropuesta, 'con la fecha del formulario');
ok(JSON.stringify(args.saldos) === JSON.stringify([
  { tipo: 'liquido', moneda: 'USD', monto: 2662.87 },
  { tipo: 'liquido', moneda: 'UYU', monto: 206554.92 },
  { tipo: 'plazo', moneda: 'USD', monto: 0 }
]), 'los saldos: el CERO viaja (es un dato) y el VACIO no (no tengo de eso): ' + JSON.stringify(args.saldos));
ok(args.registrarFlujo === false, 'la casilla destildada manda registrarFlujo:false');
ok(m.el('btgGuardar').disabled === true && /Saving/.test(m.el('btgMsg').textContent), 'mientras espera, el boton se apaga y dice que guarda');

// La respuesta buena: mensaje, formulario cerrado, la cuenta se repinta y se
// dispara la sincronizacion.
m.pedidos[0].ok({ ok: true, mensajes: ['Saved 2026-09-30: USD 7801.19 (liquid 7801.19, deposit 0).'] });
ok(m.el('btgGuardar').disabled === false, 'vuelve el boton');
ok(/Saved 2026-09-30/.test(m.el('btgMsg').textContent), 'muestra lo que contesto el servidor');
ok(form.hidden === true, 'cierra el formulario');
ok(m.espias.showAccount.length === 1 && m.espias.showAccount[0][0].key === 'BTG', 'repinta la cuenta abierta (BTG, no otra)');
ok(m.espias.sincronizarTodo === 1, 'y dispara la sincronizacion para que el resumen tome el valor nuevo');

// Con la casilla tildada, viaja true. Y una respuesta mala deja el formulario
// abierto con el motivo.
m.el('btgAbrir').click();
m.el('btgFlujo').checked = true;
m.el('btgGuardar').click();
ok(m.pedidos.length === 2 && m.pedidos[1].args.registrarFlujo === true, 'la casilla tildada manda registrarFlujo:true');
m.pedidos[1].ok({ ok: false, mensajes: ['The store is not available right now.'] });
ok(/not available/.test(m.el('btgMsg').textContent) && m.el('accBtgForm').hidden === false, 'una respuesta con ok:false deja el formulario abierto y dice por que');
ok(m.espias.showAccount.length === 1, 'y NO repinta nada');

// ===========================================================================
console.log('\nC) mostrarBtg y restaurarVistaCuenta');
// ===========================================================================
var m2 = montar();
m2.el('accTabla').hidden = false;
m2.api.mostrarBtg();
ok(m2.el('accTabla').hidden === true && m2.el('accItau').hidden === true && m2.el('accFondo').hidden === true,
   'esconde la tabla de posiciones y los bloques de Itau');
ok(m2.el('accBtg').hidden === false && /Loading/.test(m2.el('accBtg').innerHTML), 'muestra su bloque cargando');
ok(m2.pedidos.length === 1 && m2.pedidos[0].fn === 'getBtg', 'pide getBtg');
m2.pedidos[0].ok(PAYLOAD);
ok(/7,801/.test(m2.el('accTotal').textContent) && /Liquid: /.test(m2.el('accLiq').textContent), 'al llegar, el total y el liquido arriba');
ok(/Snapshot of 2026-09-13/.test(m2.el('accBtg').innerHTML), 'y el corte pintado');

// Una respuesta TARDIA de BTG cuando ya se abrio otra cuenta no pinta nada.
var m3 = montar();
m3.api.mostrarBtg();
m3.api.setPedida('CS');
m3.pedidos[0].ok(PAYLOAD);
ok(/Loading/.test(m3.el('accBtg').innerHTML) && m3.el('accTotal').textContent === 'Loading...',
   'si mientras cargaba se abrio otra cuenta, la respuesta tardia se descarta');

m2.api.restaurarVistaCuenta();
ok(m2.el('accTabla').hidden === false && m2.el('accBtg').hidden === true && m2.el('accBtgForm').hidden === true,
   'al abrir otra cuenta vuelve la tabla y se esconden el bloque y el formulario de BTG');

ok(m.api.esBtg({ key: 'BTG', nombre: 'BTG' }) && m.api.esBtg({ nombre: 'Btg Pactual' }) && !m.api.esBtg({ key: 'CS', nombre: 'Charles Schwab' }),
   'esBtg reconoce la cuenta por clave o por nombre, y no a otra');

// ===========================================================================
console.log('\nD) el contrato con el Worker, leido del fuente del Worker');
// ===========================================================================
// Lo que manda el formulario es lo que lee normalizarEntrada, y lo que pinta
// renderBtg es lo que arma getBtg / cambioEntreCortes. Se cruza contra el
// codigo real del otro repo: renombrar un campo de un solo lado pone esto en
// rojo. (Es el mismo cruce que test-html hace con los aportes.)
// El repo del Worker, al lado de este (igual que en test-html.js).
var RUTA_WORKER = process.env.GA_WORKER || path.join(__dirname, '..', '..', 'ga-portfolio-worker');
var btgSrc = fs.readFileSync(path.join(RUTA_WORKER, 'src', 'business', 'Btg.js'), 'utf8');
var normalizar = (btgSrc.match(/export function normalizarEntrada\([\s\S]*?\n\}/) || [''])[0];
ok(!!normalizar, 'encuentro normalizarEntrada en el Worker');
['args.fecha', 'args.saldos', '.tipo', '.moneda', '.monto'].forEach(function (campo) {
  ok(normalizar.indexOf(campo) !== -1, 'el Worker lee ' + campo + ' (lo que manda el formulario)');
});
ok(/args\.registrarFlujo/.test(btgSrc), 'y guardarBtg lee args.registrarFlujo (la casilla)');
var cambio = (btgSrc.match(/export function cambioEntreCortes\([\s\S]*?\n\}/) || [''])[0];
['desde:', 'delta:', 'efectoFx:', 'flujo:'].forEach(function (campo) {
  ok(cambio.indexOf(campo) !== -1, 'cambioEntreCortes devuelve ' + campo.replace(':', '') + ' (lo que pinta renderBtg)');
});
ok(/totales\.total/.test(btgSrc) && /liquido:/.test(btgSrc) && /plazo:/.test(btgSrc), 'y los totales traen liquido, plazo y total');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
