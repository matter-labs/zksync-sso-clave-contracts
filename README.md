# ZKsync SSO

[![License](https://img.shields.io/badge/license-GPL3-blue)](LICENSE)
[![CI](https://github.com/matter-labs/zksync-account-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/matter-labs/zksync-account-sdk/actions/workflows/ci.yml)

A user & developer friendly modular smart account implementation on ZKsync;
simplifying user authentication, session management, and transaction processing.

Forked from [Clave](https://github.com/getclave/clave-contracts).

## Features and Goals

<!-- prettier-ignore -->
> [!CAUTION]
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

## Local Development

1. Install workspace dependencies with `pnpm install`.
2. Install the latest release of
   [Era Test Node](https://github.com/matter-labs/era-test-node).
3. Run `pnpm build` to build the contracts.
4. Run `era_test_node run` and `pnpm test` in separate terminals to run the
   tests.
5. Run `pnpm lint` to lint the project.
6. Run `pnpm fmt` to format the project.
