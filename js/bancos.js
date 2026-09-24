// Las pantallas de los DOS BANCOS URUGUAYOS: Itaú y BTG.
//
// Salieron de vistas.js el 14/09/2026, cuando ese archivo llegó a 935 líneas y
// el 41% ya era esto. Es el mismo caso que graficos.js el 6/09: no cambió una
// línea de lógica, solo dejó de haber que leer las pantallas de cuentas para
// tocar un banco. Lo marcó una auditoría por agentes.
//
// CARGA DESPUÉS DE vistas.js, y eso importa: `showAccount` llama acá (esBtg,
// mostrarBtg, restaurarVistaCuenta, itauEsCuenta, renderFondoItau) pero SIEMPRE
// dentro de una función, nunca al cargar. Al revés no hay nada: ningún otro
// archivo usa estas funciones, así que este es una hoja del árbol.
//
// Los dos bancos son la excepción del sistema: ninguno se puede leer desde el
// servidor. Itaú va por relevo con la PC de Guzmán (su clave vive cifrada allá
// y un banco no habilita CORS) y BTG se carga a mano una vez por mes, porque
// iBanca pide token en cada acceso.
// ---------------------------------------------------------------------------
// Actualizar Itaú desde la app (13/09/2026)
// ---------------------------------------------------------------------------
// El botón NO entra al banco. No puede: la contraseña de Itaú vive cifrada en
// la PC de Guzmán —a propósito, el backend es público— y un banco no habilita
// que una página ajena le hable, así que el truco de Binance (que sincroniza
// el propio teléfono) acá no sirve.
//
// Entonces deja un PEDIDO en el servidor y la PC lo atiende cuando lo ve. Por
// eso esto muestra estado en vez de un spinner mudo: tarda, y con la PC
// apagada no va a pasar nunca. Decir "prendé la PC" es más útil que girar.
var ITAU_ESPERA_MS = 3000;
var itauTimer = null;
// Solo si el pedido lo hizo Guzman EN ESTA pantalla se recarga la cartera al
// terminar. Sin esto, abrir la cuenta de Itau despues de una actualizacion
// vieja disparaba una recarga entera por un resultado de hace dias.
var itauActivo = false;

function itauEsCuenta(acc) {
  return /^itau/i.test(String((acc && acc.nombre) || '')) ||
         /^itau/i.test(String((acc && acc.key) || ''));
}

// El texto de cada estado. `abandonado` y `sin_respuesta` son los dos que
// explican algo que el usuario puede arreglar; los demás son informativos.
function itauTexto(e) {
  var m = (e && e.mensaje) || '';
  switch (e && e.estado) {
    case 'pendiente': return 'Requested. Waiting for your PC...';
    case 'actualizando': return 'Reading Ita&uacute;...';
    case 'listo': return '&#10003; ' + esc(m || 'Updated.');
    case 'error': return '&#9888; ' + esc(m || 'It could not be updated.');
    case 'sin_respuesta': return '&#9888; Your PC did not answer. Is it on?';
    case 'abandonado': return '&#9888; It started and never finished. Check the PC.';
    default: return '';
  }
}

function itauParar() {
  if (itauTimer) { clearTimeout(itauTimer); itauTimer = null; }
  itauActivo = false;
}

function itauMostrar(e) {
  var msg = document.getElementById('accItauMsg');
  if (msg) msg.innerHTML = itauTexto(e);
  var btn = document.getElementById('accItauBtn');
  var enCurso = e && (e.estado === 'pendiente' || e.estado === 'actualizando');
  if (btn) btn.disabled = !!enCurso;
  return enCurso;
}

// Pregunta cómo viene hasta que termine. Se rinde sola: un pedido que nadie
// toma llega a `sin_respuesta` y ahí corta, en vez de preguntar para siempre.
function itauSeguir() {
  itauParar();
  google.script.run.withSuccessHandler(function (e) {
    if (!document.getElementById('accItau') || document.getElementById('accItau').hidden) return;
    var sigue = itauMostrar(e);
    if (sigue) {
      itauTimer = setTimeout(itauSeguir, ITAU_ESPERA_MS);
    } else if (itauActivo && e && e.estado === 'listo') {
      // Terminó bien: que la pantalla muestre el número nuevo, que es el
      // punto de haber apretado.
      // sinItau: esta llamada VIENE de Itau. Sin la bandera, la cadena volveria
      // a pedir Itau, que volveria a terminar, que volveria a llamar: un login al
      // banco cada minuto para siempre (13/09/2026).
      if (typeof sincronizarTodo === 'function') sincronizarTodo({ sinItau: true });
    }
  }).withFailureHandler(function () {
    var msg = document.getElementById('accItauMsg');
    if (msg) msg.textContent = 'Could not check the status.';
  }).itauEstado();
}

