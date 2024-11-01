# NFT Quest

A demo of using the ZKsync SDK for smart accounts.

## Getting Started

Run the following (be sure a local node is running, e.g. `era_test_node`):

```sh
# Deploy the ZKsync SSO contracts
pnpm nx deploy contracts

# Deploy the contracts for the NFT Quest Demo
pnpm nx deploy:local nft-quest-contracts

# Start the website and Auth Server
pnpm nx dev nft-quest
```

## Running e2e tests

Run the tests locally with:

```sh
pnpm nx e2e nft-quest
```

and you can enable debug mode with:

```sh
pnpm nx e2e:debug nft-quest
```
