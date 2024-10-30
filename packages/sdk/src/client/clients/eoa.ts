import { type Account, type Address, type Chain, type Client, createClient, getAddress, type Hash, type Prettify, publicActions, type PublicRpcSchema, type RpcSchema, type Transport, type WalletClientConfig, type WalletRpcSchema } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { type ZksyncAccountWalletActions, zksyncAccountWalletActions } from "../decorators/session_wallet.js";
import { toSmartAccount } from "../smart-account.js";

export function createZksyncEoaClient<
  transport extends Transport,
  chain extends Chain,
  rpcSchema extends RpcSchema | undefined = undefined,
>(_parameters: ZksyncAccountEoaClientConfig<transport, chain, rpcSchema>): ZksyncAccountEoaClient<transport, chain, rpcSchema> {
  type WalletClientParameters = typeof _parameters;
  const parameters: WalletClientParameters & {
    key: NonNullable<WalletClientParameters["key"]>;
    name: NonNullable<WalletClientParameters["name"]>;
  } = {
    ..._parameters,
    address: getAddress(_parameters.address),
    key: _parameters.key || "wallet",
    name: _parameters.name || "ZKsync Account Eoa Client",
  };

  const account = toSmartAccount({
    address: parameters.address,
    sign: async ({ hash }) => {
      if (!parameters.privateKey) throw new Error("Session key wasn't provided, can't sign");
      const privateKeySigner = privateKeyToAccount(parameters.privateKey);
      const hashSignature = await privateKeySigner.sign({ hash });
      return hashSignature;
    },
  });
  const client = createClient<transport, chain, Account, rpcSchema>({
    ...parameters,
    account,
    type: "walletClient",
  })
    .extend(() => ({
      privateKey: parameters.privateKey,
    }))
    .extend(publicActions)
    .extend(zksyncAccountWalletActions as any);
  return client;
}

type ZksyncAccountEoaData = {
  privateKey?: Hash;
};

export type ClientWithZksyncAccountEoaData<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  account extends Account = Account,
> = Client<transport, chain, account> & ZksyncAccountEoaData;

export type ZksyncAccountEoaClient<
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
    ZksyncAccountWalletActions<chain, account>
  > & ZksyncAccountEoaData
>;

export interface ZksyncAccountEoaClientConfig<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  rpcSchema extends RpcSchema | undefined = undefined,
> extends Omit<WalletClientConfig<transport, chain, Account, rpcSchema>, "account"> {
  chain: NonNullable<chain>;
  address: Address;
  privateKey?: Hash;
  key?: string;
  name?: string;
}
