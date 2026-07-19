// ESLint 9 flat config.
// Encodes the architectural boundaries as lint rules so they cannot erode:
//   - features may not import from other features
//   - only services/ performs I/O
//   - tax-engine may not import React
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist/**', 'build/**', 'preview/**', 'tools/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: '19.1' } },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // jsx:"react-jsx" means React need not be in scope
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      // The defect class that reached a reviewer twice: unused imports.
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],

      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Architectural boundaries from ARCHITECTURE.md §3
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['../*/features/*', '**/features/*/!(index)'],
            message: 'Features may not import from other features. Move shared code to components/ or services/.' },
        ],
      }],
    },
  },
  {
    // The tax engine is deterministic and framework-free.
    files: ['src/tax-engine/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'react', message: 'The tax engine must not depend on React.' },
          { name: '../services', message: 'The tax engine must not perform I/O.' },
        ],
      }],
    },
  },
  {
    files: ['src/tests/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off', 'no-console': 'off' },
  }
);
