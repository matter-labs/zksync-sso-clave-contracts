# NX Commands Cheatsheet

A collection of commands to help with running NX in the monorepo.

## Running NX commands

Use the `pnpm nx` command to use the monorepo's NX package, or install NX
globally on your machine with npm. Project names are based on the name defined
in the workspace's `project.json`, not the directory name.

```bash
pnpm nx <target> <project>
# examples
# pnpm nx deploy contracts
# pnpm nx serve auth-server
# pnpm nx build sdk
```

## Run commands in parallel across all packages

NX commands can be run in parallel across all the packages with the `run-many`
command.

```bash
pnpm nx run-many --target=build --all
```

Finetune to specific projects:

```bash
pnpm nx run-many -t serve -p demo-app auth-server
```

## View project commands

This provides a UI to see what commands are available for a project. This is
usually the scripts you'll see in the `package.json` but this will make it
easier to see if NX is modifying a particular command based on a plugin.

To see the available commands for a project with NX:

```bash
pnpm nx show project <project> --web
```

## Keeping NX up to date

Run the `pnpm nx report` command to get the list of NX packages and plugins with
their versions. It will report whether any packages need to be updated.
