import { toHex, encodeAbiParameters, createClient, getAddress, publicActions, walletActions, type WalletActions, type PublicActions, type Account, type Address, type Chain, type Client, type Prettify, type PublicRpcSchema, type RpcSchema, type Transport, type WalletClientConfig, type WalletRpcSchema } from 'viem'

import { requestPasskeyAuthentication } from '../actions/passkey.js';
import { zksyncAccountPasskeyActions, type ZksyncAccountPasskeyActions } from '../decorators/passkey.js';
import { base64UrlToUint8Array, unwrapEC2Signature } from '../../utils/passkey.js';
import { toSmartAccount } from '../smart-account.js';

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
      const passkeySignature = await requestPasskeyAuthentication({
        challenge: hash,
        credentialPublicKey: parameters.credentialPublicKey,
      });
      const authData = passkeySignature.passkeyAuthenticationResponse.response.authenticatorData;
      const clientDataJson = passkeySignature.passkeyAuthenticationResponse.response.clientDataJSON;
      const signature = unwrapEC2Signature(
        base64UrlToUint8Array(passkeySignature.passkeyAuthenticationResponse.response.signature)
      );
      const fatSignature = encodeAbiParameters(
        [
          { type: 'bytes' }, // authData
          { type: 'bytes' }, // clientDataJson
          { type: 'bytes32[2]' }, // signature (two elements)
        ],
        [
          toHex(base64UrlToUint8Array(authData)),
          toHex(base64UrlToUint8Array(clientDataJson)),
          [toHex(signature.r), toHex(signature.s)]
        ]
      );
      const fullFormattedSig = encodeAbiParameters(
        [
          { type: 'bytes' }, // fat signature
          { type: 'address' }, // validator address
          { type: 'bytes[]' }, // validator data
        ],
        [
          fatSignature,
          parameters.contracts.validator,
          []
        ]
      );
      
      return fullFormattedSig;
    },
  });
  const client = createClient<transport, chain, Account, rpcSchema>({
    ...parameters,
    account,
    type: 'walletClient',
  })
    .extend(() => ({
      credentialPublicKey: parameters.credentialPublicKey,
      userName: parameters.userName,
      userDisplayName: parameters.userDisplayName,
      contracts: parameters.contracts,
    }))
    .extend(publicActions)
    .extend(walletActions)
    .extend(zksyncAccountPasskeyActions)
  return client;
}

export type PasskeyRequiredContracts = {
  session: Address; // Session, spend limit, etc.
  validator: Address; // Validator for passkey signature
  accountFactory?: Address; // For account creation
  accountImplementation?: Address; // For account creation
}
type ZksyncAccountPasskeyData = {
  credentialPublicKey: Uint8Array; // Public key of the passkey
  userName: string; // Basically unique user id (which is called `userName` in webauthn)
  userDisplayName: string; // Also option required for webauthn
  contracts: PasskeyRequiredContracts;
}

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
    PublicActions<transport, chain, account> & WalletActions<chain, account> & ZksyncAccountPasskeyActions
  > & ZksyncAccountPasskeyData
>;

export interface ZksyncAccountPasskeyClientConfig<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  rpcSchema extends RpcSchema | undefined = undefined
> extends Omit<WalletClientConfig<transport, chain, Account, rpcSchema>, 'account'> {
  chain: NonNullable<chain>;
  address: Address;
  credentialPublicKey: Uint8Array;
  userName: string;
  userDisplayName: string;
  contracts: PasskeyRequiredContracts;
  key?: string;
  name?: string;
}