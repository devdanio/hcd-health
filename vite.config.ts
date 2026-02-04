import { resolve } from 'node:path'

import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

export default defineConfig(({ mode }) => {
  const isTracker = mode === 'tracker'

  // -----------------------------
  // TRACKER BUILD (isolated)
  // -----------------------------
  if (isTracker) {
    return {
      plugins: [tailwindcss()],
      publicDir: false,
      build: {
        outDir: 'public/scripts/tracker',
        emptyOutDir: false,
        lib: {
          entry: resolve(__dirname, 'public-components/tracker/index.ts'),
          name: 'HCHTracker',
          fileName: () => 'tracker.js',
          formats: ['iife'],
        },
        rollupOptions: {
          output: {
            extend: true,
          },
        },
      },
      define: {
        'process.env': {},
      },
    }
  }

  // -----------------------------
  // TANSTACK START (default)
  // -----------------------------
  return {
    optimizeDeps: {
      include: ['@clerk/tanstack-react-start', 'cookie-es'],
    },
    resolve: {
      alias: {
        cookie: 'cookie-es',
      },
    },
    ssr: {
      external: ['@prisma/client', '@prisma/adapter-pg', 'pg', 'pg-pool'],
    },
    plugins: [
      viteTsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
      tailwindcss(),
      tanstackStart({ srcDirectory: 'src' }),
      mode === 'production' ? nitro() : null,
      viteReact(),
    ],
  }
})
