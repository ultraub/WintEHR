const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Determine backend URL based on environment
  // In Docker development, always use 'backend' service name
  const isDocker = process.env.HOST === '0.0.0.0';
  const backendTarget = isDocker 
    ? 'http://emr-backend-dev:8000' 
    : process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
  
  console.log(`[Proxy] Backend target: ${backendTarget} (Docker: ${isDocker})`);
  
  // Common proxy options with error handling
  const createProxy = (name, pathRewrite) => {
    return createProxyMiddleware({
      target: backendTarget,
      changeOrigin: true,
      logLevel: 'error',
      pathRewrite: pathRewrite,
      onError: (err, req, res) => {
        console.error(`[${name} Proxy Error]`, err.message);
        if (err.code === 'ECONNREFUSED') {
          res.status(503).json({
            error: 'Backend service unavailable',
            message: 'The backend service is not running or still starting up'
          });
        } else {
          res.status(500).json({
            error: 'Proxy error',
            message: err.message
          });
        }
      },
      onProxyReq: (proxyReq, req, res) => {
        // Log the actual request being made
        console.log(`[${name}] ${req.method} ${req.path} -> ${backendTarget}${req.path}`);
      }
    });
  };
  
  // API routes - standard proxy
  app.use(
    '/api',
    createProxy('API')
  );
  
  // FHIR routes - need to add the path back since Express strips it
  app.use(
    '/fhir',
    createProxy('FHIR', (path, req) => {
      // Add /fhir back to the path since Express strips it
      const newPath = '/fhir' + path;
      // console.log(`[FHIR Proxy] Rewriting ${path} -> ${newPath}`);
      return newPath;
    })
  );
  
  // CDS Hooks routes - need to add the path back
  app.use(
    '/cds-hooks',
    createProxy('CDS', (path, req) => {
      // Add /cds-hooks back to the path
      const newPath = '/cds-hooks' + path;
      // console.log(`[CDS Proxy] Rewriting ${path} -> ${newPath}`);
      return newPath;
    })
  );
  
  
  // Health check endpoint for debugging proxy configuration
  app.get('/proxy-health', (req, res) => {
    res.json({
      status: 'ok',
      backend: backendTarget,
      isDocker: isDocker,
      host: process.env.HOST,
      environment: process.env.NODE_ENV
    });
  });
};