(function () {
  var btn = document.getElementById('accItauBtn');
  if (!btn) return;
  btn.onclick = function () {
    btn.disabled = true;
    var msg = document.getElementById('accItauMsg');
    if (msg) msg.textContent = 'Requesting...';
    itauActivo = true;
    google.script.run.withSuccessHandler(function (e) {
      itauMostrar(e);
      itauSeguir();
    }).withFailureHandler(function (err) {
      btn.disabled = false;
      if (msg) msg.textContent = msgErr ? msgErr(err, 'The request') : 'It could not be requested.';
    }).itauPedir();
  };
})();

// ---------------------------------------------------------------------------
// El desglose del fondo de Itaú (13/09/2026)
// ---------------------------------------------------------------------------
// El fondo cotiza en PESOS y la cartera se mide en dólares, así que la
// ganancia que ves mezcla dos cosas que se mueven por motivos distintos: lo
// que rinde el fondo (letras del Banco Central) y lo que hace el tipo de
// cambio. Guzmán aportó 6.000 y tiene 32 más; el fondo rindió 1,23% en pesos
// y el peso se llevó 0,68 de esos puntos. Sin el desglose ese 0,54% parece
// que el fondo no rinde, y no es eso.
//
// Antes esta fila mostraba un guion en la ganancia, y no por esconderla: la
// app tiene el costo en pesos y el valor en dólares, y no puede restarlos.
function renderFondoItau(acc, data) {
  var box = document.getElementById('accFondo');
  if (!box) return;
  if (!itauEsCuenta(acc)) { box.hidden = true; return; }
  var r = data && data.resumenItau;
  if (!r) {
    // Sin lo aportado cargado no se inventa nada: se ofrece cargarlo.
    box.hidden = false;
    box.innerHTML = '<p class="detlbl">Tell the app how many dollars you put into the fund ' +
      'and it will show what the fund earned and what the peso did.</p>' +
      '<div class="detedit"><button type="button" class="ghostbtn" id="accFondoSet">Set contributed</button></div>';
    wireFondoSet();
    return;
  }
  box.hidden = false;
  var signo = function (n) { return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; };
  var clase = function (n) { return n >= 0 ? 'up' : 'down'; };
  box.innerHTML =
    '<div class="detgrid">' +
      '<span><span class="detlbl">Contributed</span><b>' + fmt(r.aportadoUSD) + '</b></span>' +
      '<span><span class="detlbl">Value today</span><b>' + fmt(r.valorUSD) + '</b></span>' +
      '<span><span class="detlbl">Gain</span><b class="' + clase(r.gananciaUSD) + '">' +
        (r.gananciaUSD >= 0 ? '+' : '') + fmt(r.gananciaUSD) + ' &middot; ' + signo(r.rendimientoPct) + '</b></span>' +
    '</div>' +
    // Las dos mitades. Se multiplican para dar el total, no se suman, pero a
    // esta escala la diferencia es invisible y "se reparte asi" se entiende.
    '<div class="detgrid" style="margin-top:8px">' +
      '<span><span class="detlbl">The fund (in UYU)</span><b class="' + clase(r.fondoPct) + '">' + signo(r.fondoPct) + '</b></span>' +
      '<span><span class="detlbl">Peso vs dollar</span><b class="' + clase(r.monedaPct) + '">' + signo(r.monedaPct) + '</b></span>' +
    '</div>' +
    '<p class="detlbl" style="margin-top:8px">' +
      (r.monedaPct < 0
        ? 'The fund earned ' + signo(r.fondoPct) + ' in pesos; the peso took back ' + Math.abs(r.monedaPct).toFixed(2) + '% of that in dollars.'
        : 'The fund earned ' + signo(r.fondoPct) + ' in pesos, and the peso added to it.') +
    '</p>' +
    comprasItauHtml(data, r) +
    '<div class="detedit"><button type="button" class="ghostbtn" id="accFondoSet">Change contributed</button></div>';
  wireFondoSet();
}

