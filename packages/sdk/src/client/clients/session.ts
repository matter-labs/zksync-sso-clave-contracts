import { createClient, getAddress, publicActions, type Account, type Address, type Chain, type Client, type Hash, type Prettify, type PublicRpcSchema, type RpcSchema, type Transport, type WalletClientConfig, type WalletRpcSchema } from 'viem'
import { privateKeyToAccount } from 'viem/accounts';
import { toSmartAccount } from 'viem/zksync';

import type { ZksyncAccountContracts } from './common.js';
import { zksyncAccountWalletActions, type ZksyncAccountWalletActions } from '../decorators/session_wallet.js';
import { zksyncAccountSessionActions, type ZksyncAccountSessionActions } from '../decorators/session.js';

export function createZksyncSessionClient<
  transport extends Transport,
  chain extends Chain,
  rpcSchema extends RpcSchema | undefined = undefined,
>(_parameters: ZksyncAccountSessionClientConfig<transport, chain, rpcSchema>): ZksyncAccountSessionClient<transport, chain, rpcSchema> {
  type WalletClientParameters = typeof _parameters;
  const parameters: WalletClientParameters & {
    key: NonNullable<WalletClientParameters['key']>;
    name: NonNullable<WalletClientParameters['name']>;
  } = {
    ..._parameters,
    address: getAddress(_parameters.address),
    key: _parameters.key || 'wallet',
    name: _parameters.name || 'ZKsync Account Session Client',
  };
  
  const account = toSmartAccount({
    address: parameters.address,
    sign: async ({ hash }) => {
      if (!parameters.sessionKey) throw new Error('Session key wasn\'t provided, can\'t sign');
      const sessionKeySigner = privateKeyToAccount(parameters.sessionKey);
      return sessionKeySigner.sign({ hash });
    },
  });
  const client = createClient<transport, chain, Account, rpcSchema>({
    ...parameters,
    account,
    type: 'walletClient',
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

type ZksyncAccountSessionData = {
  sessionKey?: Hash;
  contracts: ZksyncAccountContracts;
}

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
    ZksyncAccountWalletActions<chain, account> & ZksyncAccountSessionActions<chain>
  > & ZksyncAccountSessionData
>

export interface ZksyncAccountSessionClientConfig<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  rpcSchema extends RpcSchema | undefined = undefined
> extends Omit<WalletClientConfig<transport, chain, Account, rpcSchema>, 'account'> {
  chain: NonNullable<chain>;
  address: Address;
  sessionKey?: Hash;
  contracts: ZksyncAccountContracts;
  key?: string;
  name?: string;
}
