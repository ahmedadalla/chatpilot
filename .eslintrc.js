module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: ['dist', 'build', '.next', 'node_modules', '*.js'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',

    // Security CI Lint Gate A: Prohibit raw prisma.<model> access outside ScopedPrismaModule
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.property.name='$executeRawUnsafe'] > TemplateLiteral",
        message: 'Security Lint Gate C: $executeRawUnsafe with template literals is strictly prohibited in GUC and DB paths.',
      },
    ],
  },
  overrides: [
    {
      // Prohibit scope = 'platform' outside PlatformSupportService
      files: ['apps/**/*', 'packages/**/*'],
      excludedFiles: ['**/platform-support.service.ts', '**/platform-support/**', '**/tests/**'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: "Literal[value='platform']",
            message: "Security Lint Gate B: Setting scope='platform' is strictly restricted to PlatformSupportService.",
          },
        ],
      },
    },
  ],
};
