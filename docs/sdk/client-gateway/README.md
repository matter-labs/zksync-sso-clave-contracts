# Gateway SDK

The client-gateway SDK provides you with an easy way to use ZK Accounts in your application.
It's built on top of [client SDK](../client/README.md) and [@wagmi/core](https://wagmi.sh/core/getting-started).

## Basic usage

```ts
import { zksyncAccountConnector } from "zksync-account/connector";

const wagmiConfig = defaultWagmiConfig({
  connectors: [
    zksyncAccountConnector({
      session: {
        expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour
        spendLimit: {
          [ETH_TOKEN.address]: parse("0.1", ETH_TOKEN.decimals).toString(), // 0.1 ETH
        },
      },
    }),
  ],
});
```
