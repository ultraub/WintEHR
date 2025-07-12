const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy API requests to the backend
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8000',
      changeOrigin: true,
      secure: false,
      timeout: 10000,
      onError: function(err, req, res) {
        console.error('Proxy error:', err);
        res.writeHead(500, {
          'Content-Type': 'text/plain'
        });
        res.end('Proxy error: ' + err.message);
      }
    })
  );

  // Proxy CDS Hooks requests to the backend
  app.use(
    '/cds-hooks',
    createProxyMiddleware({
      target: 'http://localhost:8000',
      changeOrigin: true,
      secure: false,
      timeout: 10000,
      onError: function(err, req, res) {
        console.error('CDS Hooks proxy error:', err);
        res.writeHead(500, {
          'Content-Type': 'text/plain'
        });
        res.end('CDS Hooks proxy error: ' + err.message);
      }
    })
  );

  // Proxy FHIR requests to the backend
  app.use(
    '/fhir',
    createProxyMiddleware({
      target: 'http://localhost:8000',
      changeOrigin: true,
      secure: false,
      timeout: 10000,
      onError: function(err, req, res) {
        console.error('FHIR proxy error:', err);
        res.writeHead(500, {
          'Content-Type': 'text/plain'
        });
        res.end('FHIR proxy error: ' + err.message);
      }
    })
  );
};