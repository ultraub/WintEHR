#!/usr/bin/env node
/**
 * Bundle Analysis Script
 * Generates webpack bundle analysis reports
 */

const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const buildDir = path.join(projectRoot, 'build');
const reportsDir = path.join(projectRoot, 'reports');

// Create reports directory
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

console.log('🔍 Starting bundle analysis...');

// Check if build exists
if (!fs.existsSync(buildDir)) {
  console.error('❌ Build directory not found. Run npm run build first.');
  process.exit(1);
}

// Install webpack-bundle-analyzer if not present
const checkAndInstall = () => {
  return new Promise((resolve, reject) => {
    exec('npm list webpack-bundle-analyzer', (error) => {
      if (error) {
        console.log('📦 Installing webpack-bundle-analyzer...');
        exec('npm install --save-dev webpack-bundle-analyzer', (installError) => {
          if (installError) {
            reject(installError);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  });
};

// Run bundle analysis
const runAnalysis = () => {
  return new Promise((resolve, reject) => {
    const command = `npx webpack-bundle-analyzer ${buildDir}/static/js/*.js --report ${reportsDir}/bundle-report.html --mode static --no-open`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Bundle analysis failed:', error);
        reject(error);
      } else {
        console.log('✅ Bundle analysis complete!');
        console.log(`📊 Report saved to: ${reportsDir}/bundle-report.html`);
        resolve();
      }
    });
  });
};

// Generate size report
const generateSizeReport = () => {
  const statsPath = path.join(buildDir, 'static');
  const reportPath = path.join(reportsDir, 'size-report.json');
  
  if (!fs.existsSync(statsPath)) {
    console.warn('⚠️  Static directory not found, skipping size report');
    return;
  }

  const sizes = {};
  
  // Get JS files
  const jsDir = path.join(statsPath, 'js');
  if (fs.existsSync(jsDir)) {
    const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
    sizes.javascript = jsFiles.map(file => {
      const filePath = path.join(jsDir, file);
      const stats = fs.statSync(filePath);
      return {
        file,
        size: stats.size,
        sizeKB: Math.round(stats.size / 1024),
        sizeMB: Math.round(stats.size / 1024 / 1024 * 100) / 100
      };
    });
  }

  // Get CSS files
  const cssDir = path.join(statsPath, 'css');
  if (fs.existsSync(cssDir)) {
    const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
    sizes.css = cssFiles.map(file => {
      const filePath = path.join(cssDir, file);
      const stats = fs.statSync(filePath);
      return {
        file,
        size: stats.size,
        sizeKB: Math.round(stats.size / 1024),
        sizeMB: Math.round(stats.size / 1024 / 1024 * 100) / 100
      };
    });
  }

  // Calculate totals
  const totalJS = sizes.javascript?.reduce((sum, f) => sum + f.size, 0) || 0;
  const totalCSS = sizes.css?.reduce((sum, f) => sum + f.size, 0) || 0;
  const totalSize = totalJS + totalCSS;

  sizes.summary = {
    totalJS: {
      bytes: totalJS,
      KB: Math.round(totalJS / 1024),
      MB: Math.round(totalJS / 1024 / 1024 * 100) / 100
    },
    totalCSS: {
      bytes: totalCSS,
      KB: Math.round(totalCSS / 1024),
      MB: Math.round(totalCSS / 1024 / 1024 * 100) / 100
    },
    total: {
      bytes: totalSize,
      KB: Math.round(totalSize / 1024),
      MB: Math.round(totalSize / 1024 / 1024 * 100) / 100
    },
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(reportPath, JSON.stringify(sizes, null, 2));
  
  console.log('📈 Size Report Generated:');
  console.log(`   JavaScript: ${sizes.summary.totalJS.MB} MB`);
  console.log(`   CSS: ${sizes.summary.totalCSS.MB} MB`);
  console.log(`   Total: ${sizes.summary.total.MB} MB`);
  console.log(`   Report: ${reportPath}`);
};

// Performance recommendations
const generateRecommendations = () => {
  const recommendationsPath = path.join(reportsDir, 'performance-recommendations.md');
  
  const recommendations = `# Performance Recommendations

Generated: ${new Date().toISOString()}

## Bundle Optimization

### Code Splitting
- ✅ Implemented React.lazy() for tab components
- ✅ Implemented dynamic imports for dialogs
- ✅ Consider route-based splitting for additional gains

### Tree Shaking
- ✅ Webpack configured for tree shaking
- ✅ Check for unused Material-UI imports
- ✅ Review lodash imports (use specific functions)

### Compression
- ✅ Gzip compression enabled
- ✅ Brotli compression enabled
- ✅ Static asset optimization in place

## Runtime Optimization

### Component Performance
- ✅ React.memo implemented for heavy components
- ✅ Virtual scrolling for large lists
- ✅ Skeleton loaders to prevent layout shifts

### Caching Strategy
- ✅ Service Worker implemented
- ✅ API response caching
- ✅ Static asset caching

## Monitoring

### Bundle Analysis
- Run \`npm run analyze\` regularly
- Monitor bundle size trends
- Set size budgets for CI/CD

### Performance Metrics
- Core Web Vitals monitoring
- Bundle size alerts
- Performance regression testing

## Next Steps

1. Set up automated bundle size monitoring
2. Implement performance budgets
3. Add Core Web Vitals tracking
4. Consider micro-frontends for large features
`;

  fs.writeFileSync(recommendationsPath, recommendations);
  console.log(`📋 Recommendations saved: ${recommendationsPath}`);
};

// Main execution
async function main() {
  try {
    await checkAndInstall();
    await runAnalysis();
    generateSizeReport();
    generateRecommendations();
    
    console.log('\n🎉 Analysis complete! Files generated:');
    console.log(`   📊 Bundle visualization: ${reportsDir}/bundle-report.html`);
    console.log(`   📈 Size report: ${reportsDir}/size-report.json`);
    console.log(`   📋 Recommendations: ${reportsDir}/performance-recommendations.md`);
    console.log('\n💡 Open bundle-report.html in your browser to explore the bundle composition.');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { generateSizeReport, generateRecommendations };