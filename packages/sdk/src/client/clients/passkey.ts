import { createClient, getAddress, publicActions, walletActions, type Account, type Address, type Chain, type Client, type Prettify, type PublicRpcSchema, type RpcSchema, type Transport, type WalletClientConfig, type WalletRpcSchema } from 'viem'
import { toSmartAccount } from 'viem/zksync';

import type { ZksyncAccountContracts } from './common.js';
import { requestPasskeySignature } from '../actions/passkey.js';

export function createZksyncPasskeyClient<
  transport extends Transport,
  chain extends Chain,
  rpcSchema extends RpcSchema | undefined = undefined,
>(_parameters: ZksyncAccountPasskeyClientConfig<transport, chain, rpcSchema>): ZksyncAccountPasskeyClient<transport, chain, rpcSchema> {
  type WalletClientParameters = typeof _parameters;
  const parameters: WalletClientParameters & {
    key: NonNullable<WalletClientParameters['key']>;
    name: NonNullable<WalletClientParameters['name']>;
  } = {
    ..._parameters,
    address: getAddress(_parameters.address),
    key: _parameters.key || 'wallet',
    name: _parameters.name || 'ZKsync Account Passkey Client',
  };
  
  const account = toSmartAccount({
    address: parameters.address,
    sign: async ({ hash }) => {
      const passkeySignature = await requestPasskeySignature({
        userName: parameters.userName,
        userDisplayName: parameters.userDisplayName,
        challenge: hash,
      });
      console.debug("Passkey signature", passkeySignature);
      const authData = passkeySignature.passkeyRegistrationResponse.response.authenticatorData!;
      const clientDataJson = passkeySignature.passkeyRegistrationResponse.response.clientDataJSON!;

      
      /* TODO: do something with that signature */
      return hash;
    },
  });
  const client = createClient<transport, chain, Account, rpcSchema>({
    ...parameters,
    account,
    type: 'walletClient',
  })
    .extend(() => ({
      userName: parameters.userName,
      userDisplayName: parameters.userDisplayName,
      contracts: parameters.contracts,
    }))
    .extend(publicActions)
    .extend(walletActions)
  return client;
}

type ZksyncAccountPasskeyData = {
  userName: string;
  userDisplayName: string;
  contracts: ZksyncAccountContracts;
}

export type ClientWithZksyncAccountPasskeyData<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  account extends Account = Account,
> = Client<transport, chain, account> & ZksyncAccountPasskeyData;

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
      : [...PublicRpcSchema, ...WalletRpcSchema]
  > & ZksyncAccountPasskeyData
>

export interface ZksyncAccountPasskeyClientConfig<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  rpcSchema extends RpcSchema | undefined = undefined
> extends Omit<WalletClientConfig<transport, chain, Account, rpcSchema>, 'account'> {
  chain: NonNullable<chain>;
  address: Address;
  userName: string;
  userDisplayName: string;
  contracts: ZksyncAccountContracts;
  key?: string;
  name?: string;
}