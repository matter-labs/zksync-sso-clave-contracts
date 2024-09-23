import { /* decodeFunctionData, erc20Abi, getAddress, */ type Account, type Chain, type Transport, type WalletActions } from 'viem'
import { sendTransaction, signTransaction } from 'viem/zksync';
import { deployContract, getAddresses, getChainId, prepareTransactionRequest, sendRawTransaction, signTypedData, signMessage, writeContract } from 'viem/actions';

import type { ClientWithZksyncAccountSessionData } from '../clients/session.js';
/* import { getTokenSpendLimit } from '../actions/session.js'; */

export type ZksyncAccountWalletActions<chain extends Chain, account extends Account> = Omit<
  WalletActions<chain, account>, 'addChain' | 'getPermissions' | 'requestAddresses' | 'requestPermissions' | 'switchChain' | 'watchAsset'
>;

export function zksyncAccountWalletActions<
  transport extends Transport,
  chain extends Chain,
  account extends Account,
>(client: ClientWithZksyncAccountSessionData<transport, chain, account>): ZksyncAccountWalletActions<chain, account> {
  return {
    deployContract: (args) => deployContract(client, args),
    getAddresses: () => getAddresses(client),
    getChainId: () => getChainId(client),
    prepareTransactionRequest: (args) =>
      prepareTransactionRequest(client, args),
    sendRawTransaction: (args) => sendRawTransaction(client, args),
    sendTransaction: async (args) => {
      const tx = client.chain.formatters?.transaction?.format(args) || args;
      /* await verifyTransactionData({
        value: tx.value,
        chain: tx.chain || undefined,
        to: tx.to || undefined,
        data: tx.data,
        gas: tx.gas,
        gasPrice: tx.gasPrice,
        maxFeePerGas: tx.maxFeePerGas,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
      }, client); */
      return await sendTransaction(client, tx);
    },
    signMessage: (args) => signMessage(client, args),
    signTransaction: (args) => signTransaction(client, args as any),
    signTypedData: (args) => signTypedData(client, args),
    writeContract: (args) => writeContract(client, args),
  }
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
  client: ClientWithZksyncAccountSessionData
) => {
  if (!client.sessionKey) throw new Error('Session key is not set');

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