// Corre todos los arneses de la PWA (test/test-*.js) y devuelve error si
// alguno falla. Cada arnés extrae un bloque del index.html por marcadores de
// comentario y lo evalúa con un DOM de mentira: no hay jsdom instalado.
//
//   npm test
//
// test-html.js cruza ademas MAP (nucleo.js) contra el API_FNS del Worker:
// necesita el clon de ga-portfolio-worker al lado de este repo, o la
// variable GA_WORKER apuntando a donde este.
var fs = require('fs');
var path = require('path');
var cp = require('child_process');
var ruta = require('./_ruta');

var dir = __dirname;
var archivos = fs.readdirSync(dir)
  .filter(function (f) { return /^test-.*\.js$/.test(f); })
  .sort();

console.log('PWA: ' + ruta.INDEX + '\n');

var totalAsserts = 0, totalFallas = 0, rotos = [];

archivos.forEach(function (f) {
  var r = cp.spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8' });
  var salida = (r.stdout || '') + (r.stderr || '');
  var m = salida.match(/(\d+) asserts, (\d+) fallas/);
  if (!m) {
    rotos.push(f);
    console.log('  ROTO  ' + f);
    console.log(salida.split('\n').slice(-6).map(function (l) { return '        ' + l; }).join('\n'));
    return;
  }
  totalAsserts += Number(m[1]);
  totalFallas += Number(m[2]);
  console.log((Number(m[2]) ? '  FAIL  ' : '  PASS  ') + f + '  (' + m[1] + ' asserts)');
  if (Number(m[2])) {
    console.log(salida.split('\n').filter(function (l) { return /FALLA/.test(l); }).join('\n'));
  }
});

console.log('\n===== ' + totalAsserts + ' asserts, ' + totalFallas + ' fallas' +
  (rotos.length ? ', ' + rotos.length + ' arnés(es) roto(s)' : '') + ' =====');
process.exit((totalFallas || rotos.length) ? 1 : 0);
