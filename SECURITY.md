# Security Policy

We take the security of `dude` and the projects it scaffolds seriously. Thank
you for helping keep it safe.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
discussions, or pull requests.**

Instead, use GitHub's **private vulnerability reporting**:

1. Go to the [**Security** tab](https://github.com/cubocicloide/dude/security)
   of this repository.
2. Click **Report a vulnerability**.
3. Fill in the advisory form with as much detail as you can.

This opens a private channel visible only to you and the maintainers.

### What to include

- A clear description of the issue and its impact.
- Steps to reproduce (a minimal proof of concept is ideal).
- The affected version(s) — the output of `dude info` helps.
- Any suggested remediation, if you have one.

### What to expect

- **Acknowledgement** within a few business days.
- An initial assessment and, if confirmed, a plan and timeline for a fix.
- Coordinated disclosure: we will agree with you on timing before any public
  advisory, and credit you unless you prefer to remain anonymous.

## Scope

This policy covers the `dude` CLI, the launcher, and the stack plugins in this
repository. Vulnerabilities in the **generated** projects' third-party
dependencies should be reported upstream to those projects; if a `dude` template
ships an insecure default, that is in scope here.

## Supported versions

`dude` is distributed through release channels (`next` / `latest`). Security
fixes are made against the latest release; older pinned versions should upgrade
via `dude upgrade`.
