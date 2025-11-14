/* eslint-disable @typescript-eslint/no-var-requires */
module.exports = {
  root: true,
  extends: ['@config/root/eslint/base'],
  ignorePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/.turbo/**',
    '**/.vercel/**',
    '**/coverage/**'
  ],
  overrides: [
    {
      files: ['apps/web/**/*.{ts,tsx}'],
      env: { browser: true, node: false }
    },
    {
      files: ['apps/api/**/*.{ts,tsx}'],
      env: { node: true, browser: false }
    },
    {
      files: ['packages/**/*.{ts,tsx}'],
      env: { node: true, browser: false }
    }
  ]
};


