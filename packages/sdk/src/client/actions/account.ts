import { getAddress, toHex, encodeAbiParameters, type Prettify, type Account, type Address, type Chain, type Client, type Hash, type TransactionReceipt, type Transport } from 'viem'
import { waitForTransactionReceipt, writeContract } from 'viem/actions';

import { FactoryAbi } from '../../abi/Factory.js';
import { noThrow } from '../../utils/helpers.js';
import { getPublicKeyBytesFromPasskeySignature } from '../../utils/passkey.js';

/* TODO: try to get rid of most of the contract params like accountImplementation, validator, initialModule */
/* it should come from factory, not passed manually each time */
export type DeployAccountArgs = {
  credentialPublicKey: Uint8Array; // Public key of the previously registered
  contracts: {
    accountFactory: Address;
    accountImplementation: Address;
    validator: Address;
    session?: Address; // Can be omitted if `initialModule` is provided
  };
  salt?: Uint8Array; // Random 32 bytes
  initialSpendLimit?: { // Initial spend limit if no initial module is provided
    sessionPublicKey: Address;
    token: Address;
    amount: bigint;
  }[];
  initialModule?: { // Should be provided if `initialSpendLimit` is not provided
    address: Address;
    data: Hash; // ABI-encoded data for initial module
  }
  onTransactionSent?: (hash: Hash) => void;
};
export type DeployAccountReturnType = {
  address: Address;
  transactionReceipt: TransactionReceipt;
};
export const deployAccount = async <
  transport extends Transport,
  chain extends Chain,
  account extends Account
>(
  client: Client<transport, chain, account>, // Account deployer (any viem client)
  args: Prettify<DeployAccountArgs>
): Promise<DeployAccountReturnType> => {
  if (args.initialModule && args.initialSpendLimit?.length) {
    throw new Error("Either initialModuleData or initialSpendLimit can be provided, not both");
  }
  if (!args.initialModule && !args.initialSpendLimit?.length) {
    throw new Error("Either initialModuleData or initialSpendLimit should be provided");
  }
  if (args.initialSpendLimit?.length && !args.contracts.session) {
    throw new Error("Session contract address should be provided if initialSpendLimit is provided");
  }

  if (!args.salt) {
    args.salt = crypto.getRandomValues(new Uint8Array(32));
  }

  const passkeyPublicKey = await getPublicKeyBytesFromPasskeySignature(args.credentialPublicKey)

  let initialModuleData: Hash = "0x";
  let initialModuleAddress: Address | undefined;

  if (args.initialSpendLimit?.length) {
     initialModuleAddress = args.contracts.session;
    /* TODO: why is it missing session time limit? */
    const tokenConfigTypes = [
      { type: 'address', name: 'token' },
      { type: 'bytes', name: 'publicKey' },
      { type: 'uint256', name: 'limit' }
    ] as const;
    initialModuleData = encodeAbiParameters(
      [{ type: 'tuple[]', components: tokenConfigTypes }], 
      [
        args.initialSpendLimit.map(({ token, amount }) => ({
          token,
          /* TODO: I think this should be not passkey pub key */
          publicKey: passkeyPublicKey,
          limit: amount,
        }))
      ]
    )
  } else if (args.initialModule) {
    initialModuleAddress = args.initialModule.address;
    initialModuleData = args.initialModule.data;
  }
  if (!initialModuleAddress) {
    throw new Error("Could not determine initial module address based on provided arguments");
  }
  
  const transactionHash = await writeContract(client, {
    address: args.contracts.accountFactory,
    abi: FactoryAbi,
    functionName: "deployProxy7579Account",
    args: [
      toHex(args.salt),
      args.contracts.accountImplementation,
      passkeyPublicKey,
      args.contracts.validator,
      initialModuleAddress,
      initialModuleData,
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
    transactionReceipt: transactionReceipt
  };
}
