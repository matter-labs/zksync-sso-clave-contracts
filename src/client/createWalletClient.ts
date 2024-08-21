import { createClient, getAddress, publicActions, type Account, type Address, type Chain, type Client, type Hash, type Prettify, type PublicRpcSchema, type RpcSchema, type Transport, type WalletActions, type WalletClientConfig, type WalletRpcSchema } from 'viem'
import { privateKeyToAccount } from 'viem/accounts';

import type { SessionData, SessionParameters } from '../gateway-client/index.js';
import { zksyncAccountWalletActions } from './decorators/wallet.js';

export type ZksyncAccountContracts = {
  session: Address; // Session, spend limit, etc.
  accountFactory?: Address; // Account creation
}

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
    WalletActions<chain, Account>
  > & {
    session: SessionData,
  }
>

export interface ZksyncAccountWalletClientConfig<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  rpcSchema extends RpcSchema | undefined = undefined
> extends Omit<WalletClientConfig<transport, chain, Account, rpcSchema>, 'account'> {
  chain: NonNullable<chain>;
  address: Address;
  session: SessionParameters & {
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
>(_parameters: ZksyncAccountWalletClientConfig<transport, chain, rpcSchema>): ZksyncAccountWalletClient<transport, chain, rpcSchema> {
  type WalletClientParameters = typeof _parameters;
  const parameters: WalletClientParameters & {
    key: NonNullable<WalletClientParameters['key']>;
    name: NonNullable<WalletClientParameters['name']>;
    session: SessionData;
  } = {
    ..._parameters,
    address: getAddress(_parameters.address),
    key: _parameters.key || 'wallet',
    name: _parameters.name || 'Wallet Client',
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
    type: 'walletClient',
  })
    .extend(() => ({
      session: parameters.session,
      contracts: parameters.contracts,
    }))
    .extend(publicActions)
    .extend(zksyncAccountWalletActions);
  return client;
}