/** `dude iac login` — configure/verify AWS credentials for an environment. */
import type { StackCommandDef } from '@cubocicloide/dude'
import { capture, run } from '../../../../shared.js'
import { envArg, hasIac, requireEnv, requireIac, resolveProfile } from '../../lib/terraform.js'

export const iacLoginCommand: StackCommandDef = {
  available: hasIac,
  description:
    'Configure/verify AWS credentials for an environment (maps --env to an AWS profile).',
  args: { ...envArg },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const profile = resolveProfile(projectRoot, args, env)

    // Does the profile already exist locally? (AWS CLI v2: `configure list-profiles`)
    const list = capture('aws', ['configure', 'list-profiles'], projectRoot)
    const known = list.stdout
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    const exists = list.status === 0 && known.includes(profile)

    // An SSO profile is one with `sso_start_url`/`sso_session` configured — those
    // need `aws sso login`, not static keys.
    const ssoStart = exists
      ? capture('aws', ['configure', 'get', 'sso_start_url', '--profile', profile], projectRoot)
      : { status: 1, stdout: '' }
    const ssoSession = exists
      ? capture('aws', ['configure', 'get', 'sso_session', '--profile', profile], projectRoot)
      : { status: 1, stdout: '' }
    const isSso = ssoStart.stdout.trim() !== '' || ssoSession.stdout.trim() !== ''

    if (!exists) {
      process.stdout.write(
        `\n  Profile "${profile}" is not configured yet. Setting it up interactively.\n` +
          `  (For SSO instead, cancel and run: aws configure sso --profile ${profile})\n\n`,
      )
      const code = run('aws', ['configure', '--profile', profile], projectRoot)
      if (code !== 0) process.exit(code)
    } else if (isSso) {
      const code = run('aws', ['sso', 'login', '--profile', profile], projectRoot)
      if (code !== 0) process.exit(code)
    }

    // Verify the credentials actually resolve.
    const who = capture(
      'aws',
      ['sts', 'get-caller-identity', '--profile', profile, '--output', 'json'],
      projectRoot,
    )
    if (who.status !== 0) {
      process.stderr.write(
        `\n  ✗  Credentials for profile "${profile}" are not valid.\n` +
          (isSso
            ? `     Try: aws sso login --profile ${profile}\n\n`
            : `     Try: aws configure --profile ${profile}\n\n`),
      )
      process.exit(1)
    }
    let account = ''
    let arn = ''
    try {
      const o = JSON.parse(who.stdout) as { Account?: string; Arn?: string }
      account = o.Account ?? ''
      arn = o.Arn ?? ''
    } catch {
      /* non-fatal — identity already verified by the exit status above */
    }

    process.stdout.write(
      `\n  ✓  Authenticated for env "${env}".\n` +
        `     profile: ${profile}\n` +
        `     account: ${account}\n` +
        `     arn:     ${arn}\n\n` +
        `  Now: dude iac plan --env ${env}\n\n`,
    )
  },
}
