// Arnés del bloque de Resultados (V11) en la pantalla de Noticias, y del
// alternador de tema que se mudó al panel lateral (25/08/2026).
//
// Lo que custodia:
// - El calendario se pinta diciendo la verdad: "reporta el..." es una
//   ESTIMACIÓN y se marca como tal; "reportó" compara real contra esperado;
//   sin datos lo dice; y las posiciones fuera de cobertura quedan nombradas.
// - Todo lo que viene del backend pasa por esc() antes de entrar al HTML.
// - El tema se alterna con UN botón en el panel lateral, la tarjeta
//   Apariencia ya no existe en Configuración, y el snippet inline del tema
//   (fijado por hash en la política) no se tocó.
var ruta = require('./_ruta');
var fs = require('fs');
var path = require('path');
var html = ruta.leerIndex();

var asserts = 0, fallos = 0;
function ok(cond, msg) {
  asserts++;
  if (!cond) { fallos++; console.log('  FALLA: ' + msg); }
  else console.log('  ok   ' + msg);
}

// ============ A) el bloque de Resultados, ejecutado ============
console.log('A) renderResultados pinta el calendario diciendo la verdad');

var tradeSrc = fs.readFileSync(path.join(ruta.RUTA, 'js', 'trade.js'), 'utf8');
var ini = tradeSrc.indexOf('// ---------- Resultados de las empresas (V11) ----------');
var fin = tradeSrc.length; // es el último bloque del archivo
ok(ini >= 0, 'existe el bloque de Resultados en trade.js');
var codigo = tradeSrc.slice(ini, fin);

function montar() {
  var elems = {};
  function elem(id) {
    if (!elems[id]) elems[id] = { innerHTML: '' };
    return elems[id];
  }
  var llamadas = { pedidas: 0 };
  var gsr = {
    withSuccessHandler: function (okCb) {
      return {
        withFailureHandler: function (failCb) {
          return { getResultados: function () { llamadas.pedidas++; llamadas.ok = okCb; llamadas.fail = failCb; } };
        }
      };
    }
  };
  var ctx = {
    document: { getElementById: function (id) { return elem(id); } },
    google: { script: { run: gsr } },
    esc: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
    Date: Date, isNaN: isNaN, Math: Math, String: String
  };
  var claves = Object.keys(ctx);
  var fn = new Function(claves.join(','), codigo +
    '\nreturn { renderResultados: renderResultados, cargarResultados: cargarResultados, fechaResultado: fechaResultado };');
  var api = fn.apply(null, claves.map(function (k) { return ctx[k]; }));
  return { api: api, elems: elems, llamadas: llamadas };
}

