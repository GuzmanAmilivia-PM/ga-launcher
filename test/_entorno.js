// Carga los archivos de js/ como los carga el navegador, en un entorno de
// mentira: DOM permisivo, localStorage de juguete y lo justo de plataforma.
//
// Lo usan DOS arneses y por eso vive acá y no adentro de uno:
//   - test-carga.js    → que ningún archivo muera AL CARGAR;
//   - test-llamadas.js → qué quedó definido de verdad como global, para poder
//     exigir que toda llamada apunte a algo que existe.
//
// Corre con `vm` a propósito: dentro de un contexto de vm, las declaraciones
// `var x` y `function x()` de nivel superior quedan como propiedades del
// objeto global, que es EXACTAMENTE lo que hace el navegador con un <script>
// clásico — y lo que un `new Function` con `with` no puede imitar (ahí las
// declaraciones son locales de la función envoltorio y hay que cosecharlas a
// mano con expresiones regulares, que es como se hacía antes y se comía las
// declaraciones indentadas).
var vm = require('vm');
var fs = require('fs');
var path = require('path');
var ruta = require('./_ruta');

// --- DOM de mentira: cualquier id existe y aguanta cualquier cosa ---
function elemento() {
  var e = {
    style: {}, dataset: {}, children: [], classList: {
      add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; }
    },
    innerHTML: '', textContent: '', value: '', disabled: false,
    addEventListener: function () {}, removeEventListener: function () {},
    setAttribute: function () {}, getAttribute: function () { return null; }, removeAttribute: function () {},
    appendChild: function (c) { return c; }, insertBefore: function (c) { return c; }, removeChild: function () {},
    querySelector: function () { return elemento(); }, querySelectorAll: function () { return []; },
    getContext: function () { return { canvas: {}, clearRect: function () {} }; },
    getBoundingClientRect: function () { return { width: 0, height: 0 }; },
    focus: function () {}, click: function () {}, closest: function () { return null; }
  };
  e.parentNode = { insertBefore: function () {}, removeChild: function () {}, replaceChild: function () {}, appendChild: function () {} };
  return e;
}

// Los archivos, en el orden REAL que declara el index.html.
function ordenDelIndex() {
  var html = fs.readFileSync(ruta.INDEX, 'utf8');
  var orden = [];
  var re = /<script src="\.\/(js\/[\w-]+\.js)"><\/script>/g, m;
  while ((m = re.exec(html)) !== null) orden.push(m[1]);
  return orden;
}

function fuentes() {
  return ordenDelIndex().map(function (f) {
    return { archivo: f, src: fs.readFileSync(path.join(ruta.RUTA, f), 'utf8') };
  });
}

/**
 * Corre los archivos en orden y devuelve {ambito, errores, orden}.
 * `storage` es el localStorage inicial (el escenario que se quiera probar).
 * Nunca tira: los fallos de carga se informan en `errores`, con el archivo.
 */
function cargar(storage) {
  var store = Object.assign({}, storage || {});
  var doc = {
    getElementById: function () { return elemento(); },
    querySelector: function () { return elemento(); },
    querySelectorAll: function () { return []; },
    createElement: function () { return elemento(); },
    addEventListener: function () {},
    documentElement: elemento(),
    body: elemento(),
    visibilityState: 'visible'
  };
  // Solo lo del NAVEGADOR: los globales del lenguaje (JSON, Math, Promise...)
  // los pone el propio contexto de vm, y meterlos a mano desde acá mezclaría
  // dos realms — con eso `[] instanceof Array` empieza a dar false y se
  // depuran fantasmas.
  var ctx = {
    document: doc,
    localStorage: {
      getItem: function (k) { return (k in store) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    navigator: {
      credentials: { create: function () { return new Promise(function () {}); }, get: function () { return new Promise(function () {}); } },
      serviceWorker: { register: function () { return Promise.resolve({}); }, addEventListener: function () {}, controller: null }
    },
    location: { hostname: 'localhost', reload: function () {}, href: 'http://localhost/' },
    crypto: {
      subtle: { digest: function () { return Promise.resolve(new ArrayBuffer(32)); } },
      getRandomValues: function (a) { return a; }
    },
    fetch: function () { return new Promise(function () {}); },
    caches: { keys: function () { return Promise.resolve([]); } },
    setInterval: function () { return 0; },
    setTimeout: function () { return 0; },  // NO ejecuta el callback: solo importa la carga
    clearTimeout: function () {},
    clearInterval: function () {},
    Chart: function () { return { destroy: function () {}, update: function () {} }; },
    WebSocket: function () { return { close: function () {}, addEventListener: function () {} }; },
    TextEncoder: function () { return { encode: function () { return new Uint8Array(0); } }; },
    AbortController: function () { return { abort: function () {}, signal: {} }; },
    isSecureContext: true,
    PublicKeyCredential: { isUserVerifyingPlatformAuthenticatorAvailable: function () { return Promise.resolve(false); } },
    btoa: function (s) { return Buffer.from(s, 'binary').toString('base64'); },
    atob: function (s) { return Buffer.from(s, 'base64').toString('binary'); },
    console: console,
    confirm: function () { return false; },
    alert: function () {},
    matchMedia: function () { return { matches: false, addEventListener: function () {} }; },
    // colorAcento/acentoRgba (nucleo.js) leen la variable CSS viva; acá no hay
    // CSS, así que devuelve vacío y esas funciones caen a su dorado por defecto.
    getComputedStyle: function () { return { getPropertyValue: function () { return ''; } }; },
    requestAnimationFrame: function () { return 0; },
    cancelAnimationFrame: function () {}
  };
  vm.createContext(ctx);
  // window.X y X son lo mismo, como en el navegador. Se hace DESPUÉS de
  // contextificar para que apunte al global real del contexto.
  vm.runInContext('var window = globalThis; var self = globalThis;', ctx);

  var errores = [];
  var lista = fuentes();
  lista.forEach(function (f) {
    try {
      vm.runInContext(f.src, ctx, { filename: f.archivo });
    } catch (e) {
      errores.push(f.archivo + ' murio al cargar: ' + e.message);
    }
  });
  return { ambito: ctx, errores: errores, orden: lista.map(function (f) { return f.archivo; }) };
}

module.exports = { cargar: cargar, fuentes: fuentes, ordenDelIndex: ordenDelIndex, elemento: elemento };
