import { invoke } from '@tauri-apps/api/core'

/**
 * Typed wrapper for the `greet` command (src-tauri/src/commands/greet.rs).
 *
 * Every Tauri command gets exactly one wrapper like this: the frontend never
 * calls invoke() directly (lint rule FE009). Argument keys are camelCase here
 * and snake_case on the Rust side — Tauri converts automatically.
 *
 * On failure the promise rejects with the serialized `AppError` message.
 */
export async function greet(name: string): Promise<string> {
  return invoke<string>('greet', { name })
}
