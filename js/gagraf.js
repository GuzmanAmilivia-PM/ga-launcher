// Grafico propio en canvas — reemplaza Chart.js (196 KB) por ~7 KB.
// Expone la MISMA interfaz `new Chart(canvas, config)` para el subconjunto
// exacto que la app usa, asi los cinco lugares que dibujan no cambiaron nada:
//   - line: puntos {x,y}, VARIAS series superpuestas (relleno, punteado, grosor
//     por dataset), curva suave, ejes con ticks y callbacks
//   - doughnut: cutout, colores, borde (la leyenda es HTML propio, no de aca)
//   - bar: apiladas por stack, radio, onClick por indice, y una linea encima
// Sin animaciones ni tooltips de biblioteca: la unica interaccion que la app
// definia era el onClick de las barras, y se conserva. Si algun dia se
// necesita algo mas de Chart.js, agregarlo ACA, no volver a la biblioteca.
(function () {
  'use strict';

  // ----- escala "linda": ~5 divisiones en pasos 1/2/5×10^n -----
  function escalaLinda(min, max, divisiones) {
    if (!isFinite(min) || !isFinite(max)) return { min: 0, max: 1, paso: 1 };
    if (min === max) { max = min + (Math.abs(min) || 1); }
    var crudo = (max - min) / (divisiones || 5);
    var mag = Math.pow(10, Math.floor(Math.log(crudo) / Math.LN10));
    var norm = crudo / mag;
    var paso = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    return { min: Math.floor(min / paso) * paso, max: Math.ceil(max / paso) * paso, paso: paso };
  }

  function medirCaja(canvas) {
    var el = canvas.parentNode && canvas.parentNode.getBoundingClientRect ? canvas.parentNode : canvas;
    var r = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, height: 0 };
    return { w: r.width || 300, h: r.height || 150 };
  }

  function Chart(canvas, config) {
    this.canvas = canvas;
    this.config = config || {};
    this._onClick = null;
    this._onResize = null;
    this._dibujar();
    var self = this;
    // Redibujar al rotar el telefono o cambiar el tamano de la ventana.
    this._onResize = function () { self._dibujar(); };
    try { window.addEventListener('resize', this._onResize); } catch (e) {}
  }

  Chart.prototype.destroy = function () {
    try { if (this._onResize) window.removeEventListener('resize', this._onResize); } catch (e) {}
    try { if (this._onClick) this.canvas.removeEventListener('click', this._onClick); } catch (e) {}
    try {
      var ctx = this.canvas.getContext('2d');
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    } catch (e) {}
  };
  Chart.prototype.update = function () { this._dibujar(); };

  Chart.prototype._dibujar = function () {
    var canvas = this.canvas, cfg = this.config;
    if (!canvas || !canvas.getContext) return;
    var caja = medirCaja(canvas);
    var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    canvas.width = Math.max(1, Math.round(caja.w * dpr));
    canvas.height = Math.max(1, Math.round(caja.h * dpr));
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, caja.w, caja.h);
    if (cfg.type === 'line') this._linea(ctx, caja);
    else if (cfg.type === 'doughnut') this._torta(ctx, caja);
    else if (cfg.type === 'bar') this._barras(ctx, caja);
  };

  // Los callbacks de ticks de la config (formatean fechas, ocultan montos).
  function tickCb(eje) {
    var t = eje && eje.ticks;
    return (t && typeof t.callback === 'function') ? t.callback : function (v) { return String(v); };
  }
  function tickColor(eje, defecto) { return (eje && eje.ticks && eje.ticks.color) || defecto; }
  function tickFont(eje) { return (eje && eje.ticks && eje.ticks.font && eje.ticks.font.size) || 11; }
  function gridColor(eje, defecto) { return (eje && eje.grid && eje.grid.color) || defecto; }

  // ----- lineas con relleno (la evolucion del patrimonio) -----
  // Dibuja TODOS los datasets, no solo el primero: el grafico de patrimonio
  // superpone el capital aportado (area) y el indice simulado (punteado). La
  // escala y el rango de fechas se calculan sobre la union de las series, asi
  // ninguna se sale del cuadro. Con un solo dataset el resultado es identico al
  // de antes. Cada dataset acepta: borderColor, borderWidth, borderDash,
  // fill (bool) y backgroundColor.
  Chart.prototype._linea = function (ctx, caja) {
    var cfg = this.config;
    var todos = ((cfg.data && cfg.data.datasets) || []).filter(function (d) {
      return d && d.data && d.data.length;
    });
    var ejes = (cfg.options && cfg.options.scales) || {};
    if (!todos.length) return;
    var ds = todos[0];
    var pts = ds.data;

    var ys = [], xs = [];
    todos.forEach(function (d) {
      d.data.forEach(function (p) {
        if (isFinite(p.y)) ys.push(p.y);
        if (isFinite(p.x)) xs.push(p.x);
      });
    });
    if (!ys.length || !xs.length) return;
    var e = escalaLinda(Math.min.apply(null, ys), Math.max.apply(null, ys), 4);
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    if (x1 === x0) x1 = x0 + 1;

    var cbY = tickCb(ejes.y), cbX = tickCb(ejes.x);
    ctx.font = tickFont(ejes.y) + 'px sans-serif';
    var padIzq = 8, etiquetasY = [];
    for (var v = e.min; v <= e.max + e.paso / 2; v += e.paso) {
      var txt = String(cbY(Math.round(v)));
      etiquetasY.push({ v: v, txt: txt });
      padIzq = Math.max(padIzq, ctx.measureText(txt).width + 10);
    }
    var padAbj = 20, padArr = 6, padDer = 6;
    var W = caja.w - padIzq - padDer, H = caja.h - padArr - padAbj;
    if (W <= 0 || H <= 0) return;
    function X(x) { return padIzq + (x - x0) / (x1 - x0) * W; }
    function Y(y) { return padArr + (1 - (y - e.min) / (e.max - e.min)) * H; }

    // grilla + etiquetas Y
    ctx.strokeStyle = gridColor(ejes.y, 'rgba(255,255,255,.06)');
    ctx.fillStyle = tickColor(ejes.y, '#8ea0b8');
    ctx.lineWidth = 1;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    etiquetasY.forEach(function (t) {
      var y = Y(t.v);
      ctx.beginPath(); ctx.moveTo(padIzq, y); ctx.lineTo(padIzq + W, y); ctx.stroke();
      if (t.txt) ctx.fillText(t.txt, padIzq - 4, y);
    });
    // etiquetas X (~6, como el maxTicksLimit original)
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = tickColor(ejes.x, '#8ea0b8');
    var nx = Math.min(6, pts.length);
    for (var i = 0; i < nx; i++) {
      var frac = nx === 1 ? 0 : i / (nx - 1);
      var xv = x0 + (x1 - x0) * frac;
      ctx.fillText(String(cbX(xv)), Math.min(Math.max(X(xv), padIzq + 14), padIzq + W - 14), padArr + H + 5);
    }

    // curva suave (puntos medios, el efecto del tension 0.3)
    function trazar(p) {
      ctx.beginPath();
      ctx.moveTo(X(p[0].x), Y(p[0].y));
      for (var i = 1; i < p.length; i++) {
        var xa = X(p[i - 1].x), ya = Y(p[i - 1].y);
        var xb = X(p[i].x), yb = Y(p[i].y);
        ctx.quadraticCurveTo(xa, ya, (xa + xb) / 2, (ya + yb) / 2);
      }
      ctx.lineTo(X(p[p.length - 1].x), Y(p[p.length - 1].y));
    }

    // Los rellenos van TODOS antes de los trazos: si cada dataset se dibujara
    // completo por turno, el area del segundo taparia la linea del primero.
    todos.forEach(function (d) {
      if (!d.fill) return;
      var p = d.data;
      trazar(p);
      ctx.lineTo(X(p[p.length - 1].x), padArr + H);
      ctx.lineTo(X(p[0].x), padArr + H);
      ctx.closePath();
      ctx.fillStyle = d.backgroundColor || 'rgba(212,175,55,.12)';
      ctx.fill();
    });
    ctx.lineJoin = 'round';
    todos.forEach(function (d) {
      trazar(d.data);
      ctx.strokeStyle = d.borderColor || '#d4af37';
      ctx.lineWidth = isFinite(d.borderWidth) ? d.borderWidth : 2;
      // El punteado del indice simulado. Se apaga siempre despues de trazar:
      // el contexto es compartido y quedaria punteando la siguiente linea.
      if (d.borderDash && d.borderDash.length && ctx.setLineDash) ctx.setLineDash(d.borderDash);
      ctx.stroke();
      if (ctx.setLineDash) ctx.setLineDash([]);
    });
  };

  // ----- torta con agujero (el portafolio) -----
  Chart.prototype._torta = function (ctx, caja) {
    var cfg = this.config;
    var ds = (cfg.data && cfg.data.datasets && cfg.data.datasets[0]) || {};
    var vals = ds.data || [];
    var total = vals.reduce(function (a, b) { return a + (b || 0); }, 0);
    if (!total) return;
    var cx = caja.w / 2, cy = caja.h / 2;
    var R = Math.min(caja.w, caja.h) / 2 - 4;
    var cutout = parseFloat((cfg.options && cfg.options.cutout) || '62') / 100;
    var r = R * cutout;
    var colores = ds.backgroundColor || [];
    var a = -Math.PI / 2;
    for (var i = 0; i < vals.length; i++) {
      var frac = (vals[i] || 0) / total;
      if (frac <= 0) continue;
      var a2 = a + frac * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, a, a2);
      ctx.arc(cx, cy, r, a2, a, true);
      ctx.closePath();
      ctx.fillStyle = colores[i % colores.length] || '#888';
      ctx.fill();
      if (ds.borderWidth) {
        ctx.strokeStyle = ds.borderColor || '#0d1420';
        ctx.lineWidth = ds.borderWidth;
        ctx.stroke();
      }
      a = a2;
    }
  };

  // ----- barras apiladas + linea encima (dividendos) -----
  Chart.prototype._barras = function (ctx, caja) {
    var cfg = this.config;
    var labels = (cfg.data && cfg.data.labels) || [];
    var todos = (cfg.data && cfg.data.datasets) || [];
    var barras = todos.filter(function (d) { return d.type !== 'line'; });
    var lineas = todos.filter(function (d) { return d.type === 'line'; });
    var ejes = (cfg.options && cfg.options.scales) || {};
    var n = labels.length;
    if (!n) return;

    // apilado por indice
    var sumas = [];
    for (var i = 0; i < n; i++) {
      var s = 0;
      barras.forEach(function (d) { s += Number(d.data[i]) || 0; });
      sumas.push(s);
    }
    var topeLinea = lineas.reduce(function (m, d) {
      return Math.max(m, Math.max.apply(null, d.data.map(Number).filter(isFinite)));
    }, 0);
    var e = escalaLinda(0, Math.max(Math.max.apply(null, sumas), topeLinea, 1), 4);

    var cbY = tickCb(ejes.y), fs = tickFont(ejes.y);
    ctx.font = fs + 'px sans-serif';
    var padIzq = 8, etiquetasY = [];
    for (var v = e.min; v <= e.max + e.paso / 2; v += e.paso) {
      var txt = String(cbY(Math.round(v * 100) / 100));
      etiquetasY.push({ v: v, txt: txt });
      padIzq = Math.max(padIzq, ctx.measureText(txt).width + 10);
    }
    var padAbj = 18, padArr = 4, padDer = 4;
    var W = caja.w - padIzq - padDer, H = caja.h - padArr - padAbj;
    if (W <= 0 || H <= 0) return;
    function Y(y) { return padArr + (1 - (y - e.min) / (e.max - e.min)) * H; }

    // grilla + etiquetas
    ctx.strokeStyle = gridColor(ejes.y, 'rgba(255,255,255,.06)');
    ctx.fillStyle = tickColor(ejes.y, '#8ea0b8');
    ctx.lineWidth = 1;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    etiquetasY.forEach(function (t) {
      var y = Y(t.v);
      ctx.beginPath(); ctx.moveTo(padIzq, y); ctx.lineTo(padIzq + W, y); ctx.stroke();
      if (t.txt) ctx.fillText(t.txt, padIzq - 4, y);
    });

    var ancho = W / n, barW = Math.max(3, ancho * 0.62);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    var fx = tickFont(ejes.x);
    for (var i2 = 0; i2 < n; i2++) {
      var xc = padIzq + ancho * i2 + ancho / 2;
      ctx.font = fx + 'px sans-serif';
      ctx.fillStyle = tickColor(ejes.x, '#8ea0b8');
      ctx.fillText(String(labels[i2]), xc, padArr + H + 4);
      var base = 0;
      for (var d2 = 0; d2 < barras.length; d2++) {
        var val = Number(barras[d2].data[i2]) || 0;
        if (val <= 0) continue;
        var yTop = Y(base + val), yBot = Y(base);
        ctx.fillStyle = barras[d2].backgroundColor || '#5b8def';
        var hBar = Math.max(1, yBot - yTop);
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(xc - barW / 2, yTop, barW, hBar, Math.min(3, hBar / 2));
          ctx.fill();
        } else {
          ctx.fillRect(xc - barW / 2, yTop, barW, hBar);
        }
        base += val;
      }
    }
    // lineas encima (el promedio mensual)
    lineas.forEach(function (d) {
      ctx.beginPath();
      for (var i3 = 0; i3 < n; i3++) {
        var y = Y(Number(d.data[i3]) || 0);
        var x = padIzq + ancho * i3 + ancho / 2;
        if (i3 === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = d.borderColor || '#38bdf8';
      ctx.lineWidth = d.borderWidth || 1.5;
      ctx.stroke();
    });

    // onClick por barra (abre el detalle del mes)
    var onClick = cfg.options && cfg.options.onClick;
    if (onClick) {
      var canvas = this.canvas;
      if (this._onClick) { try { canvas.removeEventListener('click', this._onClick); } catch (e2) {} }
      this._onClick = function (ev) {
        var rect = canvas.getBoundingClientRect();
        var px = ev.clientX - rect.left;
        var idx = Math.floor((px - padIzq) / ancho);
        if (idx >= 0 && idx < n) onClick(ev, [{ index: idx }]);
      };
      canvas.addEventListener('click', this._onClick);
    }
  };

  Chart._escalaLinda = escalaLinda; // expuesta para los tests
  window.Chart = Chart;
})();
