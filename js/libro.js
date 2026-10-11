// ---------- Tax book: el libro fiscal de un año (24/09/2026, A27) ----------
// Lo que informaron los brokers en el año —dividendos, retenciones y ventas—,
// guardado por el Worker en una tabla que solo crece (Libro.js) para que no
// se pierda cuando sale de la ventana de 365 dias. Aca se dibuja y se baja en
// CSV para el contador. No calcula impuestos: junta y dice que falta.
var libDatos = null;
var libAnio = null;
var libPidiendo = false;
var libPedido = 0;

function cargarLibro(anio, forzar) {
  if (anio) libAnio = anio;
  if (libDatos && !forzar && (!libAnio || libDatos.anio === libAnio)) { renderLibro(); return; }
  var n = ++libPedido;
  libPidiendo = true;
  var el = document.getElementById('libBody');
  if (el && (!libDatos || libDatos.anio !== libAnio)) el.innerHTML = '<p class="loadingtxt">Loading ' + esc(libAnio || 'the year') + '...</p>';
  google.script.run.withSuccessHandler(function (r) {
    if (n !== libPedido) return;   // una respuesta vieja (otro año) no pisa la nueva
    libPidiendo = false;
    libDatos = r;
    if (r && r.anio) libAnio = r.anio;
    renderLibro();
  }).withFailureHandler(function (err) {
    if (n !== libPedido) return;
    libPidiendo = false;
    var b = document.getElementById('libBody');
    if (b) b.innerHTML = '<p class="newsempty">' + esc(msgErr(err, 'Tax book')) + '</p>';
  }).getLibroFiscal(libAnio ? { anio: libAnio } : {});
}

function libMonto(n) { return (n === null || n === undefined) ? '—' : fmtUsd(n); }
// Lo retenido en pantalla incluye la comision del ADR que cobra Schwab
// (gastos, A32): las dos restan del dividendo. El CSV las separa.
function libRetenido(x) { return Math.round(((Number(x.retenciones) || 0) + (Number(x.gastos) || 0)) * 100) / 100; }

