import { defineCommand } from '@cubocicloide/dude'
import { spawnSync } from 'node:child_process'

function exec(cmd: string, args: string[], cwd: string): void {
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

async function waitForBackend(url: string, retries = 30, intervalMs = 2000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  process.stderr.write(
    `error: backend did not become healthy after ${(retries * intervalMs) / 1000}s\n`,
  )
  process.exit(1)
}

const SEED_SCRIPT = `
from django.contrib.auth import get_user_model

User = get_user_model()

users = [
    {"username": "admin", "email": "admin@example.com"},
    {"username": "alice", "email": "alice@example.com"},
    {"username": "bob", "email": "bob@example.com"},
]

added = 0
for u in users:
    _, created = User.objects.get_or_create(username=u["username"], defaults={"email": u["email"]})
    added += int(created)
print(f"Seeded {added} user(s).")
`

export default defineCommand({
  description: 'Drop the database, re-apply all migrations, and seed demo data.',
  async run({ projectRoot }) {
    process.stdout.write('Dropping all containers and volumes...\n')
    exec('docker', ['compose', 'down', '--volumes'], projectRoot)

    process.stdout.write('Starting services...\n')
    exec('docker', ['compose', 'up', '--detach'], projectRoot)

    process.stdout.write('Waiting for backend to be ready...\n')
    await waitForBackend('http://localhost:8000/api/health/')

    // start.sh already migrates on boot; run it again explicitly so the
    // command fails loudly if a migration is broken.
    process.stdout.write('Running migrations...\n')
    exec(
      'docker',
      [
        'compose',
        'exec',
        'backend',
        'uv',
        'run',
        'python',
        'manage.py',
        'migrate',
        '--noinput',
      ],
      projectRoot,
    )

    process.stdout.write('Seeding demo data...\n')
    exec(
      'docker',
      ['compose', 'exec', 'backend', 'uv', 'run', 'python', 'manage.py', 'shell', '-c', SEED_SCRIPT],
      projectRoot,
    )

    process.stdout.write('Reset complete.\n')
  },
})
