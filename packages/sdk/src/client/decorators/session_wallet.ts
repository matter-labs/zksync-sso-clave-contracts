import { type Account, /* bytesToHex, */ type Chain, /* formatTransaction, */ type Hex, type PublicActions, type Transport, type WalletActions } from "viem";
import { /* deployContract, */ estimateContractGas, estimateGas, /* getAddresses, getChainId, */ prepareTransactionRequest, /* sendRawTransaction, signMessage, */ signTypedData, simulateContract, writeContract } from "viem/actions";
import { getGeneralPaymasterInput, signEip712Transaction /* type ZksyncEip712Meta */ } from "viem/zksync";

import { sendEip712Transaction } from "../actions/sendEip712Transaction.js";
import { type ClientWithZksyncAccountSessionData, signSessionTransaction } from "../clients/session.js";

const emptySignature = "0x" + "1b".padStart(65 * 2, "0") as Hex;

export type ZksyncAccountWalletActions<chain extends Chain, account extends Account> =
  Omit<WalletActions<chain, account>, "addChain" | "getPermissions" | "requestAddresses" | "requestPermissions" | "switchChain" | "watchAsset" | "prepareTransactionRequest"> &
  Pick<PublicActions<Transport, chain, account>, "estimateContractGas" | "estimateGas" | "prepareTransactionRequest" | "simulateContract">;

