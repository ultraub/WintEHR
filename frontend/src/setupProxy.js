const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Use Docker service name when running in container, localhost otherwise
  const backendUrl = process.env.NODE_ENV === 'development' 
    ? 'http://backend:8000'  // Docker service name
    : 'http://localhost:8000';

  // Proxy API requests to the backend
  app.use(
    '/api',
    createProxyMiddleware({
      target: backendUrl,
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
      target: backendUrl,
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
      target: backendUrl,
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