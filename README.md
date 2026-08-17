# ga-launcher — la app (PWA) de GA Portfolio Tracker

Interfaz del tracker personal de inversiones. Se publica sola con GitHub Pages
en cada push a `main` (~30-60 s). El backend vive en otro repo (privado):
`portfolio-tracker`, que es también donde están los tests de ESTA app
(`npm run test:ui` desde allá).

**Los pendientes de esta app NO están acá.** Viven en el `MEJORAS.md` del repo
del backend, junto con los del backend, porque casi toda mejora toca las dos
mitades. Leerlo antes de proponer trabajo sobre esta app.

## Las dos reglas que rompen la app si se ignoran

1. **El orden de los `<script src>` del index.html es semántica, no estética.**
   Son scripts clásicos que comparten ámbito global y ~140 sentencias corren al
   cargar. Reordenarlos o volverlos async/defer/module rompe la app (ya pasó:
   la pantalla de bloqueo quedó muerta en la v30).
2. **Todo archivo nuevo en `js/` va también en ASSETS del `sw.js`** — si no, el
   modo offline se rompe en silencio. Y al publicar se sube la versión del
   `CACHE` en `sw.js` (`ga-pwa-vNN`), que es la única fuente de verdad de
   versión: el badge del menú la lee de ahí.

## Estructura

- `index.html` — solo estructura visual + CSP. El código vive en `js/`.
- `js/nucleo.js` — shim de la API, helpers. Se carga primero.
- `js/gagraf.js` — gráficos propios (reemplazo de Chart.js, misma interfaz).
- `js/vistas|trade|graficos|config|brokers|paneles|sincronizar|ia|seguridad|buscador.js`
- `js/arranque.js` — pintado instantáneo, carga, poll. Se carga último.
- `sw.js` — service worker (shell offline). `servidor-local.js` — solo para
  probar en local (`node servidor-local.js` → http://localhost:8788).

## Seguridad (no degradar)

- CSP en el `<head>`: `script-src` sin `unsafe-inline` (el snippet del tema va
  por hash — si lo editás, recalculá el hash; el test `test-html.js` lo
  verifica). `connect-src` cerrado al backend y al WebSocket de Binance.
- Cero scripts de terceros en la página (TradingView va en iframe sandboxeado).
- La clave de Binance (`ga_bnb`) vive SOLO en el dispositivo y jamás viaja al
  backend. Todo dato externo pasa por `esc()` antes de tocar el DOM.
