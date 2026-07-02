import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Set by `tauri android dev --host` / `tauri ios dev --host` so a physical
// device on the local network can reach the dev server.
// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST

// Vite config tuned for Tauri development:
// https://tauri.app/start/frontend/vite/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Don't obscure Rust compiler errors with Vite's screen clearing.
  clearScreen: false,
  server: {
    // Tauri expects a fixed port (see build.devUrl in src-tauri/tauri.conf.json).
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Don't reload the frontend when the Rust backend recompiles.
      ignored: ['**/src-tauri/**'],
    },
  },
})
