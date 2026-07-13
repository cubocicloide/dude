---
'@cubocicloide/stack-frappe': patch
---

Fix two issues surfaced by a first `dude iac create-site` run.

- The `configurator` ECS task ran `bench set-config -g db_host ...` before `common_site_config.json` existed on a fresh EFS `sites/` volume, crashing with `FileNotFoundError` on the very first deploy. It now seeds an empty `{}` config file first.
- `dude iac logs` shells out to `aws logs tail`, which is an AWS CLI **v2** subcommand — on a v1 CLI it fails with a confusing raw argparse "invalid choice" error. Detect a v1 CLI up front and fail with an actionable message (upgrade link + a `filter-log-events` fallback) instead.
