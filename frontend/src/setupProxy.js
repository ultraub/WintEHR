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
      logLevel: 'info',
      pathRewrite: pathRewrite,
      // Configure all timeout-related options
      timeout: 0, // Disable http-proxy timeout (let backend handle it)
      proxyTimeout: 0, // Disable proxy-specific timeout
      // Configure the underlying http agent with custom timeout
      agent: false, // Disable keep-alive agent
      onProxyReq: (proxyReq, req, res) => {
        // Set socket timeout directly on the request
        proxyReq.setTimeout(120000); // 2 minute timeout
        console.log(`[${name}] ${req.method} ${req.path} -> ${backendTarget}${req.path}`);
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log(`[${name}] ${req.method} ${req.path} <- ${proxyRes.statusCode}`);
      },
      onError: (err, req, res) => {
        console.error(`[${name} Proxy Error]`, err.message, err.code);
        if (err.code === 'ECONNREFUSED') {
          res.status(503).json({
            error: 'Backend service unavailable',
            message: 'The backend service is not running or still starting up'
          });
        } else if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT' || err.code === 'ECONNRESET') {
          res.status(504).json({
            error: 'Gateway timeout',
            message: 'The backend took too long to respond. This may be due to catalog processing.'
          });
        } else {
          res.status(500).json({
            error: 'Proxy error',
            message: err.message
          });
        }
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
      return '/fhir' + path;
    })
  );
  
  // CDS Services routes - need to add the path back
  app.use(
    '/cds-services',
    createProxy('CDS', (path, req) => {
      // Add /api/cds-services back to the path
      return '/api/cds-services' + path;
    })
  );
  
  // WebSocket proxy - special handling for real-time connections
  app.use(
    '/api/ws',
    createProxyMiddleware({
      target: backendTarget,
      ws: true, // Enable WebSocket proxy
      changeOrigin: true,
      logLevel: 'debug',
      onError: (err, req, res) => {
        console.error('[WebSocket Proxy Error]', err.message);
      },
      onProxyReqWs: (proxyReq, req, socket, options, head) => {
        console.log('[WebSocket] Proxying WebSocket request to:', backendTarget);
      }
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