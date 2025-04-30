# ZKsync SSO Clave Contracts

[![License](https://img.shields.io/badge/license-GPL3-blue)](LICENSE)
[![CI](https://github.com/matter-labs/zksync-account-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/matter-labs/zksync-account-sdk/actions/workflows/ci.yml)

A user & developer friendly modular smart account implementation on ZKsync;
simplifying user authentication, session management, and transaction processing.

Forked from [Clave](https://github.com/getclave/clave-contracts).

## Features and Goals

<!-- prettier-ignore -->
> [!CAUTION]
> The factory and module interfaces are not yet stable! Any modules created
> against the IModuleValidator interface will likely need to be updated in the
> final version. The code is currently under audit and the latest may contain
> security vulnerabilities.

See the [ZKsync SSO](https://github.com/matter-labs/zksync-sso) project for a
complete developer solution, this project is just the smart contract components.

## Local Development

1. Install workspace dependencies with `pnpm install`.
2. Install the latest release of
   [Era Test Node](https://github.com/matter-labs/anvil-zksync).
3. Run `pnpm build` to build the contracts.
4. Run `era_test_node run` and `pnpm test` in separate terminals to run the
   tests.
5. Run `pnpm lint` to lint the project.
6. Run `pnpm fmt` to format the project.

## Modules

### GuardianRecoveryValidator

This module allows for recovering an account with a Guardian, which helps users
regain access to their SSO accounts if their primary authentication method (such
as a passkey) is lost.

Users can **initiate the recovery process to update their passkey
authentication,** with the Guardian serving as both verifier and facilitator.

#### Guardian

A Guardian is a trusted entity designated to assist in recovering access to a
smart account by signing to verify the legitimacy of the recovery process.

#### Functionalities

1. **Proposing a guardian**\
   The `proposeGuardian` method handles the initial registration of external
   accounts by:
   1. Taking an external account address and storing it as a **pending
      guardian**.
   2. Enabling `addGuardian` to **confirm and activate** this guardian.
2. **Confirming guardian**\
   The `addGuardian` method handles the registration of external accounts by:
   1. Verifying that the guardian was **previously proposed** by the account.
   2. Marking the guardian as **active and ready**.
   3. Recording the guardian-to-account relationship for **future recovery and
      validation**.
3. **Removing guardian**\
   The `removeGuardian` method handles guardian removal by:
   1. Accepting the guardian’s address as input.
   2. Removing the guardian from the account’s list.
   3. Cleaning up associated metadata (e.g., removing the account from the
      guardian’s guarded list).
4. **Initiating recovery**\
   A verified guardian can **initiate account recovery** using the
   `initRecovery` method, which:
   1. Verifies the caller is an **active guardian** of the account.
   2. Verifies that account does not have non-expired pending recovery
   3. Records a recovery request with:
      - **Hashed credential ID**
      - **Raw public key**
      - **Timestamp**
5. **Executing recovery**\
   Account recovery is completed by submitting a specific transaction validated
   via `validateTransaction`, which:
   1. Ensures the transaction calls `WebAuthValidator.addValidationKey`.
   2. Confirm the **credential ID and public key** match the recovery request.
   3. Verifies that **24 hours have passed** since initiation and the request is
      within the **72-hour validity window**.
6. **Cancelling recovery**\
   A pending recovery can be discarded using `discardRecovery`, which:
   1. Removes the recovery request from storage.

## Deployment

Chain operators can use the `deploy` script to _initially_ deploy the contracts,
ensuring that the proxy addresses are added to the storage slot exception allow
list. (api_web3_json_rpc: whitelisted_tokens_for_aa)

```bash
pnpm run deploy --file chainname.json
```

This list of contracts can be included into the parent SSO-SDK project for
automatic chain support. Then subsquent updates can be made using the `upgrade`
script, which will use the deployed proxies:

```bash
pnpm run upgrade --proxyfile chainname.json
```

Non-chain operators should use the deploy script with the no proxy flag to avoid
the storage slot validation errors.

```bash
pnpm run deploy --file chainname.json --direct
```
