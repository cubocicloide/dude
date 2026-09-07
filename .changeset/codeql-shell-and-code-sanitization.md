---
"@cubocicloide/dude": patch
---

Close the two open CodeQL code-scanning alerts.

`dude docs` and `dude report` each carried their own copy of `openBrowser()`, and
both opened the Windows browser through `cmd /c start` — cmd.exe's parser, where a
URL containing `&`, `|` or `^` stops being one argument and becomes a second
command (`js/shell-command-constructed-from-input`, alert #4; reachable from
`dude docs --port`, which was interpolated verbatim). The two copies are now one
shared `openBrowser()` that uses `rundll32 url.dll,FileProtocolHandler` on Windows,
so the URL is a single argv entry with no shell in the chain, and refuses anything
that is not a well-formed `http(s)` URL. `--port` is validated as a port (1–65535)
before it reaches the URL or the `docker run -p` argument, so an obvious mistake
now fails with a sentence instead of an obscure Docker error.

Alert #1 (`js/bad-code-sanitization`) was in the lint-engine tests, which built a
stack-check fixture by interpolating `JSON.stringify(diagnostics)` into generated
JavaScript. The fixture body is now a constant that reads the payload from a
sibling `.json` file, so no code is constructed from data at all.
