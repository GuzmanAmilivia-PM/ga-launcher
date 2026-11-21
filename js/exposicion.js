// ---------- Exposure: las 10 empresas con mas exposicion (24/09/2026, A28) ----------
// Pedido de Guzman: una pantalla aparte, en el menu del costado, con las diez
// empresas que mas pesan en la cartera "teniendo en cuenta lo de los indices":
// META directa MAS la META que hay dentro de VOO y QQQ. La cuenta la hace el
// Worker (Exposicion.js) con las 25 mayores tenencias de cada fondo; aca solo
// se dibuja. Describe, no juzga: el umbral de concentracion es del analisis.
var expDatos = null;
var expPidiendo = false;

function cargarExposicion(forzar) {
  if (expDatos && !forzar) renderExposicion();
  if (expPidiendo) return;
  expPidiendo = true;
  google.script.run.withSuccessHandler(function (r) {
    expPidiendo = false;
    expDatos = r;
    renderExposicion();
  }).withFailureHandler(function (err) {
    expPidiendo = false;
    if (expDatos) return;   // con datos ya pintados, un fallo de red no borra la pantalla
    var el = document.getElementById('expBody');
    if (el) el.innerHTML = '<p class="newsempty">' + esc(msgErr(err, 'Exposure')) + '</p>';
  }).getExposicion();
}

// "Aug 31" desde "2026-08-31": la fecha de cada lista, corta.
function expFecha(ymd) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  if (!m) return esc(ymd);
  var MES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return MES[Number(m[2]) - 1] + ' ' + Number(m[3]);
}

// Las dos miradas de la misma cuenta (21/11/2026). Pedido de Guzman: "ademas
// del top 10, por sector (semis, finance tech, emergente, etc)". 'empresas' es
// el top 10 de siempre; 'temas' agrupa lo mismo por el tema de cada empresa
// (lo decide el Worker: Clasificacion.js, temaDe). Los dos botones viven en el
// HTML y usan active-acento (regla dura: active-compra es solo de Trades).
var expVista = 'empresas';
var EXP_TITULOS = { empresas: 'Top 10 companies, funds included', temas: 'By theme, funds included' };

function setExpVista(v) {
  expVista = (v === 'temas') ? 'temas' : 'empresas';
  var bE = document.getElementById('expVerEmpresas');
  var bT = document.getElementById('expVerTemas');
  if (bE) bE.className = 'tipobtn' + (expVista === 'empresas' ? ' active-acento' : '');
  if (bT) bT.className = 'tipobtn' + (expVista === 'temas' ? ' active-acento' : '');
  var t = document.getElementById('expTitulo');
  if (t) t.textContent = EXP_TITULOS[expVista];
  renderExposicion();
}

// Lo que se ve de cada fondo: la cifra por fondo es un piso, y hay que decirlo.
// La misma nota cierra las dos miradas; `intro` es la frase propia de cada una.
function expNotaFondos(r, intro) {
  var fondos = r.fondos || [];
  var h = '';
  if (fondos.length) {
    h += '<p class="capnota">' + intro + ' Through funds counts each fund’s 25 largest holdings, so those figures are a floor: ' +
      fondos.map(function (f) {
        return esc(f.s) + ' ' + Math.round(Number(f.visto) || 0) + '% seen (as of ' + expFecha(f.fecha) + ')';
      }).join(', ') + '. Source: ' + esc(r.fuente) + ', loaded ' + esc(r.cargado) + '.</p>';
  } else {
    h += '<p class="capnota">' + intro + ' No funds to look into: only direct holdings.</p>';
  }
  if ((r.sinTabla || []).length) {
    h += '<p class="newsempty" style="font-size:12px">&#9888; Not looked into (holdings not loaded): ' + r.sinTabla.map(esc).join(', ') + '.</p>';
  }
  return h;
}

// Una fila con su barra: lo directo en el acento, lo de los fondos mas claro.
// `max` es el valor contra el que se miden las barras (la fila mas grande).
function expFilaHtml(rank, nombreHtml, pct, valor, dir, max, detalleHtml) {
  var fondo = Math.max(0, (Number(valor) || 0) - dir);
  return '<div class="exprow">' +
    '<div class="exprow-top"><span class="exprank">' + rank + '</span>' +
    '<span class="expname">' + nombreHtml + '</span>' +
    '<b class="exppct">' + (pct === null || pct === undefined ? '—' : Number(pct).toFixed(1) + '%') + '</b></div>' +
    '<div class="expbar">' +
    (dir > 0 ? '<i class="expbar-dir" style="width:' + (dir / max * 100).toFixed(1) + '%"></i>' : '') +
    (fondo > 0 ? '<i class="expbar-fondo" style="width:' + (fondo / max * 100).toFixed(1) + '%"></i>' : '') +
    '</div>' + detalleHtml + '</div>';
}

// "Direct USD 500 · VOO USD 300": cada parte en un span que no se corta
// ("QQQ" arriba y "USD 380" abajo se leia como dos datos). Sin fondos no se
// repite el monto: "all direct".
function expPartes(dir, fondos) {
  var partes = [];
  if (!(fondos || []).length) partes.push('all direct');
  else {
    if (dir > 0) partes.push('Direct ' + fmt(dir));
    fondos.forEach(function (f) { partes.push(esc(f.s) + ' ' + fmt(f.valor)); });
  }
  return partes.map(function (p) { return '<span>' + p + '</span>'; });
}

