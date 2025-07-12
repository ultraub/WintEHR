const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Determine backend target based on environment
  const isInDocker = !!process.env.HOSTNAME;
  const backendTarget = process.env.REACT_APP_BACKEND_URL || 
                       (isInDocker ? 'http://backend:8000' : 'http://localhost:8000');
  
  console.log('🔥 PROXY SETUP: Setting up simple proxy with target:', backendTarget);
  
  // Simple proxy configuration for all /api requests
  app.use('/api', createProxyMiddleware({
    target: backendTarget,
    changeOrigin: true,
    logLevel: 'debug'
  }));

  // Proxy CDS Hooks and FHIR requests
  app.use('/cds-hooks', createProxyMiddleware({
    target: backendTarget,
    changeOrigin: true
  }));

  app.use('/fhir', createProxyMiddleware({
    target: backendTarget,
    changeOrigin: true
  }));
};