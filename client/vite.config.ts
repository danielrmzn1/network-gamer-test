import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const SERVER = 'http://localhost:8787'
const sharedDir = fileURLToPath(new URL('../shared', import.meta.url))

// During dev, Vite serves the UI on :5173 and proxies all network-test
// traffic to the Node measurement server on :8787 (same-origin in prod).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@shared': sharedDir },
  },
  server: {
    port: 5173,
    // shared/ lives outside the client root; allow Vite to read it.
    fs: { allow: ['..'] },
    proxy: {
      '/api': { target: SERVER, changeOrigin: true },
      '/dl': { target: SERVER, changeOrigin: true },
      '/ul': { target: SERVER, changeOrigin: true },
      '/net': { target: SERVER, ws: true, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
  },
})
