// Arnés del bloque de ingreso por dividendos del panel (D5, 31/08/2026;
// reescrito el 01/09/2026 cuando pasó a ser por período).
//
// QUÉ PROTEGE, y por qué son dos cosas distintas:
//
// 1. El número del PERÍODO (por defecto el próximo mes, opción hasta fin de
//    año). Sale de `divDatos.detalle` — el MISMO dato que pinta las barras
//    grises del gráfico de arriba y el detalle que se abre al tocar una barra.
//    Que salga de ahí no es un detalle de implementación: una segunda cuenta
//    paralela podría discrepar con lo que ya se ve en pantalla, y ese fue
//    exactamente el bug del 01/09 en los mini-gráficos.
//
// 2. El RITMO ANUAL, que es la línea chica. Se arma con DOS fuentes que no
//    miden lo mismo: la tasa anunciada por el proveedor (bruta, antes de
//    impuestos, mira adelante) y lo que cada posición pagó de verdad en el
//    último año (neto, mira atrás). La mezcla es forzada — Finnhub gratis no
//    da la tasa de NINGÚN ETF y FMP los bloquea igual —, así que lo que se
//    protege no es la suma sino que la pantalla DIGA cómo se armó. Sin esas
//    frases el número se lee como una promesa exacta.
//
// Los dos conviven a propósito y por eso el ritmo anual dice que es un
// "run-rate": son métodos distintos y pueden no coincidir con la suma de los
// meses. Callar esa diferencia sería el mismo error de las dos mitades que se
// contradicen.
var ruta = require('./_ruta');
var html = ruta.leerIndex();
var codigo = ruta.bloque(html,
  '// ---------- D5: ingreso proyectado a 12 meses ----------',
  '// ---------- Dividendos ampliados: cuánto viene de cada app ----------');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

// Reloj de mentira: el bloque pregunta en qué mes estamos para saber cuál es
// "el próximo". Sin poder fijarlo, el arnés daría distinto según el día en
// que se corra — y el caso de diciembre no se podría probar nunca.
function relojDe(mes, anio) {
  function D() { }
  D.prototype.getMonth = function () { return mes - 1; };
  D.prototype.getFullYear = function () { return anio; };
  return D;
}

// DOM de mentira. Los botones que devuelve querySelectorAll salen de mirar el
// HTML REALMENTE pintado: si el bloque deja de dibujarlos, acá no hay ninguno
// y las pruebas del clic fallan en vez de pasar sobre un fantasma.
var el, pedidos, clicks;
function nuevoEl() {
  var e = {
    innerHTML: '',
    style: { display: 'none' },
    querySelectorAll: function (sel) {
      if (sel !== '[data-proyper]') return [];
      var out = [];
      ['mes', 'anio'].forEach(function (p) {
        if (e.innerHTML.indexOf('data-proyper="' + p + '"') === -1) return;
        out.push({
          _p: p,
          getAttribute: function () { return this._p; },
          addEventListener: function (_, fn) { clicks[this._p] = fn.bind(this); }
        });
      });
      return out;
    }
  };
  return e;
}

function correr(respuesta, comoFalla, opts) {
  opts = opts || {};
  el = nuevoEl();
  pedidos = 0;
  clicks = {};
  var ctx = {
    document: {
      getElementById: function (id) {
        if (id === 'proyBloque') return el;
        // El desplegable solo existe si el bloque lo pintó.
        if (id === 'proyToggle' && el.innerHTML.indexOf('id="proyToggle"') !== -1) {
          return { addEventListener: function (_, fn) { clicks.toggle = fn; } };
        }
        return null;
      }
    },
    divDatos: opts.divDatos === undefined ? FIXTURE_DIV : opts.divDatos,
    MESES_CORTOS: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    Date: relojDe(opts.mes || 9, opts.anio || 2026),
    esc: function (s) { return String(s === null || s === undefined ? '' : s); },
    fmtUsd: function (n) { return '$' + Number(n).toFixed(2); },
    anaPct: function (x, dec) {
      if (x === null || x === undefined || !isFinite(x)) return '—';
      return (Math.round(x * (dec === 1 ? 1000 : 100)) / (dec === 1 ? 10 : 1)).toFixed(dec === 1 ? 1 : 0) + '%';
    },
    ajustarAlturaDeck: function () { },
    google: {
      script: {
        run: {
          withSuccessHandler: function (okFn) {
            return {
              withFailureHandler: function (failFn) {
                return {
                  getDividendosProyectados: function () {
                    pedidos++;
                    if (comoFalla) failFn(new Error('caido'));
                    else okFn(respuesta);
                  }
                };
              }
            };
          }
        }
      }
    },
    isFinite: isFinite, Math: Math, Number: Number, String: String, Object: Object
  };
  var fn = new Function(Object.keys(ctx).join(','),
    codigo + '\nreturn { cargar: cargarProyeccion, render: renderProyeccion };');
  return fn.apply(null, Object.keys(ctx).map(function (k) { return ctx[k]; }));
}

