// El candado antes de publicar (28/10/2026).
//
// GitHub Pages publica la app con cada push a main y no corre nada: v244 salio
// con esta suite en rojo. El hook .githooks/pre-push corre `npm test` antes de
// subir a main, pero git solo lo usa si el clon tiene
// core.hooksPath=.githooks, y eso es configuracion local que no viaja con el
// repo. Este arnes es el que se pone rojo si un clon nuevo (o una worktree de
// otro clon) quedo sin el candado. Arreglo:  git config core.hooksPath .githooks
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
  try { return cp.execFileSync('git', args, { cwd: ruta.RUTA, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch (e) { return null; }
}

var hook = path.join(ruta.RUTA, '.githooks', 'pre-push');

console.log('\nA) el hook existe y este clon lo usa');
ok(fs.existsSync(hook), '.githooks/pre-push existe');
var hooksPath = git(['config', '--get', 'core.hooksPath']);
if (hooksPath === null && git(['rev-parse', '--git-dir']) === null) {
  console.log('  (no es un clon de git: no hay push que cuidar)');
} else if (process.env.GITHUB_ACTIONS) {
  // El workflow del Worker baja este repo solo para correr la suite: desde
  // ahi nadie sube nada.
  console.log('  (en GitHub Actions: no hay push que cuidar)');
} else {
  ok(hooksPath === '.githooks', 'core.hooksPath = .githooks (hoy: ' + (hooksPath || 'sin configurar') +
    ') — arreglo: git config core.hooksPath .githooks');
}

console.log('\nB) solo frena lo que va a main');
var src = fs.existsSync(hook) ? fs.readFileSync(hook, 'utf8') : '';
ok(/refs\/heads\/main/.test(src), 'mira si el destino es refs/heads/main');
ok(/npm test/.test(src) && /exit 1/.test(src), 'corre npm test y corta con exit 1 si falla');
// Un push a otra rama sale al toque, sin correr la suite (si la corriera, este
// arnes se llamaria a si mismo).
var r = cp.spawnSync('sh', [hook], { cwd: ruta.RUTA, input: 'refs/heads/x abc refs/heads/prueba def\n', encoding: 'utf8' });
if (r.error) console.log('  (sin sh en esta maquina: no se ejecuta el hook)');
else ok(r.status === 0 && !/npm test/.test(r.stdout || ''), 'un push a otra rama no corre la suite y pasa');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
