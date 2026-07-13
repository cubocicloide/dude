import { defineLintCommand } from '@cubocicloide/dude'

export const lintCommand = defineLintCommand({
  description: "Check project structure conventions using the stack's own rules (FE + Rust/Tauri).",
})
