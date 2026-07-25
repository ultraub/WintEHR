/// <reference types="vitest" />
import { defineConfig, transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite config — replaces the former CRA (react-scripts 5) + CRACO setup.
 *
 * DEPLOYMENT BOUNDARY (do not change without updating Docker/nginx):
 *  - build.outDir is `build` (NOT Vite's default `dist`). Dockerfile.production
 *    does `COPY --from=builder /app/build /usr/share/nginx/html`.
 *  - envPrefix is `REACT_APP_` so the `ARG REACT_APP_* -> ENV REACT_APP_*`
 *    chain in Dockerfile.production keeps getting baked into the bundle
 *    (Vite's loadEnv merges matching keys out of process.env).
 *  - Emitted assets keep CRA's `static/js`, `static/css`, `static/media`
 *    layout so anything referencing those paths still works.
 *  - `npm run build` still runs `node scripts/postbuild-sw.js` afterwards.
 *  - Dev server stays on 0.0.0.0:3000.
 */

// Docker dev detection, ported verbatim from the deleted src/setupProxy.js.
const isDocker = process.env.HOST === '0.0.0.0';
const backendTarget = isDocker
  ? 'http://emr-backend:8000'
  : process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const hapiFhirTarget = isDocker
  ? 'http://hapi-fhir:8080'
  : process.env.REACT_APP_HAPI_FHIR_URL || 'http://localhost:8888';

/**
 * 320+ `.js` files under src/ contain JSX and are deliberately NOT renamed.
 * Vite's built-in esbuild transform only matches /\.(m?ts|[jt]sx)$/, so plain
 * `.js` would reach Rollup with raw JSX in it.
 *
 * Widening `esbuild.include` is not viable: `esbuild.loader` is one value, so
 * forcing 'jsx' would also hit `.ts`/`.tsx` and break them (verified: it fails
 * on `import type { … }` in fhirClient.ts). Hence this pre-plugin, scoped to
 * `src/**\/*.js` only.
 *
 * The loader is 'tsx', not 'jsx': 7 of the 585 src `.js` files carry type
 * annotations that CRA's babel-preset-react-app happened to accept via
 * @babel/preset-flow (`import type { AllergyIntolerance } …`,
 * `props: TransitionProps & { … }`, `interface Props { … }`). Under the plain
 * 'jsx' loader those 7 fail to parse; under 'tsx' all 585 parse.
 *
 * tsconfigRaw pins the two TS semantics that would otherwise silently differ
 * from plain JS:
 *  - verbatimModuleSyntax: keep every value import (no TS import elision), so
 *    side-effect-only imports are not dropped.
 *  - useDefineForClassFields: JS class-field (define) semantics, not TS's
 *    legacy assignment semantics.
 */
const jsxInJsPlugin = (isProduction) => ({
  name: 'wintehr:jsx-in-js',
  enforce: 'pre',
  async transform(code, id) {
    const file = id.split('?')[0];
    if (!file.endsWith('.js') || !file.includes('/src/') || file.includes('/node_modules/')) {
      return null;
    }
    return transformWithEsbuild(code, file, {
      loader: 'tsx',
      jsx: 'automatic',
      jsxDev: !isProduction,
      tsconfigRaw: {
        compilerOptions: { useDefineForClassFields: true, verbatimModuleSyntax: true },
      },
      // craco used babel-plugin-transform-remove-console with
      // exclude: ['error', 'warn']; `pure` is the esbuild equivalent.
      ...(isProduction ? { pure: ['console.log', 'console.debug', 'console.info'] } : {}),
    });
  },
});

const proxyLogger = (name) => (proxy) => {
  proxy.on('error', (err, req, res) => {
    // eslint-disable-next-line no-console
    console.error(`[${name} Proxy Error]`, err.message, err.code);
    if (res && !res.headersSent && typeof res.writeHead === 'function') {
      const code = err.code === 'ECONNREFUSED' ? 503 : 504;
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: code === 503 ? `${name} service unavailable` : 'Gateway timeout',
          message: err.message,
        })
      );
    }
  });
};

