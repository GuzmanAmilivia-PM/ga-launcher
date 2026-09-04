// Los arneses viven en test/ de ESTE repo desde el 4/09/2026 (antes, en
// scripts/ui/ del repo historico ga-portfolio-tracker: habia que clonar el
// ex-backend para probar la app). RUTA es la raiz del repo; GA_LAUNCHER la
// pisa si alguna vez hace falta apuntar a otro clon.
var fs = require('fs');
var path = require('path');

var RUTA = process.env.GA_LAUNCHER || path.join(__dirname, '..');
var INDEX = path.join(RUTA, 'index.html');

function leerIndex() {
  if (!fs.existsSync(INDEX)) {
    console.error('No encuentro ' + INDEX + '.');
    console.error('Cloná el repo ga-launcher o apuntá la variable GA_LAUNCHER a donde esté.');
    process.exit(1);
  }
  var html = fs.readFileSync(INDEX, 'utf8');
  // Desde el 16/08/2026 el codigo vive en js/*.js (scripts clasicos que el
  // index carga en orden). Para los arneses se devuelve todo concatenado EN
  // ESE MISMO ORDEN, asi los marcadores de bloque se siguen encontrando y el
  // texto se comporta como el archivo unico de antes.
  var dirJs = path.join(RUTA, 'js');
  if (fs.existsSync(dirJs)) {
    var orden = [];
    var re = /<script src="\.\/(js\/[\w-]+\.js)"><\/script>/g, m;
    while ((m = re.exec(html)) !== null) orden.push(m[1]);
    if (!orden.length) {
      console.error('index.html no carga ningun js/*.js: ¿cambio el formato de los <script src>?');
      process.exit(1);
    }
    html += '\n' + orden.map(function (f) {
      return fs.readFileSync(path.join(RUTA, f), 'utf8');
    }).join('\n');
  }
  return html;
}

/**
 * Extrae un bloque del index.html entre dos marcadores de comentario.
 * Los arneses evalúan solo el trozo que les toca, así que si alguien renombra
 * un encabezado `// ---------- X ----------` el test avisa en vez de pasar
 * probando nada.
 */
function bloque(html, desde, hasta) {
  var i = html.indexOf(desde);
  var f = html.indexOf(hasta);
  if (i < 0 || f < 0 || f < i) {
    console.error('No se encontró el bloque entre:\n  ' + desde + '\n  ' + hasta);
    console.error('¿Se renombró alguno de esos comentarios en index.html?');
    process.exit(1);
  }
  return html.slice(i, f);
}

module.exports = { RUTA: RUTA, INDEX: INDEX, leerIndex: leerIndex, bloque: bloque };
