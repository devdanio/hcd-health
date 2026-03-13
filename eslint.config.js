//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.nitro/**',
      '**/.output/**',
      '**/coverage/**',
      'data-scripts/**',
      'public/**',
      'public-components/**',
      'test.js',
      'eslint.config.js',
      'prettier.config.js',
      'src/generated/**',
      'prisma/migrations/**',
      'src/server/lib/**',
    ],
  },
  ...tanstackConfig,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // TanStack config is great, but these rules are too noisy for shadcn + boilerplate.
      'sort-imports': 'off',
      'import/consistent-type-specifier-style': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
  },
]
