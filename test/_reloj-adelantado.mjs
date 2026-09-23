// Precarga de test/_futuro.js: el proceso entero ve la hora de hoy corrida
// RELOJ_DIAS días hacia adelante. Los arneses que fijan su reloj
// (_reloj.js) lo siguen pisando.
const Real = Date;
const OFFSET = Number(process.env.RELOJ_DIAS || 0) * 86400000;
class Adelantado extends Real {
  constructor(...a) { if (a.length === 0) super(Real.now() + OFFSET); else super(...a); }
  static now() { return Real.now() + OFFSET; }
}
Adelantado.UTC = Real.UTC;
Adelantado.parse = Real.parse;
globalThis.Date = Adelantado;
