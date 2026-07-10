import type { Command } from './types'

export const COMMANDS: Command[] = [
  // Infrastructure
  { group: 'Infrastructure', cmd: 'dude up --build', desc: 'Build images and start all services' },
  { group: 'Infrastructure', cmd: 'dude up', desc: 'Start all services (detached)' },
  { group: 'Infrastructure', cmd: 'dude down', desc: 'Stop and remove containers' },
  { group: 'Infrastructure', cmd: 'dude logs [service]', desc: 'Follow logs; omit service to follow all' },
  { group: 'Infrastructure', cmd: 'dude shell <service>', desc: 'Open a shell inside a running container' },
  // Quality
  { group: 'Code quality', cmd: 'dude lint', desc: 'Structural lint checks (naming, layout)' },
  { group: 'Code quality', cmd: 'dude format', desc: 'Format code — ruff (backend) + prettier (frontend)' },
  { group: 'Code quality', cmd: 'dude review', desc: 'Lint + ESLint + API contract review in one pass' },
  // API
  { group: 'API contract', cmd: 'dude api sync', desc: 'Fetch OpenAPI spec → regenerate the typed client' },
  { group: 'API contract', cmd: 'dude api review', desc: 'Validate frontend/src/openapi/ against the spec' },
  // Testing
  { group: 'Testing', cmd: 'dude test', desc: 'Run all test suites (backend + e2e)' },
  { group: 'Testing', cmd: 'dude test --backend', desc: 'pytest only' },
  { group: 'Testing', cmd: 'dude test --e2e', desc: 'Playwright + Cucumber only' },
  // Security
  { group: 'Security', cmd: 'dude security scan', desc: 'Run all SAST scanners; exit 1 on new HIGH+ findings' },
  { group: 'Security', cmd: 'dude security accept', desc: 'Absorb all findings into the baseline' },
  { group: 'Security', cmd: 'dude security verify --rule-id <id>', desc: 'Confirm a specific finding is fixed' },
  // Docs
  { group: 'Documentation', cmd: 'dude docs', desc: 'Serve MkDocs at http://localhost:8001 (live-reload)' },
  // Help
  { group: 'Help', cmd: 'dude help', desc: 'Show all available commands and flags' },
]

export const GROUPS = [...new Set(COMMANDS.map((c) => c.group))]