// Estamos en SEPTIEMBRE, así que el próximo mes es octubre.
// Octubre a propósito tiene: el mismo símbolo en DOS brokers (se suma, no se
// lista dos veces) y una fila YA COBRADA (no es "lo que viene" y no entra).
var FIXTURE_DIV = {
  anio: 2026,
  detalle: {
    10: [
      { broker: 'IBKR', symbol: 'O', monto: 20, estado: 'proximo', estimado: true },
      { broker: 'CS', symbol: 'O', monto: 5, estado: 'proximo', estimado: false },
      { broker: 'CS', symbol: 'VOO', monto: 17.5, estado: 'proximo', estimado: false },
      { broker: 'CS', symbol: 'MPT', monto: 3, estado: 'cobrado', estimado: false }
    ],
    11: [{ broker: 'CS', symbol: 'SCHD', monto: 12, estado: 'proximo', estimado: true }],
    12: [{ broker: 'CS', symbol: 'VOO', monto: 60, estado: 'proximo', estimado: true }]
  }
};

var COMPLETA = {
  ok: true, anual: 834.47, mensual: 69.54, yieldCartera: 0.7,
  cobertura: 0.95, pctAnunciado: 44.65,
  posicionesQuePagan: 16, posicionesMiradas: 19, ventanaDias: 365,
  lista: [
    { symbol: 'VOO', nombre: 'VANGUARD S&P 500 ETF', anual: 237.02, metodo: 'historial', parcial: false, yield: 1.02 },
    { symbol: 'O', nombre: 'REALTY INCOME CORP REIT', anual: 81.03, metodo: 'anunciado', parcial: false, yield: 5.25 }
  ]
};

console.log('\nA) por defecto: el PRÓXIMO MES y la lista PLEGADA (pedido de Guzmán, 01/09/2026)');
var api = correr(COMPLETA);
api.cargar();
ok(pedidos === 1, 'pide la proyección una vez');
ok(el.style.display === '', 'el bloque se muestra');
// 20 + 5 + 17,5 = 42,50. El cobrado de 3 NO entra.
ok(el.innerHTML.indexOf('$42.50') !== -1, 'el número grande es el del próximo mes (octubre), no el anual');
ok(el.innerHTML.indexOf('$834.47') !== -1, 'el ritmo anual sigue estando, como línea aparte');
ok(el.innerHTML.indexOf('Oct') !== -1, 'dice de qué mes habla');
ok(/class="proylista" style="display:none"/.test(el.innerHTML),
  'la lista por activo arranca PLEGADA: era lo que molestaba de la versión anterior');
ok(el.innerHTML.indexOf('id="proyToggle"') !== -1, 'pero el desplegable está a la vista para abrirla');
ok(/aria-expanded="false"/.test(el.innerHTML), 'y se anuncia como plegado para un lector de pantalla');

console.log('\nB) lo cobrado no es "lo que viene", y un símbolo en dos brokers es UNA fila');
api = correr(COMPLETA);
api.cargar();
clicks.toggle();   // abrir la lista para poder mirarla
ok(el.innerHTML.indexOf('MPT') === -1,
  'la fila YA COBRADA de octubre no aparece: el panel es de lo que falta cobrar');
var filasO = (el.innerHTML.match(/>O<span|>O</g) || []).length;
ok(filasO === 1, 'O aparece UNA sola vez aunque venga de IBKR y de Schwab (=' + filasO + ')');
ok(el.innerHTML.indexOf('$25.00') !== -1, 'y con los dos brokers sumados: 20 + 5');
ok(el.innerHTML.indexOf('REALTY INCOME CORP REIT') !== -1,
  'el nombre sale de la lista de la proyección, cruzado por símbolo');

