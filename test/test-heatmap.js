// Arnés de D10 (1/09/2026), DADO VUELTA el 23/09/2026.
//
// D10 era la grilla "Month by month" de la pagina Analysis: los retornos mes
// a mes netos de aportes, con (fin − aportes) / inicio. Convivia con el mapa
// de calor de Portfolio, que NO los restaba: la app mostraba dos grillas mes a
// mes que se contradecian (junio −0,81 % en una y +0,56 % en la otra). Quedo
// UNA: el mapa de calor de Portfolio, ahora sin depositos y con LA cuenta de
// la app (_twrCadena). Los casos con numeros reales que custodiaba este arnes
// se mudaron a test-mapacalor.js, contra la grilla que quedo.
//
// Regla de la casa: al sacar una funcion, sus asserts no se borran, se dan
// vuelta. Estos verifican que la segunda grilla no vuelva sin querer.
var fs = require('fs');
var path = require('path');
var ruta = require('./_ruta');
var html = ruta.leerIndex();

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

var analisis = fs.readFileSync(path.join(ruta.RUTA, 'js', 'analisis.js'), 'utf8');
var css = fs.readFileSync(path.join(ruta.RUTA, 'css', 'estilos.css'), 'utf8');

console.log('\nA) la segunda grilla mes a mes no existe');
ok(!/function retornosMensuales\(/.test(html), 'retornosMensuales (la otra cuenta de "sin depositos") no esta');
ok(!/function anaHeatmapHtml\(/.test(html), 'anaHeatmapHtml (la grilla de Analysis) no esta');
ok(analisis.indexOf('anaHeatmapHtml(') === -1, 'y la pagina Analysis no la llama');
ok(analisis.indexOf('Month by month') === -1, 'ni dibuja un titulo "Month by month"');
ok(!/\.heat\s*\{|\.heatwrap\s*\{/.test(css), 'su CSS se fue con ella');

console.log('\nB) la grilla que queda es la de Portfolio, sin depositos');
ok(/function mapaCalorMensual\(serie\)/.test(html), 'el mapa de calor de Portfolio sigue');
var calor = fs.readFileSync(path.join(ruta.RUTA, 'js', 'calor.js'), 'utf8');
ok(/_twrCadena\(tramo\)/.test(calor), 'y mide cada mes con _twrCadena: la MISMA cuenta que el "pp vs S&P" y la tarjeta del año');
ok(/if \(!aportesCargados\)/.test(calor), 'y sin la lista de aportes no se dibuja (los crudos mentirian)');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
