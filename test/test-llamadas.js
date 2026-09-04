// Verifica que TODA función que la app llama exista de verdad (ítem E2).
//
// El arnés hermano (test-carga.js) corre los archivos de js/ en el orden del
// index y atrapa lo que muere AL CARGAR. Eso deja afuera la mitad más común
// del problema: una llamada dentro del cuerpo de una función no se evalúa
// hasta que alguien la usa, así que borrar o renombrar `pintarBadges` deja
// todo cargando perfecto y rompe recién cuando Guzmán toca ese botón —
// semanas después, en el teléfono, sin consola donde mirar.
//
// Con el código partido en 14 archivos (16/08/2026) esto dejó de ser teórico:
// una función y sus llamadores viven en archivos distintos y nada obliga a que
// viajen juntos.
//
// Cómo: se cargan los archivos en un navegador de mentira (_entorno.js) para
// saber qué quedó definido DE VERDAD, y después se busca en el texto cada
// nombre en posición de llamada `nombre(`. Si no resuelve —ni global de la
// app, ni local del propio archivo, ni algo que el navegador provee—, falla.
// Los `x.metodo()` no se miran: qué es `x` no se puede saber sin ejecutar.
var vm = require('vm');
var entorno = require('./_entorno');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

// Palabras del lenguaje que también van seguidas de paréntesis.
var PALABRAS = {};
('if for while switch catch return typeof function new else do delete void in of ' +
 'instanceof await yield case throw try finally break continue var let const this ' +
 'super class extends import export default null true false undefined NaN Infinity ' +
 'arguments with debugger').split(' ').forEach(function (p) { PALABRAS[p] = true; });

// Comentarios y textos afuera: en un comentario hay ejemplos de código que no
// se llaman nunca, y en un texto puede haber cualquier cosa ("total(" en un
// mensaje al usuario). Sin esto el arnés inventa fallas.
function sinRuido(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

function nombres(limpio, patron) {
  var out = [], mm, r = new RegExp(patron.source, patron.flags);
  while ((mm = r.exec(limpio)) !== null) out.push(mm[1]);
  return out;
}

// El cuerpo de cada función del archivo: desde el `function` hasta su llave de
// cierre, con sus parámetros. Se cuenta llaves sobre el texto ya limpio de
// comentarios y cadenas, así que las llaves que se ven son llaves de verdad.
function rangosDeFunciones(limpio) {
  var out = [];
  var r = /\bfunction\s*([\w$]*)\s*\(([^)]*)\)\s*\{/g, mm;
  while ((mm = r.exec(limpio)) !== null) {
    var abre = mm.index + mm[0].length - 1;
    var nivel = 0, fin = limpio.length;
    for (var i = abre; i < limpio.length; i++) {
      var c = limpio.charAt(i);
      if (c === '{') nivel++;
      else if (c === '}') { nivel--; if (nivel === 0) { fin = i; break; } }
    }
    out.push({
      desde: mm.index,
      hasta: fin,
      params: mm[2].split(',').map(function (p) { return p.trim(); }).filter(function (p) { return /^[\w$]+$/.test(p); })
    });
  }
  return out;
}

/**
 * Dónde manda cada nombre declarado dentro del archivo: {nombre: [rangos]}.
 *
 * El ALCANCE importa. La primera versión juntaba todos los nombres declarados
 * en el archivo en una bolsa plana, y un solo parámetro le daba pase libre a
 * TODO el archivo: `function repintarPanel(cargado, clave, render)` marcaba
 * `render` como local, así que renombrar la función global `render` —usada a
 * tres archivos de distancia— pasaba en verde y explotaba en el teléfono.
 * Auditoría del 23/08/2026.
 */
function alcancesEn(limpio) {
  var rangos = rangosDeFunciones(limpio);
  var mapa = {};
  function anotar(nombre, idx) {
    // El alcance de una declaración es la función más chica que la contiene
    // (o el archivo entero si está en el nivel de arriba).
    // `idx > r.desde` y no `>=`: una función declarada ADENTRO de otra vive en
    // la de afuera, no en sí misma. Con `>=`, `function pintarModo()` se
    // asignaba su propio cuerpo como alcance y sus llamadas —que están en la
    // función de afuera— quedaban huérfanas.
    var mejor = null;
    for (var i = 0; i < rangos.length; i++) {
      var r = rangos[i];
      if (idx > r.desde && idx <= r.hasta && (!mejor || (r.hasta - r.desde) < (mejor.hasta - mejor.desde))) mejor = r;
    }
    (mapa[nombre] = mapa[nombre] || []).push(mejor || { desde: 0, hasta: limpio.length });
  }
  var patrones = [
    /\b(?:var|let|const)\s+([\w$]+)/g,
    /,\s*([\w$]+)\s*=/g,          // var a = 1, b = 2
    /\bfunction\s+([\w$]+)/g,
    /\bcatch\s*\(\s*([\w$]+)/g
  ];
  patrones.forEach(function (p) {
    var r = new RegExp(p.source, p.flags), mm;
    while ((mm = r.exec(limpio)) !== null) anotar(mm[1], mm.index);
  });
  // Los parámetros mandan dentro de SU función, y solo ahí.
  rangos.forEach(function (r) {
    r.params.forEach(function (p) { (mapa[p] = mapa[p] || []).push(r); });
  });
  return mapa;
}

function esLocalEn(alcances, nombre, idx) {
  var rs = alcances[nombre];
  if (!rs) return false;
  for (var i = 0; i < rs.length; i++) if (idx >= rs[i].desde && idx <= rs[i].hasta) return true;
  return false;
}

// Cada nombre en posición de llamada. El primer grupo existe solo para no
// empezar el match con un punto (`x.metodo()`) ni en medio de otro nombre.
function llamadasEn(limpio) {
  var out = [];
  var r = /(^|[^\w$.])([A-Za-z_$][\w$]*)\s*\(/g, mm;
  while ((mm = r.exec(limpio)) !== null) {
    var n = mm[2];
    if (PALABRAS[n]) continue;
    var antes = limpio.slice(Math.max(0, mm.index - 12), mm.index + mm[1].length);
    if (/\bfunction\s*$/.test(antes)) continue;   // la declaración, no una llamada
    out.push({ nombre: n, idx: mm.index, linea: limpio.slice(0, mm.index).split('\n').length, llamada: true });
  }
  return out;
}

// Nombres usados como REFERENCIA, sin paréntesis: `.onclick = pintarOjo`,
// `f.meses.map(celdaCalor)`, `{alOk: aplicar}`. Son la otra mitad del uso real
// —24 funciones globales de esta app viven SOLO así— y ninguno de los dos
// arneses las miraba: renombrar `celdaCalor` dejaba todo en verde y el mapa de
// calor explotaba al abrirlo. Auditoría del 23/08/2026.
function referenciasEn(limpio) {
  var out = [];
  var patrones = [
    /[=:]\s*([A-Za-z_$][\w$]*)\s*[;,)\]}\n]/g,        // = fn;  {clave: fn}
    /\(\s*([A-Za-z_$][\w$]*)\s*[,)]/g,                // map(fn)  cb(fn, x)
    /,\s*([A-Za-z_$][\w$]*)\s*\)/g                    // cb(x, fn)
  ];
  patrones.forEach(function (p) {
    var r = new RegExp(p.source, p.flags), mm;
    while ((mm = r.exec(limpio)) !== null) {
      var n = mm[1];
      if (PALABRAS[n]) continue;
      var antes = limpio.charAt(Math.max(0, mm.index));
      if (antes === '.') continue;
      out.push({ nombre: n, idx: mm.index, linea: limpio.slice(0, mm.index).split('\n').length, llamada: false });
    }
  });
  return out;
}

