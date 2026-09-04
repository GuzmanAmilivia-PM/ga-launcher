// Arnés de IA Insights (la ficha por activo). Nace el 26/08/2026, cuando la
// ficha pasó a seguir el MARCO profesional: hasta ese día esta pantalla no
// tenía arnés — se pintaba lo que el backend mandara y nadie lo verificaba.
//
// El backend manda la ficha ya redactada; lo que se prueba acá es el PINTADO
// y el CABLEADO: que cada sección del marco caiga donde va, que una ficha
// VIEJA del caché no pierda lo suyo ni pinte títulos vacíos, que el aviso de
// "esto no es una recomendación" no se pueda perder, y que el contenido del
// modelo se escape antes de entrar al html.
var ruta = require('./_ruta');
var html = ruta.leerIndex();
// ia.js entero: de su encabezado al del archivo siguiente en el orden de
// carga real (seguridad.js).
var codigo = ruta.bloque(html,
  '// ---------- IA Insights ----------',
  '// ---------- Seguridad');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

// La ficha del esquema NUEVO (v2): los once campos del marco.
var FICHA = {
  ok: true, symbol: 'O', generado: '26/08 14:30', modelo: 'claude-opus-5',
  analisis: {
    clasificacion: {
      queEs: 'REIT minorista de arrendamiento neto, en fase madura.',
      lente: 'Se mide por AFFO y la cobertura del dividendo: el PER no sirve porque la depreciacion inmobiliaria distorsiona el beneficio.'
    },
    resumen: 'Propietario de locales con contratos largos.',
    indicadores: [
      { nombre: 'P/AFFO', valor: '13.2x', comentario: 'por debajo de su media de 10 anios' },
      { nombre: 'Cobertura del dividendo', valor: '76% del AFFO', comentario: 'holgada para el sector' }
    ],
    calidad: 'Genera caja estable; el apalancamiento esta en el rango normal de un REIT.',
    fortalezas: ['Contratos de muy largo plazo', 'Inquilinos diversificados'],
    riesgos: ['Sensible a las tasas de interes', 'Crecimiento por adquisiciones dependiente del costo del capital'],
    crecimiento: 'Crecimiento de AFFO por accion de un digito bajo, en linea con su historia.',
    expectativas: 'El precio de hoy parece descontar crecimiento de AFFO cercano al historico: no exige una aceleracion.',
    enCartera: 'Pesa 4% y es una apuesta individual dentro de tu perfil moderado.',
    queMirar: ['El costo de la deuda nueva', 'La ocupacion trimestre a trimestre'],
    nota: 'Conocimiento con fecha de corte; los hechos recientes pueden faltar.'
  }
};

