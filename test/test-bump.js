// El guardian del bump, probado con repos de mentira (9/10/2026, auditoria).
//
// test-html (seccion I) exige que CACHE de sw.js suba cuando cambia el
// cascaron. Hasta hoy miraba solo el ultimo commit, y `npm test` corre ANTES
// de commitear: un cambio sin bump pasaba en verde y salia publicado (asi
// salio el PIN con sal, b1c5fd0). Aca se arma un repo de git de juguete en la
// carpeta temporal, se lo pone en cada situacion y se le pregunta a
// revisarBump (_bump.js, lo mismo que corre test-html) que opina.
var fs = require('fs');
var os = require('os');
var path = require('path');
var cp = require('child_process');
var revisarBump = require('./_bump').revisarBump;

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

var hayGit = true;
try { cp.execFileSync('git', ['--version'], { stdio: 'ignore' }); } catch (e) { hayGit = false; }
if (!hayGit) {
  console.log('  (sin git en esta maquina: me salteo el guardian del bump)');
  console.log('\n0 asserts, 0 fallas');
  process.exit(0);
}

var dirs = [];
function repo() {
  var d = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-bump-'));
  dirs.push(d);
  function git() {
    var args = ['-c', 'core.autocrlf=false', '-c', 'user.name=arnes', '-c', 'user.email=arnes@example.invalid'].concat([].slice.call(arguments));
    return cp.execFileSync('git', args, { cwd: d, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  }
  function escribir(f, txt) { fs.mkdirSync(path.join(d, path.dirname(f)), { recursive: true }); fs.writeFileSync(path.join(d, f), txt); }
  function sw(n) { escribir('sw.js', "var CACHE = 'ga-pwa-v" + n + "';\n"); }
  git('init', '-q');
  sw(10); escribir('js/a.js', 'var a = 1;\n'); escribir('index.html', '<p>hola</p>\n'); escribir('test/t.js', '// t\n');
  git('add', '-A'); git('commit', '-q', '-m', 'v10');
  return { dir: d, git: git, escribir: escribir, sw: sw, commit: function (m) { git('add', '-A'); git('commit', '-q', '-m', m); } };
}
function todoBien(r) { return r && r.length && r.every(function (c) { return c.ok; }); }
function textos(r) { return (r || []).map(function (c) { return (c.ok ? 'ok: ' : 'MAL: ') + c.msg; }).join(' | '); }

try {
  console.log('\nA) lo que todavia no se commiteo');
  var r = repo();
  ok(todoBien(revisarBump(r.dir)), 'recien commiteado y con la version subida: bien');
  r.escribir('js/a.js', 'var a = 2;\n');
  var res = revisarBump(r.dir);
  ok(!todoBien(res) && /SIN commitear en js\/a\.js/.test(textos(res)), 'un js cambiado SIN subir CACHE se pone rojo ANTES del commit: ' + textos(res));
  r.sw(11);
  ok(todoBien(revisarBump(r.dir)), 'con CACHE subido (sin commitear) pasa: ' + textos(revisarBump(r.dir)));
  r.sw(9);
  ok(!todoBien(revisarBump(r.dir)), 'una version MENOR no cuenta como bump');
  r.sw(10);
  r.git('add', 'js/a.js');
  ok(!todoBien(revisarBump(r.dir)), 'en el indice (staged) tambien cuenta');
  r = repo();
  r.escribir('js/nuevo.js', 'var n = 1;\n');
  ok(!todoBien(revisarBump(r.dir)) && /js\/nuevo\.js/.test(textos(revisarBump(r.dir))), 'un archivo nuevo del cascaron, todavia sin agregar a git, tambien');
  r = repo();
  r.escribir('css/estilos.css', 'body{}\n');
  ok(!todoBien(revisarBump(r.dir)), 'y el CSS');
  r = repo();
  r.escribir('test/t.js', '// otro\n');
  ok(todoBien(revisarBump(r.dir)), 'un cambio que no es del cascaron (una prueba) no pide bump');

  console.log('\nB) con el arbol limpio, el ultimo commit (como siempre)');
  r = repo();
  r.escribir('index.html', '<p>chau</p>\n'); r.commit('sin bump');
  res = revisarBump(r.dir);
  ok(!todoBien(res) && /ultimo commit toco index\.html/.test(textos(res)), 'un commit del cascaron sin tocar sw.js: rojo: ' + textos(res));
  r = repo();
  r.escribir('js/a.js', 'var a = 3;\n'); r.sw(11); r.commit('v11');
  ok(todoBien(revisarBump(r.dir)), 'con el bump en el mismo commit: bien: ' + textos(revisarBump(r.dir)));
  r = repo();
  r.escribir('js/a.js', 'var a = 3;\n'); r.escribir('sw.js', "var CACHE = 'ga-pwa-v10';\n// solo un comentario\n"); r.commit('toca sw sin subir');
  ok(!todoBien(revisarBump(r.dir)), 'tocar sw.js sin subir el numero no alcanza');

  console.log('\nC) sin git');
  var sinGit = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-bump-'));
  dirs.push(sinGit);
  fs.writeFileSync(path.join(sinGit, 'sw.js'), "var CACHE = 'ga-pwa-v1';\n");
  ok(revisarBump(sinGit) === null, 'devuelve null (el arnes se saltea con aviso)');
} finally {
  dirs.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} });
}

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
