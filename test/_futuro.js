// Los arneses, otra vez, como si fuera dentro de N días (23/09/2026).
//
//   node test/_futuro.js            # dentro de 100 días (lo que corre npm test)
//   node test/_futuro.js 45 200 400 # varias fechas
//
// Dos arneses pasaban hoy y se rompían solos en el cambio de año (el del YTD
// único, entre el 1/01 y el 1/03 de CADA año). Corrida con el reloj
// adelantado, la suite avisa con meses de margen; el arnés que falle acá
// tiene que fijar su reloj (test/_reloj.js).
var cp = require('child_process');
var path = require('path');
var url = require('url');

var precarga = url.pathToFileURL(path.join(__dirname, '_reloj-adelantado.mjs')).href;
var dias = process.argv.slice(2).map(Number).filter(function (n) { return n > 0; });
var fallo = false;
(dias.length ? dias : [100]).forEach(function (d) {
  var fecha = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  var r = cp.spawnSync(process.execPath, [path.join(__dirname, 'run.js')], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { RELOJ_DIAS: String(d), NODE_OPTIONS: ((process.env.NODE_OPTIONS || '') + ' --import ' + precarga).trim() })
  });
  var salida = (r.stdout || '') + (r.stderr || '');
  var resumen = (salida.match(/=====[^\n]*=====/) || ['(sin resumen)'])[0];
  var rotos = salida.split('\n').filter(function (l) { return /^\s+(FAIL|ROTO)\s/.test(l); });
  if (r.status !== 0 || rotos.length) {
    fallo = true;
    console.log('Con el reloj en ' + fecha + ' (dentro de ' + d + ' días): ' + resumen + '\n' + rotos.join('\n'));
  } else {
    console.log('Con el reloj en ' + fecha + ' (dentro de ' + d + ' días): ' + resumen);
  }
});
process.exit(fallo ? 1 : 0);
