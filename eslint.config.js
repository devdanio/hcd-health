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
]
