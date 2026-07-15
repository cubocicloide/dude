---
'@cubocicloide/dude': minor
'@cubocicloide/dude-launcher': minor
---

Two-phase release channels: every publish now lands on the `next` dist-tag (candidate channel); `latest` (stable) only moves via explicit promotion (`make promote`). `dude init` and `dude upgrade` resolve the stable channel by default and accept `--next` to opt into the newest published candidate; the launcher honors `DUDE_CHANNEL=next` when delegating project-less commands to the published CLI.
