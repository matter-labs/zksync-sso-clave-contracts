import { type Account, type Address, type Chain, type Client, createClient, getAddress, type Prettify, type PublicActions, publicActions, type PublicRpcSchema, type RpcSchema, type Transport, type WalletActions, walletActions, type WalletClientConfig, type WalletRpcSchema } from "viem";
import { toSmartAccount } from "zksync-sso/client/smart-account";
import { passkeyHashSignatureResponseFormat } from "zksync-sso/utils";

export function createZksyncPasskeyClient<
  transport extends Transport,
  chain extends Chain,
  rpcSchema extends RpcSchema | undefined = undefined,
>(_parameters: ZksyncAccountPasskeyClientConfig<transport, chain, rpcSchema>): ZksyncAccountPasskeyClient<transport, chain, rpcSchema> {
  type WalletClientParameters = typeof _parameters;
  const parameters: WalletClientParameters & {
    key: NonNullable<WalletClientParameters["key"]>;
    name: NonNullable<WalletClientParameters["name"]>;
  } = {
    ..._parameters,
    address: getAddress(_parameters.address),
    key: _parameters.key || "wallet",
    name: _parameters.name || "ZKsync Account Passkey Client",
  };

  const account = toSmartAccount({
    address: parameters.address,
    sign: async (/* { hash } */) => {
      const passkeySignature = {
        passkeyAuthenticationResponse: {
          response: await parameters.signHash(),
        },
      };

      return passkeyHashSignatureResponseFormat(passkeySignature.passkeyAuthenticationResponse.response, parameters.contracts);
    },
  });
  const client = createClient<transport, chain, Account, rpcSchema>({
    ...parameters,
    account,
    type: "walletClient",
  })
    .extend(() => ({
      contracts: parameters.contracts,
    }))
    .extend(publicActions)
    .extend(walletActions);
  return client;
}

type PasskeyRequiredContracts = {
  session: Address; // Session, spend limit, etc.
  passkey: Address; // Validator for passkey signature
  accountFactory?: Address; // For account creation
};
type ZksyncAccountPasskeyData = {
  contracts: PasskeyRequiredContracts;
};

export type ClientWithZksyncAccountPasskeyData<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
> = Client<transport, chain, Account> & ZksyncAccountPasskeyData;

export type ZksyncAccountPasskeyClient<
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
    PublicActions<transport, chain, account> & WalletActions<chain, account>
  > & ZksyncAccountPasskeyData
>;

export interface ZksyncAccountPasskeyClientConfig<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  rpcSchema extends RpcSchema | undefined = undefined,
> extends Omit<WalletClientConfig<transport, chain, Account, rpcSchema>, "account"> {
  chain: NonNullable<chain>;
  address: Address;
  contracts: PasskeyRequiredContracts;
  key?: string;
  name?: string;
  signHash: () => Promise<{
    authenticatorData: string;
    clientDataJSON: string;
    signature: string;
  }>;
}
