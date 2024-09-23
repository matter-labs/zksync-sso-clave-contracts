import { encodeFunctionData, type Account, type Address, type Chain, type Client, type Hash, type Prettify, type TransactionReceipt, type Transport } from 'viem'
import { readContract, waitForTransactionReceipt } from 'viem/actions';
import { Provider, SmartAccount, utils as ethersUtils, type types as ethersTypes } from 'zksync-ethers';

import { noThrow } from '../../utils/helpers.js';
import { SessionPasskeySpendLimitModuleAbi } from '../../abi/SessionPasskeySpendLimitModule.js';

/* DO NOT USE THIS. USE FUNCTION FROM PASSKEY ACTIONS INSTEAD */
/* TODO: Remove */
/* export type RequestSessionArgs = Prettify<SessionPreferences & {
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
} */

/* DO NOT USE THIS. USE FUNCTION FROM PASSKEY ACTIONS INSTEAD */
/* TODO: Remove */
/* export type CreateSessionWithPasskeyArgs = Prettify<SessionPreferences & {
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
  // TODO: Implement set session
  const transactionHash = await writeContract(client, {
    address: args.contracts.session,
    args: [args.sessionKeyPublicAddress, args.passkeyRegistrationResponse, args.spendLimit, args.validUntil],
    abi: [] as const,
    functionName: "USE_ACTUAL_METHOD_HERE2222",
  } as any);
  return transactionHash;
} */

/* TODO: make contracts support fetching initial limit, left limit by session public address,
  instead of by token address */
export type GetTokenSpendLimitArgs = {
  accountAddress: Address;
  tokenAddress: Address;
  contracts: { session: Address };
} /* & ({ sessionKey: Hash } | { sessionKeyPublicAddress: Address }) */;
export type GetTokenSpendLimitReturnType = {
  limitLeft: bigint;
  sessionPublicKey: Address;
};
export const getTokenSpendLimit = async <
  transport extends Transport,
  chain extends Chain,
  account extends Account
>(client: Client<transport, chain, account>, args: GetTokenSpendLimitArgs): Promise<Prettify<GetTokenSpendLimitReturnType>> => {
  /* const sessionKeyPublicAddress = 'sessionKey' in args ? publicKeyToAddress(args.sessionKey) : args.sessionKeyPublicAddress; */
  /* TODO: this isn't actually the right method to fetch how much spend limit is left!!! */
  const [limitLeft, sessionPublicKey] = await readContract(client, {
    address: args.contracts.session,
    abi: SessionPasskeySpendLimitModuleAbi,
    functionName: "spendingLimits",
    args: [args.accountAddress, args.tokenAddress],
  });
  
  return {
    limitLeft,
    sessionPublicKey,
  };
}

export type AddSessionKeyArgs = {
  accountAddress: Address;
  sessionPublicKey: Address;
  token: Address;
  expiresAt: bigint | Date; // Time in seconds as bigint or Date
  contracts: {
    session: Address;
  };
  onTransactionSent?: (hash: Hash) => void;
};
export type AddSessionKeyReturnType = {
  transactionReceipt: TransactionReceipt;
};
export const addSessionKey = async <
  transport extends Transport,
  chain extends Chain,
  account extends Account
>(client: Client<transport, chain, account>, args: Prettify<AddSessionKeyArgs>): Promise<Prettify<AddSessionKeyReturnType>> => {
  const provider = new Provider(client.chain.rpcUrls.default.http[0]);
  const passkeyClient = new SmartAccount({
    payloadSigner: (hash: any) => {
      return Promise.resolve(client.account.sign!({ hash: hash }));
    },
    address: args.accountAddress,
    secret: null,
  }, provider);

  const callData = encodeFunctionData({
    abi: SessionPasskeySpendLimitModuleAbi,
    functionName: "addSessionKey",
    args: [
      args.sessionPublicKey,
      args.token,
      typeof args.expiresAt === "bigint" ? args.expiresAt : BigInt(Math.floor(args.expiresAt.getTime() / 1000)),
    ],
  });

  const aaTx = {
    type: 113,
    from: args.accountAddress,
    to: args.contracts.session,
    data: callData,
    chainId: (await provider.getNetwork()).chainId,
    nonce: await provider.getTransactionCount(args.accountAddress),
    gasPrice: await provider.getGasPrice(),
    customData: {
      gasPerPubdata: ethersUtils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    } as ethersTypes.Eip712Meta,
  };
  (aaTx as any)['gasLimit'] = await provider.estimateGas(aaTx);

  const signedTransaction = await passkeyClient.signTransaction(aaTx);
  const tx = await provider.broadcastTransaction(signedTransaction);
  const transactionHash = tx.hash as Hash;
  if (args.onTransactionSent) {
    noThrow(() => args.onTransactionSent?.(transactionHash));
  }

  const transactionReceipt = await waitForTransactionReceipt(client, { hash: transactionHash });
  if (transactionReceipt.status !== "success") throw new Error("addSessionKey transaction reverted");

  return {
    transactionReceipt,
  };
}