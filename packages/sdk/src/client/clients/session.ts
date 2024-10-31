import { type Account, type Address, type Chain, type Client, createClient, encodeAbiParameters, getAddress, type Hash, type Prettify, publicActions, type PublicRpcSchema, type RpcSchema, type Transport, type WalletClientConfig, type WalletRpcSchema } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { type ZksyncAccountSessionActions, zksyncAccountSessionActions } from "../decorators/session.js";
import { type ZksyncAccountWalletActions, zksyncAccountWalletActions } from "../decorators/session_wallet.js";
import { toSmartAccount } from "../smart-account.js";

export function createZksyncSessionClient<
  transport extends Transport,
  chain extends Chain,
  rpcSchema extends RpcSchema | undefined = undefined,
>(_parameters: ZksyncAccountSessionClientConfig<transport, chain, rpcSchema>): ZksyncAccountSessionClient<transport, chain, rpcSchema> {
  type WalletClientParameters = typeof _parameters;
  const parameters: WalletClientParameters & {
    key: NonNullable<WalletClientParameters["key"]>;
    name: NonNullable<WalletClientParameters["name"]>;
  } = {
    ..._parameters,
    address: getAddress(_parameters.address),
    key: _parameters.key || "wallet",
    name: _parameters.name || "ZKsync Account Session Client",
  };

  const account = toSmartAccount({
    address: parameters.address,
    sign: async ({ hash }) => {
      if (!parameters.sessionKey) throw new Error("Session key wasn't provided, can't sign");
      const sessionKeySigner = privateKeyToAccount(parameters.sessionKey);
      const hashSignature = await sessionKeySigner.sign({ hash });
      return encodeAbiParameters(
        [{ type: "bytes" }, { type: "address" }, { type: "bytes[]" }],
        [hashSignature, parameters.contracts.session, ["0x"]], // FIXME: this is assuming there are no other hooks
      );
    },
  });
  const client = createClient<transport, chain, Account, rpcSchema>({
    ...parameters,
    account,
    type: "walletClient",
  })
    .extend(() => ({
      sessionKey: parameters.sessionKey,
      contracts: parameters.contracts,
    }))
    .extend(publicActions)
    .extend(zksyncAccountWalletActions)
    .extend(zksyncAccountSessionActions);
  return client;
}

export type SessionRequiredContracts = {
  session: Address; // Session, spend limit, etc.
};
type ZksyncAccountSessionData = {
  sessionKey?: Hash;
  contracts: SessionRequiredContracts;
};

export type ClientWithZksyncAccountSessionData<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  account extends Account = Account,
> = Client<transport, chain, account> & ZksyncAccountSessionData;

export type ZksyncAccountSessionClient<
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
    ZksyncAccountWalletActions<chain, account> & ZksyncAccountSessionActions
  > & ZksyncAccountSessionData
>;

export interface ZksyncAccountSessionClientConfig<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  rpcSchema extends RpcSchema | undefined = undefined,
> extends Omit<WalletClientConfig<transport, chain, Account, rpcSchema>, "account"> {
  chain: NonNullable<chain>;
  address: Address;
  sessionKey?: Hash;
  contracts: SessionRequiredContracts;
  key?: string;
  name?: string;
}
