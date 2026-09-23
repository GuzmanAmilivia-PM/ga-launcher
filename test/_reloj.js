// El reloj de la historia (23/09/2026). Cada arnés corre en su propio
// proceso (run.js), así que fijar el reloj acá vale para ese arnés entero:
// Date.now() y `new Date()` sin argumentos arrancan en `iso` y siguen
// andando. Existe porque dos arneses armaban sus fechas con el año de HOY y
// se ponían rojos solos en el cambio de año (encontrados corriendo la suite
// con el reloj adelantado: test/_futuro.js). Un arnés que cuenta una historia
// fechada la cuenta en SU fecha, no en la del día que alguien lo corre.
function fijarReloj(iso) {
  var Real = Date;
  var base = Real.parse(iso), arranque = Real.now();
  class DeLaHistoria extends Real {
    constructor(...a) { if (a.length === 0) super(base + (Real.now() - arranque)); else super(...a); }
    static now() { return base + (Real.now() - arranque); }
  }
  DeLaHistoria.UTC = Real.UTC;
  DeLaHistoria.parse = Real.parse;
  global.Date = DeLaHistoria;
}
module.exports = { fijarReloj: fijarReloj };
