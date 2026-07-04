/**
 * Integration test: scaffold option matrix.
 *
 * Drives the real `dude init` CLI (via the Project helper) for each
 * combination of stack options, then verifies — from a customer's point of
 * view — that:
 *
 *   1. the right template overlays were applied (and the disabled ones were not),
 *   2. the SSO choice landed in webserver_config.py / .env.example / compose, and
 *   3. `dude lint` exits 0 on the freshly-scaffolded project.
 *
 * This is the only place the `withEntraId`/`withIac` Handlebars conditionals
 * are exercised end-to-end. Unit tests cover individual lint rules; this
 * proves the variants a user can actually select all scaffold into a
 * lint-clean project.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Project } from '@cubocicloide/dude/testing'

interface Variant {
  name: string
  flags: string[]
  /** Files that must exist. */
  present: string[]
  /** Files that must NOT exist. */
  absent: string[]
  /** Markers that must appear in the given file. */
  contains: Array<{ file: string; marker: string }>
  /** Markers that must NOT appear in the given file. */
  lacks: Array<{ file: string; marker: string }>
}

const IAC_FILES = [
  'iac/terraform/main.tf',
  'iac/terraform/ecs.tf',
  'iac/terraform/rds.tf',
  'iac/terraform/environments/dev/terraform.tfvars',
  'iac/runner/Dockerfile',
  'airflow/Dockerfile.prod',
  'docs/docs/deploy.md',
]

const CORE_FILES = [
  'docker-compose.yml',
  'airflow/Dockerfile',
  'airflow/requirements.txt',
  'airflow/config/webserver_config.py',
  'airflow/dags/lib/defaults.py',
  'airflow/dags/examples/example_etl.py',
  'airflow/dags/examples/example_ecs_task.py',
  'airflow/dags/examples/example_kubernetes_pod.py',
  'airflow/dags/examples/example_batch_compute.py',
  'airflow/plugins/ops_toolkit/__init__.py',
  'airflow/tests/test_dag_integrity.py',
  '.claude/rules/AF/001.md',
  '.claude/rules/AF/010.md',
]

const VARIANTS: Variant[] = [
  {
    name: 'base (native sso, no iac)',
    flags: [],
    present: CORE_FILES,
    absent: IAC_FILES,
    contains: [
      { file: 'airflow/config/webserver_config.py', marker: 'AUTH_DB' },
      { file: '.env.example', marker: 'AIRFLOW_ADMIN_USERNAME' },
      { file: 'docker-compose.yml', marker: '_AIRFLOW_WWW_USER_CREATE' },
    ],
    lacks: [
      { file: 'airflow/config/webserver_config.py', marker: 'AUTH_OAUTH' },
      { file: '.env.example', marker: 'AZURE_TENANT_ID' },
      { file: 'airflow/requirements.txt', marker: 'authlib' },
    ],
  },
  {
    name: 'entra-id sso',
    flags: ['--sso', 'entra-id'],
    present: CORE_FILES,
    absent: IAC_FILES,
    contains: [
      { file: 'airflow/config/webserver_config.py', marker: 'AUTH_OAUTH' },
      { file: 'airflow/config/webserver_config.py', marker: 'AUTH_ROLES_MAPPING' },
      { file: '.env.example', marker: 'AZURE_TENANT_ID' },
      { file: 'airflow/requirements.txt', marker: 'authlib' },
      { file: 'docker-compose.yml', marker: 'AZURE_CLIENT_ID' },
    ],
    lacks: [
      { file: 'airflow/config/webserver_config.py', marker: 'AUTH_DB' },
      { file: 'docker-compose.yml', marker: '_AIRFLOW_WWW_USER_CREATE' },
    ],
  },
  {
    name: 'full (entra-id + aws-ecs)',
    flags: ['--sso', 'entra-id', '--iac', 'aws-ecs'],
    present: [...CORE_FILES, ...IAC_FILES],
    absent: [],
    contains: [
      { file: 'iac/terraform/ecs.tf', marker: 'AwsEcsExecutor' },
      { file: 'iac/terraform/ecs.tf', marker: 'AZURE_TENANT_ID' },
      {
        file: 'iac/terraform/environments/dev/terraform.tfvars',
        marker: 'AZURE_CLIENT_SECRET',
      },
      { file: 'docs/mkdocs.yml', marker: 'deploy.md' },
    ],
    lacks: [
      // Entra deployments never bake a bootstrap admin into the migrate task.
      { file: 'iac/terraform/ecs.tf', marker: 'AIRFLOW_ADMIN_PASSWORD' },
    ],
  },
  {
    name: 'native sso + aws-ecs',
    flags: ['--iac', 'aws-ecs'],
    present: [...CORE_FILES, ...IAC_FILES],
    absent: [],
    contains: [
      { file: 'iac/terraform/ecs.tf', marker: 'AIRFLOW_ADMIN_PASSWORD' },
      { file: 'iac/terraform/secrets.tf', marker: 'admin_password' },
    ],
    lacks: [{ file: 'iac/terraform/ecs.tf', marker: 'AZURE_TENANT_ID' }],
  },
]

describe.each(VARIANTS)('scaffold variant: $name', (variant) => {
  let project: Project

  beforeAll(() => {
    project = Project.scaffold({
      stack: './stacks/airflow',
      prefix: 'dude-airflow-',
      flags: ['--yes', ...variant.flags],
    })
  }, 60_000)

  afterAll(() => project.cleanup())

  it('applies the enabled overlays', () => {
    for (const file of variant.present) {
      expect(project.exists(file), `expected ${file} to exist`).toBe(true)
    }
  })

  it('omits the disabled overlays', () => {
    for (const file of variant.absent) {
      expect(project.exists(file), `expected ${file} to be absent`).toBe(false)
    }
  })

  it('renders the SSO/IaC conditionals correctly', () => {
    for (const { file, marker } of variant.contains) {
      expect(project.readFile(file), `${file} should contain "${marker}"`).toContain(marker)
    }
    for (const { file, marker } of variant.lacks) {
      expect(project.readFile(file), `${file} should not contain "${marker}"`).not.toContain(
        marker,
      )
    }
  })

  it('passes `dude lint` on the fresh scaffold', () => {
    const result = project.run('lint')
    if (result.status !== 0) process.stdout.write(result.stdout + result.stderr + '\n')
    expect(result.status).toBe(0)
  })

  it('pins both the CLI and the stack in package.json, in lockstep with dude.json', () => {
    const pkg = JSON.parse(project.readFile('package.json')) as {
      devDependencies?: Record<string, string>
    }
    const manifest = JSON.parse(project.readFile('dude.json')) as {
      stack: string
      stackVersion: string
    }
    const deps = pkg.devDependencies ?? {}

    expect(deps['@cubocicloide/dude'], 'CLI must be pinned in devDependencies').toBeTruthy()
    expect(deps[manifest.stack], `stack ${manifest.stack} must be pinned`).toBe(
      manifest.stackVersion,
    )
  })
})
