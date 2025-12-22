import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig(({ mode }) => ({
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
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart({ srcDirectory: 'src' }),
    mode === 'production' ? nitro() : null,
    viteReact(),
  ],
}))

export default config

// import { defineConfig } from 'vite'
// import { tanstackStart } from '@tanstack/react-start/plugin/vite'
// import viteReact from '@vitejs/plugin-react'
// import viteTsConfigPaths from 'vite-tsconfig-paths'
// import tailwindcss from '@tailwindcss/vite'
// import { nitro } from 'nitro/vite'
// import preact from '@preact/preset-vite'
// import { resolve } from 'path'

// export default defineConfig(({ mode }) => {
//   const isTracker = mode === 'tracker'

//   // -----------------------------
//   // TRACKER BUILD (isolated)
//   // -----------------------------
//   if (isTracker) {
//     return {
//       plugins: [preact(), tailwindcss()],
//       publicDir: false,
//       build: {
//         outDir: 'public/scripts/tracker',
//         emptyOutDir: false,
//         lib: {
//           entry: resolve(__dirname, 'public-components/tracker/index.ts'),
//           name: 'HCHTracker',
//           fileName: () => 'tracker.js',
//           formats: ['iife'],
//         },
//         rollupOptions: {
//           output: {
//             extend: true,
//           },
//         },
//       },
//       define: {
//         'process.env': {},
//       },
//     }
//   }

//   // -----------------------------
//   // TANSTACK START (unchanged)
//   // -----------------------------
//   return {
//     // optimizeDeps: {
//     //   include: ['@clerk/tanstack-react-start'],
//     // },
//     resolve: {
//       alias: {
//         cookie: 'cookie-es',
//       },
//     },
//     ssr: {
//       external: ['@prisma/client', '@prisma/adapter-pg', 'pg', 'pg-pool'],
//     },
//     plugins: [
//       viteTsConfigPaths({
//         projects: ['./tsconfig.json'],
//       }),
//       tailwindcss(),
//       tanstackStart({ srcDirectory: 'src' }),
//       mode === 'production' ? nitro() : null,
//       viteReact(),
//     ],
//   }
// })
