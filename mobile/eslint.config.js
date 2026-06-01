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
      // TypeScript — keep `any` allowed (RN ecosystem requires escape hatches:
      // Ionicons glyph names, Animated callbacks, opaque 3rd-party JS modules).
      // The stronger safety net is `strictNullChecks` in tsconfig.json.
      '@typescript-eslint/no-explicit-any': 'off',
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
