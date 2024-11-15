import { type Account, type Address, type Chain, type Client, encodeFunctionData, type Hash, type Prettify, type TransactionReceipt, type Transport } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { getGeneralPaymasterInput, sendTransaction } from "viem/zksync";

import { SessionKeyModuleAbi } from "../../abi/SessionKeyModule.js";
import { noThrow } from "../../utils/helpers.js";
import type { SessionConfig } from "../../utils/session.js";

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

export type CreateSessionArgs = {
  sessionConfig: SessionConfig;
  contracts: {
    session: Address; // session module
  };
  onTransactionSent?: (hash: Hash) => void;
};
export type CreateSessionReturnType = {
  transactionReceipt: TransactionReceipt;
};
export const createSession = async <
  transport extends Transport,
  chain extends Chain,
  account extends Account,
>(client: Client<transport, chain, account>, args: Prettify<CreateSessionArgs>): Promise<Prettify<CreateSessionReturnType>> => {
  const callData = encodeFunctionData({
    abi: SessionKeyModuleAbi,
    functionName: "createSession",
    args: [args.sessionConfig],
  });

  let sendTransactionArgs = {
    to: args.contracts.session,
    data: callData,
    gas: 10_000_000n, // TODO: Remove when gas estimation is fixed
  } as any;

  if ((client as any).paymasterAddress) {
    sendTransactionArgs = {
      ...sendTransactionArgs,
      account: client.account,
      paymaster: (client as any).paymasterAddress,
      paymasterInput: (client as any).paymasterInput ?? getGeneralPaymasterInput({ innerInput: "0x" }),
    };
  }

  const transactionHash = await sendTransaction(client, sendTransactionArgs);
  if (args.onTransactionSent) {
    noThrow(() => args.onTransactionSent?.(transactionHash));
  }

  const transactionReceipt = await waitForTransactionReceipt(client, { hash: transactionHash });
  if (transactionReceipt.status !== "success") throw new Error("createSession transaction reverted");

  return {
    transactionReceipt,
  };
};
