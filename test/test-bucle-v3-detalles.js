// Detalles de la vuelta 3 del bucle de mejora (22/11/2026), carril D.
//
//  A) Allocation: "BTGlast snapshot" salia pegado. La fecha de BTG empieza con
//     un espacio dentro de .lname, que es flex, y ese espacio se pierde: el
//     aire lo pone un margen en .lname .desc.
//  B) "Available to invest": lo invertido (.dispside), cuando baja solo a su
//     renglon, quedaba a la izquierda. margin-left: auto lo deja a la derecha.
//  C) El "$" del grafico del Inicio (20 px de ancho): crece solo el area de
//     toque (::after), acotada a .evocontrols .evorow .modobar y sin tapar al
//     "%" vecino (el hueco entre los dos es de 2 px).
//  D) Ningun texto en español en la interfaz: msgErr(err, 'Algo') -> 'Something'.
//
// ALCANCE: texto del CSS y del codigo, sin navegador. Que se vea bien en la
// pantalla lo mide el verificador.
var fs = require('fs');
var path = require('path');
var ruta = require('./_ruta');

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

var css = fs.readFileSync(path.join(ruta.RUTA, 'css', 'estilos.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
function leerJs(n) { return fs.readFileSync(path.join(ruta.RUTA, 'js', n), 'utf8'); }

// Parser chico: reglas {sel, decl, media} (el mismo de test-bucle-v2-maquetado.js).
function reglas(txt, media) {
  var out = [], i = 0;
  while (i < txt.length) {
    var a = txt.indexOf('{', i);
    if (a < 0) break;
    var sel = txt.slice(i, a).trim();
    if (/^@/.test(sel)) {
      var prof = 1, j = a + 1;
      while (j < txt.length && prof) { if (txt[j] === '{') prof++; else if (txt[j] === '}') prof--; j++; }
      if (/^@media/.test(sel)) out = out.concat(reglas(txt.slice(a + 1, j - 1), sel));
      i = j;
      continue;
    }
    var b = txt.indexOf('}', a);
    out.push({ sel: sel.replace(/\s+/g, ' '), decl: txt.slice(a + 1, b), media: media || null });
    i = b + 1;
  }
  return out;
}
var R = reglas(css);
function decl(regla, prop) {
  var m = regla.decl.match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)'));
  return m ? m[1].trim() : null;
}
function conSelector(sel) {
  return R.filter(function (r) { return r.media === null && r.sel.split(',').some(function (s) { return s.trim() === sel; }); });
}
// Ultimo valor declarado (fuera de @media).
function val(sel, prop) {
  var v = null;
  conSelector(sel).forEach(function (r) { var d = decl(r, prop); if (d !== null) v = d; });
  return v;
}
function px(v) { var m = String(v || '').match(/^(-?\d+(?:\.\d+)?)px$/); return m ? Number(m[1]) : null; }

console.log('\nA) Allocation: la fecha de BTG no se pega al nombre');
var bancos = leerJs('bancos.js'), vistas = leerJs('vistas.js');
var fAsOf = (bancos.match(/function btgAsOfHtml\(\) \{[\s\S]*?\n\}/) || [''])[0];
ok(/<span class="desc">last snapshot /.test(fAsOf), 'la fecha de BTG (btgAsOfHtml) va en un <span class="desc">');
ok(/var asOf = [^\n]*btgAsOfHtml\(\)/.test(vistas) && /<span class="lname">[^\n]*\+ asOf \+ '<\/span>'/.test(vistas),
  'y la leyenda de Allocation (vistas.js) la pone DENTRO de .lname');
var mDesc = val('.lname .desc', 'margin-left');
ok(mDesc !== null && parseFloat(mDesc) > 0, '.lname .desc tiene margen a la izquierda (el espacio de adelante se pierde en un flex): ' + mDesc);
ok(/flex/.test(val('.lname', 'display') || ''), '.lname sigue siendo flex (por eso hace falta el margen)');

console.log('\nB) "Available to invest": lo invertido queda a la derecha aunque baje de renglon');
ok(val('.dispside', 'margin-left') === 'auto', '.dispside { margin-left: auto }: ' + val('.dispside', 'margin-left'));
ok(val('.dispside', 'align-items') === 'flex-end', 'y sus renglones siguen alineados a la derecha');

console.log('\nC) el "$" del grafico del Inicio: mas area de toque sin mover nada');
var SEL = '.evocontrols .evorow .modobar .rangebtn';
ok(val(SEL, 'position') === 'relative', SEL + ' { position: relative } (la capa se ancla al boton)');
ok(val('.rangebtn', 'position') === null && conSelector('.rangebtn::after').length === 0 && conSelector('.modobar .rangebtn::after').length === 0,
  'acotado: ni .rangebtn a secas ni .modobar .rangebtn (los usan la tarjeta de cuenta y el modal grande) tienen la capa');
var capa = conSelector(SEL + '::after');
ok(capa.length === 1, 'hay UNA capa de toque ' + SEL + '::after');
var c = capa[0] || { decl: '' };
ok(decl(c, 'content') === "''" && decl(c, 'position') === 'absolute', 'la capa es content: \'\' y position: absolute');
var top = px(decl(c, 'top')), bot = px(decl(c, 'bottom')), izq = px(decl(c, 'left')), der = px(decl(c, 'right'));
ok(top === -10 && bot === -10, 'crece 10 px arriba y abajo: top ' + top + ', bottom ' + bot);
var gap = px(val('.evocontrols .evorow .modobar', 'gap'));
ok(izq !== null && der !== null && izq <= 0 && der <= 0 && -izq <= 3 && -der <= 3,
  'a los costados crece como mucho 3 px: left ' + izq + ', right ' + der);
ok(gap !== null && -izq - der <= gap, 'y entre las capas del "$" y del "%" no se pisan dentro del hueco de ' + gap + ' px (' + (-izq) + ' + ' + (-der) + ')');
ok(/^6px 6px$/.test(val(SEL, 'padding') || '') && val(SEL, 'font-size') === '12px', 'el boton conserva su tamaño (padding 6px 6px, 12px): nada se mueve');

console.log('\nD) sin texto en español en la interfaz: el contexto de msgErr');
var dirJs = path.join(ruta.RUTA, 'js');
var conAlgo = fs.readdirSync(dirJs).filter(function (f) { return /\.js$/.test(f); }).filter(function (f) {
  return /msgErr\([^)]*,\s*'Algo'\s*\)/.test(fs.readFileSync(path.join(dirJs, f), 'utf8'));
});
ok(conAlgo.length === 0, "ningun msgErr(..., 'Algo') en js/: " + (conAlgo.join(', ') || 'ninguno'));
ok(/msgErr\(err, 'Something'\)/.test(leerJs('nucleo.js')), "la falla por defecto (nucleo.js) dice 'Something'");

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