// ---------------------------------------------------------------------------
// Las COMPRAS del fondo, una por una (13/09/2026)
// ---------------------------------------------------------------------------
// Pedido de Guzman: "ver el desglose de itau assets, con compras, fechas y
// retorno". El fondo NO es una posicion: son dos compras de la misma
// cuotaparte, hechas con tres meses de diferencia y a precios distintos. La
// tabla de posiciones las mostraba como dos filas gemelas, con el precio en
// PESOS escrito como si fueran dolares y la ganancia en guion.
//
// QUE RETORNO SE MUESTRA POR COMPRA, y por que solo ese. El retorno en PESOS
// es exacto para cada compra: precio de hoy contra el precio que pagaste ese
// dia. El retorno en DOLARES no se puede repartir por compra — haria falta el
// tipo de cambio del dia de CADA una, y eso nadie lo guardo (por eso el
// bloque de arriba pide los dolares aportados EN TOTAL). Se muestra entonces
// lo que es cierto: el rendimiento del fondo en su moneda por compra, y el
// valor de hoy en dolares, que si sale del tipo de cambio de hoy. Inventar un
// retorno en dolares por compra seria dar un numero que no se puede sostener.
function fechaCortaItau(iso) {
  var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  // Se arma con los componentes LOCALES: new Date('2026-05-27') es medianoche
  // UTC y en Montevideo (UTC-3) se lee el 26. Un dia de menos en la fecha de
  // una compra es un error que no se ve como error.
  var d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}
function comprasItauHtml(data, r) {
  var filas = ((data && data.posiciones) || []).filter(function (h) {
    return String(h.symbol || '').trim().toUpperCase() === 'ITAU' && Number(h.qty) > 0;
  });
  if (!filas.length) return '';
  // El precio de hoy es UNO SOLO: es la misma cuotaparte. La hoja lo escribe
  // en la primera compra y las demas lo espejan, asi que se toma el primero
  // que exista en vez de suponer que esta en la fila que se esta dibujando.
  var precioHoy = 0;
  filas.forEach(function (h) { if (!precioHoy && Number(h.precioActual) > 0) precioHoy = Number(h.precioActual); });
  var tc = (r && Number(r.tcHoy) > 0) ? Number(r.tcHoy) : 0;
  var out = '<p class="detlbl" style="margin-top:14px">Purchases</p>' +
    '<table class="itautable"><tbody>';
  filas.forEach(function (h) {
    var qty = Number(h.qty);
    var costo = Number(h.precioCompra);
    var pctUYU = (costo > 0 && precioHoy > 0) ? ((precioHoy / costo - 1) * 100) : null;
    var valorUSD = (tc > 0 && precioHoy > 0) ? (qty * precioHoy / tc) : null;
    out += '<tr>' +
      '<td><b>' + esc(fechaCortaItau(h.fechaInicio) || '—') + '</b>' +
        '<span class="pcmini">' + esc(fmtNum(qty)) + ' units @ ' + esc(fmtNum(costo)) + ' UYU</span></td>' +
      '<td class="col-precio">' +
        (pctUYU === null ? '<span class="detlbl">—</span>'
          : '<span class="' + (pctUYU >= 0 ? 'up' : 'down') + '">' + signoPct(pctUYU, 2) + '</span>') +
        (valorUSD !== null ? '<span class="pcmini">' + esc(fmt(valorUSD)) + '</span>' : '') +
      '</td></tr>';
  });
  // UNA linea, no un parrafo (13/09/2026, Guzman: "hay mucha info tuya,
  // minimalizaria un poco nomas"). Lo que NO se puede sacar es que ese retorno
  // es en pesos: sin eso, el numero se lee como dolares y no lo es. El por que
  // —que el dolar de cada compra nadie lo guardo— ya vive arriba, en el bloque
  // que pide los dolares aportados.
  out += '</tbody></table>' +
    '<p class="detlbl">In pesos &middot; unit at ' + esc(fmtNum(precioHoy)) + ' UYU today</p>';
  return out;
}

