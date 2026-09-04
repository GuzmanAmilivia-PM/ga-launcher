// Saca la patita del MEDIO de la E del logo nuevo.
// El logo esta girado 45°, asi que se trabaja en los ejes de la letra:
//   X = (x - y)/raiz2   (a lo largo del asta de la E)
//   Y = (x + y)/raiz2   (a lo largo de las patitas)
// Medido sobre el archivo original (pixeles del trazo, no a ojo):
//   patitas a la altura Y=1040 -> X [-189,-125] [9,73] [160,226]
//   el asta termina en Y=1001
// Entonces la del medio es el rectangulo X [9,73] x Y [1002, fin], con unos
// pixeles de margen para llevarse el antialiasing del borde.
var L = require('./logo.js');
var ORIGEN = process.argv[2];
var SALIDA = process.argv[3] || 'Logo-editado.png';
var R2 = Math.SQRT2;
var X_DESDE = 5, X_HASTA = 77, Y_DESDE = 1002, Y_HASTA = 1100;

var im = L.leerPNG(ORIGEN);
var borrados = 0;
for (var y = 0; y < im.H; y++) {
  for (var x = 0; x < im.W; x++) {
    var X = (x - y) / R2, Y = (x + y) / R2;
    if (X < X_DESDE || X > X_HASTA || Y < Y_DESDE || Y > Y_HASTA) continue;
    var o = (y * im.W + x) * 4;
    if (im.px[o] - im.px[o + 2] > 20) borrados++;
    im.px[o] = 0; im.px[o + 1] = 0; im.px[o + 2] = 0; im.px[o + 3] = 255;
  }
}
L.escribirPNG(im, SALIDA);

// verificacion: a la altura de las patitas tienen que quedar DOS tramos
function oro(X, Y) {
  var x = Math.round((X + Y) / R2), y = Math.round((Y - X) / R2);
  if (x < 0 || y < 0 || x >= im.W || y >= im.H) return false;
  var o = (y * im.W + x) * 4;
  return (im.px[o] - im.px[o + 2]) > 90;
}
function tramosX(Y) {
  var res = [], dentro = false, ini = 0;
  for (var X = -250; X <= 300; X++) {
    var g = oro(X, Y);
    if (g && !dentro) { dentro = true; ini = X; }
    else if (!g && dentro) { dentro = false; res.push([ini, X - 1]); }
  }
  if (dentro) res.push([ini, 300]);
  return res;
}
console.log('pixeles dorados borrados: ' + borrados);
console.log('patitas ahora (Y=1040): ' + JSON.stringify(tramosX(1040)));
console.log('asta intacta (Y=970):   ' + JSON.stringify(tramosX(970)));
console.log('justo debajo del asta (Y=1005): ' + JSON.stringify(tramosX(1005)));