function expHtmlEmpresas(r) {
  var emp = r.empresas || [];
  if (!emp.length) return '<p class="newsempty">No companies in the portfolio yet.</p>';
  // Las barras se miden contra la primera: la mas larga llena la fila.
  var max = Number(emp[0].valor) || 1;
  var h = '<p class="expley"><i class="expley-dir"></i>direct <i class="expley-fondo"></i>through funds</p>';
  emp.forEach(function (e, i) {
    var dir = Math.max(0, Number(e.directo) || 0);
    // El simbolo ADELANTE (9/10/2026, auditoria): con un nombre largo
    // ("Taiwan Semiconductor Manufacturing") los puntos suspensivos se
    // comian el simbolo, que es lo que se reconoce de un vistazo.
    h += expFilaHtml(i + 1, '<em>' + esc(e.s) + '</em> ' + esc(e.nombre), e.pct, e.valor, dir, max,
      '<p class="expdet"><span>' + fmt(e.valor) + '</span> &middot; ' + expPartes(dir, e.fondos).join(' &middot; ') + '</p>');
  });
  return h + expNotaFondos(r, '% of the whole portfolio.');
}

// Por tema: la misma fila, con las empresas que mas pesan adentro del tema.
// Los dos renglones que NO son un tema van al final y sin numero: lo que no
// se ve de los fondos (mas alla de sus 25 mayores tenencias) y lo que todavia
// no tiene tema. Decirlos es la diferencia entre un piso y un invento.
function expHtmlTemas(r) {
  var temas = r.temas || [];
  if (!temas.length) return '<p class="newsempty">No themes to show yet.</p>';
  var max = 1;
  temas.forEach(function (t) { if (!t.resto && !t.sinClasificar && Number(t.valor) > max) max = Number(t.valor); });
  var h = '<p class="expley"><i class="expley-dir"></i>direct <i class="expley-fondo"></i>through funds</p>';
  var n = 0;
  temas.forEach(function (t) {
    var dir = Math.max(0, Number(t.directo) || 0);
    var aparte = !!(t.resto || t.sinClasificar);
    var det = '<p class="expdet"><span>' + fmt(t.valor) + '</span> &middot; ' + expPartes(dir, t.fondos).join(' &middot; ') + '</p>';
    if (t.resto) det += '<p class="expdet">What your funds hold beyond their 25 largest holdings: the rest of the market, not split by theme.</p>';
    else if ((t.top || []).length) det += '<p class="expdet">Mostly ' + t.top.map(function (x) { return '<span>' + esc(x.s) + '</span>'; }).join(', ') + '</p>';
    // Las barras de los renglones aparte se topean: el resto de los fondos
    // suele ser mas grande que cualquier tema y aplastaria a los demas.
    h += expFilaHtml(aparte ? '&middot;' : ++n, esc(t.tema), t.pct, Math.min(Number(t.valor) || 0, max), Math.min(dir, max), max, det);
  });
  // Los PAISES emergentes (21/11/2026, correccion de Guzman: "emergente me
  // referia a paises emergentes"): otro corte de lo mismo, por pais. Va
  // aparte y lo dice, porque se superpone con los temas de arriba.
  var em = r.emergentes;
  if (em && Number(em.valor) > 0) {
    var dirE = Math.max(0, Number(em.directo) || 0);
    h += '<p class="detlbl expcorte">By country</p>' +
      expFilaHtml('&middot;', 'Emerging countries', em.pct, Math.min(Number(em.valor) || 0, max), Math.min(dirE, max), max,
        '<p class="expdet"><span>' + fmt(em.valor) + '</span> &middot; ' + expPartes(dirE, em.fondos).join(' &middot; ') + '</p>' +
        '<p class="expdet">' + (em.empresas || []).map(function (x) {
          return '<span>' + esc(x.s) + ' (' + esc(x.pais) + ') ' + fmt(x.valor) + '</span>';
        }).join(' &middot; ') + '</p>' +
        '<p class="expdet">A different cut of the same money: these companies are also counted in their themes above.</p>');
  }
  var h2 = expNotaFondos(r, '% of the whole portfolio; cash is left out. Each company counts under one theme.');
  if ((r.sinTema || []).length) {
    h2 += '<p class="newsempty" style="font-size:12px">&#9888; Not classified yet: ' + r.sinTema.map(esc).join(', ') + '.</p>';
  }
  return h + h2;
}

function renderExposicion() {
  var el = document.getElementById('expBody');
  if (!el) return;
  var r = expDatos;
  if (!r) return;
  if (!r.ok) { el.innerHTML = '<p class="newsempty">' + esc(msgBackend(r)) + '</p>'; return; }
  el.innerHTML = (expVista === 'temas') ? expHtmlTemas(r) : expHtmlEmpresas(r);
}

(function () {
  var back = document.getElementById('expBack');
  if (back) back.onclick = function () { volver('inicio'); };
  var ref = document.getElementById('expRefresh');
  if (ref) ref.onclick = function () { cargarExposicion(true); };
  var bE = document.getElementById('expVerEmpresas');
  if (bE) bE.onclick = function () { setExpVista('empresas'); };
  var bT = document.getElementById('expVerTemas');
  if (bT) bT.onclick = function () { setExpVista('temas'); };
})();
