# NX Commands Cheatsheet

A collection of commands to help with running NX in the monorepo.

## Running NX commands

Use the `npx nx` command to use the monorepo's NX package, or install NX
globally on your machine with npm. Project names are based on the name defined
in the `package.json`, not the directory name.

```bash
npx nx <target> <project>
```

## Run commands in parallel across all packages

NX commands can be run in parallel across all the packages with the `run-many`
command.

```bash
npx nx run-many --target=build --all
```

Finetune to specific projects:

```bash
npx nx run-many --target=build --projects=zksync-account,smart-account-gateway
```

## View project commands

This provides a UI to see what commands are available for a project.
This is usually the scripts you'll see in the `package.json` but this will make
it easier to see if NX is modifying a particular command based on a plugin.

To see the available commands for a project with NX:

```bash
npx nx show project <project> --web
```

## Keeping NX up to date

Run the `npx nx report` command to get the list of NX packages and plugins with
their versions. It will report whether any packages need to be updated.