export default defineConfig(async ({ mode }) => {
  const isProduction = mode === 'production';

  // `ANALYZE=true npm run build` -> build/bundle-analysis.html
  // (replacement for webpack-bundle-analyzer).
  const analyzePlugins =
    process.env.ANALYZE === 'true'
      ? [
          (await import('rollup-plugin-visualizer')).visualizer({
            filename: 'build/bundle-analysis.html',
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : [];

  return {
    // CRA-compatible env contract. Vite's loadEnv() pulls every process.env key
    // with this prefix (plus .env files) onto import.meta.env at build time.
    envPrefix: 'REACT_APP_',

    plugins: [
      jsxInJsPlugin(isProduction),
      react({ include: /\.(js|jsx|ts|tsx)$/ }),
      ...analyzePlugins,
    ],

    // Applies to .ts/.tsx/.jsx (Vite's default esbuild filter); the plugin
    // above covers .js.
    esbuild: {
      ...(isProduction ? { pure: ['console.log', 'console.debug', 'console.info'] } : {}),
    },

    optimizeDeps: {
      // The dep scanner also parses src/ entry files, so it needs the same
      // "a .js may contain JSX" assumption.
      esbuildOptions: {
        loader: { '.js': 'tsx' },
      },
    },

    resolve: {
      // Mirrors the craco `webpackConfig.resolve.extensions` override.
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.mjs'],
    },

    define: {
      // 47 `process.env.NODE_ENV` reads across src/ keep working untouched.
      // Skipped under vitest: tests run in node where process.env is real and
      // a few suites assign to process.env.NODE_ENV, which a define would
      // turn into an invalid assignment target.
      ...(mode === 'test' ? {} : { 'process.env.NODE_ENV': JSON.stringify(mode) }),
      // webpack 5 defined this for browser targets; some deps assume it.
      global: 'globalThis',
    },

    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: false,
      watch: {
        usePolling: true,
        interval: 1000,
      },
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
      proxy: {
        // Must precede '/api' — Vite matches proxy keys in insertion order.
        '/api/ws': {
          target: backendTarget,
          ws: true,
          changeOrigin: true,
          configure: proxyLogger('WebSocket'),
        },
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          timeout: 120000,
          proxyTimeout: 120000,
          configure: proxyLogger('API'),
        },
        '/dicom': {
          target: backendTarget,
          changeOrigin: true,
          timeout: 120000,
          proxyTimeout: 120000,
          configure: proxyLogger('DICOM'),
        },
        '/fhir': {
          target: hapiFhirTarget,
          changeOrigin: true,
          timeout: 90000,
          proxyTimeout: 90000,
          // HAPI is mounted at /fhir; drop an optional /R4 segment the way
          // the old pathRewrite did.
          rewrite: (path) => path.replace(/^\/fhir\/R4(?=\/|$)/, '/fhir'),
          configure: proxyLogger('HAPI FHIR'),
        },
        '/.well-known': {
          target: backendTarget,
          changeOrigin: true,
          timeout: 120000,
          proxyTimeout: 120000,
          configure: proxyLogger('SMART Discovery'),
        },
        '/cds-services': {
          target: backendTarget,
          changeOrigin: true,
          timeout: 120000,
          proxyTimeout: 120000,
          rewrite: (path) => path.replace(/^\/cds-services/, '/api/cds-services'),
          configure: proxyLogger('CDS'),
        },
      },
    },

    preview: {
      host: '0.0.0.0',
      port: 3000,
    },

    build: {
      // NON-NEGOTIABLE: the Docker build stage copies /app/build.
      outDir: 'build',
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          // Keep CRA's on-disk layout.
          entryFileNames: 'static/js/[name].[hash].js',
          chunkFileNames: 'static/js/[name].[hash].js',
          assetFileNames: (assetInfo) => {
            const name = assetInfo.names?.[0] || assetInfo.name || '';
            if (name.endsWith('.css')) return 'static/css/[name].[hash][extname]';
            return 'static/media/[name].[hash][extname]';
          },
          // Port of the webpack splitChunks cacheGroups from craco.config.js.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
              return 'vendor';
            }
            if (/[\\/]node_modules[\\/]@mui[\\/]/.test(id)) return 'mui';
            if (/[\\/]node_modules[\\/](chart\.js|recharts|react-chartjs-2|cornerstone[^\\/]*)[\\/]/.test(id)) {
              return 'charts';
            }
            if (/[\\/]node_modules[\\/](axios|date-fns|uuid|lodash[^\\/]*)[\\/]/.test(id)) {
              return 'utils';
            }
            // Stand-in for webpack's `default` cacheGroup (minChunks: 2) for
            // the styling/animation libs that are always in the eager graph.
            // Deliberately NOT a catch-all `return 'common'`: that pulls
            // lazy-route-only deps (monaco, cornerstone, vis-timeline, …) into
            // an eagerly preloaded chunk and inflates first load from ~506 kB
            // to ~840 kB gzipped. Rollup's default behaviour already hoists
            // genuinely shared modules into their own async chunks.
            if (
              /[\\/]node_modules[\\/](@emotion[\\/]|stylis|hoist-non-react-statics|clsx|prop-types|react-is|tslib|notistack|react-transition-group)[\\/]?/.test(
                id
              )
            ) {
              return 'common';
            }
            return undefined;
          },
        },
      },
    },

    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.js',
      css: false,
      include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
      // No transformIgnorePatterns hack needed: Vite transforms ESM-only deps
      // (axios) natively, which is why craco's jest override is gone.
    },
  };
});
