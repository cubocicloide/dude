/**
 * The `docs` command is shared: the implementation lives in the CLI runtime
 * (`defineDocsCommand`), which serves the MkDocs site and refreshes the pages it
 * generates — `api.md` from the live command catalog and `cheatsheet.md` from the
 * project's rules and answers.
 *
 * This file used to be a byte-identical 117-line copy in every stack, so adding a
 * generated page meant editing six places. Keep it a thin registration.
 */
import { defineDocsCommand } from '@cubocicloide/dude'

export const docsCommand = defineDocsCommand()