// --- El entorno real: qué existe después de cargar los 14 archivos ---
var cargado = entorno.cargar({});
console.log('A) los archivos cargan antes de mirar las llamadas');
ok(cargado.errores.length === 0, cargado.errores.length
  ? 'alguno murio al cargar y lo que sigue no serviria: ' + cargado.errores.join(' | ')
  : 'los ' + cargado.orden.length + ' archivos cargaron');

// Una sola pregunta para todo: ¿este nombre resuelve en un navegador con la
// app cargada? Cubre de una las funciones de la app, los globales del lenguaje
// (JSON, Math, Promise) y lo que provee la plataforma (document, fetch). Si un
// día se usa algo del navegador que el entorno no simula, la falla es correcta:
// se agrega el stub en _entorno.js y los DOS arneses ganan fidelidad.
var resuelto = {};
function tipoDe(nombre) {
  if (!(nombre in resuelto)) {
    try {
      resuelto[nombre] = vm.runInContext('typeof ' + nombre, cargado.ambito);
    } catch (e) { resuelto[nombre] = 'undefined'; }
  }
  return resuelto[nombre];
}
// En posición de LLAMADA no alcanza con que el nombre exista: tiene que ser
// llamable. `var daychgHtml = 5` con la función renombrada al lado dejaba el
// arnés en verde, y en el teléfono es "daychgHtml is not a function".
function existeLlamable(nombre) { return tipoDe(nombre) === 'function'; }
function existeAlgo(nombre) { return tipoDe(nombre) !== 'undefined'; }

console.log('\nB) toda funcion llamada existe y es llamable');
var huerfanas = [];
var total = 0, refs = 0;
entorno.fuentes().forEach(function (f) {
  var limpio = sinRuido(f.src);
  var alcances = alcancesEn(limpio);
  var yaDicho = {};
  function revisar(c) {
    if (esLocalEn(alcances, c.nombre, c.idx)) return;
    if (c.llamada ? existeLlamable(c.nombre) : existeAlgo(c.nombre)) return;
    if (yaDicho[c.nombre + (c.llamada ? '()' : '')]) return;
    yaDicho[c.nombre + (c.llamada ? '()' : '')] = true;
    huerfanas.push(f.archivo + ':' + c.linea + (c.llamada
      ? ' llama a ' + c.nombre + '(), que no existe o no es una funcion'
      : ' usa ' + c.nombre + ' como referencia, y no existe'));
  }
  llamadasEn(limpio).forEach(function (c) { total++; revisar(c); });
  referenciasEn(limpio).forEach(function (c) { refs++; revisar(c); });
});
ok(total > 700, 'se revisaron ' + total + ' llamadas y ' + refs + ' referencias en ' + cargado.orden.length + ' archivos');
ok(huerfanas.length === 0, huerfanas.length
  ? 'nombres que no resuelven:\n         ' + huerfanas.join('\n         ')
  : 'ninguna llamada ni referencia apunta a algo inexistente');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