console.log('\nC) el selector: hasta fin de año');
api = correr(COMPLETA);
api.cargar();
ok(typeof clicks.anio === 'function', 'el botón "Rest of year" está enganchado desde JS');
clicks.anio();
// 42,50 (oct) + 12 (nov) + 60 (dic) = 114,50
ok(el.innerHTML.indexOf('$114.50') !== -1, 'suma octubre a diciembre (=hasta fin de año)');
ok(el.innerHTML.indexOf('Oct–Dec') !== -1 || el.innerHTML.indexOf('Oct&ndash;Dec') !== -1,
  'y dice el rango que abarca');
ok(/data-proyper="anio"[^>]*active-acento|active-acento[^>]*data-proyper="anio"/.test(el.innerHTML) ||
   el.innerHTML.indexOf('active-acento" data-proyper="anio"') !== -1,
  'el botón elegido queda marcado');
// active-compra es SOLO de Trades: prestada, sale verde sin importar la paleta.
ok(el.innerHTML.indexOf('active-compra') === -1 && el.innerHTML.indexOf('active-venta') === -1,
  'usa active-acento y NUNCA las clases de Trades (regla dura del proyecto)');
clicks.mes();
ok(el.innerHTML.indexOf('$42.50') !== -1, 'y se puede volver al próximo mes');

console.log('\nD) el período elegido SOBREVIVE a abrir y cerrar la lista');
api = correr(COMPLETA);
api.cargar();
clicks.anio();
clicks.toggle();
ok(el.innerHTML.indexOf('$114.50') !== -1,
  'abrir la lista no resetea el período a "próximo mes"');
ok(/class="proylista"(?! style="display:none")/.test(el.innerHTML), 'y la lista quedó abierta');
ok(el.innerHTML.indexOf('SCHD') !== -1, 'con los símbolos del período entero, no solo los de octubre');

console.log('\nE) diciembre: se DICE que no hay dato, no se pinta un cero');
// El calendario del backend sólo llega a fin del año calendario. En diciembre
// "el próximo mes" es enero del año que viene y de eso no sabemos nada. Un
// $0.00 ahí diría "no cobrás nada", que es una afirmación y no un dato que falta.
api = correr(COMPLETA, false, { mes: 12, anio: 2026 });
api.cargar();
ok(el.innerHTML.indexOf('$0.00') === -1, 'NO inventa un cero para enero');
ok(el.innerHTML.indexOf('2027') !== -1, 'dice que el próximo mes cae en el año que viene');
ok(el.style.display === '', 'y el bloque sigue visible: el ritmo anual todavía sirve');

console.log('\nF) las declaraciones que hacen honesto al ritmo anual');
api = correr(COMPLETA);
api.cargar();
ok(el.innerHTML.indexOf('95%') !== -1, 'declara la cobertura: 0,95 exacto es un hueco real del 5%');
ok(/45% of it comes from announced rates, before withholding tax/.test(el.innerHTML),
  'dice qué parte es BRUTA: mezcla tasas anunciadas con cobros reales');
ok(el.innerHTML.indexOf('actually paid you over the last 12 months') !== -1, 'y de dónde sale el resto');
// 0,70% con cero decimales se redondearia a "1%", que es otra cifra.
ok(el.innerHTML.indexOf('0.7% of portfolio') !== -1, 'el rendimiento de la cartera va con decimal');
ok(el.innerHTML.indexOf('run-rate') !== -1,
  'el anual se presenta como RITMO, no como una suma exacta: se calcula con otro método que los meses');

console.log('\nG) la marca de "esto es estimado por cadencia"');
api = correr(COMPLETA);
api.cargar();
clicks.toggle();
ok(/O<span class="pparcial">~<\/span>/.test(el.innerHTML), 'el símbolo estimado lleva su marca');
ok(el.innerHTML.indexOf('payment cadence') !== -1,
  'y la marca se explica abajo: un símbolo suelto no dice nada');
// Un período sin nada estimado no debe arrastrar la nota.
api = correr(COMPLETA, false, {
  divDatos: { anio: 2026, detalle: { 10: [{ broker: 'CS', symbol: 'VOO', monto: 9, estado: 'proximo', estimado: false }] } }
});
api.cargar();
ok(el.innerHTML.indexOf('payment cadence') === -1, 'sin nada estimado, la nota no aparece');
ok(el.innerHTML.indexOf('pparcial') === -1, 'ni la marca');

