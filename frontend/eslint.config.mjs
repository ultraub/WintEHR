// ESLint 9 flat config — replaces the package.json `eslintConfig` block that
// extended `react-app` / `react-app/jest`.
//
// eslint-config-react-app is unmaintained (it died with CRA) and never
// supported ESLint 9, so this config REPRODUCES its curated rule set rather
// than adopting `js.configs.recommended`-style presets — react-app was a
// deliberately minimal likely-bug catcher, and swapping in a broad preset
// would bury the real signal under thousands of new stylistic findings.
// Severity choices (warn vs error) mirror react-app so the lint baseline
// stays comparable across the migration.

import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';
import jestPlugin from 'eslint-plugin-jest';
import testingLibrary from 'eslint-plugin-testing-library';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

const sharedRules = {
  // --- likely bugs (react-app severities)
  'no-undef': 'error',
  'no-unused-vars': ['warn', {
    args: 'none', ignoreRestSiblings: true,
    // eslint 9 default became caughtErrors:'all'; keep the eslint-8 baseline —
    // unused catch bindings are the E2 silent-catch sweep's business.
    caughtErrors: 'none',
  }],
  'default-case': ['warn', { commentPattern: '^no default$' }],
  'no-useless-escape': 'warn',
  'no-dupe-keys': 'error',
  'no-dupe-args': 'error',
  'no-dupe-class-members': 'error',
  'no-duplicate-case': 'error',
  'no-unreachable': 'warn',
  'no-const-assign': 'error',
  'no-delete-var': 'error',
  'no-func-assign': 'error',
  'no-redeclare': 'error',
  'no-self-assign': 'error',
  'no-this-before-super': 'error',
  'no-undef-init': 'warn',
  'no-unused-expressions': ['error', {
    allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true,
  }],
  'use-isnan': 'warn',
  'valid-typeof': 'warn',
  eqeqeq: ['warn', 'smart'],
  'array-callback-return': 'warn',
  'no-loop-func': 'warn',
  'no-mixed-operators': ['warn', {
    groups: [
      ['&', '|', '^', '~', '<<', '>>', '>>>'],
      ['==', '!=', '===', '!==', '>', '>=', '<', '<='],
      ['&&', '||'],
      ['in', 'instanceof'],
    ],
    allowSamePrecedence: false,
  }],
  'no-throw-literal': 'warn',
  'require-yield': 'warn',
  'getter-return': 'warn',

  // --- react
  'react/jsx-no-undef': 'error',
  'react/jsx-uses-react': 'warn',
  'react/jsx-uses-vars': 'warn',
  'react/jsx-no-duplicate-props': ['warn', { ignoreCase: true }],
  'react/jsx-pascal-case': ['warn', { allowAllCaps: true, ignore: [] }],
  'react/no-danger-with-children': 'warn',
  'react/no-direct-mutation-state': 'warn',
  'react/no-typos': 'error',
  'react/require-render-return': 'error',
  'react/style-prop-object': 'warn',
  // New JSX transform — React import not required in scope:
  'react/react-in-jsx-scope': 'off',

  // --- hooks
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'warn',

  // --- import hygiene
  'import/no-anonymous-default-export': 'warn',
};

const sharedLanguageOptions = {
  ecmaVersion: 'latest',
  sourceType: 'module',
  parserOptions: { ecmaFeatures: { jsx: true } },
  globals: {
    ...globals.browser,
    ...globals.es2021,
    process: 'readonly', // vite `define` provides process.env.NODE_ENV
  },
};

export default [
  {
    ignores: ['build/**', 'dev-dist/**', 'node_modules/**', 'coverage/**'],
  },

  // Module SDK boundary (module platform Phase 3, docs/MODULES.md):
  // manifest-module code imports platform APIs ONLY through src/modules/sdk.js.
  // This is the contract that lets out-of-repo modules survive core
  // refactors — deep imports would couple them to internals. Third-party
  // packages (react, @mui/*, ...) are unaffected. cds-studio and
  // ui-composer live under src/modules/ for historical reasons and are NOT
  // manifest modules; they are deliberately not listed here.
  {
    files: ['src/modules/{flowsheets,scheduling,quality-analytics,inpatient}/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['../*', '../../**', '!../sdk'],
          message:
            'Module code imports platform APIs from the SDK only (src/modules/sdk.js) — see docs/MODULES.md.',
        }],
      }],
    },
  },

  // Application source (JS/JSX)
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
      import: importPlugin,
    },
    languageOptions: sharedLanguageOptions,
    settings: { react: { version: 'detect' } },
    rules: sharedRules,
  },

  // TypeScript source — plus the historically Flow/TS-annotated .js files
  // that vite.config.js feeds through esbuild's tsx loader. eslint 8 reported
  // them as unparseable; routing them through the TS parser lints them.
  {
    files: [
      'src/**/*.{ts,tsx}',
      'src/components/clinical/dialogs/resources/*.js',
      'src/components/clinical/shared/dialogs/SimplifiedClinicalDialog.js',
      'src/components/fhir/fields/index.js',
      'src/hooks/fhir/useResourceSearch.js',
      'src/modules/cds-studio/monaco/cqlLanguage.js',
      'src/modules/cds-studio/utils/cqlDefineExtractor.js',
    ],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
      import: importPlugin,
      '@typescript-eslint': tsPlugin,
    },
    languageOptions: {
      ...sharedLanguageOptions,
      parser: tsParser,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...sharedRules,
      // TS compiler owns undef/redeclare analysis for TS files
      'no-undef': 'off',
      'no-redeclare': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true, caughtErrors: 'none' }],
    },
  },

  // Tests (vitest exposes a jest-compatible API, so the jest plugin's
  // bug-catchers — valid-expect etc. — apply as-is; `react-app/jest` provided
  // these before)
  {
    files: [
      'src/**/__tests__/**/*.{js,jsx,ts,tsx}',
      'src/**/*.{test,spec}.{js,jsx,ts,tsx}',
      'src/setupTests.js',
      'src/test-utils/**/*.{js,jsx}',
    ],
    plugins: {
      jest: jestPlugin,
      'testing-library': testingLibrary,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node, // vitest runs in Node — `global` is real here
        ...globals.jest,
        vi: 'readonly',
        vitest: 'readonly',
      },
    },
    rules: {
      'jest/valid-expect': 'warn',
      'jest/valid-expect-in-promise': 'warn',
      'jest/no-conditional-expect': 'warn',
      'jest/no-identical-title': 'warn',
      'testing-library/no-node-access': 'warn',
      'testing-library/no-wait-for-multiple-assertions': 'warn',
      'testing-library/no-unnecessary-act': 'warn',
      'testing-library/prefer-screen-queries': 'off',
    },
  },
];
