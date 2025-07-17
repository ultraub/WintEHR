const CompressionPlugin = require('compression-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  webpack: {
    plugins: {
      add: [
        // Gzip compression for production builds
        ...(process.env.NODE_ENV === 'production' 
          ? [
              new CompressionPlugin({
                filename: '[path][base].gz',
                algorithm: 'gzip',
                test: /\.(js|css|html|svg)$/,
                threshold: 8192,
                minRatio: 0.8,
              }),
              // Brotli compression for better compression ratios
              new CompressionPlugin({
                filename: '[path][base].br',
                algorithm: 'brotliCompress',
                test: /\.(js|css|html|svg)$/,
                threshold: 8192,
                minRatio: 0.8,
              }),
            ]
          : []),
        
        // Bundle analyzer (only when ANALYZE=true)
        ...(process.env.ANALYZE === 'true' 
          ? [new BundleAnalyzerPlugin({ openAnalyzer: false })]
          : []),
      ],
    },
    configure: (webpackConfig, { env, paths }) => {
      // Production optimizations
      if (env === 'production') {
        // Optimize chunks for better caching
        webpackConfig.optimization = {
          ...webpackConfig.optimization,
          splitChunks: {
            chunks: 'all',
            cacheGroups: {
              // Vendor chunk for React and core libraries
              vendor: {
                test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
                name: 'vendor',
                chunks: 'all',
                priority: 20,
              },
              // MUI chunk for Material-UI components
              mui: {
                test: /[\\/]node_modules[\\/]@mui[\\/]/,
                name: 'mui',
                chunks: 'all',
                priority: 15,
              },
              // Charts and visualization libraries
              charts: {
                test: /[\\/]node_modules[\\/](chart\.js|recharts|react-chartjs-2|cornerstone)[\\/]/,
                name: 'charts',
                chunks: 'all',
                priority: 10,
              },
              // Common utilities
              utils: {
                test: /[\\/]node_modules[\\/](axios|date-fns|uuid|lodash)[\\/]/,
                name: 'utils',
                chunks: 'all',
                priority: 5,
              },
              // Default chunk for other node_modules
              default: {
                minChunks: 2,
                priority: -10,
                reuseExistingChunk: true,
              },
            },
          },
        };

        // Tree shaking and optimization
        webpackConfig.optimization.usedExports = true;
        webpackConfig.optimization.sideEffects = false;
      }

      return webpackConfig;
    },
  },
  devServer: {
    // Bind to all interfaces for Docker access
    host: '0.0.0.0',
    port: 3000,
    // Allow connections from any host
    allowedHosts: 'all',
    // Disable problematic features for Docker
    compress: false,
    // Disable caching in development
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
    // Ensure hot reload works properly
    hot: true,
    liveReload: true,
    watchFiles: {
      paths: ['src/**/*'],
      options: {
        usePolling: true,
        interval: 1000
      }
    }
  },
  babel: {
    plugins: [
      // Remove console.log in production
      ...(process.env.NODE_ENV === 'production' 
        ? [['transform-remove-console', { exclude: ['error', 'warn'] }]]
        : []),
    ],
  },
};