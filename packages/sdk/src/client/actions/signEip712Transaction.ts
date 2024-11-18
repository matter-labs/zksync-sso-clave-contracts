import { type Account, type Address, assertCurrentChain, BaseError, type Client, type ExtractChainFormatterParameters, type GetChainParameter, type IsUndefined, type Transport, type UnionOmit } from "viem";
import { parseAccount } from "viem/accounts";
import { getChainId, signTypedData } from "viem/actions";
import type { ChainEIP712, SignTransactionErrorType, SignTransactionReturnType, TransactionRequestEIP712 } from "viem/zksync";

import { assertEip712Request, type AssertEip712RequestParameters } from "../utils/assertEip712Request.js";
import { getAction } from "../utils/getAction.js";

type GetAccountParameter<
  account extends Account | undefined = Account | undefined,
  accountOverride extends Account | Address | undefined = Account | Address,
  required extends boolean = true,
> = IsUndefined<account> extends true
  ? required extends true
    ? { account: accountOverride | Account | Address }
    : { account?: accountOverride | Account | Address | undefined }
  : { account?: accountOverride | Account | Address | undefined };

type FormattedTransactionRequest<
  chain extends ChainEIP712 | undefined = ChainEIP712 | undefined,
> = ExtractChainFormatterParameters<
  chain,
  "transactionRequest",
  TransactionRequestEIP712
>;

export type SignEip712TransactionParameters<
  chain extends ChainEIP712 | undefined = ChainEIP712 | undefined,
  account extends Account | undefined = Account | undefined,
  chainOverride extends ChainEIP712 | undefined = ChainEIP712 | undefined,
> = UnionOmit<
  FormattedTransactionRequest<
    chainOverride extends ChainEIP712 ? chainOverride : chain
  >,
  "from"
> &
GetAccountParameter<account> &
GetChainParameter<chain, chainOverride>;

export type SignEip712TransactionReturnType = SignTransactionReturnType;

export type SignEip712TransactionErrorType = SignTransactionErrorType;

/**
 * Signs an EIP712 transaction.
 *
 * @param args - {@link SignTransactionParameters}
 * @returns The signed serialized transaction. {@link SignTransactionReturnType}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { zksync } from 'viem/chains'
 * import { signEip712Transaction } from 'viem/zksync'
 *
 * const client = createWalletClient({
 *   chain: zksync,
 *   transport: custom(window.ethereum),
 * })
 * const signature = await signEip712Transaction(client, {
 *   account: '0xA0Cf798816D4b9b9866b5330EEa46a18382f251e',
 *   to: '0x0000000000000000000000000000000000000000',
 *   value: 1n,
 * })
 *
 * @example
 * // Account Hoisting
 * import { createWalletClient, http } from 'viem'
 * import { privateKeyToAccount } from 'viem/accounts'
 * import { zksync } from 'viem/chains'
 * import { signEip712Transaction } from 'viem/zksync'
 *
 * const client = createWalletClient({
 *   account: privateKeyToAccount('0x…'),
 *   chain: zksync,
 *   transport: custom(window.ethereum),
 * })
 * const signature = await signEip712Transaction(client, {
 *   to: '0x0000000000000000000000000000000000000000',
 *   value: 1n,
 * })
 */
export async function signEip712Transaction<
  chain extends ChainEIP712 | undefined,
  account extends Account | undefined,
  chainOverride extends ChainEIP712 | undefined,
>(
  client: Client<Transport, chain, account>,
  args: SignEip712TransactionParameters<chain, account, chainOverride>,
): Promise<SignEip712TransactionReturnType> {
  const {
    account: account_ = client.account,
    chain = client.chain,
    ...transaction
  } = args;

  if (!account_)
    throw new Error("Account not found.");
  const account = parseAccount(account_);

  assertEip712Request({
    account,
    chain,
    ...(args as AssertEip712RequestParameters),
  });

  if (!chain?.custom?.getEip712Domain)
    throw new BaseError("`getEip712Domain` not found on chain.");
  if (!chain?.serializers?.transaction)
    throw new BaseError("transaction serializer not found on chain.");

  const chainId = await getAction(client, getChainId, "getChainId")({});
  if (chain !== null)
    assertCurrentChain({
      currentChainId: chainId,
      chain: chain,
    });

  const eip712Domain = chain?.custom.getEip712Domain({
    ...transaction,
    chainId,
    from: account.address,
    type: "eip712",
  });

  const customSignature = await signTypedData(client, {
    ...eip712Domain,
    account,
  });

  return chain?.serializers?.transaction(
    {
      chainId,
      ...transaction,
      customSignature,
      type: "eip712" as any,
    },
    { r: "0x0", s: "0x0", v: 0n },
  ) as SignEip712TransactionReturnType;
}
