import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [preact(), tailwindcss()],
  build: {
    outDir: '../../public',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'main.tsx'),
      name: 'ChatWidget',
      fileName: () => 'chat-widget.js',
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
})
