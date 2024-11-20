import { type Account, assertRequest, type AssertRequestErrorType, type Chain, type Client, type ExactPartial, type Hash, type PublicActions, type RpcSchema, type SendTransactionRequest, type Transport, type WalletActions } from "viem";
import { parseAccount } from "viem/accounts";
import { prepareTransactionRequest, sendRawTransaction } from "viem/actions";
import { type ChainEIP712, type SendEip712TransactionParameters, type SendEip712TransactionReturnType, type SendTransactionParameters, zksync } from "viem/zksync";

import { InvalidEip712TransactionError, type InvalidEip712TransactionErrorType } from "../utils/assertEip712Transaction.js";
import { isEIP712Transaction } from "../utils/isEip712Transaction.js";

/**
 * Creates, signs, and sends a new EIP712 transaction to the network.
 *
 * @param client - Client to use
 * @param parameters - {@link SendEip712TransactionParameters}
 * @returns The [Transaction](https://viem.sh/docs/glossary/terms#transaction) hash. {@link SendTransactionReturnType}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { zksync } from 'viem/chains'
 * import { sendEip712Transaction } from 'viem/zksync'
 *
 * const client = createWalletClient({
 *   chain: zksync,
 *   transport: custom(window.ethereum),
 * })
 * const hash = await sendEip712Transaction(client, {
 *   account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
 *   to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
 *   value: 1000000000000000000n,
 * })
 *
 * @example
 * // Account Hoisting
 * import { createWalletClient, http } from 'viem'
 * import { privateKeyToAccount } from 'viem/accounts'
 * import { zksync } from 'viem/chains'
 * import { sendEip712Transaction } from 'viem/zksync'
 *
 * const client = createWalletClient({
 *   account: privateKeyToAccount('0x…'),
 *   chain: zksync,
 *   transport: http(),
 * })
 *
 * const hash = await sendEip712Transaction(client, {
 *   to: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
 *   value: 1000000000000000000n,
 * })
 */
export async function sendEip712Transaction<
  chain extends ChainEIP712 | undefined,
  account extends Account | undefined,
  const request extends SendTransactionRequest<chain, chainOverride>,
  chainOverride extends ChainEIP712 | undefined = undefined,
>(
  client: Client<Transport, chain, account>,
  parameters: SendEip712TransactionParameters<
    chain,
    account,
    chainOverride,
    request
  >,
): Promise<SendEip712TransactionReturnType> {
  const {
    account: account_ = client.account,
    chain = client.chain,
    ...rest
  } = parameters;

  if (!account_)
    throw new Error("Account not found.");
  const account = parseAccount(account_);

  assertEip712Request(parameters);

  const request = await getAction(
    client,
    prepareTransactionRequest,
    "prepareTransactionRequest",
  )({
    account,
    chain,
    nonceManager: account.nonceManager,
    ...rest,
  } as any);

  const serializer = chain?.serializers?.transaction;
  const serializedTransaction = (await account.signTransaction!(request, {
    serializer,
  })) as Hash;

  return await getAction(
    client,
    sendRawTransaction,
    "sendRawTransaction",
  )({
    serializedTransaction,
  });
}

/**
 * Retrieves and returns an action from the client (if exists), and falls
 * back to the tree-shakable action.
 *
 * Useful for extracting overridden actions from a client (ie. if a consumer
 * wants to override the `sendTransaction` implementation).
 */
export function getAction<
  transport extends Transport,
  chain extends Chain | undefined,
  account extends Account | undefined,
  rpcSchema extends RpcSchema | undefined,
  extended extends { [key: string]: unknown },
  client extends Client<transport, chain, account, rpcSchema, extended>,
  parameters,
  returnType,
>(
  client: client,
  actionFn: (_: any, parameters: parameters) => returnType,
  // cspell:ignore minifiers
  // Some minifiers drop `Function.prototype.name`, or replace it with short letters,
  // meaning that `actionFn.name` will not always work. For that case, the consumer
  // needs to pass the name explicitly.
  name: keyof PublicActions | keyof WalletActions | (string & {}),
): (parameters: parameters) => returnType {
  const action_implicit = client[actionFn.name];
  if (typeof action_implicit === "function")
    return action_implicit as (params: parameters) => returnType;

  const action_explicit = client[name];
  if (typeof action_explicit === "function")
    return action_explicit as (params: parameters) => returnType;

  return (params) => actionFn(client, params);
}

type AssertEip712RequestParameters = ExactPartial<
  SendTransactionParameters<typeof zksync>
>;

/** @internal */
export type AssertEip712RequestErrorType =
  | InvalidEip712TransactionErrorType
  | AssertRequestErrorType;

export function assertEip712Request(args: AssertEip712RequestParameters) {
  if (!isEIP712Transaction(args as any))
    throw new InvalidEip712TransactionError();
  assertRequest(args as any);
}