// Cargar o corregir los dólares aportados. Es el UNICO dato que la app no
// puede deducir: la base guarda el costo en pesos y nadie guardó el dólar del
// día de la compra.
function wireFondoSet() {
  var b = document.getElementById('accFondoSet');
  if (!b) return;
  b.onclick = function () {
    var actual = (lastAccData && lastAccData.resumenItau) ? lastAccData.resumenItau.aportadoUSD : '';
    var v = window.prompt('How many dollars did you put into Ita\u00fa Assets, in total?', actual);
    if (v === null) return;
    var n = Number(String(v).replace(',', '.'));
    if (!isFinite(n) || n <= 0) { alert('That is not an amount.'); return; }
    b.disabled = true;
    google.script.run.withSuccessHandler(function () {
      b.disabled = false;
      if (lastAcc) showAccount(lastAcc, accountReturnView);
    }).withFailureHandler(function (err) {
      b.disabled = false;
      alert(msgErr ? msgErr(err, 'Saving the amount') : 'It could not be saved.');
    }).itauAportado({ aportado: n });
  };
}

// ---------------------------------------------------------------------------
// BTG: los saldos cortados a fin de mes (13/09/2026)
// ---------------------------------------------------------------------------
// BTG es la cuenta del sueldo de Guzmán: entra, paga impuestos, transfiere a
// Itaú para la tarjeta y para el fondo, y lo que queda es pólvora seca
// esperando ir a un broker, parte líquida y parte en un plazo fijo de un mes.
//
// Mirar ese saldo el día 5 es mirar el sueldo recién caído, no el patrimonio.
// Por eso el corte va a FIN DE MES, cuando ya pagó todo. Y por eso esta
// pantalla no "actualiza": carga un corte con su fecha.
//
// BTG no se puede leer solo: iBanca pide token en cada acceso y tiene huella
// de dispositivo, no hay scraper posible como con Itaú. Los cuatro números
// los carga Guzmán una vez por mes; lo demás lo deriva la app.
function esBtg(acc) {
  return /^btg/i.test(String((acc && acc.nombre) || '')) ||
         String((acc && acc.key) || '').toUpperCase() === 'BTG';
}

function btgPct(n) { return (n >= 0 ? '+' : '') + fmt(n); }

function renderBtg(data) {
  var box = document.getElementById('accBtg');
  if (!box) return;
  box.hidden = false;
  var u = data && data.ultimo;
  if (!u) {
    box.innerHTML = '<p class="detlbl">No month-end snapshot yet. Load the balances of the ' +
      'last day of the month, when your salary has already gone out.</p>' +
      '<div class="detedit"><button type="button" class="ghostbtn" id="btgAbrir">Load balances</button></div>';
    wireBtgAbrir();
    return;
  }
  var t = u.totales;
  var c = data.cambio;
  var html = '<div class="detgrid">' +
    '<span><span class="detlbl">Liquid</span><b>' + fmt(t.liquido) + '</b></span>' +
    '<span><span class="detlbl">Fixed deposit</span><b>' + fmt(t.plazo) + '</b></span>' +
    '<span><span class="detlbl">Total</span><b>' + fmt(t.total) + '</b></span>' +
    '</div>' +
    '<p class="detlbl" style="margin-top:6px">Snapshot of ' + esc(u.fecha) + '</p>';
  if (c) {
    // Las dos mitades del cambio. El flujo es plata que entro o salio; el
    // efecto del peso es lo que se movio el dolar sobre lo que ya estaba.
    // Separarlas es lo que evita que una transferencia parezca ganancia.
    html += '<div class="detgrid" style="margin-top:10px">' +
      '<span><span class="detlbl">Since ' + esc(c.desde) + '</span><b class="' + (c.delta >= 0 ? 'up' : 'down') + '">' + btgPct(c.delta) + '</b></span>' +
      '<span><span class="detlbl">You put in / took out</span><b>' + btgPct(c.flujo) + '</b></span>' +
      '<span><span class="detlbl">Peso vs dollar</span><b class="' + (c.efectoFx >= 0 ? 'up' : 'down') + '">' + btgPct(c.efectoFx) + '</b></span>' +
      '</div>' +
      '<p class="detlbl" style="margin-top:8px">Almost everything that moves here month to month is ' +
      'your own money coming and going, not return: the deposit interest is small next to the salary.</p>';
  }
  html += '<div class="detedit"><button type="button" class="ghostbtn" id="btgAbrir">Load a new snapshot</button></div>';
  box.innerHTML = html;
  wireBtgAbrir();
}

function wireBtgAbrir() {
  var b = document.getElementById('btgAbrir');
  if (!b) return;
  b.onclick = function () {
    var f = document.getElementById('accBtgForm');
    if (!f) return;
    f.hidden = false;
    // La fecha propuesta es el fin del mes ANTERIOR si estamos en los
    // primeros dias: si hoy es 5, el corte que falta es el del mes pasado.
    var hoy = new Date();
    var fin = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + (hoy.getUTCDate() > 20 ? 1 : 0), 0));
    document.getElementById('btgFecha').value = fin.toISOString().slice(0, 10);
    document.getElementById('btgMsg').textContent = '';
  };
}

