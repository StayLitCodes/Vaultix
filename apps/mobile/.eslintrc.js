module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    es2022: true,
    node: true,
    jest: true,
  },
  ignorePatterns: ['node_modules/', '.expo/', 'dist/', 'coverage/', '*.d.ts'],
  rules: {
    // TypeScript already resolves globals/identifiers.
    'no-undef': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
  },
  overrides: [
    {
      files: ['*.js'],
      parser: 'espree',
      rules: { '@typescript-eslint/no-var-requires': 'off' },
    },
  ],
};
