# Demo App

This app demonstrates a basic use of the ZKsync SSO SDK and provides e2e test
coverage for the SDK.

## Requirements

You will need [Era In Memory Node](https://github.com/matter-labs/era-test-node)
for deploying contracts locally.

In a terminal, start up the Era In Memory Node with the command `era_test_node`.

## Setup

Run the following commands from the root of the monorepo.

```bash
pnpm install
```

Running the Demo App requires the Auth Server. The following will start both.

```bash
pnpm nx dev demo-app
```

The output will list the localhost addresses for both running applications.
