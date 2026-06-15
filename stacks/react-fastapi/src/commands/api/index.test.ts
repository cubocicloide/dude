import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'pathe'
import yaml from 'yaml'
import { makeProject, mockProcessExit, ProcessExitError, captureIO, makeCtx } from '../_testkit'
import { syncCommand, reviewCommand } from './index'

const NO_OVERRIDE = '// openapi-no-override'
const OUT = 'frontend/src/openapi'

/** A small OpenAPI3 spec with one route exercising both generators. */
function makeSpec() {
  return {
    openapi: '3.1.0',
    info: { title: 'Test', version: '1.0.0' },
    paths: {
      '/todos/{id}': {
        get: {
          parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer' } }],
          responses: {
            '200': {
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/Todo' } },
              },
            },
          },
        },
        post: {
          requestBody: {
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Todo' } },
            },
          },
          responses: {
            '200': {
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/Todo' } },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Todo: {
          type: 'object',
          properties: { id: { type: 'integer' }, title: { type: 'string' } },
        },
      },
    },
  }
}

/**
 * A project pre-seeded with the openapi.types.ts no-override marker so the
 * network-hitting openapiTS() call is skipped.
 */
function seededProject() {
  return makeProject({
    [`${OUT}/utils/openapi.types.ts`]: `${NO_OVERRIDE}\nexport type paths = {}\n`,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api sync', () => {
  it('writes openapi.yaml and generates per-route types.ts + index.ts', async () => {
    const spec = makeSpec()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => spec }))
    const io = captureIO()
    const root = seededProject()

    await syncCommand.run!(makeCtx(root))

    // openapi.yaml round-trips the spec.
    const yamlPath = path.join(root, OUT, 'utils', 'openapi.yaml')
    const savedSpec = yaml.parse(readFileSync(yamlPath, 'utf8'))
    expect(savedSpec.paths['/todos/{id}']).toBeTruthy()

    // The no-override types file was skipped (no network).
    expect(io.stdout()).toContain('Skipped (no-override)')
    expect(io.stdout()).toContain('openapi.types.ts')

    // Per-route folder (routeToSegments: {id} -> [id]).
    const routeDir = path.join(root, OUT, 'todos', '[id]')

    const typesContent = readFileSync(path.join(routeDir, 'types.ts'), 'utf8')
    expect(typesContent).toContain(`import type { paths, components } from '../../../utils/openapi.types'`)
    expect(typesContent).toContain(`export type GetParameters = paths['/todos/{id}']['get']['parameters']['query']`)
    expect(typesContent).toContain(`export type GetResponse = components['schemas']['Todo']`)
    expect(typesContent).toContain(`export type PostRequestBody = components['schemas']['Todo']`)
    expect(typesContent).toContain(`export type PostResponse = components['schemas']['Todo']`)

    const indexContent = readFileSync(path.join(routeDir, 'index.ts'), 'utf8')
    expect(indexContent).toContain(`import type { GetParameters, GetResponse, PostRequestBody, PostResponse } from './types'`)
    // get: has path param + query, no method/body.
    expect(indexContent).toContain('export const $get = (id: string, params: GetParameters): Promise<GetResponse> => {')
    expect(indexContent).toContain('const uri = `/todos/${id}`')
    expect(indexContent).toContain(`new URLSearchParams(params as Record<string, string>)`)
    // post: method + body.
    expect(indexContent).toContain('export const $post = (id: string, body: PostRequestBody): Promise<PostResponse> => {')
    expect(indexContent).toContain(`method: 'POST'`)
    expect(indexContent).toContain('body: JSON.stringify(body)')

    // Summary: 2 files written (types.ts + index.ts), 0 skipped from the routes.
    expect(io.stdout()).toContain('2 file(s) written, 0 skipped (no-override).')
  })

  it('exits 1 and reports a fetch failure when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }))
    const exit = mockProcessExit()
    const io = captureIO()
    const root = seededProject()

    await expect(syncCommand.run!(makeCtx(root))).rejects.toThrow(ProcessExitError)
    expect(exit).toHaveBeenCalledWith(1)
    expect(io.stderr()).toContain('could not fetch OpenAPI spec')
  })

  it('exits 1 when fetch rejects outright', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')))
    const exit = mockProcessExit()
    const io = captureIO()
    const root = seededProject()

    await expect(syncCommand.run!(makeCtx(root))).rejects.toThrow(ProcessExitError)
    expect(exit).toHaveBeenCalledWith(1)
    expect(io.stderr()).toContain('could not fetch OpenAPI spec')
  })
})

/**
 * Build a clean openapi tree that exactly matches the spec so review passes.
 * Generates the tree by running sync first.
 */
async function buildCleanTree() {
  const spec = makeSpec()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => spec }))
  const io = captureIO()
  const root = seededProject()
  await syncCommand.run!(makeCtx(root))
  io.restore()
  vi.unstubAllGlobals()
  return root
}

describe('api review', () => {
  it('exits 1 when openapi.yaml is not found', async () => {
    const exit = mockProcessExit()
    const io = captureIO()
    const root = makeProject({ [`${OUT}/utils/.keep`]: '' })

    await expect(reviewCommand.run!(makeCtx(root))).rejects.toThrow(ProcessExitError)
    expect(exit).toHaveBeenCalledWith(1)
    expect(io.stderr()).toContain('not found')
  })

  it('reports "No issues found." for a clean matching tree', async () => {
    const root = await buildCleanTree()
    const io = captureIO()

    await expect(reviewCommand.run!(makeCtx(root))).resolves.toBeUndefined()
    expect(io.stdout()).toContain('No issues found.')
  })

  it('exits 1 and flags an unexpected file in the out dir', async () => {
    const root = await buildCleanTree()
    // Add a stray file not described by the spec.
    const strayPath = path.join(root, OUT, 'todos', '[id]', 'stray.ts')
    mkdirSync(path.dirname(strayPath), { recursive: true })
    writeFileSync(strayPath, 'export const x = 1\n')

    const exit = mockProcessExit()
    const io = captureIO()

    await expect(reviewCommand.run!(makeCtx(root))).rejects.toThrow(ProcessExitError)
    expect(exit).toHaveBeenCalledWith(1)
    expect(io.stdout()).toContain('stray.ts')
    expect(io.stdout()).toContain('unexpected')
  })
})
