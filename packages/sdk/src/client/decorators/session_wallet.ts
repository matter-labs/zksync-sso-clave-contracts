import { type Account, bytesToHex, type Chain, formatTransaction, type Transport, type WalletActions } from "viem";
import { deployContract, getAddresses, getChainId, sendRawTransaction, signMessage, signTypedData, writeContract } from "viem/actions";
import { signTransaction, type ZksyncEip712Meta } from "viem/zksync";

import { sendEip712Transaction } from "../actions/sendEip712Transaction.js";
import type { ClientWithZksyncSsoSessionData } from "../clients/session.js";

export type ZksyncSsoWalletActions<chain extends Chain, account extends Account> = Omit<
  WalletActions<chain, account>, "addChain" | "getPermissions" | "requestAddresses" | "requestPermissions" | "switchChain" | "watchAsset" | "prepareTransactionRequest"
>;

export function zksyncSsoWalletActions<
  transport extends Transport,
  chain extends Chain,
  account extends Account,
>(client: ClientWithZksyncSsoSessionData<transport, chain, account>): ZksyncSsoWalletActions<chain, account> {
  return {
    deployContract: (args) => deployContract(client, args),
    getAddresses: () => getAddresses(client),
    getChainId: () => getChainId(client),
    sendRawTransaction: (args) => sendRawTransaction(client, args),
    sendTransaction: async (args) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const unformattedTx: any = Object.assign({}, args);

      if ("eip712Meta" in unformattedTx) {
        const eip712Meta = unformattedTx.eip712Meta as ZksyncEip712Meta;
        unformattedTx.gasPerPubdata = eip712Meta.gasPerPubdata ? BigInt(eip712Meta.gasPerPubdata) : undefined;
        unformattedTx.factoryDeps = eip712Meta.factoryDeps;
        unformattedTx.customSignature = eip712Meta.customSignature;
        unformattedTx.paymaster = eip712Meta.paymasterParams?.paymaster;
        unformattedTx.paymasterInput = eip712Meta.paymasterParams?.paymasterInput ? bytesToHex(new Uint8Array(eip712Meta.paymasterParams?.paymasterInput)) : undefined;
        delete unformattedTx.eip712Meta;
      }

      const formatters = client.chain?.formatters;
      const format = formatters?.transaction?.format || formatTransaction;

      const tx = {
        ...format(unformattedTx),
        type: "eip712",
      };

      return await sendEip712Transaction(client, tx);
    },
    signMessage: (args) => signMessage(client, args),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    signTransaction: (args) => signTransaction(client, args as any),
    signTypedData: (args) => signTypedData(client, args),
    writeContract: (args) => writeContract(client, args),
  };
}

/* export class SpendLimitError extends Error {
  public tokenAddress: Address;
  public spendLimit: bigint;

  constructor(message: string, info: { tokenAddress: Address, spendLimit: bigint }) {
    super(message);
    this.tokenAddress = info.tokenAddress;
    this.spendLimit = info.spendLimit;
  }
}

const l2BaseTokenAddress = getAddress('0x000000000000000000000000000000000000800a');

const blockedMethods = [
  "approve", // do not allow token approvals to prevent indirect token transfer
];
const isBlockedMethod = (method: string) => {
  return blockedMethods.includes(method);
}

const decodeERC20TransactionData = (transactionData: Hash) => {
  try {
    const { functionName, args } = decodeFunctionData({
      abi: erc20Abi,
      data: transactionData,
    });
    return { functionName, args };
  } catch {
    return { functionName: undefined, args: [] };
  }
}

const getTotalFee = (fee: {
  gas?: bigint,
  gasPrice?: bigint,
  maxFeePerGas?: bigint,
  maxPriorityFeePerGas?: bigint,
}): bigint => {
  if (!fee.gas) return 0n;

  if (fee.gasPrice) {
    return fee.gas * fee.gasPrice;
  } else if (fee.maxFeePerGas && fee.maxPriorityFeePerGas) {
    return fee.gas * (fee.maxFeePerGas + fee.maxPriorityFeePerGas);
  } else if (fee.maxFeePerGas) {
    return fee.gas * fee.maxFeePerGas;
  } else if (fee.maxPriorityFeePerGas) {
    return fee.gas * fee.maxPriorityFeePerGas;
  }

  return 0n;
}

const verifyTransactionData = async (
  transaction: {
    value?: bigint;
    chain?: { id: number | undefined };
    to?: Address;
    data?: Hash;
    gas?: bigint,
    gasPrice?: bigint,
    maxFeePerGas?: bigint,
    maxPriorityFeePerGas?: bigint,
  },
  client: ClientWithZksyncSsoSessionData
) => {
  const spendLimitCache = new Map<Address, bigint>(); // Prevent multiple calls to getTokenSpendLimit (mostly for ETH)
  const exceedsSpendLimit = async (tokenAddress: Address, amount: bigint): Promise<boolean> => {
    if (!spendLimitCache.has(tokenAddress)) {
      const spendLimit = await getTokenSpendLimit(client, { tokenAddress, sessionKey: client.sessionKey!, contracts: client.contracts });
      spendLimitCache.set(tokenAddress, spendLimit);
    }

    const tokenSpendLimit = spendLimitCache.get(tokenAddress)!;
    if (tokenSpendLimit < amount) {
      return true;
    }

    return false;
  }

  // Verify transaction value
  const value = transaction.value || 0n;
  if (await exceedsSpendLimit(getAddress(l2BaseTokenAddress), value)) {
    throw new SpendLimitError(`Transaction value ${value} exceeds account spend limit`, {
      tokenAddress: getAddress(l2BaseTokenAddress),
      spendLimit: spendLimitCache.get(getAddress(l2BaseTokenAddress))!,
    });
  }

  // Verify total fee
  const totalFee = getTotalFee({
    gas: transaction.gas,
    gasPrice: transaction.gasPrice,
    maxFeePerGas: transaction.maxFeePerGas,
    maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
  });
  if (await exceedsSpendLimit(getAddress(l2BaseTokenAddress), totalFee)) {
    throw new SpendLimitError(`Total fee ${totalFee} exceeds account spend limit`, {
      tokenAddress: getAddress(l2BaseTokenAddress),
      spendLimit: spendLimitCache.get(getAddress(l2BaseTokenAddress))!,
    });
  }

  if (!transaction.data || !transaction.to) return;

  // Assuming transaction is an erc20 transaction
  const { functionName, args } = decodeERC20TransactionData(transaction.data);
  if (!functionName) return;

  // Verify if method is not blocked
  if (isBlockedMethod(functionName)) {
    throw new Error(`Method "${functionName}" is not allowed for this account`);
  }

  const tokenAddress = getAddress(transaction.to.toLowerCase());

  // Verify transfer amount
  if (functionName === "transfer") {
    const [_to, _amount] = args;
    const amount = _amount ? BigInt(_amount) : 0n;
    if (await exceedsSpendLimit(tokenAddress, amount)) {
      throw new SpendLimitError(`Amount ${amount} exceeds account spend limit`, {
        tokenAddress,
        spendLimit: spendLimitCache.get(tokenAddress)!,
      });
    }
  }
} */
