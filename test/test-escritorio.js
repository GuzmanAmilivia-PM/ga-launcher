// Arnés del MODO ESCRITORIO (31/08/2026). Pedido de Guzmán: "modo celular y
// modo computadora". En pantalla ancha la app se veía como un teléfono
// estirado — una columna de 860px con vacío a los costados y la barra de
// botones abajo, que es donde llega el pulgar y no donde mira el ojo.
//
// LO QUE ESTE ARNÉS PUEDE Y NO PUEDE: no hay navegador acá, así que NO mide
// geometría — mira las REGLAS escritas. Que la barra quede efectivamente a
// la izquierda sin pisar el contenido se midió en un navegador de verdad y
// los números están en HISTORIAL.md. Lo que sí custodia esto es que las
// reglas sigan existiendo, que vivan DENTRO del @media (o sea que el
// teléfono no se entere), y que el umbral no se despegue entre el CSS y el
// JS — que es el error que dejaría paneles visibles y vacíos.
var ruta = require('./_ruta');
var fs = require('fs');
var path = require('path');
var html = fs.readFileSync(ruta.INDEX, 'utf8');
var paneles = fs.readFileSync(path.join(ruta.RUTA, 'js', 'paneles.js'), 'utf8');
var arranque = fs.readFileSync(path.join(ruta.RUTA, 'js', 'arranque.js'), 'utf8');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

// El bloque entero del @media, para poder preguntar "¿esta regla está ADENTRO?".
function bloqueMedia(css, condicion) {
  var i = css.indexOf('@media (' + condicion + ')');
  if (i === -1) return null;
  var j = css.indexOf('{', i);
  var prof = 0;
  for (var k = j; k < css.length; k++) {
    if (css[k] === '{') prof++;
    else if (css[k] === '}') { prof--; if (prof === 0) return css.slice(i, k + 1); }
  }
  return null;
}

