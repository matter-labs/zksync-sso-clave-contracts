import { createClient, getAddress, publicActions, type Account, type Address, type Chain, type Client, type Hash, type Prettify, type PublicRpcSchema, type RpcSchema, type Transport, type WalletActions, type WalletClientConfig, type WalletRpcSchema } from 'viem'
import { privateKeyToAccount } from 'viem/accounts';

import type { SessionData, SessionParameters } from '../gateway-client/index.js';
import { zksyncAccountWalletActions } from './decorators/wallet.js';

export type ClientWithZksyncAccountSession<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  account extends Account = Account,
> = Client<transport, chain, account> & { session: SessionData };

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
> extends WalletClientConfig<transport, chain, Account, rpcSchema> {
  chain: NonNullable<chain>;
  address: Address;
  session: SessionParameters & {
    sessionKey: Hash;
  }
  key?: string;
  name?: string;
  account: never;
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
    }
  };
  
  const account = privateKeyToAccount(parameters.session.sessionKey);
  const client = createClient<transport, chain, Account, rpcSchema>({
    ...parameters,
    account,
    type: 'walletClient',
  })
    .extend(() => ({ session: parameters.session }))
    .extend(publicActions)
    .extend(zksyncAccountWalletActions);
  return client;
}