function renderLibro() {
  var el = document.getElementById('libBody');
  if (!el) return;
  var r = libDatos;
  if (!r) return;
  if (!r.ok) { el.innerHTML = '<p class="newsempty">' + esc(msgBackend(r)) + '</p>'; return; }
  var h = '<div class="tipobar libanios">';
  (r.anios || []).forEach(function (a) {
    h += '<button type="button" class="tipobtn' + (a === r.anio ? ' active-acento' : '') + '" data-anio="' + a + '">' + a + '</button>';
  });
  h += '</div>';
  var t = r.totales || {};
  h += '<p class="rendtitular">' + libMonto(t.neto) + ' <span class="desc">net dividends in ' + r.anio + (r.enCurso ? ' so far' : '') + '</span></p>';

  // Dividendos por broker: bruto, retenido, neto. Todo en USD con el cambio
  // que informo el broker.
  // Cada tabla va adentro de .libscroll (9/10/2026, auditoria): a 393 px la
  // de brokers se salia de la tarjeta y la de "por papel" de la pantalla, con
  // los montos pegados ("US$ 512.30US$ 153.69"). Si no entra, se desliza
  // ADENTRO de la tarjeta; la pagina no se corre.
  h += '<div class="libscroll"><table class="rendtabla libtabla"><tr><th></th><th>Dividends</th><th>Withheld</th><th>Net</th></tr>';
  (r.brokers || []).forEach(function (b) {
    h += '<tr><td>' + esc(b.broker) + '</td><td>' + libMonto(b.dividendos) + '</td><td>' + libMonto(libRetenido(b)) + '</td><td>' + libMonto(b.neto) + '</td></tr>';
  });
  h += '<tr class="libtotal"><td>Total</td><td>' + libMonto(t.dividendos) + '</td><td>' + libMonto(libRetenido(t)) + '</td><td>' + libMonto(t.neto) + '</td></tr></table></div>';

  // Las ventas, con el resultado que informo el broker.
  var ventas = r.ventas || [];
  h += '<p class="libsub">Sales' + (ventas.length ? ' (' + ventas.length + ')' : '') + '</p>';
  if (!ventas.length) {
    h += '<p class="capnota">No sales recorded in ' + r.anio + '.</p>';
  } else {
    // Tres columnas: la fecha va debajo del simbolo (con cuatro, a 375 px la
    // tabla se salia por la derecha).
    h += '<div class="libscroll"><table class="rendtabla libtabla"><tr><th></th><th>Proceeds</th><th>Result</th></tr>';
    ventas.forEach(function (v) {
      var res = v.resultado;
      // ≈: lo estimo el Worker (costo promedio o la hoja Ventas de Guzman), no
      // lo informo el broker (A33). El aviso de abajo dice de donde sale.
      var aprox = res !== null && res !== undefined && v.resultadoFuente && v.resultadoFuente !== 'broker';
      h += '<tr><td>' + esc(v.symbol) + ' <em>' + esc(v.broker) + (v.fuente === 'app' ? ' · app' : '') + '</em><span class="libfecha">' + esc(v.fecha) + '</span></td>' +
        '<td>' + libMonto(v.importe) + '</td>' +
        '<td>' + (res === null || res === undefined ? '—' : '<b class="' + (res >= 0 ? 'up' : 'down') + '">' + (aprox ? '≈ ' : '') + libMonto(res) + '</b>') + '</td></tr>';
    });
    h += '<tr class="libtotal"><td>Total</td><td>' + libMonto(t.importeVentas) + '</td><td>' + libMonto(t.resultado) + '</td></tr></table></div>';
    if (ventas.some(function (v) { return v.resultadoFuente && v.resultadoFuente !== 'broker'; })) {
      h += '<p class="capnota">≈ estimated: the broker does not report it (see the notes below).</p>';
    }
  }

  // Dividendos por papel, plegado: es el detalle que pide el contador.
  var sim = r.simbolos || [];
  if (sim.length) {
    h += '<details class="libdet"><summary>Dividends by holding (' + sim.length + ')</summary>' +
      '<div class="libscroll"><table class="rendtabla libtabla"><tr><th></th><th>Dividends</th><th>Withheld</th><th>Net</th></tr>';
    sim.forEach(function (s) {
      h += '<tr><td>' + esc(s.symbol || '—') + ' <em>' + esc(s.broker) + (s.moneda && s.moneda !== 'USD' ? ' · ' + esc(s.moneda) : '') + '</em></td>' +
        '<td>' + libMonto(s.dividendos) + '</td><td>' + libMonto(libRetenido(s)) + '</td><td>' + libMonto(s.neto) + '</td></tr>';
    });
    h += '</table></div></details>';
  }

  // Los premios de Binance Earn y sus distribuciones (A33): ingreso, aparte
  // de los dividendos, en USD al precio de cada dia.
  var ing = r.ingresos || [];
  if (ing.length) {
    h += '<p class="libsub">Crypto rewards</p><p class="rendtitular" style="font-size:15px">' + libMonto(t.ingresos) +
      ' <span class="desc">from Binance Earn and distributions, at each day’s price</span></p>';
    h += '<details class="libdet"><summary>Rewards by asset (' + ing.length + ')</summary><div class="libscroll"><table class="rendtabla libtabla"><tr><th></th><th>Units</th><th>USD</th></tr>';
    ing.forEach(function (x) {
      h += '<tr><td>' + esc(x.symbol) + ' <em>' + esc(x.broker) + '</em></td><td>' + esc(x.qty) + '</td><td>' + libMonto(x.monto) + '</td></tr>';
    });
    h += '</table></div></details>';
  }

  if (Number(t.gastos)) h += '<p class="capnota">Withheld includes ' + libMonto(t.gastos) + ' of ADR fees (charged by the depositary bank, not a tax).</p>';
  (r.avisos || []).forEach(function (x) { h += '<p class="newsempty" style="font-size:12px">&#9888; ' + esc(x) + '</p>'; });
  var reg = (r.registro || []).map(function (x) { return esc(x.broker) + ' since ' + esc(x.desde); }).join(', ');
  h += '<p class="capnota">What the brokers reported, in USD at the broker’s exchange rate' + (reg ? ' — kept ' + reg : '') +
    '. A record, not a tax return: the tax reading is your accountant’s.</p>';
  h += '<button type="button" class="tipobtn libcsv" id="libCsv">Download CSV</button>';
  el.innerHTML = h;

  Array.prototype.forEach.call(el.querySelectorAll('[data-anio]'), function (b) {
    b.addEventListener('click', function () { cargarLibro(Number(b.getAttribute('data-anio')), false); });
  });
  var csv = document.getElementById('libCsv');
  if (csv) csv.onclick = function () { libDescargarCsv(r); };
}

