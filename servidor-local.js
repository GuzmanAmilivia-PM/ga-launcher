// Servidor estatico SOLO para probar la PWA antes de publicarla.
// Sirve este directorio en http://localhost:8788 para poder verificar cosas
// que en file:// no se pueden: la politica de contenido (CSP), el service
// worker y los iframes. No se usa en produccion — GitHub Pages sirve el repo.
var http = require('http');
var fs = require('fs');
var path = require('path');

var TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

http.createServer(function (req, res) {
  var rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  var file = path.join(__dirname, rel);
  // No salir del directorio del repo.
  if (file.indexOf(__dirname) !== 0) { res.writeHead(403); res.end('no'); return; }
  fs.readFile(file, function (err, buf) {
    if (err) { res.writeHead(404); res.end('no existe: ' + rel); return; }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(8788, function () {
  console.log('PWA de prueba en http://localhost:8788');
});