/* export function zksyncAccountWalletActions<
  transport extends Transport,
  chain extends Chain,
  account extends Account,
>(client: ClientWithZksyncAccountSessionData<transport, chain, account>): ZksyncAccountWalletActions<chain, account> {
  return {
    deployContract: (args) => deployContract(client, args),
    getAddresses: () => getAddresses(client),
    getChainId: () => getChainId(client),
    sendRawTransaction: (args) => sendRawTransaction(client, args),
    sendTransaction: async (args) => {
      console.log("Send transaction", args);
      const formatters = client.chain?.formatters;
      const format = formatters?.transaction?.format || formatTransaction;

      const unformattedTx: any = args;

      if ("eip712Meta" in unformattedTx) {
        const eip712Meta = unformattedTx.eip712Meta as ZksyncEip712Meta;
        unformattedTx.gasPerPubdata = eip712Meta.gasPerPubdata ? BigInt(eip712Meta.gasPerPubdata) : undefined;
        unformattedTx.factoryDeps = eip712Meta.factoryDeps;
        unformattedTx.customSignature = eip712Meta.customSignature;
        unformattedTx.paymaster = eip712Meta.paymasterParams?.paymaster;
        unformattedTx.paymasterInput = eip712Meta.paymasterParams?.paymasterInput ? bytesToHex(new Uint8Array(eip712Meta.paymasterParams?.paymasterInput)) : undefined;
      }

      const tx = {
        ...format(unformattedTx),
        type: "eip712",
      };

      return await sendEip712Transaction(client, tx);
    },
    signMessage: (args) => signMessage(client, args),
    signTransaction: (args) => signEip712Transaction(client, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...args as any,
      type: "eip712",
    }),
    signTypedData: (args) => signTypedData(client, args),
    writeContract: (args) => {
      console.log("Write contract", client, args);
      return writeContract(client, args);
    },
    prepareTransactionRequest: async (args) => {
      console.log("prepareTransactionRequest", args);
      if (!("customSignature" in args)) {
        (args as any).customSignature = signSessionTransaction({
          sessionKeySignedHash: emptySignature,
          sessionContract: client.contracts.session,
          sessionConfig: client.sessionConfig,
        });
      }
      console.log("Initial args", args);
      const request = await prepareTransactionRequest(client, args as any) as any;
      console.log("After prepare", request);
      return request;
    },
    estimateContractGas: (args) => {
      console.log("estimateContractGas", args);
      if (!("customSignature" in args)) {
        (args as any).customSignature = signSessionTransaction({
          sessionKeySignedHash: emptySignature,
          sessionContract: client.contracts.session,
          sessionConfig: client.sessionConfig,
        });
      }
      return estimateContractGas(client, args as any);
    },
    estimateGas: async (args) => {
      console.log("estimateGas", args);
      if (!("customSignature" in args)) {
        (args as any).customSignature = signSessionTransaction({
          sessionKeySignedHash: emptySignature,
          sessionContract: client.contracts.session,
          sessionConfig: client.sessionConfig,
        });
      }
      const estimated = await estimateGas(client, args);
      console.log("Estimated", estimated);
      return estimated;
    },
    simulateContract: (args) => {
      console.log("simulateContract", args);
      if (!("customSignature" in args)) {
        (args as any).customSignature = signSessionTransaction({
          sessionKeySignedHash: emptySignature,
          sessionContract: client.contracts.session,
          sessionConfig: client.sessionConfig,
        });
      }
      return simulateContract(client, args);
    },
  };
} */
export const walletActions = {
  signTypedData: (client: ClientWithZksyncAccountSessionData, args: any) => {
    console.log("Sign typed data", args);
    return signTypedData(client, args);
  },
  signTransaction: (client: ClientWithZksyncAccountSessionData, args: any) => {
    console.log("Sign transaction", args);
    return signEip712Transaction(client, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...args as any,
      type: "eip712",
    });
  },
  estimateGas: async (client: ClientWithZksyncAccountSessionData, args: any) => {
    console.log("estimateGas", args);
    if (!("customSignature" in args)) {
      (args as any).customSignature = signSessionTransaction({
        sessionKeySignedHash: emptySignature,
        sessionContract: client.contracts.session,
        sessionConfig: client.sessionConfig,
      });
    }
    console.log("Before estimate");
    const estimated = await estimateGas(client, args);
    console.log("After estimate");
    console.log("Estimated", estimated);
    return estimated;
  },
  estimateContractGas: (client: ClientWithZksyncAccountSessionData, args: any) => {
    console.log("estimateContractGas", args);
    if (!("customSignature" in args)) {
      (args as any).customSignature = signSessionTransaction({
        sessionKeySignedHash: emptySignature,
        sessionContract: client.contracts.session,
        sessionConfig: client.sessionConfig,
      });
    }
    return estimateContractGas(client, args as any);
  },
  prepareTransactionRequest: async (client: ClientWithZksyncAccountSessionData, args: any) => {
    console.log("prepareTransactionRequest", args);
    if (!("customSignature" in args)) {
      (args as any).customSignature = signSessionTransaction({
        sessionKeySignedHash: emptySignature,
        sessionContract: client.contracts.session,
        sessionConfig: client.sessionConfig,
      });
    }
    console.log("Initial args", args, client);
    // const request = await prepareTransactionRequest(client, args as any) as any;
    const request = await prepareTransactionRequest(client, {
      chainId: client.chain.id,
      ...args,
      type: "eip712",
    } as any) as any;
    console.log("After prepare", request);
    return request;
  },
  sendTransaction: async (client: ClientWithZksyncAccountSessionData, args: any) => {
    /* console.log("Send transaction", args);
    const formatters = client.chain?.formatters;
    const format = formatters?.transaction?.format || formatTransaction;

    const unformattedTx: any = format(args);

    if ("eip712Meta" in unformattedTx) {
      const eip712Meta = unformattedTx.eip712Meta as ZksyncEip712Meta;
      unformattedTx.gasPerPubdata = eip712Meta.gasPerPubdata ? BigInt(eip712Meta.gasPerPubdata) : undefined;
      unformattedTx.factoryDeps = eip712Meta.factoryDeps;
      unformattedTx.customSignature = eip712Meta.customSignature;
      unformattedTx.paymaster = eip712Meta.paymasterParams?.paymaster;
      unformattedTx.paymasterInput = eip712Meta.paymasterParams?.paymasterInput ? bytesToHex(new Uint8Array(eip712Meta.paymasterParams?.paymasterInput)) : undefined;
      delete unformattedTx.eip712Meta;
    }

    const tx = {
      ...unformattedTx,
      type: "eip712",
    };

    return await sendEip712Transaction(client, tx); */
    const tx: any = {
      ...(client.chain.formatters?.transaction?.format(args) || args),
      type: "eip712",
    };
    if (tx.eip712Meta) {
      const transaction = {
        ...tx,
        paymaster: tx.eip712Meta.paymasterParams.paymaster,
        // TODO: Find permanent fix as this only works for general paymasters with no input
        paymasterInput: getGeneralPaymasterInput({ innerInput: "0x" }),
      };
      return await sendEip712Transaction(client, transaction);
    }

    return await sendEip712Transaction(client, tx);
  },
  simulateContract: (client: ClientWithZksyncAccountSessionData, args: any) => {
    console.log("simulateContract", args);
    if (!("customSignature" in args)) {
      (args as any).customSignature = signSessionTransaction({
        sessionKeySignedHash: emptySignature,
        sessionContract: client.contracts.session,
        sessionConfig: client.sessionConfig,
      });
    }
    return simulateContract(client, args);
  },
  writeContract: (client: ClientWithZksyncAccountSessionData, args: any) => {
    console.log("Write contract", client, args);
    return writeContract(client, args);
  },
} as const;

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
