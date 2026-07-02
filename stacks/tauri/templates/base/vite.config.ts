import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

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
    watch: {
      // Don't reload the frontend when the Rust backend recompiles.
      ignored: ['**/src-tauri/**'],
    },
  },
})
