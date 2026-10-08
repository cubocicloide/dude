# Custom dude commands

Every TypeScript file in this directory becomes a project-local command. Export
a definition created by `defineCommand` from `@cubocicloide/dude`; the filename
is the command name. Project commands may override stack commands, while core
commands such as init, upgrade, version, and help are reserved.