// El CSV para el contador: un renglon por dividendo-por-papel y por venta, en
// USD. Sin el ojito: es un archivo que se baja a proposito.
function libCsvTexto(r) {
  function c(v) {
    var s = (v === null || v === undefined) ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  var filas = [['type', 'year', 'date', 'broker', 'symbol', 'currency', 'quantity', 'dividends_usd', 'withheld_usd', 'fees_usd', 'net_usd', 'proceeds_usd', 'result_usd', 'source', 'result_source', 'income_usd']];
  (r.simbolos || []).forEach(function (s) {
    filas.push(['dividend', r.anio, '', s.broker, s.symbol, s.moneda, '', s.dividendos, s.retenciones, s.gastos || 0, s.neto, '', '', 'broker', '', '']);
  });
  (r.ventas || []).forEach(function (v) {
    filas.push(['sale', r.anio, v.fecha, v.broker, v.symbol, v.moneda, v.qty, '', '', '', '', v.importe, v.resultado, v.fuente, v.resultadoFuente || '', '']);
  });
  (r.ingresos || []).forEach(function (x) {
    filas.push(['reward', r.anio, '', x.broker, x.symbol, 'USD', x.qty, '', '', '', '', '', '', 'broker', '', x.monto]);
  });
  return filas.map(function (f) { return f.map(c).join(','); }).join('\n') + '\n';
}
// En la app INSTALADA en el iPhone, la hoja de compartir (9/10/2026,
// auditoria). Una descarga de blob con <a download> en una web app de la
// pantalla de inicio de iOS no es confiable (puede abrir un visor sin salida),
// y lo que Guzman quiere es mandarle el archivo al contador: la hoja de
// compartir ofrece Mail, WhatsApp y Archivos. Solo ahi y solo si el navegador
// dice que puede compartir el archivo; en cualquier otro caso (la
// computadora, Safari comun) la descarga de siempre.
function libDescargarCsv(r) {
  var texto = libCsvTexto(r);
  var nombre = 'tax-book-' + r.anio + '.csv';
  var nav = (typeof navigator !== 'undefined') ? navigator : null;
  if (nav && nav.standalone === true && typeof nav.share === 'function' && typeof nav.canShare === 'function' && typeof File === 'function') {
    var archivo = null, puede = false;
    try { archivo = new File([texto], nombre, { type: 'text/csv' }); puede = !!nav.canShare({ files: [archivo] }); } catch (e) { puede = false; }
    if (puede) {
      // Cerrar la hoja (AbortError) es decir que no: no se baja nada.
      nav.share({ files: [archivo], title: 'Tax book ' + r.anio }).catch(function (e) {
        if (!(e && e.name === 'AbortError')) libBajarCsv(texto, nombre);
      });
      return;
    }
  }
  libBajarCsv(texto, nombre);
}
function libBajarCsv(texto, nombre) {
  var blob = new Blob([texto], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

(function () {
  var back = document.getElementById('libBack');
  if (back) back.onclick = function () { volver('inicio'); };
  var ref = document.getElementById('libRefresh');
  if (ref) ref.onclick = function () { cargarLibro(libAnio, true); };
})();
