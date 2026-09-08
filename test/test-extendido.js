// El salto fuera de rueda entre parentesis al lado del % del dia (8/09/2026).
var vm = require('vm');
var ruta = require('./_ruta');
var html = ruta.leerIndex();

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

var src = [
  (html.match(/function signoPct[^\n]*\n/) || [''])[0],
  (html.match(/function pctHtml\(v, dec, extra\) \{[\s\S]*?\n\}/) || [''])[0],
  (html.match(/var SIMBOLOS_CASH = \[[^\]]*\];/) || [''])[0],
  (html.match(/function esFilaCash[\s\S]*?\n\}/) || [''])[0],
  (html.match(/function daychgHtml\(p\) \{[\s\S]*?\n\}/) || [''])[0],
  (html.match(/var EXT_UMBRAL_PCT = [^;]*;/) || [''])[0],
  (html.match(/function extHtml\(p\) \{[\s\S]*?\n\}/) || [''])[0]
].join('\n');
ok(/function extHtml/.test(src) && /function daychgHtml/.test(src) && /extra/.test(src), 'encuentro daychgHtml, extHtml y el pctHtml con extra');

var ctx = { Number: Number, isFinite: isFinite, Math: Math, String: String };
vm.createContext(ctx);
vm.runInContext(src, ctx);

var conSalto = ctx.daychgHtml({ symbol: 'MSFT', cambioDia: -1.21, cambioExt: 2.3, sesionExt: 'post' });
ok(/<span class="daychg down">-1\.21%/.test(conSalto), 'el % de la rueda va primero, con su color');
ok(/<span class="dayext">\(post \+2\.3%\)<\/span><\/span>$/.test(conSalto), 'y el salto del after market entre parentesis, adentro del mismo renglon');
var pre = ctx.daychgHtml({ symbol: 'MSFT', cambioDia: 0.5, cambioExt: -1.8, sesionExt: 'pre' });
ok(/\(pre -1\.8%\)/.test(pre), 'pre market: dice pre');
var chico = ctx.daychgHtml({ symbol: 'MSFT', cambioDia: 0.5, cambioExt: 0.4, sesionExt: 'post' });
ok(chico.indexOf('dayext') === -1, 'un salto de 0,4% no se muestra: no es grande');
var sinDato = ctx.daychgHtml({ symbol: 'MSFT', cambioDia: 0.5, cambioExt: null, sesionExt: null });
ok(sinDato.indexOf('dayext') === -1 && /\+0\.50%/.test(sinDato), 'sin dato fuera de rueda, el % de siempre y nada mas');
ok(ctx.daychgHtml({ symbol: 'MSFT', cambioDia: null }).indexOf('not priced') !== -1, 'sin % del dia sigue diciendo not priced');
ok(/\.dayext \{/.test(html), 'el estilo .dayext existe');

console.log(asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
