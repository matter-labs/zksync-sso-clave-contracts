import { createPublicClient, zeroAddress, encodeAbiParameters, type Prettify, type Account, type Address, type Chain, type Client, type Hash, type TransactionReceipt, type Transport } from 'viem'
import { waitForTransactionReceipt, writeContract, sendTransaction } from 'viem/actions';
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
    gas: BigInt(10_000_000_000),
  } as any);
  if (args.onTransactionSent) {
    try { args.onTransactionSent(transactionHash) }
    catch {}
  }

  const transactionReceipt = await waitForTransactionReceipt(client, { hash: transactionHash });
  const proxyAccountAddress = transactionReceipt.contractAddress;
  console.log("Deployed account to - ", proxyAccountAddress);
  if (!proxyAccountAddress) {
    throw new Error("No contract address in transaction receipt");
  }
  /* TODO: figure out if this check is really needed, most likely not */
  if (proxyAccountAddress === zeroAddress) {
    throw new Error("Received zero address from account deployment");
  }

  console.log("Funding account with 10 ETH");
  const transactionHashFund = await sendTransaction(client, {
    to: proxyAccountAddress,
    value: BigInt(10_000 * 10**18),
  } as any);
  const transactionReceiptFund = await waitForTransactionReceipt(client, { hash: transactionHashFund });
  console.log("Account funded", {transactionReceiptFund});


  const passkeyClient = createZksyncPasskeyClient({
    address: proxyAccountAddress,
    chain: client.chain,
    transport: http(),
    userName: "1438197563170099206",
    userDisplayName: "BotJackHamer09",
    contracts: {
      session: "0x"
    }
  });

  console.log("params", {
    sessionPublicKey: args.initialSpendLimit![0].sessionPublicKey,
    token: args.initialSpendLimit![0].token,
    time: BigInt(Math.ceil(new Date().getTime() / 1000) + (1000 * 60 * 5)) // now + 5 minutes
  });
  // const callData = moduleContract.interface.encodeFunctionData('addSessionKey', [fixtures.sessionKeyWallet.address, tokenConfig.token, 100]);
  const callData = encodeAbiParameters(
    [
      { type: 'address', name: 'publicKey' },
      { type: 'address', name: 'token' },
      { type: 'uint256', name: 'expiration' }
    ] as const,
    [
      args.initialSpendLimit![0].sessionPublicKey,
      args.initialSpendLimit![0].token,
      BigInt(Math.ceil(new Date().getTime() / 1000) + (1000 * 60 * 5)) // now + 5 minutes
    ]
  );
  const transactionHash2 = await sendTransaction(passkeyClient, {
      address: args.initialModule,
      account: passkeyClient.account,
      chain: passkeyClient.chain,
      to: args.initialModule,
      nonce: await createPublicClient({
        chain: passkeyClient.chain,
        transport: http(),
      }).getTransactionCount({ address: passkeyClient.account.address }),
      kzg: undefined as any,
      data: callData as Hash,
      gas: BigInt(10_000_000_000),
      /* gas: BigInt(aaTx['gasLimit']),
      gasPrice: BigInt(aaTx['gasPrice']),
      gasPerPubdata: BigInt(utils.DEFAULT_GAS_PER_PUBDATA_LIMIT), */
  } as any);
  /* const transactionHash2 = await writeContract(passkeyClient, {
    address: args.initialModule,
    abi: [
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "publicKey",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "expiration",
            "type": "uint256"
          }
        ],
        "name": "addSessionKey",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ] as const,
    functionName: "addSessionKey",
    args: [
      args.initialSpendLimit![0].sessionPublicKey,
      args.initialSpendLimit![0].token,
      BigInt(Math.ceil(new Date().getTime() / 1000) + (1000 * 60 * 5)) // now + 5 minutes
    ],
    gas: BigInt(10_000_000_000),
  } as any); */
  console.log("transactionHash2", transactionHash2);
  if (args.onTransactionSent) {
    try { args.onTransactionSent(transactionHash) }
    catch {}
  }

  const receipt2 = await waitForTransactionReceipt(passkeyClient, { hash: transactionHash2 });
  console.log(receipt2);

  return {
    address: proxyAccountAddress,
    transactionReceipt: transactionReceipt
  };
}
