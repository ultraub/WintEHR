/**
 * Webpack Configuration Optimizations for Clinical Workspace
 * These optimizations should be merged with the main webpack configuration
 */

const TerserPlugin = require('terser-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const { BundleBuddyWebpackPlugin } = require('bundle-buddy-webpack-plugin');

module.exports = {
  // Production optimizations
  optimization: {
    // Enable tree shaking
    usedExports: true,
    sideEffects: false,
    
    // Module concatenation (scope hoisting)
    concatenateModules: true,
    
    // Minimize in production
    minimize: process.env.NODE_ENV === 'production',
    
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          parse: {
            ecma: 8
          },
          compress: {
            ecma: 5,
            warnings: false,
            comparisons: false,
            inline: 2,
            drop_console: process.env.NODE_ENV === 'production',
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.info', 'console.debug']
          },
          mangle: {
            safari10: true
          },
          output: {
            ecma: 5,
            comments: false,
            ascii_only: true
          }
        },
        parallel: true,
        cache: true
      })
    ],
    
    // Split runtime chunk for better caching
    runtimeChunk: {
      name: 'runtime'
    },
    
    // Module IDs for consistent hashing
    moduleIds: 'deterministic',
    chunkIds: 'deterministic',
    
    // Split chunks configuration
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        // Vendor libraries
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
          reuseExistingChunk: true
        },
        
        // React and related libraries
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
          name: 'react',
          priority: 20
        },
        
        // Material-UI
        mui: {
          test: /[\\/]node_modules[\\/]@mui[\\/]/,
          name: 'mui',
          priority: 15
        },
        
        // Date utilities
        date: {
          test: /[\\/]node_modules[\\/](date-fns|moment|dayjs)[\\/]/,
          name: 'date-utils',
          priority: 15
        },
        
        // Chart libraries
        charts: {
          test: /[\\/]node_modules[\\/](d3|recharts|chart\.js)[\\/]/,
          name: 'charts',
          priority: 15
        },
        
        // Clinical components
        clinical: {
          test: /[\\/]src[\\/]components[\\/]clinical[\\/]/,
          name: 'clinical',
          priority: 5,
          minChunks: 2,
          reuseExistingChunk: true
        },
        
        // Common components
        common: {
          test: /[\\/]src[\\/]components[\\/]common[\\/]/,
          name: 'common',
          priority: 5,
          minChunks: 3,
          reuseExistingChunk: true
        },
        
        // Default chunk
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true
        }
      }
    }
  },
  
  // Module rules for optimization
  module: {
    rules: [
      // Optimize images
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/,
        use: [
          {
            loader: 'image-webpack-loader',
            options: {
              mozjpeg: {
                progressive: true,
                quality: 75
              },
              optipng: {
                enabled: false
              },
              pngquant: {
                quality: [0.65, 0.90],
                speed: 4
              },
              gifsicle: {
                interlaced: false
              },
              webp: {
                quality: 75
              }
            }
          }
        ]
      }
    ]
  },
  
  // Plugins for optimization
  plugins: [
    // Compression
    new CompressionPlugin({
      filename: '[path][base].gz',
      algorithm: 'gzip',
      test: /\.(js|css|html|svg)$/,
      threshold: 8192,
      minRatio: 0.8
    }),
    
    // Brotli compression
    new CompressionPlugin({
      filename: '[path][base].br',
      algorithm: 'brotliCompress',
      test: /\.(js|css|html|svg)$/,
      compressionOptions: {
        level: 11
      },
      threshold: 8192,
      minRatio: 0.8
    }),
    
    // Bundle analysis (development only)
    process.env.ANALYZE && new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      reportFilename: '../bundle-report.html',
      openAnalyzer: false,
      generateStatsFile: true,
      statsFilename: '../bundle-stats.json'
    }),
    
    // Bundle buddy for duplicate detection
    process.env.ANALYZE && new BundleBuddyWebpackPlugin({
      sam: true
    })
  ].filter(Boolean),
  
  // Performance hints
  performance: {
    hints: process.env.NODE_ENV === 'production' ? 'warning' : false,
    maxEntrypointSize: 512000, // 500 KB
    maxAssetSize: 512000, // 500 KB
    assetFilter: function(assetFilename) {
      // Only provide hints for JS and CSS files
      return assetFilename.endsWith('.js') || assetFilename.endsWith('.css');
    }
  },
  
  // Resolve optimizations
  resolve: {
    // Module resolution caching
    symlinks: false,
    cacheWithContext: false,
    
    // Alias for faster resolution
    alias: {
      '@clinical': path.resolve(__dirname, '../'),
      '@components': path.resolve(__dirname, '../../../'),
      '@hooks': path.resolve(__dirname, '../../../../hooks'),
      '@services': path.resolve(__dirname, '../../../../services'),
      '@contexts': path.resolve(__dirname, '../../../../contexts'),
      '@utils': path.resolve(__dirname, '../../../../utils')
    }
  },
  
  // Cache configuration
  cache: {
    type: 'filesystem',
    cacheDirectory: path.resolve(__dirname, '../../../../../.webpack-cache'),
    buildDependencies: {
      config: [__filename]
    }
  }
};

// Specific optimizations for clinical modules
const clinicalModuleOptimizations = {
  // Prefetch hints for critical modules
  prefetchModules: [
    './workspace/tabs/SummaryTab',
    './workspace/tabs/ChartReviewTabOptimized',
    './ui/ClinicalCard',
    './ui/MetricsBar'
  ],
  
  // Preload hints for immediate modules
  preloadModules: [
    '../../../services/fhirService',
    '../../../contexts/FHIRResourceContext',
    '../../../contexts/ClinicalWorkflowContext'
  ],
  
  // Magic comments for dynamic imports
  dynamicImportOptions: {
    webpackChunkName: '[request]',
    webpackMode: 'lazy',
    webpackPrefetch: true
  }
};

// Export configurations
module.exports.clinicalModuleOptimizations = clinicalModuleOptimizations;