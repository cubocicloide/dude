import { z } from 'zod'

/**
 * Schema for the per-project `dude.config.ts` file.
 *
 * Kept intentionally minimal in the bootstrap phase: only the `stack` field
 * is required. Additional fields (rules, AI review, etc.) will be added as
 * the corresponding features land.
 */
export const dudeConfigSchema = z.object({
  /**
   * Identifier of the stack plugin powering this project.
   *
   * Accepted forms:
   *   - short name from the registry          → "react-fastapi"
   *   - full npm spec                         → "@cubocicloide/stack-react-fastapi@0.1.0"
   *   - local path (development)              → { path: "../stacks/react-fastapi" }
   */
  stack: z.union([
    z.string().min(1),
    z.object({ path: z.string().min(1) }),
    z.object({ package: z.string().min(1) }),
  ]),
})

export type DudeConfig = z.infer<typeof dudeConfigSchema>

/**
 * Identity helper that gives projects full TypeScript type-checking on their
 * `dude.config.ts`. Returns the input unchanged at runtime.
 */
export function defineConfig(config: DudeConfig): DudeConfig {
  return dudeConfigSchema.parse(config)
}
