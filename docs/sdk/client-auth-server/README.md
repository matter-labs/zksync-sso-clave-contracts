# Auth Server SDK

The client-auth-server SDK provides you with an easy way to use ZK Accounts in
your application. It's built on top of [client SDK](../client/README.md) and
[@wagmi/core](https://wagmi.sh/core/getting-started).

## Basic usage

```ts
import { zksync } from "viem/chains";
import { createConfig, connect } from "@wagmi/core";
import { zksyncAccountConnector } from "zksync-sso/connector";

const ssoConnector = zksyncAccountConnector({
  // Optional session configuration
  session: {
    feeLimit: parseEther("0.1"),
    // Allow transfers to a specific address with a limit of 0.1 ETH
    transfers: [
      {
        to: "0x188bd99cd7D4d78d4E605Aeea12C17B32CC3135A",
        valueLimit: parseEther("0.1"),
      },
    ],
  },
});

const wagmiConfig = createConfig({
  connectors: [ssoConnector],
  ..., // your wagmi config https://wagmi.sh/core/api/createConfig
});

const connectWithSSO = () => {
  connect(wagmiConfig, {
    connector: ssoConnector,
    chainId: zksync.id, // or another chain id that has SSO support
  });
};
```
