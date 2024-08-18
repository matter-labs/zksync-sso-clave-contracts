import { createClient, decodeFunctionData, erc20Abi, getAddress, publicActions, type Address, type Chain, type Client, type Hash, type Transport, type WalletActions } from 'viem'

import { toSessionKeyAccount, type SessionKeyAccount } from './session-key-account.js';
import type { SessionData } from '../core/provider/interface.js';
import { addChain, deployContract, getAddresses, getChainId, getPermissions, prepareTransactionRequest, requestAddresses, requestPermissions, sendRawTransaction, signMessage, signTransaction, signTypedData, switchChain, watchAsset, writeContract } from 'viem/actions';
import { sendTransaction } from 'viem/zksync';

const l2BaseTokenAddress = getAddress('0x000000000000000000000000000000000000800a');

export interface ZksyncAccount extends SessionKeyAccount<'zksyncAccount'> {
  session: SessionData;
};

export type ToZksyncAccount = {
  address: Address;
  session: Omit<SessionData, 'address'> & { spendLimit?: SessionData['spendLimit'] };
}

export function toZksyncAccount(_parameters: ToZksyncAccount): ZksyncAccount {
  const parameters: ToZksyncAccount & { session: SessionData } = {
    ..._parameters,
    session: {
      ..._parameters.session,
      address: _parameters.address,
      spendLimit: _parameters.session.spendLimit || {},
    },
  };

  const sessionKeyAccount = toSessionKeyAccount({
    address: parameters.address,
    sessionKey: parameters.session.sessionKey,
  });

  const account = {
    ...sessionKeyAccount,
    session: parameters.session,
    /* sign: async ({ hash }: { hash: Hash }) => {
      return await sessionKeyAccount.sign({ hash });
    },
    async signTransaction(transaction) {
      if (transaction.data && transaction.to) {
        await verifyTransactionData(transaction.data, transaction.to, parameters.session);
      }
      return await sessionKeyAccount.signTransaction(transaction);
    }, */
    /* async signMessage({ message }) {
      return await sessionKeyAccount.signMessage({ message });
    },
    async signTypedData(typedData) {
      return await sessionKeyAccount.signTypedData(typedData);
    }, */
    source: 'zksyncAccount',
  } as ZksyncAccount;

  return account;
}

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
  return readContract(walletClient.chain.contracts.session)
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
  walletClient: ZksyncWalletClient
) => {
  const session = walletClient.account.session;
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

export function zksyncAccountWalletActions<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  account extends ZksyncAccount | undefined = ZksyncAccount,
>(client: Client<transport, chain, account>): WalletActions<chain, account> {
  return {
    addChain: (args) => addChain(client, args),
    deployContract: (args) => deployContract(client, args as any),
    getAddresses: () => getAddresses(client),
    getChainId: () => getChainId(client),
    getPermissions: () => getPermissions(client),
    prepareTransactionRequest: (args) =>
      prepareTransactionRequest(client as any, args as any) as any,
    requestAddresses: () => requestAddresses(client),
    requestPermissions: (args) => requestPermissions(client, args),
    sendRawTransaction: (args) => sendRawTransaction(client, args),
    sendTransaction: async (args) => {
      console.log("args", args);
      await verifyTransactionData({
        value: args.value,
        chain: args.chain || undefined,
        to: args.to || undefined,
        data: args.data,
        gas: args.gas,
        gasPrice: args.gasPrice,
        maxFeePerGas: args.maxFeePerGas,
        maxPriorityFeePerGas: args.maxPriorityFeePerGas,
      }, client as any);
      console.log("Proceed", args);
      return await sendTransaction(client, args as any);
    },
    signMessage: (args) => signMessage(client, args),
    signTransaction: (args) => signTransaction(client, args as any),
    signTypedData: (args) => signTypedData(client, args),
    switchChain: (args) => switchChain(client, args),
    watchAsset: (args) => watchAsset(client, args),
    writeContract: (args) => writeContract(client, args as any),
  }
}

export interface CreateZksyncWalletClient<
  transport extends Transport,
  chain extends Chain
> extends ToZksyncAccount {
  transport: transport;
  chain?: chain;
  key?: string;
  name?: string;
}

export function createZksyncWalletClient<
  transport extends Transport,
  chain extends Chain
>(_parameters: CreateZksyncWalletClient<transport, chain>) {
  type WalletClientParameters = typeof _parameters;
  const parameters: WalletClientParameters & {
    key: NonNullable<WalletClientParameters['key']>;
    name: NonNullable<WalletClientParameters['name']>;
  } = {
    ..._parameters,
    address: getAddress(_parameters.address),
    key: _parameters.key || 'wallet',
    name: _parameters.name || 'Wallet Client'
  };

  const sessionKeyAccount = toZksyncAccount({
    address: parameters.address,
    session: parameters.session,
  });

  const client = createClient<transport, chain, ZksyncAccount>({
    ...parameters,
    account: sessionKeyAccount,
    chain: parameters.chain,
    key: parameters.key,
    name: parameters.name,
    transport: parameters.transport,
    type: 'walletClient',
  }).extend(publicActions).extend(zksyncAccountWalletActions);
  return client;
}

export type ZksyncWalletClient = ReturnType<typeof createZksyncWalletClient>;