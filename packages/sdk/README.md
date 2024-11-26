# zksync-sso SDK

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE-MIT)

A user & developer friendly modular smart account implementation on ZKsync;
simplifying user authentication, session management, and transaction processing.

## Features and Goals

<!-- prettier-ignore -->
> ZKsync SSO is under active development and is not yet feature
> complete. Use it to improve your development applications and tooling. Please
> do not use it in production environments.

- 🧩 Modular smart accounts based on
  [ERC-7579](https://eips.ethereum.org/EIPS/eip-7579#modules)
- 🔑 Passkey authentication (no seed phrases)
- ⏰ Sessions w/ easy configuration and management
- 💰 Integrated paymaster support
- ❤️‍🩹 Account recovery _(Coming Soon)_
- 💻 Simple SDKs : JavaScript, iOS/Android _(Coming Soon)_
- 🤝 Open-source authentication server
- 🎓 Examples to get started quickly

## Getting started

Install the ZKsync SSO SDK package:

```sh
npm i zksync-sso
```

Add ZKsync SSO connector to your app (using `wagmi`):

```ts
import { zksyncSsoConnector, callPolicy } from "zksync-sso/connector";
import { zksyncSepoliaTestnet } from "viem/chains";
import { createConfig, connect } from "@wagmi/core";
import { erc20Abi } from "viem";

const ssoConnector = zksyncSsoConnector({
  // Optional session configuration, if omitted user will have to sign every transaction via Auth Server
  session: {
    expiry: "1 day",

    // Allow up to 0.1 ETH to be spend in gas fees
    feeLimit: parseEther("0.1"),

    transfers: [
      // Allow ETH transfers of up to 0.1 ETH to specific address
      {
        to: "0x188bd99cd7D4d78d4E605Aeea12C17B32CC3135A",
        valueLimit: parseEther("0.1"),
      },
    ],

    // Allow calling specific smart contracts (e.g. ERC20 transfer):
    contractCalls: [
      callPolicy({
        address: "0xa1cf087DB965Ab02Fb3CFaCe1f5c63935815f044",
        abi: erc20Abi,
        functionName: "transfer",
        constraints: [
          // Only allow transfers to this address. Or any address if omitted
          {
            index: 0, // First argument of erc20 transfer function, recipient address
            value: "0x6cC8cf7f6b488C58AA909B77E6e65c631c204784",
          },

          // Allow transfering up to 0.2 tokens per hour
          // until the session expires
          {
            index: 1,
            limit: {
                limit: parseUnits("0.2", TOKEN.decimals),
                period: "1 hour",
            },
          },
        ],
      }),
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
    chainId: zksyncSepoliaTestnet.id, // or another chain id that has SSO support
  });
};
```

[Find more information here in our docs.](https://docs.zksync.io/build/zksync-sso)
