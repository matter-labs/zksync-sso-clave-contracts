import { type Account, type Address, type Chain, type Client, createClient, getAddress, type Hex, type Prettify, type PublicActions, publicActions, type PublicRpcSchema, type RpcSchema, type Transport, type WalletActions, walletActions, type WalletClientConfig, type WalletRpcSchema } from "viem";
import { eip712WalletActions } from "viem/zksync";

import { passkeyHashSignatureResponseFormat } from "../../utils/passkey.js";
import { requestPasskeyAuthentication } from "../actions/passkey.js";
import { type ZksyncSsoPasskeyActions, zksyncSsoPasskeyActions } from "../decorators/passkey.js";
import { toSmartAccount } from "../smart-account.js";

export function createZksyncPasskeyClient<
  transport extends Transport,
  chain extends Chain,
  rpcSchema extends RpcSchema | undefined = undefined,
>(_parameters: ZksyncSsoPasskeyClientConfig<transport, chain, rpcSchema>): ZksyncSsoPasskeyClient<transport, chain, rpcSchema> {
  type WalletClientParameters = typeof _parameters;
  const parameters: WalletClientParameters & {
    key: NonNullable<WalletClientParameters["key"]>;
    name: NonNullable<WalletClientParameters["name"]>;
  } = {
    ..._parameters,
    address: getAddress(_parameters.address),
    key: _parameters.key || "zksync-sso-passkey-wallet",
    name: _parameters.name || "ZKsync SSO Passkey Client",
  };

  const account = toSmartAccount({
    address: parameters.address,
    sign: async ({ hash }) => {
      const passkeySignature = await requestPasskeyAuthentication({
        challenge: hash,
        credentialPublicKey: parameters.credentialPublicKey,
      });

      return passkeyHashSignatureResponseFormat(passkeySignature.passkeyAuthenticationResponse.response, parameters.contracts);
    },
  });
  const client = createClient<transport, chain, Account, rpcSchema>({
    ...parameters,
    account,
    type: "walletClient",
  })
    .extend(() => ({
      credentialPublicKey: parameters.credentialPublicKey,
      userName: parameters.userName,
      userDisplayName: parameters.userDisplayName,
      contracts: parameters.contracts,
      paymasterAddress: parameters.paymasterAddress,
      paymasterInput: parameters.paymasterInput,
    }))
    .extend(publicActions)
    .extend(walletActions)
    .extend(eip712WalletActions())
    .extend(zksyncSsoPasskeyActions);
  return client;
}

export type PasskeyRequiredContracts = {
  session: Address; // Session, spend limit, etc.
  passkey: Address; // Validator for passkey signature
  accountFactory?: Address; // For account creation
};
type ZksyncSsoPasskeyData = {
  credentialPublicKey: Uint8Array; // Public key of the passkey
  userName: string; // Basically unique user id (which is called `userName` in webauthn)
  userDisplayName: string; // Also option required for webauthn
  contracts: PasskeyRequiredContracts;
  paymasterAddress?: Address;
  paymasterInput?: Hex;
};

export type ClientWithZksyncSsoPasskeyData<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
> = Client<transport, chain, Account> & ZksyncSsoPasskeyData;

export type ZksyncSsoPasskeyClient<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  rpcSchema extends RpcSchema | undefined = undefined,
  account extends Account = Account,
> = Prettify<
  Client<
    transport,
    chain,
    account,
    rpcSchema extends RpcSchema
      ? [...PublicRpcSchema, ...WalletRpcSchema, ...rpcSchema]
      : [...PublicRpcSchema, ...WalletRpcSchema],
    PublicActions<transport, chain, account> & WalletActions<chain, account> & ZksyncSsoPasskeyActions
  > & ZksyncSsoPasskeyData
>;

export interface ZksyncSsoPasskeyClientConfig<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  rpcSchema extends RpcSchema | undefined = undefined,
> extends Omit<WalletClientConfig<transport, chain, Account, rpcSchema>, "account"> {
  chain: NonNullable<chain>;
  address: Address;
  credentialPublicKey: Uint8Array;
  userName: string;
  userDisplayName: string;
  contracts: PasskeyRequiredContracts;
  paymasterAddress?: Address;
  paymasterInput?: Hex;
  key?: string;
  name?: string;
}
