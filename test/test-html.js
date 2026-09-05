// Chequeos estructurales del index.html de la PWA. No prueba comportamiento:
// prueba que el archivo no tenga los errores que ya nos mordieron una vez.
var ruta = require('./_ruta');
var html = ruta.leerIndex();

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

// Los comentarios HTML se sacan primero: uno de ellos mencionaba la etiqueta de
// script literal y hacia que este mismo chequeo creyera ver codigo roto.
var limpio = html.replace(/<!--[\s\S]*?-->/g, '');

console.log('\nA) todo el JavaScript compila');
// El HTML solo conserva un bloque inline chico (el del tema, en el head);
// el resto vive en js/*.js. leerIndex() ya concatena todo.
var soloHtml = require('fs').readFileSync(ruta.INDEX, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
var re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
var m, n = 0, malos = [];
while ((m = re.exec(soloHtml)) !== null) {
  n++;
  try { new Function(m[1]); } catch (e) { malos.push('inline #' + n + ': ' + e.message); }
}
ok(n <= 2, 'quedan a lo sumo 2 bloques inline chicos (' + n + ')');
var fsA = require('fs'), pathA = require('path');
var dirJs = pathA.join(ruta.RUTA, 'js');
var archivosJs = fsA.readdirSync(dirJs).filter(function (f) { return /\.js$/.test(f); });
archivosJs.forEach(function (f) {
  try { new Function(fsA.readFileSync(pathA.join(dirJs, f), 'utf8')); }
  catch (e) { malos.push(f + ': ' + e.message); }
});
ok(archivosJs.length >= 10, 'hay ' + archivosJs.length + ' archivos en js/');
ok(malos.length === 0, 'todo compila' + (malos.length ? ': ' + malos.join(' | ') : ''));

console.log('\nB) nada de terceros corre dentro de la pagina');
var srcs = (soloHtml.match(/<script[^>]*src="([^"]*)"/g) || [])
  .map(function (s) { return s.match(/src="([^"]*)"/)[1]; });
var externos = srcs.filter(function (u) { return /^https?:/.test(u); });
ok(externos.length === 0,
   'ningun script externo (la pagina guarda la clave de Binance)' +
   (externos.length ? ' — HAY: ' + externos.join(', ') : ''));
// Los scripts clasicos comparten globales y ~138 sentencias corren al cargar:
// el ORDEN de los <script src> es semantica, no estetica.
var cargados = srcs.filter(function (u) { return u.indexOf('./js/') === 0; })
  .map(function (u) { return u.replace('./js/', ''); });
ok(cargados.length === archivosJs.length,
   'index.html carga los ' + archivosJs.length + ' archivos de js/ (carga ' + cargados.length + ')');
ok(cargados[0] === 'nucleo.js', 'nucleo.js (el shim de la API) se carga primero');
ok(cargados[cargados.length - 1] === 'arranque.js', 'arranque.js (pintarCache/loadData) se carga ultimo');
var faltanEnDisco = cargados.filter(function (f) { return archivosJs.indexOf(f) === -1; });
ok(faltanEnDisco.length === 0, 'todos los cargados existen en disco' + (faltanEnDisco.length ? ' — FALTAN: ' + faltanEnDisco.join(', ') : ''));

console.log('\nB2) el service worker cachea todos los archivos de js/');
var sw = fsA.readFileSync(pathA.join(ruta.RUTA, 'sw.js'), 'utf8');
var sinCachear = archivosJs.filter(function (f) { return sw.indexOf("./js/" + f) === -1; });
ok(sinCachear.length === 0,
   'ASSETS del sw.js al dia' + (sinCachear.length ? ' — FALTAN: ' + sinCachear.join(', ') + ' (offline se rompe)' : ''));

console.log('\nB3) las fuentes viven en la app y el shell va cache-first');
// Desde v65 (R4): el CSS de Google Fonts bloqueaba el primer pintado sin
// pasar por el service worker, y el shell versionado se revalidaba entero en
// cada apertura compitiendo con el pedido de datos.
ok(!/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(soloHtml), 'index.html ya no depende de Google Fonts');
ok(/@font-face[^}]*Manrope[^}]*\.\/fonts\//.test(soloHtml.replace(/\n/g, ' ')), '@font-face de Manrope apunta a ./fonts/');
ok(/@font-face[^}]*Montserrat[^}]*\.\/fonts\//.test(soloHtml.replace(/\n/g, ' ')), '@font-face de Montserrat apunta a ./fonts/');
var dirFonts = pathA.join(ruta.RUTA, 'fonts');
var woff2 = fsA.existsSync(dirFonts) ? fsA.readdirSync(dirFonts).filter(function (f) { return /\.woff2$/.test(f); }) : [];
ok(woff2.length >= 2, 'los .woff2 estan en el repo (' + woff2.length + ')');
var fontsSinCachear = woff2.filter(function (f) { return sw.indexOf('./fonts/' + f) === -1; });
ok(fontsSinCachear.length === 0, 'las fuentes estan en ASSETS del sw' + (fontsSinCachear.length ? ' — FALTAN: ' + fontsSinCachear.join(', ') : ''));
// El cache de lo estable (5/09/2026): fuentes e iconos en un cajon que no se
// renueva con cada version. Que exista, que el activate no lo borre, que su
// nombre no empiece con 'ga-pwa-' (versionShell saca de ahi la version), y que
// fuentes e iconos ya no esten TAMBIEN en ASSETS (se bajarian dos veces).
var mEst = sw.match(/var ESTABLES = '([^']+)'/);
ok(!!mEst && mEst[1].indexOf('ga-pwa-') !== 0, 'el cache de lo estable existe y NO se llama ga-pwa-*: ' + (mEst ? mEst[1] : 'no esta'));
ok(/k !== CACHE && k !== ESTABLES/.test(sw), 'el activate conserva el cache de lo estable');
var swPlano = sw.replace(/\n/g, ' ');
ok(/ASSETS_ESTABLES = \[[^\]]*fonts\/[^\]]*icon-512/.test(swPlano), 'fuentes e iconos van en el cajon estable');
ok(!/var ASSETS = \[[^\]]*fonts\//.test(swPlano), 'y ya no estan en ASSETS del cascaron');
// El contrato cache-first: responde del cache y va a la red SOLO si falta.
// La version anterior disparaba un fetch de revalidacion en cada pedido.
ok(/return cached \|\| fetch\(/.test(sw), 'el sw responde del cache y solo va a la red si falta');
ok(!/var fresh = fetch/.test(sw), 'sin revalidacion en segundo plano en cada apertura');

console.log('\nC) la politica de contenido esta y cubre lo que tiene que cubrir');
var csp = (html.match(/http-equiv="Content-Security-Policy"[^>]*content="([^"]*)"/) || [])[1] || '';
ok(!!csp, 'hay una politica declarada');
// El backend VIVO desde el 20/08/2026. Este es el assert que importa: sin el
// Worker en connect-src la app se muere entera, y hasta la auditoria del
// 21/08/2026 nadie lo vigilaba — se exigian los dos dominios de Apps Script,
// que ya no atienden a nadie, y del Worker no se decia una palabra.
ok(/connect-src[^;]*ga-portfolio-worker\.ga-portfolio\.workers\.dev/.test(csp),
   'permite el backend VIVO (el Worker de Cloudflare)');
var apiUrl = (limpio.match(/^\s*var API_URL = '([^']+)'/m) || [])[1] || '';
ok(/workers\.dev/.test(apiUrl), 'API_URL apunta al Worker, no a Apps Script (es ' + apiUrl + ')');
// DADOS VUELTA el 22/08/2026, al apagar Apps Script: antes exigian que los dos
// dominios estuvieran (por la ventana de rollback); ahora exigen que NO esten.
// Asi nadie los repone sin querer y la superficie de exfiltracion no vuelve a
// crecer sola.
ok(!/script\.google\.com/.test(csp), 'el backend viejo YA NO esta permitido (apagado el 22/08/2026)');
ok(!/script\.googleusercontent\.com/.test(csp), 'ni su redireccion');
ok(!/script\.google\.com/.test(limpio), 'y no quedo ninguna referencia a Apps Script en el codigo');
ok(/connect-src[^;]*wss:\/\/ws-api\.binance\.com/.test(csp), 'permite el WebSocket de Binance');
ok(/connect-src/.test(csp) && !/connect-src[^;]*\*/.test(csp), 'connect-src NO es abierto: sin eso la clave se podria mandar a cualquier lado');
ok(/frame-src[^;]*tradingview\.com/.test(csp), 'permite el iframe de TradingView');
ok(/script-src[^;]*'self'/.test(csp) && !/script-src[^;]*https:\/\//.test(csp), 'script-src sin hosts externos');
// frame-ancestors se SACO el 4/09/2026: dentro de un <meta> el navegador la
// ignora y deja un error en consola en cada carga (solo vale por cabecera
// HTTP, que GitHub Pages no manda). El assert se da vuelta para que nadie la
// reponga creyendo que protege algo.
ok(!/frame-ancestors/.test(csp), 'sin frame-ancestors en el <meta>: ahi no hace nada y ensucia la consola');
ok(/object-src 'none'/.test(csp), 'sin plugins');

console.log('\nC2b) todo boton se puede nombrar: texto visible o aria-label');
// Un boton que es solo un icono (el de refrescar, el de cerrar) no le dice
// nada a un lector de pantalla. La radiografia del 3/09/2026 conto 86
// botones y 19 con etiqueta; los diez que eran solo un simbolo se
// etiquetaron el 4/09. Esto evita que vuelvan a entrar mudos.
{
  var reBtn = /<button\b([^>]*)>([\s\S]*?)<\/button>/g, mB, mudos = [];
  while ((mB = reBtn.exec(html)) !== null) {
    var textoBtn = mB[2].replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, 'x').trim();
    if (!/aria-label="[^"]+"/.test(mB[1]) && textoBtn.length < 2) {
      mudos.push((mB[1].match(/id="([^"]+)"/) || [])[1] || mB[1].trim().slice(0, 40));
    }
  }
  ok(mudos.length === 0, 'ningun boton del index.html es solo un icono sin aria-label' + (mudos.length ? ' — MUDOS: ' + mudos.join(', ') : ''));
}

console.log('\nC3) la politica de contenido y lo que la app de verdad carga');
// INCIDENTE del 24/08/2026: se cerro img-src a 'self' data: por un hallazgo de
// auditoria que decia "la app no carga ninguna imagen de afuera". Era FALSO —
// los logos de las posiciones salen de assets.parqet.com y cdn.jsdelivr.net— y
// se publico asi: los circulos de la tabla quedaron VACIOS durante dos dias.
// Peor: el respaldo a las iniciales tampoco corria, porque estaba enganchado
// con un onerror INLINE y la propia politica prohibe el codigo inline.
//
// Estos asserts atan las dos cosas al codigo REAL, no a una lista escrita a
// mano: de donde saca los logos la app, y que la politica los permita.
var graficosCsp = fsA.readFileSync(pathA.join(ruta.RUTA, 'js', 'graficos.js'), 'utf8');
var fnLogo = (graficosCsp.match(/function logoUrl[\s\S]*?\n\}/) || [''])[0];
var hostsLogo = (fnLogo.match(/https:\/\/[a-z0-9.-]+/g) || []).map(function (u) { return u.replace(/\/$/, ''); });
ok(hostsLogo.length > 0, 'se detectan los hosts de los logos en el codigo: ' + hostsLogo.join(', '));
var imgSrc = (csp.match(/img-src([^;]*)/) || [])[1] || '';
hostsLogo.forEach(function (h) {
  ok(imgSrc.indexOf(h) !== -1, 'img-src permite ' + h + ' (si no, el logo no carga): img-src' + imgSrc);
});
ok(!/\shttps?:(?!\/\/)/.test(imgSrc),
  'y NO permite cualquier host (un https: pelado): solo los que la app usa de verdad — img-src' + imgSrc);
// El TERCER servidor de logos (27/08/2026) no se puede derivar del código como
// los otros dos: esa url no está escrita en ningún lado, la elige el proveedor
// en cada respuesta y el backend la guarda por símbolo (logosFinnhub). Por eso
// este host va a mano — es la excepción, y va anotada: si el proveedor cambia
// de dominio, esto se cae y hay que actualizar la política.
// Entró porque el servicio por ticker devolvía para SPCX (SpaceX) el logo de
// la gestora que usó ese ticker antes.
// Se mira DENTRO de la función (fnLogo), no por cuán cerca están las cosas en
// el texto: una ventana de N caracteres la rompe cualquier comentario nuevo, y
// eso ya pasó dos veces este mismo día.
ok(fnLogo.indexOf('h.logo') !== -1 && fnLogo.indexOf('h.logo') < fnLogo.indexOf('parqet'),
   'el logo declarado por el backend se devuelve ANTES de caer al servicio por ticker');
ok(/finnhub\.io/.test(imgSrc),
   'img-src permite el servidor de logos del backend (si no, el logo oficial no carga): img-src' + imgSrc);

// Ningun HTML que arme la app puede llevar manejadores inline: la politica los
// bloquea, asi que son codigo muerto que falla en silencio.
var conInline = [];
archivosJs.forEach(function (f) {
  var src = fsA.readFileSync(pathA.join(dirJs, f), 'utf8');
  var m2, r3 = /['"][^'"]*\son[a-z]+\s*=\s*["'][^"']*\(/g;
  while ((m2 = r3.exec(src)) !== null) conInline.push(f + ': ' + m2[0].slice(-40));
});
ok(conInline.length === 0,
  'ningun manejador inline en el HTML que arma la app' + (conInline.length ? ' — HAY: ' + conInline.join(' | ') : ''));

console.log('\nD) el widget de TradingView va aislado');
ok(/crearTvWidget[\s\S]{0,700}createElement\('iframe'\)/.test(limpio), 'se crea como iframe, no como script');
ok(/sandbox[\s\S]{0,80}allow-scripts/.test(limpio), 'con sandbox');
ok(!/s3\.tradingview\.com/.test(limpio), 'ya no se carga su loader en la pagina');

console.log('\nE) los contenedores que el codigo usa existen');
var ids = [], r2 = /getElementById\('([\w-]+)'\)/g;
while ((m = r2.exec(limpio)) !== null) if (ids.indexOf(m[1]) < 0) ids.push(m[1]);
var faltan = ids.filter(function (id) { return html.indexOf('id="' + id + '"') === -1; });
ok(faltan.length === 0, ids.length + ' contenedores' + (faltan.length ? ' — FALTAN: ' + faltan.join(', ') : ''));

console.log('\nF) toda llamada al backend esta declarada en el shim');
var mapa = (limpio.match(/var MAP = \{([\s\S]*?)\};/) || [])[1] || '';
var declaradas = (mapa.match(/(\w+):/g) || []).map(function (x) { return x.slice(0, -1); });
// Las cadenas son del estilo `...withFailureHandler(fn).getNoticias()`, pero
// dentro del callback hay codigo con sus propias llamadas, asi que la ventana
// de busqueda tambien atrapa metodos comunes de JS: se descartan por nombre.
var JS_COMUNES = ['withSuccessHandler', 'withFailureHandler', 'forEach', 'join', 'map',
  'filter', 'then', 'catch', 'slice', 'split', 'push', 'indexOf', 'replace', 'toFixed',
  'querySelectorAll', 'querySelector', 'getElementById', 'setAttribute', 'appendChild'];
var usadas = [], r3 = /\.(?:withSuccessHandler|withFailureHandler)\([\s\S]{0,400}?\)\s*\.(\w+)\(/g;
while ((m = r3.exec(limpio)) !== null) if (usadas.indexOf(m[1]) < 0) usadas.push(m[1]);
var sinMapear = usadas.filter(function (f) {
  return declaradas.indexOf(f) === -1 && JS_COMUNES.indexOf(f) === -1;
});
ok(declaradas.length > 20, 'el shim declara ' + declaradas.length + ' funciones');
ok(sinMapear.length === 0, 'ninguna llamada sin declarar' + (sinMapear.length ? ': ' + sinMapear.join(', ') : ''));

console.log('\nG) el contrato PWA-API no se puede desincronizar');
// MAP (nucleo.js) espeja la tabla API_FNS del backend A MANO y en DOS repos:
// este test es el unico chequeo cruzado. Si falla: alguien agrego una fn de un
// solo lado.
// Hasta la auditoria del 21/08/2026 esto cruzaba contra src/Api.js, el backend
// JUBILADO: pasaba de casualidad (29 = 29) y se iba a romper el dia que se
// borrara esa carpeta. Ahora mira el Worker, que es el que atiende.
var RUTA_WORKER = process.env.GA_WORKER || pathA.join(__dirname, '..', '..', 'ga-portfolio-worker');
var indexWorker = pathA.join(RUTA_WORKER, 'src', 'index.js');
if (!fsA.existsSync(indexWorker)) {
  console.error('No encuentro ' + indexWorker + '.');
  console.error('Cloná el repo ga-portfolio-worker o apuntá la variable GA_WORKER a donde esté.');
  process.exit(1);
}
var apiSrc = fsA.readFileSync(indexWorker, 'utf8');
var bloqueFns = (apiSrc.match(/const API_FNS = \{([\s\S]*?)\n\};/) || [])[1] || '';
var fnsApi = [];
var mFn, reFn = /^\s{2}(\w+):/gm;
while ((mFn = reFn.exec(bloqueFns)) !== null) fnsApi.push(mFn[1]);
var mapaPwa = (limpio.match(/var MAP = \{([^}]*)\}/) || [])[1] || '';
var fnsPwa = (mapaPwa.match(/'([\w]+)'/g) || []).map(function (x) { return x.slice(1, -1); });
ok(fnsApi.length >= 25, 'API_FNS del backend leida (' + fnsApi.length + ' fns)');
var soloPwa = fnsPwa.filter(function (f) { return fnsApi.indexOf(f) === -1; });
ok(soloPwa.length === 0, 'la PWA no llama fns inexistentes' + (soloPwa.length ? ': ' + soloPwa.join(', ') : ''));
// Estas son del backend y la PWA NO las llama A PROPOSITO: las usa la tarea
// programada del informe semanal de los lunes. 'mail' manda el informe;
// 'noticias_semana' lee el archivo de titulares que el cron viene juntando dia
// a dia (la app muestra las de hoy y no tiene donde poner una semana).
var SOLO_BACKEND = ['mail', 'noticias_semana'];
var soloApi = fnsApi.filter(function (f) { return fnsPwa.indexOf(f) === -1 && SOLO_BACKEND.indexOf(f) === -1; });
ok(soloApi.length === 0, 'ninguna fn del backend quedo sin mapear' + (soloApi.length ? ': ' + soloApi.join(', ') : ''));
SOLO_BACKEND.forEach(function (f) {
  ok(fnsApi.indexOf(f) !== -1, "la fn '" + f + "' sigue existiendo en el backend (la usa el informe semanal)");
});

// --- El NOMBRE de los campos, no solo el de las fns (1/09/2026) -----------
//
// La sección G cruza qué FUNCIONES existen de los dos lados. No alcanzaba:
// el 1/09/2026 se encontró que `aportesEnRango` (graficos.js) leía
// `a.monto` mientras `getAportes` manda `{fecha, grupo}` — `monto` se sacó
// del payload hace tiempo. Como `undefined` no es finito, esa función
// devolvía SIEMPRE 0, y con eso "Qué movió tu saldo" informaba
// "Contributions: US$ 0" atribuyendo todo al mercado: exactamente la mentira
// que ese bloque existe para eliminar.
//
// Nada se puso en rojo porque el arnés alimentaba `{fecha, monto}`, una
// forma que el backend NUNCA manda. Es la lección ya escrita en este
// proyecto: una sonda con la forma inventada pasa en verde mientras
// producción se rompe.
console.log('\nG2) los CAMPOS del payload de aportes, cruzados contra el worker');
var aportesSrc = fsA.readFileSync(pathA.join(RUTA_WORKER, 'src', 'business', 'Dividendos.js'), 'utf8');
var mLista = aportesSrc.match(/lista:\s*lista\.map\(function \(r\) \{ return \{([^}]*)\}/);
ok(!!mLista, 'encuentro el armado de la lista de aportes en el worker');
var camposWorker = (mLista ? mLista[1] : '').match(/(\w+)\s*:/g) || [];
camposWorker = camposWorker.map(function (c) { return c.replace(':', '').trim(); });
ok(camposWorker.indexOf('grupo') !== -1, 'el worker sigue mandando `grupo` (si lo renombró, la app hay que tocarla)');
ok(camposWorker.indexOf('monto') === -1, 'y NO manda `monto`: leerlo da undefined y suma cero en silencio');
// Todo lugar de la app que recorra aportesLista tiene que leer un campo que
// el worker mande de verdad. Se mira SOLO adentro de esos recorridos: hay
// otros `monto` legítimos en la app (dividendos, transacciones) que sí
// existen en sus propios payloads.
var recorridos = html.match(/aportesLista\.forEach\(function \(\w+\) \{[\s\S]*?\n  \}\);/g) || [];
ok(recorridos.length >= 2, 'se detectan los recorridos de aportesLista (' + recorridos.length + ')');
var conMonto = recorridos.filter(function (b) { return /\b\w+\.monto\b/.test(b); });
ok(conMonto.length === 0,
  'ningún recorrido de aportes lee `.monto`' +
  (conMonto.length ? ' — hay ' + conMonto.length + ', y ese campo no viaja: suma cero en silencio' : ''));
var conGrupo = recorridos.filter(function (b) { return /\b\w+\.grupo\b/.test(b); });
ok(conGrupo.length === recorridos.length, 'todos leen `grupo`, que es el campo real');

console.log('\nH) la CSP sin unsafe-inline: el hash del snippet del tema coincide');
ok(csp.indexOf("script-src 'self' 'sha256-") !== -1 && !/script-src[^;]*unsafe-inline/.test(csp), 'script-src va por hash, no por unsafe-inline');
var cryptoH = require('crypto');
var snippetTema = (html.match(/<script>(try\{[\s\S]*?)<\/script>/) || [])[1];
ok(!!snippetTema, 'el snippet del tema existe');
var hashReal = 'sha256-' + cryptoH.createHash('sha256').update(snippetTema).digest('base64');
ok(csp.indexOf(hashReal) !== -1, 'el hash de la CSP coincide con el snippet REAL (si editaste el snippet, recalculalo)');

// ===========================================================================
// I) EL RITUAL DEL BUMP TIENE CUSTODIA
// ===========================================================================
// La regla dura del proyecto es "al publicar se sube CACHE en sw.js": si el
// cascarón cambia y la versión queda igual, el teléfono sigue sirviendo los
// archivos viejos. Antes de este bloque el arnés verificaba que cada archivo
// estuviera LISTADO en ASSETS, no que la versión hubiera subido, y hay siete
// commits que cambiaron el cascarón sin tocar `sw.js` — el más claro es
// `6057774` (17/08/2026), que cambió cómo dibuja `gagraf.js`.
//
// (Este comentario decía que había fallado "una vez, en `c04efd6`". Es falso:
// ese commit NO subió la versión A PROPÓSITO, porque solo cambiaba comentarios,
// y lo dice en su propio mensaje. La regla está bien; la cita estaba mal, y se
// repitió a `CLAUDE.md` desde acá. Auditoría del 24/08/2026.)
console.log('\nI) la version del cache sube cuando cambia el cascaron');
var cpH = require('child_process');
function gitEnLauncher(cmd) {
  try {
    return cpH.execSync('git ' + cmd, { cwd: ruta.RUTA, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) { return null; }
}
var versionActual = (sw.match(/var CACHE = '([^']+)'/) || [])[1] || '';
ok(/^ga-pwa-v\d+$/.test(versionActual), 'la version tiene la forma esperada: ' + versionActual);

// Archivos del cascarón que cambiaron en el último commit, y si ese commit
// tocó también sw.js. Si git no está disponible, el chequeo se saltea con aviso
// en vez de romper (el arnés tiene que poder correr en cualquier lado).
var tocados = gitEnLauncher('show --name-only --pretty=format: HEAD');
if (tocados === null) {
  console.log('  (sin git en ' + ruta.RUTA + ': me salteo el chequeo del bump)');
} else {
  var lista = tocados.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
  var esCascaron = function (f) { return f === 'index.html' || /^js\/[\w-]+\.js$/.test(f); };
  var cambiaronDelCascaron = lista.filter(esCascaron);
  var subioSw = lista.indexOf('sw.js') !== -1;
  ok(cambiaronDelCascaron.length === 0 || subioSw,
     'el ultimo commit toco ' + (cambiaronDelCascaron.join(', ') || 'nada del cascaron') +
     (cambiaronDelCascaron.length ? ' y por eso TIENE que tocar sw.js' : ''));

  // Y que la version haya subido de verdad respecto del commit anterior.
  if (cambiaronDelCascaron.length) {
    var swAnterior = gitEnLauncher('show HEAD~1:sw.js');
    if (swAnterior) {
      var vAnterior = (swAnterior.match(/var CACHE = 'ga-pwa-v(\d+)'/) || [])[1];
      var vAhora = (versionActual.match(/v(\d+)$/) || [])[1];
      ok(vAnterior === undefined || Number(vAhora) > Number(vAnterior),
         'y el numero SUBIO: v' + vAnterior + ' -> ' + versionActual);
    }
  }
}


console.log('\nJ) el grafico de Evolucion arranca COMPACTO, y se toca el grafico');
// Pedido de Guzman (22/08/2026), en tres pasos el mismo dia: que no ocupe
// tanto; que expanda ahi mismo y no en otra pantalla; y que el control sea la
// MINI GRAFICA, no un boton al costado — "vacia queda raro".
var cajaEvo = (html.match(/<div class="chartbox" id="evoChartBox"[^>]*>/) || [''])[0];
ok(!!cajaEvo, 'la caja del grafico de Inicio tiene id propio (evoChartBox)');
ok(/display:\s*none/.test(cajaEvo), 'y arranca oculta: ' + cajaEvo);
ok(/id="evoMini"/.test(html), 'compacta NO queda un hueco: hay una mini grafica en su lugar');
ok(/id="rangePct"/.test(html), 'el % del rango SIGUE a la vista');
ok(/id="rangeBar"/.test(html), 'y los botones de rango tambien, para elegir el periodo');
ok(html.indexOf('id="expandBtn"') === -1,
  'el boton de texto del costado YA NO existe: el control es el grafico');

var graficosSrcH = require('fs').readFileSync(require('path').join(ruta.RUTA, 'js', 'graficos.js'), 'utf8');
var panelesSrcH = require('fs').readFileSync(require('path').join(ruta.RUTA, 'js', 'paneles.js'), 'utf8');
ok(/function drawLineChart\([\s\S]{0,120}evoPlegado\(\)\)\s*return;/.test(graficosSrcH),
  'drawLineChart no dibuja mientras la caja este plegada');
// El area del grafico es el control en los DOS estados. Si solo la mini
// abriera, el grafico expandido no se podria compactar tocandolo.
ok(/_mini\.onclick = _clicEvo;/.test(graficosSrcH), 'tocar la mini grafica expande');
ok(/_caja\.onclick = _clicEvo;/.test(graficosSrcH), 'y tocar el grafico expandido lo vuelve a compactar');
// El clic pasa por _clicEvo, que se abstiene si el gesto fue un deslizamiento
// del carrusel: el control ocupa el ancho de la tarjeta, asi que deslizar hacia
// Dividendos arrancando el dedo encima podia plegar el grafico de paso — y
// encima recordarlo. Auditoria del 23/08/2026.
ok(/function _clicEvo\(\)[\s\S]{0,200}huboSwipe[\s\S]{0,40}return;/.test(graficosSrcH),
  'un deslizamiento del carrusel NO cuenta como clic sobre el grafico');
ok(/huboSwipe = true/.test(panelesSrcH), 'y paneles.js marca cuando hubo deslizamiento');
// Un <div role="button"> NO convierte Enter/Espacio en clic solo: eso lo hace un
// <button> de verdad. Sin esto, con el grafico abierto no habia NINGUN control
// para compactarlo con teclado o con VoiceOver — y la eleccion queda guardada,
// asi que no se salia ni reabriendo la app.
ok(/_mini\.onkeydown = _teclaEvo;/.test(graficosSrcH) && /_caja\.onkeydown = _teclaEvo;/.test(graficosSrcH),
  'los dos estados responden al teclado');
ok(/id="evoChartBox"[^>]*role="button"[^>]*tabindex="0"/.test(html),
  'y la caja del grafico es alcanzable con el foco');
ok(/function toggleEvo\(\)[\s\S]{0,500}drawLineChart\(/.test(graficosSrcH),
  'al expandir dibuja: si no, la caja abriria vacia');
ok(/function toggleEvo\(\)[\s\S]{0,500}renderEvoMini\(\)/.test(graficosSrcH),
  'y al compactar repinta la mini, que es lo que queda a la vista');
ok(/function toggleEvo\(\)[\s\S]{0,600}ajustarAlturaDeck/.test(graficosSrcH),
  'y reajusta el alto de la tarjeta, que sigue al panel visible');
// La mini se dibuja con la MISMA funcion que las filas de posiciones: una sola
// implementacion probada, no dos parecidas.
ok(/renderEvoMini[\s\S]{0,600}sparkSvg\(/.test(graficosSrcH),
  'la mini usa sparkSvg, el mismo dibujo que las posiciones');
ok(/renderEvoMini\(\);/.test(graficosSrcH.match(/btn\.onclick = function \(\)[\s\S]{0,300}/) || ''),
  'al cambiar de periodo la mini se repinta');
// La pantalla completa NO se pierde.
ok(/id="evoAmpliarBtn"/.test(html), 'el grafico a pantalla completa sigue teniendo su boton');
ok(/_ampBtn\.onclick = function[\s\S]{0,120}openChartModal\(\)/.test(graficosSrcH),
  'y ese boton es el que abre el grande');

console.log('\nJ) la tarjeta 1 ES el valor total, con el esquema de las posiciones');
// Pedido de Guzman (23/08/2026): "tarjeta 1 valor total, tarjeta 2 dividendos
// etc, que no diga evolucion ya se a que es esa grafica, cash que este
// discreto". El numero vivia ARRIBA, afuera del carrusel, en .topstats.
ok(!/class="topstats"/.test(html), 'el bloque de arriba ya no existe: el total se mudo adentro de la tarjeta');
var panel1 = (html.match(/<div class="sweeppanel">[\s\S]*?(?=<div class="sweeppanel">)/) || [''])[0];
ok(!!panel1, 'se puede aislar el primer panel del carrusel');
ok(!/<h2>Evoluci/.test(panel1), 'la tarjeta ya NO se titula Evolucion');
// El orden IMPORTA: es el mismo que una fila de posiciones — nombre, dibujo, %.
var iVal = panel1.indexOf('id="total"'), iMini = panel1.indexOf('id="evoMini"'), iPct = panel1.indexOf('id="rangePct"');
ok(iVal !== -1 && iMini !== -1 && iPct !== -1 && iVal < iMini && iMini < iPct,
  'total, dibujo y % van en ese orden, como una fila de la tabla de posiciones');
// Que compartan UNA fila se comprueba sobre el BLOQUE de la fila, no por
// cuán cerca están en el texto. Antes era una ventana de 400 caracteres desde
// `class="totalrow"`, y eso medía otra cosa: el 27/08/2026 un comentario nuevo
// adentro de la fila la puso en rojo sin que nada estuviera mal, y la salida
// de un arnés que se rompe por un párrafo se aprende a ignorar. La fila va
// desde `totalrow` hasta el gráfico desplegable, que es lo que sigue siempre.
var iFila = panel1.indexOf('class="totalrow"');
var finFila = panel1.indexOf('id="evoChartBox"');
var filaTotal = (iFila !== -1 && finFila > iFila) ? panel1.slice(iFila, finFila) : '';
ok(!!filaTotal, 'se puede aislar la fila del total (de .totalrow hasta el grafico desplegable)');
ok(filaTotal.indexOf('id="total"') !== -1 &&
   filaTotal.indexOf('id="evoMini"') !== -1 &&
   filaTotal.indexOf('id="rangePct"') !== -1,
   'y los tres comparten UNA fila: total, dibujo y % viven adentro de .totalrow');
// El cash sigue estando, pero como renglon al pie y no compitiendo arriba.
ok(/class="cashline"[\s\S]{0,200}id="liquidezVal"/.test(panel1), 'el cash queda discreto, al pie de la misma tarjeta');
ok(panel1.indexOf('class="cashline"') > iVal, 'y debajo del total, no al lado');
// El carrusel NO se toca: sigue habiendo mas de un panel y el segundo es
// Dividendos. Si esto se rompe, la pantalla pierde paneles sin avisar.
ok((html.match(/<div class="sweeppanel">/g) || []).length >= 3, 'el carrusel conserva sus tres tarjetas');
ok(/<div class="sweeppanel">[\s\S]*?<h2>Dividends/.test(html.slice(html.indexOf('id="evoChartBox"'))),
  'y la tarjeta 2 sigue siendo Dividendos');
// El ojo de ocultar montos se movio con el total: si se queda afuera, apunta a
// un numero que ya no esta ahi.
ok(panel1.indexOf('id="eyeBtn"') !== -1, 'el ojo de ocultar montos viajo junto al numero');
// El dibujo se achico: a 305px de ancho una semana daba 50px por tramo.
ok(/var EVO_W = 100, EVO_H = 40;/.test(graficosSrcH), 'la mini mide 100x40, apenas mas que los 80x32 de la tabla');
ok(/sparkSvg\(vals, EVO_W, EVO_H/.test(graficosSrcH), 'y renderEvoMini usa esas constantes, no numeros sueltos');

console.log('\nK) elegir el periodo solo estorba con el grafico cerrado');
// Pedido de Guzman (23/08/2026): "elegir el periodo ocupa mucho espacio, que no
// aparezcan cuando no expando la grafica". Ocupaban una franja entera arriba,
// SIEMPRE, para algo que casi nunca se toca.
ok(/id="evoControls"[^>]*style="display:none"/.test(html), 'los controles arrancan ocultos');
ok(/id="evoControls"[\s\S]{0,200}id="rangeBar"/.test(html), 'y adentro van los botones de periodo');
ok(/id="evoControls"[\s\S]{0,300}id="evoAmpliarBtn"/.test(html),
  'junto con el de pantalla completa: un solo nodo, asi no queda uno visible y el otro no');
// Debajo del grafico, no arriba: era lo primero que se leia y no es lo primero
// que importa.
ok(panel1.indexOf('id="evoChartBox"') < panel1.indexOf('id="evoControls"'),
  'y van DEBAJO del grafico, no arriba de todo');
ok(panel1.indexOf('id="evoControls"') > panel1.indexOf('id="total"'),
  'o sea despues del numero, que es lo que se viene a ver');
// El que los muestra y esconde es pintarBotonEvo, el mismo que ya manejaba la
// mini: si se le escapa este nodo, los botones quedan invisibles para siempre.
ok(/function pintarBotonEvo\(\)[\s\S]{0,900}getElementById\('evoControls'\)[\s\S]{0,120}display = abierto \? '' : 'none'/.test(graficosSrcH),
  'se muestran al abrir el grafico y se esconden al cerrarlo');
// Plegado hay que seguir sabiendo DE QUE periodo habla el %, o el numero queda
// huerfano. Eso lo escribe updateRangePct en rangeNombre ("in 1S", "in YTD").
// El "en" era español y se escapo del pasaje a ingles del 26/08/2026: se veia
// en el Inicio, al lado del porcentaje. El assert ahora exige el ingles, asi
// que reponerlo en español vuelve a poner el arnes en rojo.
ok(/id="rangeNombre"/.test(panel1) && /elPer\.textContent = r \? \('in ' \+ r\.key\)/.test(graficosSrcH),
  'aunque los botones no se vean, el % dice a que periodo corresponde, y en ingles');

// El "volver" de cada pagina secundaria, en ingles (01/09/2026).
//
// Se encontro mirando una captura: ocho de las once paginas seguian diciendo
// "Volver" y tres ya decian "Back" — o sea que el pasaje a ingles del
// 26/08/2026 tradujo las nuevas y se salteo las viejas, y nadie lo notaba
// porque las dos versiones convivian sin romper nada. Es el tipo de resto que
// solo aparece cuando alguien abre ESA pantalla, asi que va custodiado.
var backlinks = (html.match(/class="backlink"[^>]*>([^<]*)</g) || []);
ok(backlinks.length >= 11, 'siguen estando los enlaces de volver (' + backlinks.length + ')');
ok(!/class="backlink"[^>]*>[^<]*Volver/.test(html),
  'ninguna pagina secundaria dice "Volver": la interfaz esta en ingles desde el 26/08/2026');
ok(backlinks.every(function (b) { return /Back/.test(b); }),
  'y todas dicen "Back", la misma palabra — no tres variantes segun quien la escribio');

console.log('\nL) los puntitos del carrusel se esconden SIN quedar inalcanzables');
// Pedido de Guzman (23/08/2026): "que el carrusel se mueva pero que no aparezcan
// los puntitos abajo". El riesgo de borrarlos es real: deslizar es un gesto
// TACTIL, asi que sin ellos las tarjetas 2 y 3 no se pueden alcanzar con
// teclado ni con VoiceOver. Se esconden a la vista, no del documento.
ok(/<button class="sdot/.test(html), 'los botones del carrusel SIGUEN en el documento');
ok((html.match(/class="sdot/g) || []).length === 3, 'uno por tarjeta, los tres');
var cssDots = (html.match(/\.sweepdots \{[^}]*\}/) || [''])[0];
ok(/clip-path: inset\(50%\)/.test(cssDots) && /height: 1px/.test(cssDots),
  'pero no ocupan alto: quedan recortados a 1px');
ok(!/display: flex/.test(cssDots), 'y ya no se dibujan en fila al pie de la tarjeta');
// Enfocables e invisibles a la vez es lo peor de los dos mundos: al recibir
// foco tienen que volver a verse.
ok(/\.sweepdots:focus-within \{[^}]*display: flex/.test(html),
  'al enfocarlos con el teclado vuelven a la vista');
// Deslizar tiene que seguir andando: es el camino normal.
ok(/wrap\.addEventListener\('touchend'/.test(fsA.readFileSync(pathA.join(ruta.RUTA, 'js', 'paneles.js'), 'utf8')),
  'y deslizar sigue funcionando, que es como se usa de verdad');

console.log('\nM) el titulo del total');
// "estimado" se saco (23/08/2026): "consume espacio y no da valor". Ocupaba un
// renglon entero al envolverse en dos lineas.
ok(/class="lbl">Total value <button class="eyebtn"/.test(html), 'dice "Total value", sin "estimado"');
ok(!/Valor total estimado/.test(html), 'y no quedo ninguna copia con la palabra vieja');

// La version que ve una persona es GENERACION.FUNCION.PUBLICACION (1.0.107):
// las dos primeras se escriben a mano y se mueven por motivos distintos (hito /
// funcion nueva); la publicacion se LEE del cache, que ya sube al publicar. Asi
// el ritual sigue siendo UN numero para tocar, y las partes no pueden quedar
// desincronizadas: un numero a mano en dos lugares es exactamente lo que queda
// viejo sin que nadie se entere.
// Se EJECUTA el armado, no se lo mira con expresiones regulares. La primera
// version de estos asserts grepeaba el codigo, y con eso se podia romper el
// formato —mostrar `1.107` en vez de `1.0.107`, o dejar el numero clavado— sin
// que ninguno se pusiera en rojo: miraban que las piezas ESTUVIERAN, no lo que
// producian. Auditoria del 24/08/2026.
var vistasSrcV = fsA.readFileSync(pathA.join(ruta.RUTA, 'js', 'vistas.js'), 'utf8');
var versionSrc = (vistasSrcV.match(/var VERSION_GENERACION[\s\S]*?\n\}/) || [''])[0];
ok(!!versionSrc, 'se puede aislar el armado de la version');
var versionTexto = new Function(versionSrc + '\nreturn versionTexto;')();
// GENERACION.FUNCION se lee de la fuente real, no se escribe aca: estos asserts
// custodian el ARMADO (tres partes, la publicacion sale del cache), no el valor
// de dos constantes que suben a mano por decision de producto. Con el "1.0"
// clavado, el bump legitimo de FUNCION (la pantalla Posiciones, 25/08/2026)
// puso ocho asserts en rojo sin que hubiera nada roto — el mismo numero viejo
// contra el que este bloque advierte.
var versionBase = new Function(versionSrc + '\nreturn VERSION_GENERACION + "." + VERSION_FUNCION;')();
ok(/^\d+\.\d+$/.test(versionBase), 'generacion y funcion son dos numeros: ' + versionBase);
ok(versionTexto('ga-pwa-v107') === versionBase + '.107',
  'con el cache real arma generacion.funcion.publicacion: ' + versionTexto('ga-pwa-v107'));
ok(versionTexto(versionActual).split('.').length === 3,
  'siempre tres partes: ' + versionTexto(versionActual));
ok(versionTexto(versionActual).indexOf(versionActual.replace('ga-pwa-v', '')) !== -1,
  'y la ultima parte es la publicacion de sw.js (' + versionActual + '): ' + versionTexto(versionActual));
ok(versionTexto(null) === versionBase && versionTexto('') === versionBase,
  'sin cache disponible dice generacion.funcion, en vez de un guion: ' + versionTexto(null));
ok(/^ga-pwa-v\d+$/.test(versionActual),
  'y la publicacion sigue siendo el contador del cache: ' + versionActual);
// La publicacion NO se escribe a mano: sale del nombre del cache. Se verifica
// por comportamiento —cambiar el cache cambia la version— y no por el nombre de
// una variable, que era lo unico que se miraba antes.
ok(versionTexto('ga-pwa-v999') === versionBase + '.999',
  'si cambia el cache, cambia la version: no hay un numero clavado');
ok(/versionShell[\s\S]{0,400}versionTexto\(/.test(vistasSrcV),
  'y versionShell usa ese mismo armado, no otro copiado');

// --- La version que se MUESTRA, ejecutada de punta a punta ---
// Los asserts de arriba prueban el armado del texto. Estos prueban las otras
// dos mitades: de QUE cache se saca el numero, y cada cuanto se vuelve a mirar.
// Las tres formas de mentir que se arreglaron el 25/08/2026:
//   1) con dos caches vivos ganaba el MAS VIEJO (caches.keys() ordena por
//      creacion, y el viejo se creo antes);
//   2) el badge se pintaba UNA vez por sesion, asi que si se pintaba antes de
//      que existiera el cache quedaba clavado en `1.0` —que no parece un error,
//      parece una version— para siempre;
//   3) el menu cacheaba y Diagnostico no, asi que podian decir cosas distintas
//      al mismo tiempo (sw.js usa skipWaiting: el cache cambia de nombre con la
//      pagina abierta, sin recargar).
var shellSrc = (vistasSrcV.match(/\/\/ De todos los caches[\s\S]*?\n\}\n(?=function pintarVersion)/) || [''])[0];
var pintarSrc = (vistasSrcV.match(/function pintarVersion\(\)[\s\S]*?\n\}\n/) || [''])[0];
ok(!!shellSrc && !!pintarSrc, 'se pueden aislar versionShell y pintarVersion');

function correrVersion(clavesPorLlamada) {
  var llamada = 0;
  var badge = { textContent: '' };
  // `keys()` devuelve un "thenable" SINCRONICO, no una Promise de verdad: con
  // una Promise los asserts caen en un microtask y este arnes cuenta sus
  // resultados antes, asi que se imprimian en verde sin haberse ejecutado
  // NUNCA. Una prueba que no corre es peor que no tenerla. Con esto el callback
  // se ejecuta en el acto y los asserts entran en la cuenta.
  function alToque(valor) {
    return { then: function (f) { f(valor); return { catch: function () { return this; } }; } };
  }
  var ventana = {
    caches: { keys: function () { return alToque(clavesPorLlamada[Math.min(llamada++, clavesPorLlamada.length - 1)]); } }
  };
  // El codigo va TAL CUAL sale de vistas.js: `versionSrc` ya trae las dos
  // constantes de version y `versionTexto`, y encima se le pegan versionShell y
  // pintarVersion. Nada se reescribe aca, para que el arnes no pueda pasar
  // probando una copia distinta de la que corre en el telefono.
  var cuerpo = [
    versionSrc,
    shellSrc,
    pintarSrc,
    'return { pintarVersion: pintarVersion, versionShell: versionShell };'
  ].join('\n');
  // `caches` va aparte porque el codigo real pregunta por `window.caches` pero
  // despues llama al global pelado, igual que en el navegador.
  var ctx = new Function('window', 'document', 'caches', cuerpo)(
    ventana, { getElementById: function () { return badge; } }, ventana.caches);
  return { api: ctx, badge: badge };
}

var dosCaches = correrVersion([['ga-pwa-v107', 'ga-pwa-v108']]);
dosCaches.api.versionShell(function (v) {
  ok(v === versionBase + '.108', 'con dos caches vivos gana el numero MAS ALTO, no el primero: ' + v);
});
var dosCachesAlReves = correrVersion([['ga-pwa-v108', 'ga-pwa-v107']]);
dosCachesAlReves.api.versionShell(function (v) {
  ok(v === versionBase + '.108', 'y da lo mismo en cualquier orden (no depende de la creacion): ' + v);
});
// Un cache de otra app en el medio no puede confundir la eleccion.
correrVersion([['otra-app-v999', 'ga-pwa-v108']]).api.versionShell(function (v) {
  ok(v === versionBase + '.108', 'un cache ajeno con numero mas alto no se elige: ' + v);
});

// El badge NO se cachea: el segundo poll refleja el cache nuevo.
var enDosTiempos = correrVersion([[], ['ga-pwa-v108']]);
enDosTiempos.api.pintarVersion();
ok(enDosTiempos.badge.textContent === versionBase,
  'primer poll, sin cache todavia: ' + enDosTiempos.badge.textContent);
enDosTiempos.api.pintarVersion();
ok(enDosTiempos.badge.textContent === versionBase + '.108',
  'y el segundo poll YA muestra la publicacion, no queda clavado en la base: ' + enDosTiempos.badge.textContent);
ok(!/_versionPintada/.test(vistasSrcV),
  'no queda ningun cacheo del badge (era lo que lo dejaba clavado y lo que desincronizaba menu y Diagnostico)');

// ============ Auditoria del 23/08/2026 ============
console.log('\nZ2) lo que la auditoria encontro a medias en los once cambios del dia');

var analisisSrc = fsA.readFileSync(pathA.join(ruta.RUTA, 'js', 'analisis.js'), 'utf8');
var graficosSrc2 = fsA.readFileSync(pathA.join(ruta.RUTA, 'js', 'graficos.js'), 'utf8');
var arranqueSrc2 = fsA.readFileSync(pathA.join(ruta.RUTA, 'js', 'seguridad.js'), 'utf8');

// 1) [DADOS VUELTA el 26/08/2026] El desglose vivia en la tarjeta con su
//    toggle y su estado externo (anaDesgAbierto). Con el analisis por perfil
//    el detalle se mudo a la pagina Analysis y alli el desglose va SIEMPRE
//    abierto: sin toggle no hay estado que se pierda al repintar. Estos
//    asserts fijan que el mecanismo viejo no vuelva a medias — si alguien
//    repone el toggle, tiene que reponer tambien la leccion del estado
//    externo (auditoria del 23/08/2026).
ok(!/anaDesgAbierto/.test(analisisSrc),
  'el estado abierto/cerrado del desglose se fue junto con el toggle de la tarjeta');
ok(/anadesglose">' \+ anaDesgloseHtml\(r\)/.test(analisisSrc),
  'la pagina Analysis pinta el desglose directo, siempre abierto: no hay estado que se pierda');
ok(!/pintarDesglose/.test(analisisSrc),
  'tampoco queda el mecanismo de abrir/cerrar (si vuelve, que vuelva con su estado externo)');

// 2) El puntaje era el unico dato del backend que se interpolaba crudo.
ok(/var pj = Number\(r\.puntaje\) \|\| 0;/.test(analisisSrc),
  'el puntaje se normaliza a numero antes de escribirlo en el html');
ok(analisisSrc.indexOf('(r.puntaje || 0)') === -1,
  'y no queda ninguna interpolacion cruda de r.puntaje');

// 3) La etiqueta del periodo se escribe ANTES de las salidas tempranas: con el
//    selector escondido es lo unico que dice que periodo rige.
ok(/function updateRangePct\(\)[\s\S]{0,800}rangeNombre[\s\S]{0,300}if \(!serie\.length/.test(graficosSrc2),
  'la etiqueta del periodo se escribe antes de cualquier return: no queda pegada la anterior');

// 4) La bandera del intento automatico de biometria.
ok(/'ga_bio_auto'\].concat\(GA_CACHES\)|ga_bio_auto'\]/.test(arranqueSrc2),
  'ga_bio_auto se borra con el borrado de emergencia');
ok(/Date\.now\(\) - t0\) < 1000/.test(arranqueSrc2),
  'solo un rechazo INMEDIATO apaga el automatico: una cancelacion humana tarda segundos y no lo apaga');

// 5) El aviso de "no se pudo dibujar" tiene que ir donde se VE: la caja del
//    grafico arranca plegada desde la v92.
var arranqueJs = fsA.readFileSync(pathA.join(ruta.RUTA, 'js', 'arranque.js'), 'utf8');
ok(!/querySelector\('\.chartbox'\)/.test(arranqueJs),
  'el aviso del grafico ya no se escribe en la caja plegada (era invisible)');
ok(/getElementById\('evoMini'\)[\s\S]{0,120}Could not draw/.test(arranqueJs),
  'va a la mini grafica, que es lo que esta a la vista');

// 6) Codigo muerto de los puntos por valor (se sacaron en la v101).
ok(html.indexOf('.spark circle') === -1, 'no quedo CSS de los circulos que se sacaron');
ok(html.indexOf('.totalpct {') === -1, 'ni la clase .totalpct, que quedo sin usuarios en la v102');
// M) El pie del Inicio: fuera "Account detail", entran las noticias del mundo.
//
// Pedido de Guzman (02/09/2026): "para mi esa info no va ahi, capaz noticias
// geopoliticas mas importantes". Los asserts de lo que se saco van DADOS
// VUELTA, asi nadie lo repone sin querer.
var vistasSrcM = require('fs').readFileSync(require('path').join(ruta.RUTA, 'js', 'vistas.js'), 'utf8');
var arranqueSrcM = require('fs').readFileSync(require('path').join(ruta.RUTA, 'js', 'arranque.js'), 'utf8');
// Se busca el MARCADO, no la palabra: el comentario que explica por que se
// saco la nombra, y un assert sobre el texto pelado se tropieza con su propia
// explicacion.
ok(html.indexOf('<h2>Account detail</h2>') === -1, 'la tarjeta "Account detail" ya no esta en el Inicio');

// N) La cabecera oculta del Inicio NO puede alcanzar a las otras dos tablas.
//
// La auditoría del 02/09/2026 la cazó ROTA: la regla se escribió sobre
// `.holdtable`, y esa clase la comparten TRES tablas — el Inicio, la página
// Positions (Instr/Buy/Price/Value) y la de indicadores de la IA
// (Indicator/Value/Reading). Medido: el thead de Positions pasaba de 40px a 0.
// El argumento de Guzmán ("está recontra sobreentendido") vale para símbolo,
// curva y precio; NO para cuatro columnas de números.
var usanHoldtable = (html.match(/class="holdtable/g) || []).length;
ok(usanHoldtable >= 3, '.holdtable la comparten varias tablas (' + usanHoldtable + '): por eso la regla va acotada');
ok(!/^\.holdtable thead th \{/m.test(html),
  'la regla NO se escribe sobre .holdtable, que las alcanzaria a todas');
ok(/\.holdhome thead th \{/.test(html), 'va sobre .holdhome, la clase propia del Inicio');
ok(/<table class="holdtable holdhome">/.test(html), 'y solo la tabla del Inicio la lleva');
// Las otras dos conservan su cabecera: se verifica que NO tengan la clase.
ok(!/<table class="holdtable postable[^"]*holdhome/.test(html), 'Positions NO la lleva: sus columnas no son obvias');
var iaSrc = require('fs').readFileSync(require('path').join(ruta.RUTA, 'js', 'ia.js'), 'utf8');
ok(iaSrc.indexOf('holdhome') === -1, 'la tabla de la IA tampoco');

// Ñ) La leyenda de Portfolio se apila en el teléfono.
//
// El monto entró ahí al sacar "Account detail" del Inicio, y en una sola línea
// no entra: `.lname` cede con ellipsis y `.lpct` es nowrap e irreducible.
// Medido a 393px (el teléfono de Guzmán): "Interactive Brokers" quedaba con
// 31px de los 128 que necesita. Agrava que esa leyenda es AHORA el único
// camino para abrir cada cuenta. Con la fila apilada: 177px, sin truncar.
//
// ALCANCE: mira la regla escrita, no el resultado — el arnés no tiene navegador.
ok(/\.pierow \{ flex-direction: column/.test(html.replace(/\s+/g, ' ')),
  'en pantalla angosta la fila de la leyenda se apila');
ok(/\.pierow \.lname \{[^}]*white-space: normal/.test(html),
  'y el nombre deja de truncarse: envuelve en vez de cortarse');
ok(html.indexOf('id="cuentasList"') === -1, 'ni su nodo');
ok(arranqueSrcM.indexOf('cuentasList') === -1, 'ni el codigo que la pintaba, que si no explotaria al arrancar');
// El valor por cuenta NO se perdio: era el UNICO lugar donde se veia, y paso a
// la leyenda de la torta, que ya era el otro camino para abrir cada cuenta.
ok(/lpct"><b>' \+ esc\(fmt\(c\.valor\)\)/.test(vistasSrcM),
  'el monto por cuenta vive ahora en la leyenda de Portfolio');
ok(/showAccount\(c\.acc, 'portafolio'\)/.test(vistasSrcM),
  'y desde ahi se siguen abriendo las cuentas: sacar la tarjeta no dejo huerfanas las paginas');
// La tarjeta nueva.
ok(/id="macroCard"[^>]*style="display:none"/.test(html),
  'la tarjeta del mundo nace ESCONDIDA: sin titulares no se muestra un titulo con un hueco');
ok(html.indexOf('id="macroList"') !== -1, 'y tiene donde pintar los titulares');
// Una sola peticion para las dos pantallas: este pedido lee los feeds de seis
// medios y es de los caros.
var pedidos = (vistasSrcM.match(/\.getNoticias\(\)/g) || []).length;
ok(pedidos === 1, 'las noticias se piden en UN solo lugar (' + pedidos + ')');
ok(/function pedirNoticias\(\)[\s\S]{0,400}renderMacroInicio/.test(vistasSrcM),
  'y esa unica peticion alimenta tambien la tarjeta del Inicio');
ok(/setTimeout\(pedirNoticias/.test(arranqueSrcM),
  'se pide DESPUES de pintar: no puede competir con el payload del arranque');

ok(graficosSrc2.indexOf('El umbral se cuenta en PUNTOS') === -1,
  'ni el comentario que describia el umbral borrado (contradecia al de abajo)');
ok(graficosSrc2.indexOf('de 305px de ancho a 87') === -1,
  'y el ancho del dibujo dice 100, que es el que esta en el codigo (el 87 no existio nunca)');

// 7) .rangepct la comparten Dividendos, Aportes y el modal: el tamano grande es
//    solo el de la fila del total.
ok(/\.totalrow \.rangepct \{[^}]*font-size: 15px/.test(html),
  'el tamano grande esta acotado a la fila del total');
ok(/^\.rangepct \{[^}]*font-size: 13px/m.test(html),
  'y el ano de Dividendos/Aportes vuelve a su tamano, que no compite con su titulo');

// 8) La celda del % puede encoger: en 2A/5A el texto llega a "+245,67% ·
//    +31,2% anual" y con flex-shrink 0 empujaba la fila fuera de la tarjeta.
ok(/\.totalrow \.tr-pct \{ flex: 0 1 auto;/.test(html),
  'la celda del % cede ancho en vez de desbordar');

// 8a) Y queda pegada al borde DERECHO aunque el dibujo desaparezca.
//
// ALCANCE DE ESTE ASSERT: mira la regla escrita, NO el resultado. El arnes no
// tiene navegador y no puede medir un hueco.
//
// Al desplegar el grafico, pintarBotonEvo esconde .evomini — el UNICO hijo
// con flex-grow de la fila. Sin margin-left:auto, ni .tr-val ni .tr-pct
// crecen: las dos se amontonan a la izquierda y el porcentaje queda colgado
// en el medio con 67px muertos a la derecha (medido a 375px el 02/09/2026,
// reporte de Guzman con captura). Tampoco daba desborde horizontal, asi que
// la prueba obvia habria dado verde con la pantalla rota — la misma trampa
// que ya esta anotada dos veces en este archivo.
ok(/\.totalrow \.tr-pct \{[^}]*margin-left: auto/.test(html),
  'el % se ancla a la derecha aunque .evomini se esconda al abrir el grafico');

// 8b) La celda del NUMERO, al reves: NO puede encoger.
//
// OJO CON EL ALCANCE DE ESTE ASSERT: mira la regla escrita, no el resultado.
// Sin navegador no hay forma de medir un solape aca, y una regla correcta no
// garantiza que nada tape al dibujo por otro camino. La medicion de verdad se
// hizo en un navegador de verdad el 25/08/2026 (Chrome, 320/375/393px, con el
// index.html real y Manrope cargada) y quedo en HISTORIAL.md con los numeros.
// Esto es solo el candado contra reponer el `min-width: 0` sin querer.
//
// Por que importa: `.total` es `white-space: nowrap`, asi que si su celda puede
// encoger, el numero NO se achica — se DERRAMA sobre el mini-grafico de al lado.
// Medido antes del arreglo: 22px tapados a 375px y 38px a 320px con un total de
// siete cifras, y a 320px la etiqueta "Valor total" se partia en dos renglones.
// Nada de eso producia desborde horizontal de la pagina, que era lo unico que
// se habia medido: la medicion daba verde midiendo la propiedad equivocada.
ok(/\.totalrow \.tr-val \{ flex: 0 0 auto; \}/.test(html),
  'la celda del numero NO cede ancho: el numero no se derrama sobre el dibujo');
ok(!/\.totalrow \.tr-val \{[^}]*min-width: 0/.test(html),
  'y no vuelve el min-width:0, que es lo que la dejaba encoger por debajo de su contenido');
// El que cede es el dibujo, y tiene piso: si el piso sube, a 320px la fila se
// pasa de ancho y el % de la derecha queda recortado.
ok(/\.evomini \{[^}]*min-width: 40px/.test(html),
  'el que cede ancho es el mini-grafico, con piso de 40px');

// 9) img-src: la app no carga ni una imagen de afuera.
ok(/img-src 'self' data:/.test(csp),
  'img-src arranca por lo propio y los datos embebidos (los hosts permitidos se verifican en C3)');

// 10) Los avisos del resumen llegan a la pantalla de Diagnostico.
var configSrc = fsA.readFileSync(pathA.join(ruta.RUTA, 'js', 'config.js'), 'utf8');
ok(/avisosResumen/.test(configSrc), 'el Diagnostico muestra los avisos de la hoja resumen');
ok(/esc\(a\)/.test(configSrc), 'y los escapa, como todo lo que viene del backend');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
