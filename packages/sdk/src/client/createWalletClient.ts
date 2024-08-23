import { createClient, getAddress, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { zksyncAccountWalletActions } from "./decorators/wallet";

import type {
  Account,
  Address,
  Chain,
  Client,
  Hash,
  Prettify,
  PublicRpcSchema,
  RpcSchema,
  Transport,
  WalletClientConfig,
  WalletRpcSchema,
} from "viem";
import type { SessionData, SessionPreferences } from "../client-gateway/index";
import type { ZksyncAccountWalletActions } from "./decorators/wallet";

export type ZksyncAccountContracts = {
  session: Address; // Session, spend limit, etc.
  accountFactory?: Address; // For account creation
};

export type ClientWithZksyncAccountData<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  account extends Account = Account,
> = Client<transport, chain, account> & {
  session: SessionData;
  contracts: ZksyncAccountContracts;
};

export type ZksyncAccountWalletClient<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  rpcSchema extends RpcSchema | undefined = undefined,
> = Prettify<
  Client<
    transport,
    chain,
    Account,
    rpcSchema extends RpcSchema
      ? [...PublicRpcSchema, ...WalletRpcSchema, ...rpcSchema]
      : [...PublicRpcSchema, ...WalletRpcSchema],
    ZksyncAccountWalletActions<chain, Account>
  > & {
    session: SessionData;
    contracts: ZksyncAccountContracts;
  }
>;

export interface ZksyncAccountWalletClientConfig<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  rpcSchema extends RpcSchema | undefined = undefined,
> extends Omit<
    WalletClientConfig<transport, chain, Account, rpcSchema>,
    "account"
  > {
  chain: NonNullable<chain>;
  address: Address;
  session: SessionPreferences & {
    sessionKey: Hash;
  };
  contracts: ZksyncAccountContracts;
  key?: string;
  name?: string;
}

export function createZksyncWalletClient<
  transport extends Transport,
  chain extends Chain,
  rpcSchema extends RpcSchema | undefined = undefined,
>(
  _parameters: ZksyncAccountWalletClientConfig<transport, chain, rpcSchema>
): ZksyncAccountWalletClient<transport, chain, rpcSchema> {
  type WalletClientParameters = typeof _parameters;
  const parameters: WalletClientParameters & {
    key: NonNullable<WalletClientParameters["key"]>;
    name: NonNullable<WalletClientParameters["name"]>;
    session: SessionData;
  } = {
    ..._parameters,
    address: getAddress(_parameters.address),
    key: _parameters.key || "wallet",
    name: _parameters.name || "Wallet Client",
    session: {
      address: getAddress(_parameters.address),
      chainId: _parameters.chain.id,
      sessionKey: _parameters.session.sessionKey,
      spendLimit: _parameters.session.spendLimit ?? {},
      validUntil: _parameters.session.validUntil,
    },
    contracts: _parameters.contracts,
  };

  const account = privateKeyToAccount(parameters.session.sessionKey);
  const client = createClient<transport, chain, Account, rpcSchema>({
    ...parameters,
    account,
    type: "walletClient",
  })
    .extend(() => ({
      session: parameters.session,
      contracts: parameters.contracts,
    }))
    .extend(publicActions)
    .extend(zksyncAccountWalletActions);
  return client;
}
