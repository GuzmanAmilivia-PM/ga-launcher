// El ritual del bump, como funcion (9/10/2026, auditoria). Lo usa test-html
// (seccion I) sobre este repo, y test-bump sobre repos de mentira para
// probar al propio guardian.
//
// Que custodia: si cambio el cascaron (index.html, js/*.js, css/*.css), CACHE
// de sw.js tiene que subir. Hasta el 9/10/2026 miraba SOLO el ultimo commit
// (`git show HEAD`), y `npm test` se corre ANTES de commitear: un cambio sin
// bump pasaba en verde, se commiteaba y se publicaba, y como el cascaron es
// cache-first el telefono no lo bajaba nunca. La suite recien se ponia roja en
// la corrida siguiente, con el cambio ya afuera — paso con el PIN con sal
// (b1c5fd0, arreglado 2 h despues en f1a01ba). Ahora mira primero lo que
// todavia no se commiteo; con eso limpio, el ultimo commit, como siempre.
var fs = require('fs');
var path = require('path');
var cp = require('child_process');

function esCascaron(f) {
  return f === 'index.html' || /^js\/[\w-]+\.js$/.test(f) || /^css\/[\w-]+\.css$/.test(f);
}
function numero(sw) {
  var m = String(sw || '').match(/var CACHE = 'ga-pwa-v(\d+)'/);
  return m ? Number(m[1]) : undefined;
}
function lineas(s) {
  return String(s || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
}

/**
 * Devuelve null si no hay git en `raiz` (el arnes se saltea con aviso), o la
 * lista de chequeos [{ok, msg}].
 */
function revisarBump(raiz) {
  function git(args) {
    try { return cp.execFileSync('git', args, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch (e) { return null; }
  }
  if (git(['rev-parse', '--verify', 'HEAD']) === null) return null;
  var vAhora = numero(fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8'));
  var out = [];

  // 1) Lo que todavia no se commiteo: modificado (en el indice o no) y
  //    archivos nuevos que git todavia no conoce.
  var pendientes = lineas(git(['diff', '--name-only', 'HEAD']))
    .concat(lineas(git(['ls-files', '--others', '--exclude-standard'])))
    .filter(esCascaron);
  if (pendientes.length) {
    var vHead = numero(git(['show', 'HEAD:sw.js']));
    out.push({
      ok: vHead === undefined || (vAhora !== undefined && vAhora > vHead),
      msg: 'hay cambios SIN commitear en ' + pendientes.join(', ') +
        ': CACHE de sw.js tiene que subir respecto del ultimo commit (v' + vHead + ' -> v' + vAhora + ')'
    });
    return out;
  }

  // 2) Arbol limpio en el cascaron: el ultimo commit, como antes.
  var lista = lineas(git(['show', '--name-only', '--pretty=format:', 'HEAD']));
  var cambiaron = lista.filter(esCascaron);
  var subioSw = lista.indexOf('sw.js') !== -1;
  out.push({
    ok: cambiaron.length === 0 || subioSw,
    msg: 'el ultimo commit toco ' + (cambiaron.join(', ') || 'nada del cascaron') +
      (cambiaron.length ? ' y por eso TIENE que tocar sw.js' : '')
  });
  if (cambiaron.length) {
    var swAnterior = git(['show', 'HEAD~1:sw.js']);
    if (swAnterior) {
      var vAnterior = numero(swAnterior);
      var vCommit = numero(git(['show', 'HEAD:sw.js']));
      out.push({
        ok: vAnterior === undefined || (vCommit !== undefined && vCommit > vAnterior),
        msg: 'y el numero SUBIO: v' + vAnterior + ' -> ga-pwa-v' + vCommit
      });
    }
  }
  return out;
}

module.exports = { revisarBump: revisarBump, esCascaron: esCascaron };
