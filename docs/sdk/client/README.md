# Client SDK

The client SDK is the lowest level of our provided SDK which lets you take full
control of how you manage ZK Accounts. It's built on top of `viem` with the same
development principles in mind.

## Lifecycle

1. Register a new passkey

   ```ts
   import { registerNewPasskey } from "zksync-sso/client/passkey";

   // We first need to register a new passkey
   const { credentialPublicKey } = await registerNewPasskey({
     userDisplayName: "Alice", // Display name of the user
     userName: "alice", // Unique username
   });
   ```

   Make sure to store `credentialPublicKey` for future use (e.g. in a
   `localStorage`).

2. Deploy the account

   ```ts
   import { generatePrivateKey, privateKeyToAddress } from "viem";
   import { deployAccount } from "zksync-sso/client";

   const deployerClient = ...; // Any client for deploying the account, make sure it has enough balance to cover the deployment cost
   const sessionKey = generatePrivateKey();
   const sessionPublicKey = privateKeyToAddress(sessionKey.value);

   const { address } = await deployAccount(deployerClient, {
      credentialPublicKey,
      contracts,

      // You can either create a session during deployment by passing a spec
      // here, or create it later using `createSession` -- see step 4.
      // initialSession: { ... },

      // You also have the option of providing a paymaster to cover the cost of creating the account.
      // paymasterAddress: "0x123..."
   });
   ```

   You can fund your new account with some ETH to cover future transactions.

3. Creating Passkey Client

   ```ts
   import { zksync, http } from "viem";
   import { createZksyncPasskeyClient } from "zksync-sso/client/passkey";

   const passkeyClient = createZksyncPasskeyClient({
     address: deployedAccountAddress,
     credentialPublicKey: credentialPublicKey, // Saved from step 1
     userDisplayName: "Alice",
     userName: "alice",
     contracts, // Addresses of service contracts. See types for more information

     // You have the option of providing a paymaster to cover the cost of creating the new sessions.
     // paymasterAddress: "0x123..."

     // Other default viem client options
     chain: zksync,
     transport: http(),
   });
   ```

   Now you can use the `passkeyClient` as a regular viem client. When signing
   transactions, user will be prompted for confirmation via passkey.

4. Creating a session

```ts
import { parseEther } from "viem";
import { LimitType } from "zksync-sso/utils";

await passkeyClient.createSession({
  // See packages/sdk/src/client-auth-server/session.ts for an easier way to create the sessionConfig
  sessionConfig: {
    signer: sessionPublicKey,
    expiresAt: BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24), // 24 hours
    feeLimit: {
      limitType: LimitType.Lifetime,
      limit: parseEther("0.01"),
      period: 0n,
    },
    transferPolicies: [
      {
        target: "0x123...",
        maxValuePerUse: parseEther("0.01"),
        valueLimit: {
          limitType: LimitType.Lifetime,
          limit: parseEther("0.01"),
          period: 0n,
        },
      }
    ],
    callPolicies: [
      ...
    ],
  },
});
```
