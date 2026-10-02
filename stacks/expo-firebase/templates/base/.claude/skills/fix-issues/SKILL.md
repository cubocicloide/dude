---
name: fix-issues
description: Route one or more issues to the issue-fixer workflow and verify the combined result.
disable-model-invocation: false
allowed-tools: 'Bash(git *) Bash(dude *) Read Write'
---

# Fix issues

Confirm the project root contains `dude.json`, fetch each requested issue, and
use an isolated branch per issue. Apply the issue-fixer workflow, consolidate
multiple completed branches without force-pushing, then run:

```bash
dude lint
dude test
dude review
```

Do not open a pull request while any check fails. Report blocked issues rather
than guessing missing product intent.
