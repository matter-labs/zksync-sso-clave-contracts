import { decodeFunctionData, erc20Abi, getAddress, type Account, type Address, type Chain, type Hash, type Transport, type WalletActions } from 'viem'
import { sendTransaction, signTransaction } from 'viem/zksync';
import { deployContract, getAddresses, getChainId, prepareTransactionRequest, requestAddresses, requestPermissions, sendRawTransaction, signTypedData, signMessage, writeContract } from 'viem/actions';

import type { ClientWithZksyncAccountSession } from '../createWalletClient.js';

export function zksyncAccountWalletActions<
  transport extends Transport,
  chain extends Chain,
  account extends Account,
>(client: ClientWithZksyncAccountSession<transport, chain, account>): WalletActions<chain, account> {
  return {
    addChain: () => {
      throw new Error('Chain adding is not supported');
    },
    deployContract: (args) => deployContract(client, args),
    getAddresses: () => getAddresses(client),
    getChainId: () => getChainId(client),
    getPermissions: () => {
      throw new Error('Permissions are not supported');
    },
    prepareTransactionRequest: (args) =>
      prepareTransactionRequest(client, args),
    requestAddresses: () => requestAddresses(client),
    requestPermissions: (args) => requestPermissions(client, args),
    sendRawTransaction: (args) => sendRawTransaction(client, args),
    sendTransaction: async (args) => {
      const tx = client.chain.formatters?.transaction?.format(args) || args;
      await verifyTransactionData({
        value: tx.value,
        chain: tx.chain || undefined,
        to: tx.to || undefined,
        data: tx.data,
        gas: tx.gas,
        gasPrice: tx.gasPrice,
        maxFeePerGas: tx.maxFeePerGas,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
      }, client);
      return await sendTransaction(client, tx);
    },
    signMessage: (args) => signMessage(client, args),
    signTransaction: (args) => signTransaction(client, args as any),
    signTypedData: (args) => signTypedData(client, args),
    switchChain: () => {
      throw new Error('Chain switching is not supported');
    },
    watchAsset: () => {
      throw new Error('Asset watching is not supported');
    },
    writeContract: (args) => writeContract(client, args),
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

/* const fetchTokenSpendLimit = async (_sessionContractAddress: Address, _tokenAddress: Address, _userAddress: Address): Promise<bigint> => {
  return readContract(client.chain.contracts.session)
  return await Promise.resolve(BigInt(0));
} */

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
  client: ClientWithZksyncAccountSession
) => {
  const session = client.session;
  /* Verify chain id */
  if (transaction.chain?.id && transaction.chain.id !== session.chainId) {
    throw new Error(`Transaction chainId ${transaction.chain.id} does not match session chainId ${session.chainId}`);
  }

  /* const spendLimitCache = new Map<Address, bigint>(); */
  const exceedsSpendLimit = async (tokenAddress: Address, amount: bigint): Promise<boolean> => {
    const sessionSpendLimit = session.spendLimit[tokenAddress];
    if (!sessionSpendLimit) {
      throw new Error(`Spend limit for token ${tokenAddress} is not set`);
    }
    /* Check against local spend limit */
    if (amount > BigInt(sessionSpendLimit)) {
      return true;
    }
    /* if (!spendLimitCache.has(tokenAddress)) {
      const spendLimit = await fetchTokenSpendLimit(tokenAddress, session.address);
      spendLimitCache.set(tokenAddress, spendLimit);
    } */
    return false;
  }

  /* Verify transaction value */
  const value = transaction.value || 0n;
  if (await exceedsSpendLimit(getAddress(l2BaseTokenAddress), value)) {
    throw new Error(`Transaction value ${value} exceeds account spend limit`);
  }

  /* Verify total fee */
  const totalFee = getTotalFee({
    gas: transaction.gas,
    gasPrice: transaction.gasPrice,
    maxFeePerGas: transaction.maxFeePerGas,
    maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
  });
  if (await exceedsSpendLimit(getAddress(l2BaseTokenAddress), totalFee)) {
    throw new Error(`Total fee ${totalFee} exceeds account spend limit`);
  }

  if (!transaction.data || !transaction.to) return;

  /* Assuming transaction is an erc20 transaction */
  const { functionName, args } = decodeERC20TransactionData(transaction.data);
  if (!functionName) return;

  /* Verify if method is not blocked */
  if (isBlockedMethod(functionName)) {
    throw new Error(`Method "${functionName}" is not allowed for this account`);
  }

  const tokenAddress = getAddress(transaction.to.toLowerCase());
  
  /* Verify transfer amount */
  if (functionName === "transfer") {
    const [_to, _amount] = args;
    const amount = _amount ? BigInt(_amount) : 0n;
    if (await exceedsSpendLimit(tokenAddress, amount)) {
      throw new Error(`Amount ${amount} exceeds account spend limit`);
    }
  }
}