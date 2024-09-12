import { zeroAddress, decodeEventLog, decodeAbiParameters, encodeAbiParameters, type Prettify, type Account, type Address, type Chain, type Client, type Hash, type TransactionReceipt, type Transport } from 'viem'
import { waitForTransactionReceipt, writeContract } from 'viem/actions';
import { toHex, http } from 'viem';

import { FactoryAbi } from '../../abi/Factory.js';
import { getPublicKeyBytesFromPasskeySignature } from '../../utils/passkey.js';
import { requestPasskeySignature, type RequestPasskeySignatureArgs } from './passkey.js';
import { createZksyncPasskeyClient } from '../clients/passkey.js';

/* TODO: try to get rid of most of the contract params like accountImplementation, validator, initialModule */
/* it should come from factory, not passed manually each time */
export type DeployAccountArgs = {
  factory: Address;
  accountImplementation: Address;
  validator: Address;
  salt?: Uint8Array; // Random 32 bytes
  passkey: {
    passkeySignature: Uint8Array;
  } | RequestPasskeySignatureArgs,
  initialModule: Address; // Passkey module address, or some other module
  initialModuleData?: Hash; // ABI-encoded data for initial module
  initialSpendLimit?: { // Initial spend limit if using Passkey module as initialModule
    sessionPublicKey: Address;
    token: Address;
    amount: number;
  }[];
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
>(client: Client<transport, chain, account>, args: Prettify<DeployAccountArgs>): Promise<DeployAccountReturnType> => {
  if (args.initialModuleData && args.initialSpendLimit?.length) {
    throw new Error("Either initialModuleData or initialSpendLimit can be provided, not both");
  }

  if (!args.salt) {
    args.salt = crypto.getRandomValues(new Uint8Array(32));
  }

  /* Request signature via webauthn if signature not provided */
  let passkeySignature: Uint8Array;
  if ('passkeySignature' in args.passkey) {
    passkeySignature = args.passkey.passkeySignature;
  } else {
    passkeySignature = (await requestPasskeySignature(args.passkey)).passkeyPublicKey;
  }

  const passkeyPublicKey = await getPublicKeyBytesFromPasskeySignature(passkeySignature);

   /* Format spendlimit to initialModuleData if initialSpendLimit was provided */
   if (args.initialSpendLimit?.length) {
    /* TODO: why is it missing session time limit? */
    const tokenConfigTypes = [
      { type: 'address', name: 'token' },
      { type: 'bytes', name: 'publicKey' },
      { type: 'uint256', name: 'limit' }
    ] as const;
    args.initialModuleData = encodeAbiParameters(
      [{ type: 'tuple[]', components: tokenConfigTypes }], 
      [
        args.initialSpendLimit.map(({ token, amount }) => ({
          token,
          publicKey: toHex(passkeyPublicKey),
          limit: BigInt(amount)
        }))
      ]
    )
  }
  
  const transactionHash = await writeContract(client, {
    address: args.factory,
    abi: FactoryAbi,
    functionName: "deployProxy7579Account",
    args: [
      toHex(args.salt),
      args.accountImplementation,
      toHex(passkeyPublicKey),
      args.validator,
      args.initialModule,
      args.initialModuleData || "0x",
    ],
    gas: BigInt(1_000_000_000),
  } as any);
  if (args.onTransactionSent) {
    try { args.onTransactionSent(transactionHash) }
    catch {}
  }

  const newAddress = "0x2eaa0539795be5eb8d72a7900dfe297fb6a54b41";

  const passkeyClient = createZksyncPasskeyClient({
    address: newAddress,
    chain: client.chain,
    transport: http(),
    userName: "mexicanace",
    userDisplayName: "mexicanace",
    contracts: {
      session: "0x"
    }
  })

  await writeContract(passkeyClient, {
    address: args.factory,
    abi: FactoryAbi,
    functionName: "addSessionKey",
    args: [
      // address publicKey
      // address token,
      // uint256 expiration,
      args.initialSpendLimit![0].sessionPublicKey,
      args.initialSpendLimit![0].token,
      BigInt(1726162649) //Thursday, 12 September 2024 17:37:29
    ],
    gas: BigInt(1_000_000_000),
  } as any);
  if (args.onTransactionSent) {
    try { args.onTransactionSent(transactionHash) }
    catch {}
  }
  
  const transactionReceipt = await waitForTransactionReceipt(client, { hash: transactionHash });
  
  /* TODO: use or remove this */
  console.debug("Figure out if we can get address properly from this data", decodeEventLog({
    abi: FactoryAbi,
    data: transactionReceipt.logs[0].data,
    topics: transactionReceipt.logs[0].topics,
  }));

  const proxyAccountAddress = decodeAbiParameters(
    [{ type: 'address', name: 'accountAddress' }],
    transactionReceipt.logs[0].data
  )[0];

  /* TODO: figure out if this check is really needed, most likely not */
  if (proxyAccountAddress === zeroAddress) {
    throw new Error("Received zero address from account deployment");
  }

  return {
    address: proxyAccountAddress,
    transactionReceipt: transactionReceipt
  };
}