function montar() {
  var estado = { pedidos: [], vistas: [] };
  var elems = {};
  function nuevoElem(id) {
    var el = { id: id, style: {}, className: '', _html: '', hijos: [] };
    el.appendChild = function (o) { this.hijos.push(o); };
    el.scrollIntoView = function () {};
    el.addEventListener = function () {};
    Object.defineProperty(el, 'innerHTML', {
      get: function () { return this._html; },
      set: function (v) { this._html = v; this.hijos = []; }
    });
    return el;
  }
  function elem(id) {
    if (!elems[id]) elems[id] = nuevoElem(id);
    return elems[id];
  }
  var ctx = {
    document: {
      getElementById: function (id) { return elem(id); },
      createElement: function () { return nuevoElem('nuevo'); }
    },
    esc: function (s) {
      return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    setView: function (v) { estado.vistas.push(v); },
    guardarConBoton: function () {},
    lastData: { posiciones: [{ symbol: 'O', nombre: 'Realty Income' }, { symbol: 'USDT', nombre: 'Tether' }] },
    window: { scrollTo: function () {} },
    google: { script: { run: (function () {
      function mk() {
        var oks = [];
        var api = {
          withSuccessHandler: function (f) { oks.push(f); return api; },
          withFailureHandler: function () { return api; },
          estadoIA: function () { oks.forEach(function (f) { f({ configurada: true }); }); },
          analizarConIA: function (args) {
            estado.pedidos.push(args);
            oks.forEach(function (f) { f(estado.respuesta || FICHA); });
          }
        };
        return api;
      }
      return {
        withSuccessHandler: function (f) { return mk().withSuccessHandler(f); },
        withFailureHandler: function (f) { return mk().withFailureHandler(f); }
      };
    })() } }
  };
  var nombres = Object.keys(ctx);
  var fn = new Function(nombres.join(','),
    codigo + '\nreturn { ficha: fichaIAHtml, preparar: prepararIA, analizar: analizarIA };');
  estado.api = fn.apply(null, nombres.map(function (n) { return ctx[n]; }));
  estado.elem = elem;
  return estado;
}

console.log('\nA) la ficha pinta el marco completo, en su orden');
var m = montar();
var h = m.api.ficha(FICHA);
ok(/O &middot; AI profile/.test(h), 'encabezado con el simbolo');
ok(/26\/08 14:30/.test(h) && /claude-opus-5/.test(h), 'cuando se genero y con que modelo');
ok(/class="ia-clase"/.test(h) && /REIT minorista/.test(h), 'PASO 1: que es el activo, arriba de todo');
ok(/el PER no sirve/.test(h), 'y CON QUE LENTE se lo mide (lo que evita el error clasico del REIT)');
ok(/P\/AFFO/.test(h) && /13\.2x/.test(h), 'los indicadores con el multiplo que corresponde');
ok(/Quality: does it create value\?/.test(h) && /apalancamiento/.test(h), 'la seccion de calidad');
ok(/ia-h pos/.test(h) && /Contratos de muy largo plazo/.test(h), 'fortalezas');
ok(/ia-h neg/.test(h) && /Sensible a las tasas/.test(h), 'riesgos');
ok(/Growth outlook/.test(h) && /digito bajo/.test(h), 'crecimiento');
ok(/What today’s price is asking for/.test(h) && /ia-destacado/.test(h), 'las EXPECTATIVAS, y van destacadas');
ok(/no exige una aceleracion/.test(h), 'con su texto');
ok(/In your portfolio/.test(h) && /perfil moderado/.test(h), 'el encaje en la cartera');
ok(/What to watch/.test(h) && /ocupacion trimestre/.test(h), 'los falsificadores: que vigilar');
ok(/fecha de corte/.test(h), 'la nota con los limites');
ok(/not a buy or sell recommendation/.test(h), 'y el aviso de que no es una recomendacion');
// El orden importa: clasificar antes de medir, y las expectativas despues del
// crecimiento. Si alguien reordena el render, el marco deja de leerse como tal.
ok(h.indexOf('ia-clase') < h.indexOf('P/AFFO'), 'la clasificacion va ANTES de los indicadores');
ok(h.indexOf('Growth outlook') < h.indexOf('What today’s price is asking for'), 'crecimiento antes que expectativas');
ok(h.indexOf('In your portfolio') < h.indexOf('What to watch'), 'y el encaje antes de que vigilar');

console.log('\nB) una ficha VIEJA del cache no pierde lo suyo ni pinta titulos vacios');
var VIEJA = {
  ok: true, symbol: 'VOO', generado: '20/08 10:00', modelo: 'claude-opus-5',
  analisis: {
    resumen: 'ETF del S&P 500.',
    indicadores: [{ nombre: 'P/E', valor: '27.1', comentario: 'en linea' }],
    fortalezas: ['diversificacion'], riesgos: ['concentracion'],
    proyeccion: 'crece con el indice', nota: 'corte de conocimiento'
  }
};
var hv = m.api.ficha(VIEJA);
ok(/Growth outlook/.test(hv) && /crece con el indice/.test(hv),
  'el campo viejo `proyeccion` se sigue leyendo bajo el mismo titulo');
ok(!/ia-clase/.test(hv), 'sin clasificacion no se dibuja el bloque');
ok(!/Quality: does it create value\?/.test(hv) && !/What to watch/.test(hv),
  'ni los titulos de las secciones que no tienen dato');
ok(/not a buy or sell recommendation/.test(hv), 'pero el aviso sigue estando');
ok(/ETF del S&amp;P 500/.test(hv), 'y el contenido va escapado');

console.log('\nC) el contenido del modelo se ESCAPA antes de entrar al html');
var HOSTIL = JSON.parse(JSON.stringify(FICHA));
HOSTIL.analisis.resumen = '<img src=x onerror=alert(1)>';
HOSTIL.analisis.clasificacion.queEs = '<script>robar()</script>';
HOSTIL.analisis.queMirar = ['<b>no</b>'];
var hh = m.api.ficha(HOSTIL);
ok(hh.indexOf('<img src=x') === -1 && /&lt;img src=x/.test(hh), 'el resumen se escapa');
ok(hh.indexOf('<script>robar') === -1, 'la clasificacion tambien');
ok(hh.indexOf('<b>no</b>') === -1, 'y los items de las listas');

console.log('\nD) la ficha vacia no rompe');
var hvacia = m.api.ficha({ ok: true, symbol: 'X' });
ok(/X &middot; AI profile/.test(hvacia) && /not a buy or sell/.test(hvacia),
  'sin analisis se pinta el encabezado y el aviso, sin excepcion');

console.log('\nE) el cableado: la lista de posiciones y el pedido al backend');
var m2 = montar();
m2.api.preparar();
ok(m2.elem('iaList').hijos.length === 1, 'lista las posiciones, y USDT (que es cash) queda afuera');
m2.api.analizar('O', false);
ok(m2.pedidos.length === 1 && m2.pedidos[0].symbol === 'O' && m2.pedidos[0].forzar === false,
  'pide el analisis del simbolo tocado');
ok(/P\/AFFO/.test(m2.elem('iaResultado').innerHTML), 'y pinta la ficha que vuelve');
m2.elem('iaRegen').onclick();
ok(m2.pedidos.length === 2 && m2.pedidos[1].forzar === true, 'el boton de refrescar fuerza el recalculo');

console.log('\nF) los errores del backend se muestran, no rompen la pantalla');
var m3 = montar();
m3.respuesta = { ok: false, mensajes: ['La clave de Anthropic no es valida.'] };
m3.api.analizar('O', false);
ok(/no es valida/.test(m3.elem('iaResultado').innerHTML), 'el mensaje del backend se ve');
m3.respuesta = { ok: false, sinClave: true };
m3.api.analizar('O', false);
ok(m3.elem('iaResultado').innerHTML === '' && m3.elem('iaKeyAviso').style.display === '',
  'sin clave: se limpia el resultado y aparece el aviso para cargarla');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
