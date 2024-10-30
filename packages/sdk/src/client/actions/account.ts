import { type Account, type Address, type Chain, type Client, getAddress, type Hash, parseAbi, type Prettify, toHex, type TransactionReceipt, type Transport } from "viem";
import { readContract, waitForTransactionReceipt, writeContract } from "viem/actions";

import { FactoryAbi } from "../../abi/Factory.js";
import { encodeModuleData, encodePasskeyModuleParameters, encodeSessionSpendLimitParameters } from "../../utils/encoding.js";
import { noThrow } from "../../utils/helpers.js";
import { getPasskeySignatureFromPublicKeyBytes, getPublicKeyBytesFromPasskeySignature } from "../../utils/passkey.js";

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
  onTransactionSent?: (hash: Hash) => void;
};
export type DeployAccountReturnType = {
  address: Address;
  transactionReceipt: TransactionReceipt;
};
export type FetchAccountArgs = {
  uniqueAccountId?: string; // Unique account ID, can be omitted if you don't need it
  expectedOrigin?: string; // Expected origin of the passkey
  contracts: {
    accountFactory: Address;
    accountImplementation: Address;
    passkey: Address;
    session: Address;
  };
};
export type FetchAccountReturnType = {
  username: string;
  address: Address;
  passkeyPublicKey: Uint8Array;
};

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

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

export const fetchAccount = async <
  transport extends Transport,
  chain extends Chain,
  account extends Account,
>(
  client: Client<transport, chain, account>, // Account deployer (any viem client)
  args: Prettify<FetchAccountArgs>,
): Promise<FetchAccountReturnType> => {
  let origin: string | undefined = args.expectedOrigin;
  if (!origin) {
    try {
      origin = window.location.origin;
    } catch {
      throw new Error("Can't identify expectedOrigin, please provide it manually");
    }
  }

  if (!args.contracts.accountFactory) throw new Error("Account factory address is not set");
  if (!args.contracts.passkey) throw new Error("Passkey module address is not set");

  let username: string | undefined = args.uniqueAccountId;
  if (!username) {
    try {
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(32),
          userVerification: "discouraged",
        },
      }) as PublicKeyCredential | null;

      if (!credential) throw new Error("No registered passkeys");
      username = credential.id;
    } catch {
      throw new Error("Unable to retrieve passkey");
    }
  }

  if (!username) throw new Error("No account found");

  const accountAddress = await readContract(client, {
    abi: parseAbi(["function accountMappings(string) view returns (address)"]),
    address: args.contracts.accountFactory,
    functionName: "accountMappings",
    args: [username],
  });

  if (!accountAddress || accountAddress == NULL_ADDRESS) throw new Error(`No account found for username: ${username}`);

  const lowerKeyHalfBytes = await readContract(client, {
    abi: parseAbi(["function lowerKeyHalf(string,address) view returns (bytes32)"]),
    address: args.contracts.passkey,
    functionName: "lowerKeyHalf",
    args: [origin, accountAddress],
  });
  const upperKeyHalfBytes = await readContract(client, {
    abi: parseAbi(["function upperKeyHalf(string,address) view returns (bytes32)"]),
    address: args.contracts.passkey,
    functionName: "upperKeyHalf",
    args: [origin, accountAddress],
  });

  if (!lowerKeyHalfBytes || !upperKeyHalfBytes) throw new Error(`Passkey credentials not found in on-chain module for passkey ${username}`);

  const passkeyPublicKey = getPasskeySignatureFromPublicKeyBytes([lowerKeyHalfBytes, upperKeyHalfBytes]);

  return {
    username,
    address: accountAddress,
    passkeyPublicKey,
  };
};
