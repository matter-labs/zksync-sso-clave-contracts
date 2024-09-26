# ZKsync Account SDK

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE-MIT)
[![CI](https://github.com/matter-labs/zksync-account-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/matter-labs/zksync-account-sdk/actions/workflows/ci.yml)

This monorepo is comprised of the following packages/products:

- `packages/sdk` is the `zksync-account` JavaScript SDK
- `packages/gateway` is the Gateway used for default account creation
    and session key management
- `packages/contracts` are the on-chain smart contracts behind ZK Accounts

[Link to **ZK Account Interface Details**](https://matterlabs.notion.site/ZK-Account-Interface-Details-0c15bbcb90dc466ca826b57aa24d3a69)

## Running development

1. Install workspace dependencies with PNPM.

    ```bash
    pnpm install
    ```

2. Start up the Verdaccio proxy registry.

    ```bash
    npx nx local-registry
    ```

3. Publish the SDK package to your proxy registry.

    ```bash
    npx nx publish:local sdk
    ```

## Running commands

Use the NX CLI to run project commands, however PNPM is still usable as an
alternative.
Project names are based on the name defined in each project's `project.json`.

```bash
npx nx <target> <project>
# Example
npx nx build sdk
```

To run a command in multiple projects, use the `run-many` command.

```bash
npx nx run-many -t <target> --all           # for all projects
npx nx run-many -t <target> -p proj1 proj2  # by project
npx nx run-many --targets=lint,test,build   # run multiple commands
```

Some commands are inferred and built-in with NX.
To review all the available commands in a project:

```bash
nx show project <project> --web
```