function ymd(dias) {
  var d = new Date(Date.now() + dias * 86400000);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

var m = montar();
m.api.renderResultados({
  hay: true,
  eventos: [
    { symbol: 'MPT', fecha: ymd(-1), hora: 'amc', epsEstimado: 0.4, epsReal: 0.45, revEstimado: 300e6, revReal: 310e6 },
    { symbol: 'BABA', fecha: ymd(3), hora: 'bmo', epsEstimado: 2.1, epsReal: null, revEstimado: null, revReal: null }
  ],
  fueraDeCobertura: ['NA9', 'TEP']
});
var pintado = m.elems.resultadosBody.innerHTML;
ok(/MPT<\/b> report/.test(pintado), 'el que ya reporto dice "reporto"');
ok(/US\$ 0\.45 vs US\$ 0\.4 expected/.test(pintado), 'y compara real contra esperado, con coma decimal');
ok(/310M vs US\$ 300M/.test(pintado), 'la facturacion va en millones, real contra esperado');
ok(/BABA<\/b> reports on/.test(pintado), 'el que viene dice "reporta el"');
// Se DIO VUELTA el 31/08/2026: antes el backend guardaba la hora ya escrita
// en español y esta pantalla —que va en ingles— la imprimia tal cual. Ahora
// viaja el codigo del proveedor y cada consumidor traduce (el mail al
// español, esto al ingles).
ok(/before the open/.test(pintado), 'la hora se dice en INGLES, como el resto de la pantalla');
ok(!/antes de abrir|tras el cierre/.test(pintado), 'y el español del mail ya no se cuela aca');
ok(/\(estimated\)/.test(pintado), 'y marcado como estimacion');
ok(/NA9, TEP/.test(pintado), 'las posiciones fuera de cobertura quedan NOMBRADAS');
ok(/not listed in the US/.test(pintado), 'con el motivo dicho, no tapado');

var m2 = montar();
m2.api.renderResultados({ hay: false, eventos: [], fueraDeCobertura: [] });
ok(/No calendar data/.test(m2.elems.resultadosBody.innerHTML),
  'sin calendario guardado lo DICE, no muestra una tarjeta vacia');

// El PLAZO sale del payload, no escrito a mano. Decia "in the next two
// weeks" con el horizonte del backend en 14; el 31/08/2026 se amplio a 90
// —la pantalla estaba vacia porque las empresas reportan una vez por
// trimestre y 14 dias caian entre dos temporadas— y ese texto habria pasado
// a mentir sin que nada fallara.
var m3 = montar();
m3.api.renderResultados({ hay: true, eventos: [], fueraDeCobertura: [], horizonteDias: 90 });
var vacio90 = m3.elems.resultadosBody.innerHTML;
ok(/None of your companies report in the next 3 months\./.test(vacio90),
  'con calendario vacio dice el plazo REAL que manda el backend');
ok(!/two weeks/.test(vacio90), 'y ya no hay ningun plazo escrito a mano');

var m3b = montar();
m3b.api.renderResultados({ hay: true, eventos: [], fueraDeCobertura: [], horizonteDias: 30 });
ok(/in the next 1 month\./.test(m3b.elems.resultadosBody.innerHTML), 'un mes va en singular');

var m3c = montar();
m3c.api.renderResultados({ hay: true, eventos: [], fueraDeCobertura: [], horizonteDias: 45 });
ok(/in the next 45 days\./.test(m3c.elems.resultadosBody.innerHTML),
  'lo que no cae en meses redondos se dice en dias');

var m3d = montar();
m3d.api.renderResultados({ hay: true, eventos: [], fueraDeCobertura: [] });
ok(/in the covered period\./.test(m3d.elems.resultadosBody.innerHTML),
  'sin el dato NO se inventa un plazo (un backend viejo no hace mentir a la pantalla)');

// `hora` llega como CODIGO del proveedor: el mismo dato lo consume el mail en
// español y esta pantalla en ingles, asi que cada uno traduce. Antes viajaba
// ya escrito y se imprimia "antes de abrir" en una interfaz en ingles.
var m3e = montar();
m3e.api.renderResultados({
  hay: true, horizonteDias: 90, fueraDeCobertura: [],
  eventos: [
    { symbol: 'AAA', fecha: ymd(2), hora: 'bmo', epsEstimado: null, epsReal: null, revEstimado: null, revReal: null },
    { symbol: 'BBB', fecha: ymd(3), hora: 'amc', epsEstimado: null, epsReal: null, revEstimado: null, revReal: null },
    { symbol: 'CCC', fecha: ymd(4), hora: 'zzz', epsEstimado: null, epsReal: null, revEstimado: null, revReal: null }
  ]
});
var horas = m3e.elems.resultadosBody.innerHTML;
ok(/AAA<\/b> reports on [^<]*, before the open/.test(horas), 'bmo se dice en ingles');
ok(/BBB<\/b> reports on [^<]*, after the close/.test(horas), 'amc tambien');
ok(!/antes de abrir|tras el cierre/.test(horas), 'no se cuela el español del mail');
ok(!/zzz/.test(horas), 'un codigo desconocido NO se imprime crudo: se omite');

// Los simbolos que el proveedor no contesto se NOMBRAN. El 1/09/2026 el cron
// guardo UN evento de doce y la pantalla mostraba ese uno sin decir que
// faltaban once: un proveedor a medias se leia igual que "no reporta nadie".
var m6 = montar();
m6.api.renderResultados({
  hay: true, horizonteDias: 90, fueraDeCobertura: [], consultados: 12,
  sinRespuesta: ["MSFT", "GOOG", "O"],
  eventos: [{ symbol: "ASML", fecha: ymd(40), hora: "bmo", epsEstimado: 10.6, epsReal: null, revEstimado: null, revReal: null }]
});
var huecos = m6.elems.resultadosBody.innerHTML;
ok(/Could not check MSFT, GOOG, O/.test(huecos), "nombra a los que no contestaron");
ok(/may be incomplete/.test(huecos), "y avisa que la lista puede estar corta");
ok(/ASML/.test(huecos), "sin esconder lo que si llego");

// Un aviso que aparece siempre se aprende a ignorar: sin huecos, no va nada.
var m7 = montar();
m7.api.renderResultados({
  hay: true, horizonteDias: 90, fueraDeCobertura: [], consultados: 12, sinRespuesta: [],
  eventos: [{ symbol: "ASML", fecha: ymd(40), hora: "", epsEstimado: null, epsReal: null, revEstimado: null, revReal: null }]
});
ok(!/Could not check/.test(m7.elems.resultadosBody.innerHTML), "sin huecos no aparece el aviso");

// Un backend anterior al campo no dispara el aviso por ausencia del dato.
var m8 = montar();
m8.api.renderResultados({ hay: true, horizonteDias: 90, fueraDeCobertura: [], eventos: [] });
ok(!/Could not check/.test(m8.elems.resultadosBody.innerHTML), "sin el campo tampoco");

// XSS: un symbol hostil no puede meter HTML
var m4 = montar();
m4.api.renderResultados({
  hay: true,
  eventos: [{ symbol: '<img src=x onerror=alert(1)>', fecha: ymd(2), hora: '', epsEstimado: null, epsReal: null, revEstimado: null, revReal: null }],
  fueraDeCobertura: ['<script>']
});
var hostil = m4.elems.resultadosBody.innerHTML;
ok(hostil.indexOf('<img src=x') === -1 && hostil.indexOf('<script>') === -1,
  'un symbol hostil del backend llega escapado, nunca como HTML vivo');

// cargarResultados: una sola llamada aunque se entre dos veces; un fallo
// permite reintentar
var m5 = montar();
m5.api.cargarResultados();
m5.api.cargarResultados();
ok(m5.llamadas.pedidas === 1, 'entrar dos veces a Noticias pide el calendario UNA vez');
m5.llamadas.fail(new Error('se cayo'));
m5.api.cargarResultados();
ok(m5.llamadas.pedidas === 2, 'tras un fallo se puede reintentar');

// ============ B) el tema en la pagina Configuracion (view-diseno) ============
console.log('\nB) el tema vive en la pagina Configuracion, ya no en el panel');
// La historia dio DOS vueltas, a proposito las dos: los botones Oscuro/Claro
// nacieron en la tarjeta Apariencia; en v111 Guzman los cambio por UN boton
// que alternaba en el panel lateral (temaToggleBtn); y el 25/08/2026 pidio
// juntar tema, acento y tonalidad en la pagina Configuracion (view-diseno) —
// los dos botones VOLVIERON, ahora ahi, y temaToggleBtn se fue. Estos asserts
// se dieron vuelta con cada mudanza para que nadie reponga la anterior.
ok(html.indexOf('id="temaToggleBtn"') === -1, 'el boton que alternaba en el panel ya NO existe');
var iDiseno = html.indexOf('id="view-diseno"');
ok(iDiseno >= 0, 'la pagina Configuracion (view-diseno) existe');
ok(html.indexOf('id="temaOscuroBtn"', iDiseno) > iDiseno && html.indexOf('id="temaClaroBtn"', iDiseno) > iDiseno,
  'con los botones Oscuro y Claro ADENTRO de esa pagina');
ok(html.indexOf('<h2>Apariencia</h2>') === -1, 'la tarjeta Apariencia vieja sigue sin volver');

var configSrc = fs.readFileSync(path.join(ruta.RUTA, 'js', 'config.js'), 'utf8');
ok(/temaOscuroBtn'\)\.onclick/.test(configSrc) && /temaClaroBtn'\)\.onclick/.test(configSrc),
  'los dos clicks estan enganchados desde JS (nada inline)');
ok(!/temaToggleBtn/.test(configSrc), 'config.js no referencia mas el boton del panel');
// El snippet inline del tema esta fijado por hash en la politica: si esta
// mudanza lo hubiera tocado, la app arrancaria sin tema. La seccion H de
// test-html verifica el hash contra el snippet real; aca alcanza con que el
// snippet siga leyendo la MISMA clave que setTema escribe.
ok(/ga_tema/.test(html) && /localStorage\.setItem\('ga_tema'/.test(configSrc),
  'el snippet del arranque y setTema comparten la clave ga_tema');

console.log('\n' + asserts + ' asserts, ' + fallos + ' fallas');
process.exit(fallos ? 1 : 0);
