const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  const backendTarget = process.env.REACT_APP_BACKEND_URL || 'http://backend:8000';
  
  console.log(`[Proxy] Backend target: ${backendTarget}`);
  
  // API routes - standard proxy
  app.use(
    '/api',
    createProxyMiddleware({
      target: backendTarget,
      changeOrigin: true,
      logLevel: 'debug'
    })
  );
  
  // FHIR routes - need to add the path back since Express strips it
  app.use(
    '/fhir',
    createProxyMiddleware({
      target: backendTarget,
      changeOrigin: true,
      logLevel: 'debug',
      pathRewrite: (path, req) => {
        // Add /fhir back to the path since Express strips it
        const newPath = '/fhir' + path;
        console.log(`[FHIR Proxy] Rewriting ${path} -> ${newPath}`);
        return newPath;
      }
    })
  );
  
  // CDS Hooks routes - need to add the path back
  app.use(
    '/cds-hooks',
    createProxyMiddleware({
      target: backendTarget,
      changeOrigin: true,
      logLevel: 'debug',
      pathRewrite: (path, req) => {
        // Add /cds-hooks back to the path
        const newPath = '/cds-hooks' + path;
        console.log(`[CDS Proxy] Rewriting ${path} -> ${newPath}`);
        return newPath;
      }
    })
  );
  
  // WebSocket proxy
  app.use(
    '/ws',
    createProxyMiddleware({
      target: backendTarget,
      changeOrigin: true,
      ws: true,
      pathRewrite: {
        '^/ws': '/ws'
      }
    })
  );
};