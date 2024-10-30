import { type Account, type Address, type Chain, type Client, getAddress, type Hash, type Prettify, toHex, type TransactionReceipt, type Transport } from "viem";
import { waitForTransactionReceipt, writeContract } from "viem/actions";

import { FactoryAbi } from "../../abi/Factory.js";
import type { SessionData } from "../../client-gateway/interface.js";
import { encodeCreateSessionParameters, encodeModuleData, encodePasskeyModuleParameters } from "../../utils/encoding.js";
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
  initialSession?: SessionData;
  salt?: Uint8Array; // Random 32 bytes
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

  const encodedSessionKeyModuleData = encodeModuleData({
    address: args.contracts.session,
    parameters: args.initialSession == null ? "0x" : encodeCreateSessionParameters(args.initialSession),
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
      [encodedPasskeyModuleData],
      [encodedSessionKeyModuleData],
      [],
    ],
  } as any);
  if (args.onTransactionSent) {
    noThrow(() => args.onTransactionSent?.(transactionHash));
  }

  const transactionReceipt = await waitForTransactionReceipt(client, { hash: transactionHash });
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