(function () {
  var g = document.getElementById('btgGuardar');
  var c = document.getElementById('btgCancelar');
  if (c) c.onclick = function () { document.getElementById('accBtgForm').hidden = true; };
  if (!g) return;
  g.onclick = function () {
    var msg = document.getElementById('btgMsg');
    var num = function (id) {
      var v = document.getElementById(id).value;
      return v === '' ? null : Number(v);
    };
    var saldos = [];
    var pares = [['btgLiqUsd', 'liquido', 'USD'], ['btgLiqUyu', 'liquido', 'UYU'],
                 ['btgPfUsd', 'plazo', 'USD'], ['btgPfUyu', 'plazo', 'UYU']];
    for (var i = 0; i < pares.length; i++) {
      var v = num(pares[i][0]);
      // Vacio = "no tengo de eso". Cero tambien es un dato (vaciaste el plazo
      // fijo), y por eso se distingue de vacio en vez de tratarlos igual.
      if (v === null) continue;
      if (!isFinite(v) || v < 0) { msg.textContent = 'Check the amounts.'; return; }
      saldos.push({ tipo: pares[i][1], moneda: pares[i][2], monto: v });
    }
    if (!saldos.length) { msg.textContent = 'Load at least one balance.'; return; }
    g.disabled = true;
    msg.textContent = 'Saving...';
    google.script.run.withSuccessHandler(function (r) {
      g.disabled = false;
      if (!r || !r.ok) { msg.textContent = msgBackend(r) || 'It could not be saved.'; return; }
      // El resultado va al aviso FLOTANTE (23/09/2026): #btgMsg vive adentro
      // del formulario que se oculta en la linea siguiente, y el mensaje se
      // iba con el. Y el Sync de despues ya no vuelve a pedir Itau: guardar
      // un corte de BTG no tiene nada que leer del banco, y el pedido dejaba
      // a la PC de Guzman entrando a Itau por nada.
      msg.textContent = '';
      var hecho = '&#10003; ' + (esc((r.mensajes || []).join(' ')) || 'Saved.');
      avisoFlotante(hecho, true);
      document.getElementById('accBtgForm').hidden = true;
      if (lastAcc) showAccount(lastAcc, accountReturnView);
      if (typeof sincronizarTodo === 'function') sincronizarTodo({ sinItau: true, previo: hecho });
      // El recordatorio del Inicio se vuelve a mirar con el corte nuevo.
      if (typeof btgRevisarRecordatorio === 'function') btgRevisarRecordatorio(true);
    }).withFailureHandler(function (err) {
      g.disabled = false;
      msg.textContent = msgErr ? msgErr(err, 'The snapshot') : 'It could not be saved.';
    }).guardarBtg({
      fecha: document.getElementById('btgFecha').value,
      saldos: saldos,
      registrarFlujo: !!document.getElementById('btgFlujo').checked
    });
  };
})();

