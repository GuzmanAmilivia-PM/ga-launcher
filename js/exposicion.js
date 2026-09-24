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

function renderExposicion() {
  var el = document.getElementById('expBody');
  if (!el) return;
  var r = expDatos;
  if (!r) return;
  if (!r.ok) { el.innerHTML = '<p class="newsempty">' + esc(msgBackend(r)) + '</p>'; return; }
  var emp = r.empresas || [];
  if (!emp.length) { el.innerHTML = '<p class="newsempty">No companies in the portfolio yet.</p>'; return; }
  // Las barras se miden contra la primera: la mas larga llena la fila.
  var max = Number(emp[0].valor) || 1;
  var h = '<p class="expley"><i class="expley-dir"></i>direct <i class="expley-fondo"></i>through funds</p>';
  emp.forEach(function (e, i) {
    var dir = Math.max(0, Number(e.directo) || 0);
    var fondo = Math.max(0, (Number(e.valor) || 0) - dir);
    // Cada parte en un span que no se corta: "QQQ" arriba y "USD 380" abajo
    // se leia como dos datos. Sin fondos no se repite el monto: "all direct".
    var partes = [];
    var fondosE = e.fondos || [];
    if (!fondosE.length) partes.push('all direct');
    else {
      if (dir > 0) partes.push('Direct ' + fmt(dir));
      fondosE.forEach(function (f) { partes.push(esc(f.s) + ' ' + fmt(f.valor)); });
    }
    partes = partes.map(function (p) { return '<span>' + p + '</span>'; });
    h += '<div class="exprow">' +
      '<div class="exprow-top"><span class="exprank">' + (i + 1) + '</span>' +
      '<span class="expname">' + esc(e.nombre) + ' <em>' + esc(e.s) + '</em></span>' +
      '<b class="exppct">' + (e.pct === null || e.pct === undefined ? '—' : Number(e.pct).toFixed(1) + '%') + '</b></div>' +
      '<div class="expbar">' +
      (dir > 0 ? '<i class="expbar-dir" style="width:' + (dir / max * 100).toFixed(1) + '%"></i>' : '') +
      (fondo > 0 ? '<i class="expbar-fondo" style="width:' + (fondo / max * 100).toFixed(1) + '%"></i>' : '') +
      '</div>' +
      '<p class="expdet"><span>' + fmt(e.valor) + '</span> &middot; ' + partes.join(' &middot; ') + '</p>' +
      '</div>';
  });
  // Lo que se ve de cada fondo: la cifra por fondo es un piso, y hay que decirlo.
  var fondos = r.fondos || [];
  if (fondos.length) {
    h += '<p class="capnota">% of the whole portfolio. Through funds counts each fund’s 25 largest holdings, so those figures are a floor: ' +
      fondos.map(function (f) {
        return esc(f.s) + ' ' + Math.round(Number(f.visto) || 0) + '% seen (as of ' + expFecha(f.fecha) + ')';
      }).join(', ') + '. Source: ' + esc(r.fuente) + ', loaded ' + esc(r.cargado) + '.</p>';
  } else {
    h += '<p class="capnota">% of the whole portfolio. No funds to look into: only direct holdings.</p>';
  }
  if ((r.sinTabla || []).length) {
    h += '<p class="newsempty" style="font-size:12px">&#9888; Not looked into (holdings not loaded): ' + r.sinTabla.map(esc).join(', ') + '.</p>';
  }
  el.innerHTML = h;
}

(function () {
  var back = document.getElementById('expBack');
  if (back) back.onclick = function () { volver('inicio'); };
  var ref = document.getElementById('expRefresh');
  if (ref) ref.onclick = function () { cargarExposicion(true); };
})();
