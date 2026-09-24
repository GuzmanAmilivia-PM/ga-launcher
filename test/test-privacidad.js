// Este repo es PUBLICO (GitHub Pages lo necesita en el plan gratis): lo que se
// escribe aca lo puede leer cualquiera. La auditoria general del 23/09/2026
// (A20) encontro el mail de la cuenta de Cloudflare en un comentario del
// index.html, y montos reales de la cartera en comentarios y pruebas; se
// sacaron el 24/09/2026.
//
// Lo que este arnes puede custodiar sin publicar nada: que no vuelva a entrar
// un MAIL en ningun archivo del repo. Lo que NO puede: los montos reales —
// para buscarlos habria que escribirlos aca, y eso seria publicarlos—. Esa
// parte es una regla escrita (CLAUDE.md del repo de los papeles): los numeros
// de las pruebas y de los comentarios son INVENTADOS.
var fs = require('fs');
var path = require('path');
var cp = require('child_process');
var ruta = require('./_ruta');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

var archivos = [];
try {
  archivos = cp.execSync('git ls-files', { cwd: ruta.RUTA, encoding: 'utf8' }).split('\n')
    .filter(function (f) { return f && /\.(js|mjs|html|css|json|md|txt)$/.test(f); });
} catch (e) {
  // Sin git (una copia suelta): los que carga la app y las pruebas.
  archivos = ['index.html', 'sw.js', 'manifest.json', 'README.md', 'css/estilos.css']
    .concat(fs.readdirSync(path.join(ruta.RUTA, 'js')).map(function (f) { return 'js/' + f; }))
    .concat(fs.readdirSync(path.join(ruta.RUTA, 'test')).map(function (f) { return 'test/' + f; }));
}

console.log('\nA) ningun mail en el repo publico');
// Un mail es algo@dominio.tld. Los iconos "eth@2x.png" no lo son (el dominio
// no termina en un tld de letras despues de un punto con algo antes).
var MAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.(com|net|org|io|uy|dev|app|me|co)\b/;
var conMail = [];
archivos.forEach(function (f) {
  var txt = fs.readFileSync(path.join(ruta.RUTA, f), 'utf8');
  txt.split('\n').forEach(function (l, i) {
    if (MAIL.test(l) && !/noreply@anthropic\.com/.test(l)) conMail.push(f + ':' + (i + 1));
  });
});
ok(archivos.length > 50, 'se revisan todos los archivos del repo (' + archivos.length + ')');
ok(conMail.length === 0, 'ninguno trae un mail' + (conMail.length ? ': ' + conMail.join(', ') : ''));
// Que el detector sirva (no es un assert sobre el repo): con un mail inventado,
// partido en dos para que el barrido no encuentre a este mismo archivo.
ok(MAIL.test('la cuenta alguien@' + 'ejemplo.com') && !MAIL.test('icons/eth@2x.png'), 'el detector reconoce un mail y no confunde un icono');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
