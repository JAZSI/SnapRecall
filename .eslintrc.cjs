/* eslint-env node */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  settings: { react: { version: 'detect' } },
  ignorePatterns: ['out/', 'dist/', 'release/', 'node_modules/', '*.config.ts'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      files: ['src/renderer/**/*'],
      rules: {
        'no-restricted-imports': [
          'error',
          { patterns: ['@main/*'], paths: [{ name: 'electron', message: 'Renderer must use window.snap, not electron.' }] },
        ],
      },
    },
  ],
};
