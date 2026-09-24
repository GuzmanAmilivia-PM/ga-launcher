// El runner (test/run.js) contra arneses de mentira (24/09/2026).
//
// Auditoria del 23/09/2026 (A18): run.js solo leia la linea "N asserts, M
// fallas" de cada arnes. Uno que la imprimia con 0 fallas y DESPUES
// reventaba —una promesa que falla tarde, un throw despues del resumen—
// pasaba como PASS y la suite quedaba verde con un arnes roto.
var fs = require('fs');
var os = require('os');
var path = require('path');
var cp = require('child_process');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (cond) console.log('  ok   ' + msg);
  else { fallos++; console.log('  FALLA: ' + msg); }
}

function correrCon(arneses) {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-run-'));
  Object.keys(arneses).forEach(function (nombre) { fs.writeFileSync(path.join(dir, nombre), arneses[nombre]); });
  var r = cp.spawnSync(process.execPath, [path.join(__dirname, 'run.js')], {
    encoding: 'utf8', env: Object.assign({}, process.env, { GA_ARNESES: dir })
  });
  fs.rmSync(dir, { recursive: true, force: true });
  return { codigo: r.status, salida: (r.stdout || '') + (r.stderr || '') };
}

var SANO = "console.log('2 asserts, 0 fallas'); process.exit(0);";
var MIENTE = "console.log('1 asserts, 0 fallas'); process.exit(3);";
var FALLA = "console.log('  FALLA: algo'); console.log('3 asserts, 1 fallas'); process.exit(1);";
var MUDO = "process.exit(0);";

console.log('\nA) el runner no le cree a un arnes que dice 0 fallas y sale con error');
var r = correrCon({ 'test-a.js': SANO });
ok(r.codigo === 0 && /PASS\s+test-a\.js/.test(r.salida), 'un arnes sano pasa');
r = correrCon({ 'test-a.js': SANO, 'test-b.js': MIENTE });
ok(r.codigo === 1, 'uno que dice "0 fallas" y sale con codigo 3 hace fallar la suite (codigo ' + r.codigo + ')');
ok(/ROTO\s+test-b\.js/.test(r.salida) && /codigo 3/.test(r.salida), 'y se nombra como roto, con su codigo');

console.log('\nB) lo que ya andaba sigue andando');
r = correrCon({ 'test-c.js': FALLA });
ok(r.codigo === 1 && /FAIL\s+test-c\.js/.test(r.salida), 'una falla declarada hace fallar la suite');
r = correrCon({ 'test-d.js': MUDO });
ok(r.codigo === 1 && /ROTO\s+test-d\.js/.test(r.salida), 'un arnes sin resumen es roto');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
