import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { attachConsole } from '@tauri-apps/plugin-log'
import './index.css'
import { App } from './App'

// Forward Rust-side log records (log::info!, log::warn!, …) to the webview
// devtools console. No-op when the app runs outside Tauri (plain `vite dev`).
attachConsole().catch(() => {
  console.warn(
    'Not running inside Tauri — Rust logs will not reach this console.'
  )
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