console.log('\nA) el bloque de escritorio existe y tiene un umbral');
var UMBRAL = 1100;
var bloque = bloqueMedia(html, 'min-width: ' + UMBRAL + 'px');
ok(!!bloque, 'hay un @media (min-width: ' + UMBRAL + 'px) en index.html');
if (!bloque) { console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas'); process.exit(1); }

console.log('\nB) el mismo umbral en el CSS y en el JS (si se despegan, el sintoma es mudo)');
// El CSS despliega el carrusel y el JS carga los paneles que ya no se
// alcanzan deslizando. Con dos umbrales distintos habria una franja de
// anchos onde los tres paneles se ven y dos estan vacios, sin ningun error.
var mUmbral = paneles.match(/ESCRITORIO_MIN_PX\s*=\s*(\d+)/);
ok(!!mUmbral, 'paneles.js declara ESCRITORIO_MIN_PX');
ok(mUmbral && Number(mUmbral[1]) === UMBRAL,
  'y vale lo MISMO que el @media (' + (mUmbral ? mUmbral[1] : '?') + ' vs ' + UMBRAL + ')');
ok(/matchMedia\('\(min-width: ' \+ ESCRITORIO_MIN_PX/.test(paneles),
  'el JS consulta con esa constante, no con un numero escrito a mano');

console.log('\nC) la barra de abajo se acuesta a la izquierda');
ok(/\.bottomnav\s*\{[^}]*flex-direction:\s*column/.test(bloque), 'la .bottomnav pasa a columna');
ok(/\.bottomnav\s*\{[^}]*left:\s*0/.test(bloque) && /\.bottomnav\s*\{[^}]*top:\s*0/.test(bloque),
  'pegada al borde izquierdo y a lo alto');
ok(/\.bottomnav\s*\{[^}]*transform:\s*none/.test(bloque),
  'se anula el translateX(-50%) que la centraba abajo (si no, queda corrida media pantalla)');
ok(/\.navtab\s*\{[^}]*flex-direction:\s*row/.test(bloque),
  'cada item pasa a icono+texto en una linea, como un menu de escritorio');
// El boton redondo del medio es un patron de barra INFERIOR (colgado y con
// sombra). Acostado quedaria como un globo suelto en medio de la lista.
ok(/\.navtab-center \.cbtn\s*\{[^}]*(background:\s*none|border-radius:\s*0)/.test(bloque),
  'el boton central redondo se aplana: es un patron de barra de abajo');

console.log('\nD) el contenido le deja lugar a la barra (o quedarian encimados)');
ok(/--lat-w:/.test(bloque), 'el ancho de la barra es UNA variable');
ok(/\.mainarea\s*\{[^}]*margin-left:\s*var\(--lat-w\)/.test(bloque),
  'y el contenido se corre exactamente ese ancho, no un numero repetido');
ok(/\.bottomnav\s*\{[^}]*width:\s*var\(--lat-w\)/.test(bloque),
  'la barra usa la MISMA variable: no se pueden desincronizar');
ok(/body\s*\{[^}]*max-width:\s*none/.test(bloque),
  'se suelta el corset de 860px del body');
ok(/\.mainarea\s*\{[^}]*max-width:/.test(bloque),
  'pero queda un tope, para que las lineas no se vuelvan ilegibles en un monitor grande');

console.log('\nE) el carrusel se despliega (y por eso el JS tiene que cargar los tres)');
ok(/\.sweepdeck\s*\{[^}]*transform:\s*none\s*!important/.test(bloque),
  'se anula el translateX que pone paneles.js EN LINEA (por eso el !important)');
ok(/\.sweepwrap\s*\{[^}]*height:\s*auto\s*!important/.test(bloque),
  'y la altura fija que tambien escribe el JS');
ok(/\.sweepdots\s*\{[^}]*display:\s*none/.test(bloque), 'los puntitos del carrusel se esconden');
ok(/function cargarPanelesDeEscritorio/.test(paneles), 'existe la carga de los tres paneles');
ok(/cargarDividendos/.test(paneles.slice(paneles.indexOf('function cargarPanelesDeEscritorio'))) &&
   /cargarAportes/.test(paneles.slice(paneles.indexOf('function cargarPanelesDeEscritorio'))),
  'y pide Dividends Y Contributions (los dos que colgaban del gesto)');
ok(/cargarPanelesDeEscritorio\(\)/.test(arranque),
  'arranque.js la llama al iniciar: sin esto, dos de tres paneles quedan en "Swipe to load"');
ok(/addEventListener\('change'|addListener/.test(paneles),
  'y se vuelve a intentar si la ventana se agranda despues');
// Sin clave guardada, la carga de escritorio NO pide nada (3/09/2026): los
// tres pedidos volvian con 'auth' y la pantalla de clave acusaba una clave
// "que dejo de servir" a alguien que nunca guardo ninguna.
var cuerpoCarga = paneles.slice(paneles.indexOf('function cargarPanelesDeEscritorio'));
cuerpoCarga = cuerpoCarga.slice(0, cuerpoCarga.indexOf('\n}'));
ok(cuerpoCarga.indexOf('getApiToken()') !== -1 &&
   cuerpoCarga.indexOf('getApiToken()') < cuerpoCarga.indexOf('cargarDividendos'),
  'la carga de escritorio mira si hay clave ANTES de pedir nada');
var nucleo = fs.readFileSync(path.join(ruta.RUTA, 'js', 'nucleo.js'), 'utf8');
var guardado = nucleo.slice(nucleo.indexOf("getElementById('lockBtn').onclick"));
guardado = guardado.slice(0, guardado.indexOf('\n};'));
ok(/cargarPanelesDeEscritorio\(\)/.test(guardado),
  'y al guardar la clave se vuelve a pedir: si no, en escritorio dos de tres paneles quedan vacios');

console.log('\nF) el telefono no se entera: NADA de esto vive fuera del @media');
// La prueba que de verdad protege a Guzman. Cada regla nueva se busca en el
// CSS CON el bloque de escritorio recortado: si aparece igual, es que quedo
// suelta y le esta pegando al telefono.
var sinBloque = html.replace(bloque, '');

// Ojo con la forma de preguntar: buscar la PROPIEDAD suelta da falsos
// positivos —"flex-direction: column" aparece en .menupanel, .mtile,
// .detgrid y dos mas, todos legitimos— y el arnes se pondria rojo por
// codigo sano. Lo que hay que mirar es la regla DE ESE SELECTOR.
function cuerposDe(css, selector) {
  var re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g');
  var out = [], m;
  while ((m = re.exec(css)) !== null) out.push(m[1]);
  return out;
}
function sueltaEnTelefono(selector, prop) {
  return cuerposDe(sinBloque, selector).some(function (c) { return c.indexOf(prop) !== -1; });
}

[
  ['.bottomnav', 'flex-direction: column', 'la barra en columna'],
  ['.mainarea', 'margin-left: var(--lat-w)', 'el corrimiento del contenido'],
  ['.sweepwrap', 'height: auto !important', 'el desarmado del carrusel'],
  ['.sweepdeck', 'transform: none !important', 'la anulacion del deslizamiento'],
  ['body', 'max-width: none', 'la suelta del ancho del body'],
  ['.navtab', 'flex-direction: row', 'los items acostados'],
  ['.sweepdots', 'display: none', 'el ocultado de los puntitos']
].forEach(function (t) {
  ok(!sueltaEnTelefono(t[0], t[1]), t[2] + ' NO se le escapa al telefono (' + t[0] + ')');
});
// Y las reglas del telefono siguen intactas.
ok(/\.bottomnav \{ position: fixed; bottom: 0;/.test(sinBloque),
  'la barra de abajo del telefono sigue escrita igual');
ok(/\.sweeppanel \{ min-width: 100%; \}/.test(sinBloque),
  'y el carrusel del telefono tambien');

console.log('\nG) la tira de indicadores: nace APAGADA');
// Lo que se agrega como HTML nuevo tiene que empezar oculto, o el telefono
// lo pinta igual. Paso el 31/08/2026: .kpis solo tenia "display:grid"
// dentro del @media, asi que en el telefono salia como bloque, se comia la
// primera pantalla y quedaba cortado. La prueba numerica decia
// "display: block" y recien la captura lo delato — de ahi este assert.
ok(/\.kpis \{ display: none; \}/.test(sinBloque),
  'hay un .kpis { display: none } FUERA del @media (el telefono no la pinta)');
ok(/\.kpis\s*\{[^}]*display:\s*grid/.test(bloque),
  'y el @media la enciende como grilla');
ok(/id="kpiStrip"/.test(html), 'el contenedor existe en el HTML');
var graficos = fs.readFileSync(path.join(ruta.RUTA, 'js', 'graficos.js'), 'utf8');
ok(/function calcularKpis/.test(graficos) && /function pintarKpis/.test(graficos),
  'y el JS que la calcula y la pinta');
// La honestidad del numero: si faltan variaciones, se DICE cuanta PLATA
// quedo afuera. Sumar como cero las que faltan daria un total menor al real,
// presentado como completo — que es peor que un guion. Desde D8 (31/08/2026)
// el aviso va en dolares y no en cantidad de posiciones: seis chicas y una
// grande se leen igual contadas, y no son lo mismo.
// Ojo: esto solo mira el TEXTO del codigo. La aritmetica de D8 se ejecuta de
// verdad en test-sinprecio.js — un grep no puede notar un divisor mal puesto.
ok(/not priced today/.test(graficos) && /valorSinPrecio/.test(graficos),
  'y avisa cuanta plata quedo afuera cuando faltan precios');
ok(!/sinDia/.test(graficos),
  'ya no cuenta "N of M posiciones": ese conteo metia al cash entre los datos faltantes');

console.log('\nH) la asignacion (D4): tambien nace apagada, y NO calcula nada nuevo');
ok(/\.asigcard \{ display: none; \}/.test(sinBloque),
  'la tarjeta nace apagada FUERA del @media (el telefono ya la tiene en Analysis)');
ok(/\.asigcard\s*\{[^}]*display:\s*block/.test(bloque), 'y el @media la enciende');
ok(/id="asigBody"/.test(html) && /id="asigTitulo"/.test(html), 'el contenedor y el titulo existen');
var analisisJs = fs.readFileSync(path.join(ruta.RUTA, 'js', 'analisis.js'), 'utf8');
ok(/function renderAsignacionTablero/.test(analisisJs), 'existe el pintado de la tarjeta');
// Lo que hace valiosa la tarjeta es que NO recalcula: reusa el look-through
// que el backend ya hace (un ETF amplio reparte su peso entre los sectores
// del indice en vez de contar como una sola cosa). Si algun dia alguien la
// "optimiza" calculando por su cuenta desde las posiciones, el numero deja
// de mirar dentro de los ETFs y la concentracion real queda mal medida.
var bloqueAsig = analisisJs.slice(analisisJs.indexOf('function renderAsignacionTablero'));
bloqueAsig = bloqueAsig.slice(0, bloqueAsig.indexOf('\n}\n') + 3);
ok(/r\.sectores/.test(bloqueAsig) && /r\.clases/.test(bloqueAsig) && /r\.concentracion/.test(bloqueAsig),
  'y sale de la respuesta del backend (clases, sectores y concentracion), no de un calculo propio');
ok(!/lastData|posiciones\.forEach/.test(bloqueAsig),
  'NO recalcula desde las posiciones: eso perderia el look-through de los ETFs');
// La cobertura se declara: un "35% tecnologia" medido sobre el 80% de la
// cartera no es lo mismo que uno medido sobre todo.
ok(/cobertura/.test(bloqueAsig) && /could be classified/.test(bloqueAsig),
  'y dice sobre cuanto se midio cuando no cubre todo');
ok(/cargarAnalisis/.test(paneles),
  'el escritorio pide el analisis al arrancar (en el telefono se pide al entrar a Portfolio)');
// La interfaz va en INGLES (regla de la app desde el 26/08/2026). La tarjeta
// se escribio primero en espanol — el MISMO error que Guzman ya habia
// marcado en la maqueta del modo escritorio, asi que ahora lo vigila un test.
ok(!/en tus 5 mayores|Por clase|Por sector|Medido sobre/.test(bloqueAsig),
  'los textos van en INGLES, como el resto de la interfaz');
ok(/in your top 5/.test(bloqueAsig) && /looking inside your ETFs/.test(bloqueAsig),
  'y se lee lo que hace: mira DENTRO de los ETFs');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
