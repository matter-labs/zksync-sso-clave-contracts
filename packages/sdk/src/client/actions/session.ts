import { type Account, type Address, type Chain, type Client, type ExtractChainFormatterReturnType, type Hash, type Prettify, type TransactionReceipt, type Transport } from 'viem'
import { readContract, waitForTransactionReceipt, writeContract } from 'viem/actions';
import { generatePrivateKey, publicKeyToAddress } from 'viem/accounts';
import { type RegistrationResponseJSON } from "@simplewebauthn/types";

import type { SessionPreferences } from '../../client-gateway/interface.js';

import { requestPasskeySignature, type GeneratePasskeyRegistrationOptionsArgs } from '../actions/passkey.js';

export type RequestSessionArgs = Prettify<SessionPreferences & {
  sessionKey?: Hash;
  contracts: {
    session: Address
  }
}> & ({ passkeyRegistrationResponse: RegistrationResponseJSON } | { passkeyRegistrationOptions: GeneratePasskeyRegistrationOptionsArgs });
export type RequestSessionReturnType<chain extends Chain> = {
  transactionReceipt: ExtractChainFormatterReturnType<chain, "transactionReceipt", TransactionReceipt>;
  sessionKey: Hash;
}
export const requestSession = async <
  transport extends Transport,
  chain extends Chain,
  account extends Account
>(client: Client<transport, chain, account>, args: RequestSessionArgs): Promise<RequestSessionReturnType<chain>> => {
  const passkeyRegistrationResponse: RegistrationResponseJSON =
    'passkeyRegistrationResponse' in args
      ? args.passkeyRegistrationResponse
      : (await requestPasskeySignature(args.passkeyRegistrationOptions)).passkeyRegistrationResponse;
      
  const sessionKey = args.sessionKey || generatePrivateKey();
  const sessionKeyPublicAddress = publicKeyToAddress(sessionKey);
  const transactionHash = await createSessionWithPasskey(client, {
    sessionKeyPublicAddress,
    passkeyRegistrationResponse,
    contracts: args.contracts,
    spendLimit: args.spendLimit,
    validUntil: args.validUntil,
  });
  const receipt = await waitForTransactionReceipt(client, { hash: transactionHash });
  if (receipt.status === "reverted") throw new Error("Transaction reverted");
  return {
    transactionReceipt: receipt,
    sessionKey,
  };
}

export type CreateSessionWithPasskeyArgs = Prettify<SessionPreferences & {
  sessionKeyPublicAddress: Address;
  passkeyRegistrationResponse: RegistrationResponseJSON;
  contracts: { session: Address };
}>
export type CreateSessionWithPasskeyReturnType = Hash;
export const createSessionWithPasskey = async <
  transport extends Transport,
  chain extends Chain,
  account extends Account,
>(client: Client<transport, chain, account>, args: CreateSessionWithPasskeyArgs): Promise<CreateSessionWithPasskeyReturnType> => {
  /* TODO: Implement set session */
  const transactionHash = await writeContract(client, {
    address: args.contracts.session,
    args: [args.sessionKeyPublicAddress, args.passkeyRegistrationResponse, args.spendLimit, args.validUntil],
    abi: [] as const,
    functionName: "USE_ACTUAL_METHOD_HERE2222",
  } as any);
  return transactionHash;
}

export type GetTokenSpendLimitArgs = {
  tokenAddress: Address;
  contracts: { session: Address };
} & ({ sessionKey: Hash } | { sessionKeyPublicAddress: Address });
export type GetTokenSpendLimitReturnType = bigint;
export const getTokenSpendLimit = async <
  transport extends Transport,
  chain extends Chain,
  account extends Account
>(client: Client<transport, chain, account>, args: GetTokenSpendLimitArgs): Promise<GetTokenSpendLimitReturnType> => {
  const sessionKeyPublicAddress = 'sessionKey' in args ? publicKeyToAddress(args.sessionKey) : args.sessionKeyPublicAddress;
  /* TODO: use actual contract abi and method */
  const spendLimit = await readContract(client, {
    address: args.contracts.session,
    args: [sessionKeyPublicAddress, args.tokenAddress],
    abi: [] as const,
    functionName: "USE_ACTUAL_METHOD_HERE",
  });
  return spendLimit;
}
