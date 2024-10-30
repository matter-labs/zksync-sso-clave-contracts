import { type Account, type Address, type Chain, type Client, getAddress, type Hash, type Prettify, toHex, type TransactionReceipt, type Transport } from "viem";
import { waitForTransactionReceipt, writeContract } from "viem/actions";

import { FactoryAbi } from "../../abi/Factory.js";
import { encodeModuleData, encodePasskeyModuleParameters, encodeSessionSpendLimitParameters } from "../../utils/encoding.js";
import { noThrow } from "../../utils/helpers.js";
import { getPublicKeyBytesFromPasskeySignature } from "../../utils/passkey.js";

/* TODO: try to get rid of most of the contract params like accountImplementation, passkey, session */
/* it should come from factory, not passed manually each time */
export type DeployAccountArgs = {
  credentialPublicKey: Uint8Array; // Public key of the previously registered
  expectedOrigin?: string; // Expected origin of the passkey
  uniqueAccountId?: string; // Unique account ID, can be omitted if you don't need it
  contracts: {
    accountFactory: Address;
    accountImplementation: Address;
    passkey: Address;
    session: Address;
  };
  salt?: Uint8Array; // Random 32 bytes
  initialSessions?: { // Initial spend limit if no initial module is provided
    sessionPublicKey: Address;
    expiresAt: string; // ISO string
    spendLimit: { [tokenAddress: Address]: string }; // tokenAddress => amount
  }[];
  eoaOwners?: Address[]; // EOA owners
  onTransactionSent?: (hash: Hash) => void;
};
export type DeployAccountReturnType = {
  address: Address;
  transactionReceipt: TransactionReceipt;
};
export const deployAccount = async <
  transport extends Transport,
  chain extends Chain,
  account extends Account,
>(
  client: Client<transport, chain, account>, // Account deployer (any viem client)
  args: Prettify<DeployAccountArgs>,
): Promise<DeployAccountReturnType> => {
  if (!args.salt) {
    args.salt = crypto.getRandomValues(new Uint8Array(32));
  }

  let origin: string | undefined = args.expectedOrigin;
  if (!origin) {
    try {
      origin = window.location.origin;
    } catch {
      throw new Error("Can't identify expectedOrigin, please provide it manually");
    }
  }

  const passkeyPublicKey = getPublicKeyBytesFromPasskeySignature(args.credentialPublicKey);
  const encodedPasskeyParameters = encodePasskeyModuleParameters({
    passkeyPublicKey,
    expectedOrigin: origin,
  });
  const encodedPasskeyModuleData = encodeModuleData({
    address: args.contracts.passkey,
    parameters: encodedPasskeyParameters,
  });
  const accountId = args.uniqueAccountId || encodedPasskeyParameters;

  const encodedSessionSpendLimitParameters = encodeSessionSpendLimitParameters((args.initialSessions || []).map((session) => ({
    sessionKey: session.sessionPublicKey,
    expiresAt: session.expiresAt,
    spendLimit: session.spendLimit,
  })));
  const encodedSessionSpendLimitModuleData = encodeModuleData({
    address: args.contracts.session,
    parameters: encodedSessionSpendLimitParameters,
  });

  const transactionHash = await writeContract(client, {
    account: client.account!,
    chain: client.chain!,
    address: args.contracts.accountFactory,
    abi: FactoryAbi,
    functionName: "deployProxy7579Account",
    args: [
      toHex(args.salt),
      args.contracts.accountImplementation,
      accountId,
      [encodedPasskeyModuleData, encodedSessionSpendLimitModuleData],
      [],
      (args.eoaOwners || []).map(getAddress),
    ],
  } as any);
  if (args.onTransactionSent) {
    noThrow(() => args.onTransactionSent?.(transactionHash));
  }

  const waitForReceipt = async () => {
    try {
      const transactionReceipt = await waitForTransactionReceipt(client, { hash: transactionHash });
      return transactionReceipt;
    } catch (error) {
      if (error instanceof Error && error.message.includes("The Transaction may not be processed on a block yet")) {
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        return await waitForReceipt();
      }
      throw error;
    }
  };
  const transactionReceipt = await waitForReceipt();
  if (transactionReceipt.status !== "success") throw new Error("Account deployment transaction reverted");

  const proxyAccountAddress = transactionReceipt.contractAddress;
  if (!proxyAccountAddress) {
    throw new Error("No contract address in transaction receipt");
  }

  return {
    address: getAddress(proxyAccountAddress),
    transactionReceipt: transactionReceipt,
  };
};
