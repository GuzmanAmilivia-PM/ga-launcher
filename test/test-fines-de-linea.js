// Los fines de linea (9/10/2026, auditoria).
//
// El git de Windows de esta PC trae core.autocrlf=true en la configuracion
// del sistema: sin .gitattributes, cualquier checkout, pull o restore
// escribia los archivos en CRLF, y con CRLF nueve arneses se ponian rojos sin
// que cambiara una linea de codigo (1943 asserts, 13 fallas, 5 rotos, medido
// en una copia). La auditoria lo encontro tambien al revisar mutaciones: las
// de varias lineas "no entraban". Aca se le pregunta a git que fin de linea
// va a escribir (no se lee el .gitattributes con una regex) y se mira que el
// arbol de trabajo este de verdad en LF.
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
function git(args) {
  try { return cp.execFileSync('git', args, { cwd: ruta.RUTA, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch (e) { return null; }
}

console.log('\nA) git escribe LF aunque core.autocrlf diga otra cosa');
var muestra = ['js/paneles.js', 'index.html', 'css/estilos.css', 'sw.js', 'test/run.js', 'test/_ruta.js'];
var attrs = git(['-c', 'core.autocrlf=true', 'check-attr', 'eol', 'text', '--'].concat(muestra));
if (attrs === null) {
  console.log('  (sin git en ' + ruta.RUTA + ': me salteo el chequeo de atributos)');
} else {
  muestra.forEach(function (f) {
    ok(new RegExp('^' + f.replace(/[.]/g, '\\.') + ': eol: lf$', 'm').test(attrs), f + ' sale con eol=lf');
  });
  var bin = git(['check-attr', 'text', '--', 'icon-512.png', 'fonts/manrope.woff2']) || '';
  ok(!/: text: set$/m.test(bin), 'los binarios no se tocan (text=auto los detecta): ' + bin.trim().replace(/\n/g, ' | '));
}

console.log('\nB) el arbol de trabajo esta en LF');
function recorrer(dir, out) {
  fs.readdirSync(dir).forEach(function (n) {
    if (n === 'node_modules' || n === '.git') return;
    var p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) recorrer(p, out);
    else if (/\.(js|css|html|json|md)$/.test(n)) out.push(p);
  });
  return out;
}
var archivos = recorrer(ruta.RUTA, []);
var conCrlf = archivos.filter(function (p) { return fs.readFileSync(p, 'utf8').indexOf('\r\n') !== -1; })
  .map(function (p) { return path.relative(ruta.RUTA, p); });
ok(archivos.length > 50, 'mire ' + archivos.length + ' archivos de texto');
ok(conCrlf.length === 0, 'ninguno tiene CRLF' + (conCrlf.length ? ': ' + conCrlf.join(', ') : ''));

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
