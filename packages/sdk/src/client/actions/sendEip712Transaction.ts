import { type Account, type Client, type Hash, type SendTransactionRequest, type Transport } from "viem";
import { parseAccount } from "viem/accounts";
import { prepareTransactionRequest, sendRawTransaction } from "viem/actions";
import { type ChainEIP712, type SendEip712TransactionParameters, type SendEip712TransactionReturnType } from "viem/zksync";

import { assertEip712Request } from "../utils/assertEip712Request.js";
import { getAction } from "../utils/getAction.js";

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
const defaultParameters = [
  "blobVersionedHashes",
  "chainId",
  "fees",
  "gas",
  "nonce",
  "type",
] as const;

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
  console.log("sendEip712Transaction", parameters);

  try {
    assertEip712Request(parameters);

    const request = await getAction(
      client,
      prepareTransactionRequest,
      "prepareTransactionRequest",
    )({
      account,
      chain,
      nonceManager: account.nonceManager,
      parameters: [...defaultParameters, "sidecars"],
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
  } catch (err) {
    console.error("sendeip712transaction error");
    throw err;
  }
}