console.log('\nH) un período vacío se dice, y sigue sin inventar ceros');
api = correr(COMPLETA, false, { divDatos: { anio: 2026, detalle: {} } });
api.cargar();
ok(el.innerHTML.indexOf('No payments scheduled') !== -1, 'lo dice con todas las letras');
ok(el.innerHTML.indexOf('id="proyToggle"') === -1, 'y no ofrece desplegar una lista vacía');

console.log('\nI) el bloque se esconde en vez de romper el panel');
api = correr(null, true);
api.cargar();
ok(el.style.display === 'none', 'si el backend falla, el bloque no se muestra');
ok(el.innerHTML === '', 'y no deja un error a medias en pantalla');

api = correr({ ok: true, anual: 0, lista: [] });
api.cargar();
ok(el.style.display === 'none', 'sin posiciones que paguen tampoco muestra un cero suelto');

api = correr({ ok: false, error: 'sin datos' });
api.cargar();
ok(el.style.display === 'none', 'una respuesta con ok:false se trata igual');

// Sin el panel de dividendos cargado no hay calendario. El bloque no puede
// explotar: el ritmo anual se muestra igual.
api = correr(COMPLETA, false, { divDatos: null });
api.cargar();
ok(el.style.display === '', 'sin divDatos el bloque NO se rompe');
ok(el.innerHTML.indexOf('$834.47') !== -1, 'y el ritmo anual se muestra igual');

console.log('\nJ) no se pide dos veces');
api = correr(COMPLETA);
api.cargar();
api.cargar();
ok(pedidos === 1, 'la segunda llamada no vuelve a pegarle al backend');
// Pero un fallo SI tiene que poder reintentarse: si el guard quedara puesto,
// un error de red dejaria el bloque muerto hasta recargar la app entera.
api = correr(null, true);
api.cargar();
api.cargar();
ok(pedidos === 2, 'tras un fallo, el siguiente intento sí sale');
// Cambiar de período NO puede volver a pedirle al backend: el calendario ya
// está en el teléfono, y una llamada por toque sería gastar red por nada.
api = correr(COMPLETA);
api.cargar();
clicks.anio(); clicks.mes(); clicks.toggle();
ok(pedidos === 1, 'cambiar de período y desplegar no gastan ni una llamada más');

console.log('\nK) la interfaz va en INGLÉS (regla del proyecto desde el 26/08/2026)');
api = correr(COMPLETA);
api.cargar();
clicks.toggle();
['Próximos', ' meses', 'cartera', 'Rendimiento', 'anual', 'impuestos', 'Cobertura', 'Volver']
  .forEach(function (p) {
    ok(el.innerHTML.indexOf(p) === -1, 'no se coló "' + p.trim() + '" en la pantalla');
  });

console.log('\nL) el contrato con el backend');
ok(codigo.indexOf('getDividendosProyectados') !== -1, 'llama a la fn del worker por su nombre del MAP');
// El bloque NO recalcula el ritmo anual: si alguien lo "optimiza" sumando
// dividendos desde las posiciones, pierde la distincion anunciado/historial y
// con ella la unica advertencia que dice que parte del numero es bruta.
ok(!/posiciones\s*\.\s*(map|forEach|reduce|filter)/.test(codigo),
  'no recalcula el ritmo anual desde las posiciones: el backend es el que sabe');
ok(codigo.indexOf('cobertura') !== -1 && codigo.indexOf('pctAnunciado') !== -1,
  'lee las marcas de honestidad del payload');
// El número del período sale del MISMO dato que el gráfico de arriba. Una
// segunda cuenta paralela podria discrepar con lo que ya se ve en pantalla.
ok(codigo.indexOf('divDatos.detalle') !== -1,
  'el período se calcula sobre divDatos.detalle, el mismo dato que pinta las barras del gráfico');
// Los manejadores se enganchan desde JS: la política de contenido bloquea los
// onclick inline, así que serían código muerto que falla en silencio.
ok(codigo.indexOf('addEventListener') !== -1 && !/onclick=/.test(codigo),
  'los botones se enganchan con addEventListener, nunca con onclick inline');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
