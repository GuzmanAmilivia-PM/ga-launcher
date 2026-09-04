// Arnés de la página Configuración: tema + acento + tonalidad (25/08/2026).
// Pedido de Guzmán en dos tandas: primero los puntos de color en el panel
// (v114) y el mismo día la página propia — "la paleta tiene que ser dentro de
// un icono que despliegue una página nueva, que se va a llamar configuración,
// ya que la que hoy es configuración se llamará Keys" — más las tonalidades
// completas de fondo ("otros juegos de colores... algo prearmado que quede
// bien": Nord es la paleta nórdica publicada).
// Se prueba el selector (config.js), la aplicación temprana (nucleo.js), el
// acento vivo de los gráficos, el CSS de paletas y tonalidades con sus pares
// claros, y los tiles del panel (Keys, Configuración, Data base test).
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

// ---- El bloque del selector, con un DOM de mentira ----
var codigo = ruta.bloque(html,
  '// ---------- Configuración (diseño): tema, acento y tonalidad ----------',
  '// ---------- Configuración: plataformas ----------');

function dot(attr, valor) {
  var d = { _attr: attr, _valor: valor, sel: null, attrs: {} };
  d.getAttribute = function (k) { return k === d._attr ? d._valor : (d.attrs[k] || null); };
  d.setAttribute = function (k, v) { d.attrs[k] = v; };
  d.classList = { toggle: function (cls, on) { if (cls === 'sel') d.sel = !!on; } };
  return d;
}
function botonTema() {
  var b = { activo: null, onclick: null };
  b.classList = { toggle: function (cls, on) { if (cls === 'active-acento') b.activo = !!on; } };
  return b;
}
var dotsPaleta = [dot('data-paleta', ''), dot('data-paleta', 'oceano'), dot('data-paleta', 'esmeralda'), dot('data-paleta', 'violeta')];
var dotsFondo = [dot('data-fondo', ''), dot('data-fondo', 'grafito'), dot('data-fondo', 'nord'), dot('data-fondo', 'bosque')];
var btnOscuro = botonTema(), btnClaro = botonTema();
var rootAttrs = {};
var docEl = {
  getAttribute: function (k) { return (k in rootAttrs) ? rootAttrs[k] : null; },
  setAttribute: function (k, v) { rootAttrs[k] = String(v); },
  removeAttribute: function (k) { delete rootAttrs[k]; }
};
var store = {};
var claro = false;
var temasPedidos = [];
var ctx = {
  document: {
    documentElement: docEl,
    querySelectorAll: function (sel) {
      if (sel === '#mPaleta .pdot') return dotsPaleta;
      if (sel === '#mFondo .pdot') return dotsFondo;
      return [];
    },
    getElementById: function (id) {
      return id === 'temaOscuroBtn' ? btnOscuro : (id === 'temaClaroBtn' ? btnClaro : null);
    }
  },
  localStorage: {
    getItem: function (k) { return (k in store) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  },
  esTemaClaro: function () { return claro; },
  setTema: function (v) { temasPedidos.push(v); claro = v; },
  lastData: null, lastAcc: null, lastAccData: null,
  render: function () {}, renderAccount: function () {},
  String: String
};
var nombres = Object.keys(ctx);
var api = new Function(nombres.join(','), codigo +
  '\nreturn { setPaleta: setPaleta, setFondo: setFondo, paletaActual: paletaActual, fondoActual: fondoActual, pintarDiseno: pintarDiseno, PALETAS: PALETAS, FONDOS: FONDOS };')
  .apply(null, nombres.map(function (n) { return ctx[n]; }));

console.log('\nA) elegir un acento lo aplica y lo guarda');
api.setPaleta('oceano');
ok(rootAttrs['data-paleta'] === 'oceano', 'el atributo data-paleta queda en el <html>');
ok(store.ga_paleta === 'oceano', 'y en ga_paleta, para el proximo arranque');
ok(dotsPaleta[1].sel === true && dotsPaleta[0].sel === false, 'el punto elegido queda marcado y el dorado no');
ok(dotsPaleta[1].attrs['aria-pressed'] === 'true', 'y lo dice tambien para el lector de pantalla');
api.setPaleta('');
ok(!('data-paleta' in rootAttrs) && !('ga_paleta' in store), 'volver al dorado limpia atributo y localStorage');
api.setPaleta('fucsia');
ok(!('data-paleta' in rootAttrs), 'una paleta que no existe cae al dorado');
rootAttrs['data-paleta'] = 'vieja-borrada';
ok(api.paletaActual() === '', 'un atributo viejo que ya no existe se lee como dorado');
api.setPaleta('');

console.log('\nB) la tonalidad de fondo, mismo mecanismo');
api.setFondo('nord');
ok(rootAttrs['data-fondo'] === 'nord' && store.ga_fondo === 'nord', 'data-fondo + ga_fondo');
ok(dotsFondo[2].sel === true && dotsFondo[0].sel === false, 'el punto de Nord marcado, el Marino no');
api.setFondo('');
ok(!('data-fondo' in rootAttrs) && !('ga_fondo' in store), 'volver al Marino limpia todo');
api.setFondo('lava');
ok(!('data-fondo' in rootAttrs), 'una tonalidad desconocida cae al Marino');
ok(api.fondoActual() === '', 'y se lee como Marino');
api.setFondo('grafito');
api.setPaleta('violeta');
ok(rootAttrs['data-fondo'] === 'grafito' && rootAttrs['data-paleta'] === 'violeta',
  'acento y tonalidad son ORTOGONALES: elegir uno no pisa al otro');
api.setPaleta(''); api.setFondo('');

console.log('\nC) los controles estan cableados');
ok(typeof dotsFondo[3].onclick === 'function' && typeof dotsPaleta[2].onclick === 'function',
  'cada punto tiene su click (sin nada inline)');
dotsFondo[3].onclick();
ok(rootAttrs['data-fondo'] === 'bosque', 'tocar un punto de tonalidad la elige');
api.setFondo('');
ok(typeof btnOscuro.onclick === 'function' && typeof btnClaro.onclick === 'function', 'los botones de tema tambien');
btnClaro.onclick();
ok(temasPedidos[temasPedidos.length - 1] === true, 'Claro llama a setTema(true)');
btnOscuro.onclick();
ok(temasPedidos[temasPedidos.length - 1] === false, 'Oscuro a setTema(false)');
claro = true;
api.pintarDiseno();
ok(btnClaro.activo === true && btnOscuro.activo === false, 'el boton del tema vigente queda marcado');
claro = false;
api.pintarDiseno();
ok(btnOscuro.activo === true && btnClaro.activo === false, 'y al reves');

console.log('\nD) lo guardado se aplica al ARRANCAR (nucleo.js, antes de pintar)');
var nucleoSrc = fs.readFileSync(path.join(ruta.RUTA, 'js', 'nucleo.js'), 'utf8');
var rePal = /var paletaGuardada = localStorage\.getItem\('ga_paleta'\); if \(paletaGuardada\) document\.documentElement\.setAttribute\('data-paleta', paletaGuardada\);/;
var reFon = /var fondoGuardado = localStorage\.getItem\('ga_fondo'\); if \(fondoGuardado\) document\.documentElement\.setAttribute\('data-fondo', fondoGuardado\);/;
ok(rePal.test(nucleoSrc), 'nucleo.js (el primer archivo) aplica el acento guardado');
ok(reFon.test(nucleoSrc), 'y la tonalidad guardada');
ok(nucleoSrc.indexOf(nucleoSrc.match(rePal)[0]) < nucleoSrc.indexOf('var API_URL'),
  'y lo hace ARRIBA de todo, antes que cualquier otra cosa del archivo');

console.log('\nE) los colores vivos para canvas (leerVarCss y familia)');
var acentoSrc = (nucleoSrc.match(/function leerVarCss[\s\S]*?function coloresPie[^\n]*\n/) || [''])[0];
ok(!!acentoSrc, 'se puede aislar leerVarCss/colorAcento/acentoRgba/coloresPie');
function conCss(valores) {
  return new Function('getComputedStyle,document,PIE_COLORS', acentoSrc +
    '\nreturn { leer: leerVarCss, acento: colorAcento, rgba: acentoRgba, pie: coloresPie };')(
    function () { return { getPropertyValue: function (p) { return valores[p] || ''; } }; },
    { documentElement: {} },
    ['#d4af37', '#5b8def', '#22c55e']
  );
}
var vivo = conCss({ '--gold': '#4f8ef7', '--gold-rgb': '79,142,247', '--navy': '#2e3440' });
ok(vivo.acento() === '#4f8ef7', 'colorAcento lee la variable CSS viva');
ok(vivo.rgba(0.12) === 'rgba(79,142,247,0.12)', 'acentoRgba arma el rgba con el alpha pedido');
ok(vivo.leer('--navy', '#0d1420') === '#2e3440', 'leerVarCss sirve para cualquier variable (la tonalidad tambien)');
ok(vivo.pie()[0] === '#4f8ef7' && vivo.pie()[1] === '#5b8def', 'coloresPie pone el acento primero y no toca el resto');
var sinCss = conCss({});
ok(sinCss.acento() === '#d4af37' && sinCss.rgba(0.5) === 'rgba(212,175,55,0.5)' && sinCss.leer('--navy', '#0d1420') === '#0d1420',
  'sin CSS que leer (arnes, navegador raro) cada uno cae a su valor de siempre');
var pieOriginal = ['#d4af37', '#5b8def', '#22c55e'];
var pieVivo = new Function('getComputedStyle,document,PIE_COLORS', acentoSrc + '\nreturn coloresPie();')(
  function () { return { getPropertyValue: function () { return '#111111'; } }; },
  { documentElement: {} }, pieOriginal);
ok(pieOriginal[0] === '#d4af37' && pieVivo[0] === '#111111', 'coloresPie devuelve una COPIA: PIE_COLORS no se muta');
var graficosSrc = fs.readFileSync(path.join(ruta.RUTA, 'js', 'graficos.js'), 'utf8');
ok(/borderColor: colorAcento\(\), backgroundColor: acentoRgba\(0\.12\)/.test(graficosSrc),
  'la linea de Evolucion usa el acento vivo, no un hexadecimal clavado');
var vistasSrc = fs.readFileSync(path.join(ruta.RUTA, 'js', 'vistas.js'), 'utf8');
ok(vistasSrc.indexOf('coloresPie().slice(0, items.length)') !== -1, 'la torta del Portafolio tambien');
ok(vistasSrc.indexOf('PIE_COLORS.slice(0') === -1, 'y no quedo el corte viejo sobre la lista clavada');
var panelesSrc = fs.readFileSync(path.join(ruta.RUTA, 'js', 'paneles.js'), 'utf8');
ok(panelesSrc.indexOf('coloresPie()[i % PIE_COLORS.length]') !== -1 && panelesSrc.indexOf('PIE_COLORS[i % PIE_COLORS.length]') === -1,
  'las barras y puntos de Dividendos tambien');
var configSrc2 = fs.readFileSync(path.join(ruta.RUTA, 'js', 'config.js'), 'utf8');
ok(/pieBorder: leerVarCss\('--navy2', '#ffffff'\)/.test(configSrc2) && /pieBorder: leerVarCss\('--navy', '#0d1420'\)/.test(configSrc2),
  'el borde de la torta acompana a la tonalidad (temaChart lee la variable viva)');

console.log('\nF) el CSS: paletas y tonalidades con su par claro, sin colores clavados');
var indexCrudo = fs.readFileSync(ruta.INDEX, 'utf8');
['oceano', 'esmeralda', 'violeta'].forEach(function (p) {
  ok(indexCrudo.indexOf('html[data-paleta="' + p + '"]') !== -1, p + ': regla oscura del acento');
  ok(indexCrudo.indexOf('html.light[data-paleta="' + p + '"]') !== -1, p + ': y su par claro');
});
['grafito', 'nord', 'bosque'].forEach(function (f) {
  ok(indexCrudo.indexOf('html[data-fondo="' + f + '"]') !== -1, f + ': regla oscura de la tonalidad');
  // Sin el par claro, la regla oscura (misma especificidad, escrita despues
  // de html.light) pisaria el fondo del tema claro con uno oscuro.
  ok(indexCrudo.indexOf('html.light[data-fondo="' + f + '"]') !== -1, f + ': y su par claro');
});
ok(indexCrudo.indexOf('rgba(212,175,55') === -1, 'ningun rgba con el dorado clavado');
ok((indexCrudo.match(/#241b02/g) || []).length === 1, 'el texto-sobre-acento clavado solo como --on-gold en :root');
// Los fondos clavados que delataban el Marino bajo otra tonalidad:
ok(indexCrudo.indexOf('rgba(13,20,32') === -1, 'la barra de abajo ya no clava el navy (color-mix sobre var(--navy))');
ok(/border: 3px solid var\(--navy\)/.test(indexCrudo), 'el aro del boton central acompana al fondo');
ok(/html\.light \.mainarea \{ background: linear-gradient\(180deg, var\(--navy2\), var\(--navy\)\)/.test(indexCrudo),
  'el degradado del tema claro sale de las variables, no de dos hex');
// El degradado OSCURO era el que tapaba todo: con #10192b/#080d16 clavados,
// elegir Grafito/Nord/Bosque "no cambiaba nada" (captura de Guzman, 25/08
// noche). Ahora se deriva de var(--navy) con color-mix.
ok(/\.mainarea \{[^}]*radial-gradient\(circle at top left, color-mix\(in srgb, var\(--navy\) 96%, #fff\), color-mix\(in srgb, var\(--navy\) 60%, #000\) 60%\)/.test(indexCrudo),
  'el fondo principal oscuro tambien se deriva de var(--navy): la tonalidad SI se ve');
ok(indexCrudo.indexOf('#10192b') === -1 || indexCrudo.indexOf('#10192b') === indexCrudo.lastIndexOf('#10192b') && /#splash\{[^}]*#10192b/.test(indexCrudo),
  'el navy clavado del degradado viejo solo puede quedar en el splash (pantalla de arranque, pre-CSS)');

console.log('\nF2) el logo acompana la paleta, sin el resplandor');
ok(!/\.galogo-sm \{[^}]*box-shadow/.test(indexCrudo),
  'el resplandor "tipo led" detras del logo se fue (sin box-shadow)');
['oceano', 'esmeralda', 'violeta'].forEach(function (p) {
  ok(new RegExp('html\\[data-paleta="' + p + '"\\] \\.galogo-img \\{ filter: hue-rotate\\(').test(indexCrudo),
    p + ': el logo gira su matiz hacia el acento (el PNG no puede leer var(--gold))');
});

console.log('\nG) el panel y las paginas: Keys, Configuracion y Data base test');
ok(/<p class="viewtitle">Keys<\/p>/.test(indexCrudo), 'la ex Configuracion ahora se titula Keys');
// Las CUATRO pestañas de la barra van sin titulo de pagina (pedido de Guzman,
// 26/08/2026: la pestaña encendida ya dice donde estas; "info de mas que
// consume espacio"). Las paginas secundarias SI lo conservan: ahi la barra no
// te ubica. Se mira la vista entera, no el texto suelto: "Noticias" y demas
// siguen apareciendo en otros lados legitimos.
// Desde el 27/08/2026 la pestaña es la WATCHLIST: Banking (view-cash) se
// mudo al menu lateral, o sea que paso al bando de las secundarias y GANA
// su titulo — el chequeo se movio con el.
['view-portafolio', 'view-watchlist', 'view-trade', 'view-noticias'].forEach(function (v) {
  var desde = indexCrudo.indexOf('id="' + v + '"');
  var trozo = indexCrudo.slice(desde, indexCrudo.indexOf('============', desde));
  ok(desde !== -1 && trozo.indexOf('viewtitle') === -1, v + ': sin titulo de pagina (la pestaña ya lo dice)');
});
['Positions', 'Settings', 'IBKR', 'Binance', 'Charles Schwab', 'Search asset', 'AI Insights', 'Security', 'Banking'].forEach(function (t) {
  ok(indexCrudo.indexOf('<p class="viewtitle">' + t + '</p>') !== -1, t + ': las paginas secundarias conservan su titulo');
});
// Y ese titulo es una ETIQUETA discreta, no un titular (26/08/2026, dos
// vueltas): chico, en mayusculas, y con el color de la TONALIDAD (no el
// acento) — la segunda vuelta pidio unificar .viewtitle con .card h2 bajo un
// solo estilo. (Mira la regla escrita; el arnes no mide como se ve.)
var reglaTitulo = (indexCrudo.match(/\.viewtitle, \.card h2, \.pagesub \{[^}]*\}/) || [''])[0];
ok(!!reglaTitulo, 'se encuentra la regla unificada de .viewtitle, .card h2 y .pagesub');
ok(reglaTitulo.indexOf('text-transform: uppercase') !== -1, 'el titulo secundario va en mayusculas');
ok(reglaTitulo.indexOf('font-size: 11.5px') !== -1, 'y chico (11.5px, era 22)');
ok(reglaTitulo.indexOf('color-mix(in srgb, var(--muted) 78%, transparent)') !== -1,
  'y con el color de la TONALIDAD (no el acento), traslucido');

console.log('\nH) el selector Por cuenta / Por tipo usa el ACENTO, no el verde de Trades');
// El reporte de Guzman (26/08/2026, con captura): "Por cuenta" salia SIEMPRE
// verde, sin importar la paleta elegida, porque reusaba active-compra (la
// clase de "COMPRA" en Trades). active-compra/venta quedan SOLO para Trades,
// donde el verde/rojo es el dato real (compraste o vendiste).
ok(indexCrudo.indexOf('class="tipobtn active-acento" id="pieCuentaBtn"') !== -1,
  'el HTML arranca con Por cuenta en active-acento, no active-compra');
ok(/\.tipobtn\.active-acento \{ background: rgba\(var\(--gold-rgb\),\.16\); border-color: var\(--gold\); color: var\(--gold\); \}/.test(indexCrudo),
  'active-acento pinta con el acento vivo');
var panelesSrc2 = fs.readFileSync(path.join(ruta.RUTA, 'js', 'paneles.js'), 'utf8');
ok(panelesSrc2.indexOf("classList.add('active-acento')") !== -1 && panelesSrc2.indexOf("classList.add('active-compra')") === -1,
  'el alternador de la torta usa active-acento; el classList.add ya no toca active-compra (el comentario que cuenta la historia no cuenta)');
var configSrc3 = fs.readFileSync(path.join(ruta.RUTA, 'js', 'config.js'), 'utf8');
ok(configSrc3.indexOf("toggle('active-acento'") !== -1,
  'los botones de Tema tambien: es el mismo concepto (control activo generico), una sola clase');
var tradeSrc = fs.readFileSync(path.join(ruta.RUTA, 'js', 'trade.js'), 'utf8');
ok(/active-compra/.test(tradeSrc) && /active-venta/.test(tradeSrc),
  'active-compra/active-venta SIGUEN en Trades: ahi el verde/rojo es el dato (compraste o vendiste)');
ok(/id="mConfig"[\s\S]{0,400}?Keys<\/button>/.test(indexCrudo), 'y su tile del panel dice Keys');
ok(/id="mDiseno"[\s\S]{0,400}?Settings<\/button>/.test(indexCrudo), 'el tile nuevo dice Settings');
ok(vistasSrc.indexOf("document.getElementById('mDiseno').onclick") !== -1 && vistasSrc.indexOf("setView('diseno')") !== -1,
  'y abre la pagina view-diseno');
ok(/var VIEWS = \[[^\]]*'diseno'/.test(vistasSrc), "la vista esta en VIEWS");
ok(vistasSrc.indexOf("if (name === 'diseno') pintarDiseno();") !== -1, 'entrar refresca que esta marcado');
ok(/<div class="mpaleta" id="mPaleta" role="group"/.test(indexCrudo) && /<div class="mpaleta" id="mFondo" role="group"/.test(indexCrudo),
  'las dos filas de puntos viven en la pagina');
ok((indexCrudo.match(/class="pdot pdot-/g) || []).length === 4 && (indexCrudo.match(/class="pdot fdot-/g) || []).length === 4,
  'cuatro acentos y cuatro tonalidades');
// El acceso a la base D1 de Cloudflare: LA base de datos de la app desde el
// corte del 29/08/2026. El tile de la Google Sheet se saco ese mismo dia
// (pedido de Guzman) — la planilla es un respaldo historico y un acceso
// directo invitaba a editarla, cuando editarla ya no cambia nada. Los
// asserts del tile viejo se dieron VUELTA, como manda la regla: ahora
// verifican que no vuelva. La URL de D1 lleva CUENTA y BASE explicitas
// (wrangler whoami / d1 list): la forma ?to=/:account/... daba "no existe".
ok(indexCrudo.indexOf('https://dash.cloudflare.com/f4c2536ebeb1a3c6e4ccc234554c2e41/workers/d1/databases/6b35aa74-13d4-412c-8452-ef1b664d2b20') !== -1,
  'el tile Database apunta a la base ga-portfolio, con cuenta y base explicitas');
ok(indexCrudo.indexOf('href="https://dash.cloudflare.com/?to=') === -1,
  'y ningun href usa la forma ?to=/:account, que daba error (el comentario que cuenta la historia no cuenta)');
ok(/Database<\/a>/.test(indexCrudo) && !/Database \(test\)/.test(indexCrudo),
  'y se llama Database a secas: dejo de ser un ensayo');
ok(indexCrudo.indexOf('docs.google.com/spreadsheets') === -1,
  'el tile de la planilla NO esta: quedo de respaldo historico y un acceso directo invitaba a editarla');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
