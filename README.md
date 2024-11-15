# ZKsync SSO SDK

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE-MIT)
[![CI](https://github.com/matter-labs/zksync-account-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/matter-labs/zksync-account-sdk/actions/workflows/ci.yml)

This monorepo is comprised of the following packages/products:

- `packages/sdk` is the `zksync-sso` JavaScript SDK
- `packages/auth-server` is the Auth Server used for account creation and
  session key management
- `packages/contracts` are the on-chain smart contracts behind ZK SSO accounts

## Running development

1. Install workspace dependencies with PNPM.

   ```bash
   pnpm install
   ```

You have two options for using the SDK in the monorepo workspaces, via PNPM
workspace protocol or using Verdaccio. The project is currently configured to
use the SDK package via PNPM. If you want to use the SDK outside of the monorepo
in another local project, setup the Verdaccio option to easily use the SDK
package.

### Using the SDK package via PNPM

PNPM provides a way to "link" workspaces together via `package.json`
dependencies using the
[Workspace protocol](https://pnpm.io/workspaces#workspace-protocol-workspace).

### Using the SDK package locally via Verdaccio

2. Start up the Verdaccio proxy registry.

   ```bash
   pnpm run registry
   ```

3. Publish the SDK package to your proxy registry.

   ```bash
   pnpm nx publish:local sdk
   ```

4. Edit the respective `package.json` dependency for the SDK to use the version
   that is published to Verdaccio.

## Running commands

Use the NX CLI to run project commands, however PNPM is still usable as an
alternative. NX project names are based on the name defined in each project's
`project.json` which are set to match the directory name.

```bash
pnpm nx <target> <project>
# Example
pnpm nx build sdk
```

To run a command in multiple projects, use the `run-many` command.

```bash
pnpm nx run-many -t <target> --all           # for all projects
pnpm nx run-many -t <target> -p proj1 proj2  # by project
pnpm nx run-many --targets=lint,test,build   # run multiple commands
```

Some commands are inferred and built-in with NX, thus you may not see commands
available from via the `package.json`. To review all the available commands in a
project:

```bash
pnpm nx show project <project> --web
```

## Lint project

At the root level of the monorepo, run the `pnpm run lint` command to run
linting across the project.

To fix lint issues that come up from linting, run the `pnpm run lint:fix`
command.

## Running/Debugging End-to-End Tests

To execute the end-to-end tests for the `demo-app` (or similarly for
`nft-quest`), you'll need to do some setup:

1. Start `era_test_node` (In a separate terminal, run
   `npx zksync-cli dev start`)
2. Deploy the smart contracts, `pnpm nx deploy contracts`

Once the local node is configured with the smart contracts deployed, you can run
the e2e tests:

```bash
pnpm nx e2e demo-app
```

To debug the end-to-end tests:

```bash
pnpm nx e2e:debug demo-app
```
