# NFT Quest

A demo of using the ZKsync SDK for smart accounts.

## Getting Started

Run the following (be sure a local node is running, e.g.
`era_test_node`[https://docs.zksync.io/build/zksync-cli/running-a-node]):

```sh
# Deploy the ZKsync SSO contracts
pnpm nx deploy contracts

# Deploy the contracts for the NFT Quest Demo
pnpm nx deploy:local nft-quest-contracts
```

The contract addresses for the NFT Quest app will be set in `.env.local`. This
.env file will override the values set in the `runtimeConfig` in
`nuxt.config.ts`.

You may also need to update the contract addresses for the Auth Server in
`/packages/auth-server/stores/client.ts` under the
`contractsByChain[zksyncInMemoryNode.id]`

```sh
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

## Deploy the NFT Quest app to Firebase (WIP)

The command to deploy for testnet:

```sh
pnpm nx deploy nft-quest
```

The command to deploy to a preview channel:

```sh
pnpm nx deploy:preview nft-quest <CHANNEL_NAME>
```