// ---------- El recordatorio del corte de fin de mes (24/09/2026) ----------
// A9 de la auditoria general. El corte de BTG se carga a mano una vez por
// mes (iBanca pide token en cada acceso: no hay forma de leerlo solo) y nada
// avisaba. Guzman: "Sin notificacion". Queda un aviso en el Inicio, desde el
// ULTIMO dia del mes hasta el BTG_RECORDAR_HASTA_DIA del siguiente, solo si
// el corte de ese fin de mes no esta cargado. Tocarlo abre BTG con el
// formulario listo; guardar el corte lo apaga. Fuera de esa ventana no se le
// pide nada al Worker.
var BTG_RECORDAR_HASTA_DIA = 10;
var BTG_TOLERANCIA_DIAS = 5;   // un corte del 27 al 30 tambien es "el de fin de mes"
var btgRecordatorioPedido = false;
var btgAbrirFormAlCargar = false;
function btgIso(d) {
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
// El fin de mes cuyo corte falta, en 'aaaa-mm-dd', o null (fuera de la
// ventana, o ya cargado). Pura: la hora y el ultimo corte entran de afuera.
function btgCorteQueFalta(ultimaFecha, ahora) {
  var h = new Date(ahora);
  var y = h.getFullYear(), m = h.getMonth(), d = h.getDate();
  var esperado;
  if (d === new Date(y, m + 1, 0).getDate()) esperado = new Date(y, m + 1, 0);   // hoy es fin de mes
  else if (d <= BTG_RECORDAR_HASTA_DIA) esperado = new Date(y, m, 0);          // primeros dias: el del mes pasado
  else return null;
  var alcanza = new Date(esperado.getFullYear(), esperado.getMonth(), esperado.getDate() - BTG_TOLERANCIA_DIAS);
  if (ultimaFecha && String(ultimaFecha).slice(0, 10) >= btgIso(alcanza)) return null;
  return btgIso(esperado);
}
function pintarBtgRecordatorio(falta) {
  var el = document.getElementById('btgRecordatorio');
  if (!el) return;
  el.hidden = !falta;
  if (!falta) { el.innerHTML = ''; return; }
  var p = falta.split('-');
  var dia = new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  el.innerHTML = '<b>Month-end:</b> load BTG&rsquo;s balances of ' + esc(dia) + '<span class="chev">&rsaquo;</span>';
}
function btgRevisarRecordatorio(forzar) {
  var el = document.getElementById('btgRecordatorio');
  if (!el) return;
  // En la ventana, con CUALQUIER ultimo corte viejo: si no, ni se pregunta.
  if (!btgCorteQueFalta(null, Date.now())) { pintarBtgRecordatorio(null); return; }
  if (btgRecordatorioPedido && !forzar) return;   // una vez por sesion
  btgRecordatorioPedido = true;
  google.script.run.withSuccessHandler(function (d) {
    if (!d || d.ok === false) return;
    pintarBtgRecordatorio(btgCorteQueFalta(d.ultimo && d.ultimo.fecha, Date.now()));
  }).withFailureHandler(function () {
    btgRecordatorioPedido = false;   // sin red: se vuelve a preguntar en la proxima apertura
  }).getBtg();
}
(function () {
  var el = document.getElementById('btgRecordatorio');
  if (!el) return;
  if (typeof hacerTocable === 'function') hacerTocable(el);
  el.onclick = function () {
    var acc = ACCOUNTS.filter(function (a) { return a.key === 'BTG'; })[0];
    if (!acc) return;
    btgAbrirFormAlCargar = true;
    showAccount(acc, 'inicio');
  };
})();

// Prepara la pantalla de cuenta para BTG: su detalle NO es una tabla de
// posiciones sino dos saldos, así que la tabla se esconde y aparece su bloque.
function mostrarBtg() {
  var tabla = document.getElementById('accTabla');
  if (tabla) tabla.hidden = true;
  var itau = document.getElementById('accItau');
  if (itau) itau.hidden = true;
  var fondo = document.getElementById('accFondo');
  if (fondo) fondo.hidden = true;
  var box = document.getElementById('accBtg');
  if (box) { box.hidden = false; box.innerHTML = '<p class="detlbl">Loading...</p>'; }
  document.getElementById('accTotal').textContent = 'Loading...';
  document.getElementById('accLiq').textContent = '';
  google.script.run.withSuccessHandler(function (d) {
    if (accPedida !== 'BTG') return;   // ya se abrio otra cuenta
    var t = (d && d.ultimo && d.ultimo.totales) || null;
    document.getElementById('accTotal').textContent = t ? fmt(t.total) : '--';
    document.getElementById('accLiq').textContent = t ? ('Liquid: ' + fmt(t.liquido)) : '';
    renderBtg(d);
    // Se llego desde el recordatorio del Inicio: el formulario ya abierto.
    if (btgAbrirFormAlCargar) {
      btgAbrirFormAlCargar = false;
      var ab = document.getElementById('btgAbrir');
      if (ab) ab.click();
    }
  }).withFailureHandler(function (err) {
    if (accPedida !== 'BTG') return;
    document.getElementById('accTotal').textContent = '--';
    errorEnVista('accError', err, 'the BTG balances');
  }).getBtg();
}

// Al abrir cualquier OTRA cuenta hay que devolver la tabla y esconder BTG: sin
// esto, entrar a BTG y salir a Schwab dejaba la pantalla sin posiciones.
function restaurarVistaCuenta() {
  var tabla = document.getElementById('accTabla');
  if (tabla) tabla.hidden = false;
  var box = document.getElementById('accBtg');
  if (box) box.hidden = true;
  var form = document.getElementById('accBtgForm');
  if (form) form.hidden = true;
}
