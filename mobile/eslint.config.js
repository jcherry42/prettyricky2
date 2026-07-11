const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', '.expo/**', 'babel.config.js', 'jest.config.js'],
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // TypeScript — `: any` is allowed as a warning during the typing-sprint
      // migration. Catch blocks default to `unknown` and use the `errorMessage()`
      // helper for safe narrowing. Remaining `any` usages are tracked via this
      // warning so they can be picked off incrementally without blocking dev.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-require-imports': 'off',

      // Redundancy prevention — fail CI if duplicate imports appear.
      'no-duplicate-imports': 'error',

      // Code quality
      'no-console': ['warn', { allow: ['warn', 'error', 'debug', 'log'] }],
    },
  },
];
