import { parseEther, encodeFunctionData, zeroAddress, encodeAbiParameters, type Prettify, type Account, type Address, type Chain, type Client, type Hash, type TransactionReceipt, type Transport } from 'viem'
import { waitForTransactionReceipt, writeContract, sendTransaction } from 'viem/actions';
import { toHex, http } from 'viem';
import { Provider, SmartAccount, utils, type types } from 'zksync-ethers';

import { FactoryAbi } from '../../abi/Factory.js';
import { SessionPasskeySpendLimitModuleAbi } from '../../abi/SessionPasskeySpendLimitModule.js';
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

   // Formatting initialSpendLimit to initialModuleData if initialSpendLimit was provided
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

  /* const accountData = [
    toHex(args.salt),
    args.accountImplementation,
    toHex(passkeyPublicKey),
    args.validator,
    args.initialModule,
    args.initialModuleData || "0x"
  ]; */
  const accountData = [
    toHex(args.salt),
    '0x050342F6567Fb63b79C4606f44eF1C26FC99b8CF',
    '0x5eb11819f7f5b03809cd72d03f49b02f4f53c05b7b07b32746b0bf002aa5d9701d8eadd00ca3201637bb817fad48af6ae4f05411c24e4e0741c5caa7dc767641',
    '0x4c85Ce243E07D52C8e9DBB50ff41e6f6f1e33a60',
    '0xB147F769FCC877dbf87e373A6c199237a2b9b2a0',
    '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000ae045de5638162fa134807cb558e15a3f5a7f853000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000003e80000000000000000000000000000000000000000000000000000000000000040c4059f858b386c61f3acefba41e2031e6240e088902893c9c4b74f06fbfd3ad10d92b32b442870be14a2cfe213c929b83e64c14378a3041d648c08b5bc966e0e'
  ];
  
  const transactionHash = await writeContract(client, {
    address: args.factory,
    abi: FactoryAbi,
    functionName: "deployProxy7579Account",
    args: accountData,
  } as any);
  if (args.onTransactionSent) {
    try { args.onTransactionSent(transactionHash) }
    catch {}
  }

  const transactionReceipt = await waitForTransactionReceipt(client, { hash: transactionHash });
  if (transactionReceipt.status !== "success") throw new Error("Account deployment transaction reverted");

  const proxyAccountAddress = transactionReceipt.contractAddress;
  console.log("Deployed account to - ", proxyAccountAddress);
  if (!proxyAccountAddress) {
    throw new Error("No contract address in transaction receipt");
  }
  /* TODO: figure out if this check is really needed, most likely not */
  if (proxyAccountAddress === zeroAddress) {
    throw new Error("Received zero address from account deployment");
  }

  const transactionHashFund = await sendTransaction(client, {
    to: proxyAccountAddress,
    value: parseEther("0.05"),
  } as any);
  const transactionReceiptFund = await waitForTransactionReceipt(client, { hash: transactionHashFund });
  if (transactionReceiptFund.status !== "success") throw new Error("Funding transaction reverted");

  const passkeyClientInitial = createZksyncPasskeyClient({
    address: proxyAccountAddress,
    chain: client.chain,
    transport: http(),
    userName: "1438197563170099206",
    userDisplayName: "BotJackHamer09",
    contracts: {
      session: "0x"
    }
  });
  const provider = new Provider(client.chain.rpcUrls.default.http[0]);
  const passkeyClient = new SmartAccount({
    payloadSigner: (hash: any) => {
      console.log("Signing hash", hash);
      const signed = passkeyClientInitial.account.sign!({ hash });
      return Promise.resolve(signed);
    },
    address: proxyAccountAddress,
    secret: "0x3d3cbc973389cb26f657686445bcc75662b415b656078503592ac8c1abb8810e",
  }, provider)

  const callData = encodeFunctionData({
    abi: SessionPasskeySpendLimitModuleAbi,
    functionName: "addSessionKey",
    args: [
      '0xB0b5af2F6f5489a358640161046A45445E519eA4',
      '0xAe045DE5638162fa134807Cb558E15A3F5A7F853',
      BigInt(100),
      /* args.initialSpendLimit![0].sessionPublicKey,
      args.initialSpendLimit![0].token,
      BigInt(Math.ceil(new Date().getTime() / 1000) + (1000 * 60 * 5)) // now + 5 minutes */
    ],
  });
  /* const transactionHash2 = await sendTransaction(passkeyClient, {
    to: args.initialModule,
    data: callData,
    gas: BigInt(10_000_000),
  } as any); */
  const aaTx = {
    type: 113,
    from: proxyAccountAddress,
    to: args.initialModule,
    data: callData,
    chainId: (await provider.getNetwork()).chainId,
    nonce: await provider.getTransactionCount(proxyAccountAddress),
    gasPrice: await provider.getGasPrice(),
    customData: {
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    } as types.Eip712Meta,
  };
  (aaTx as any)['gasLimit'] = await provider.estimateGas(aaTx);

  const signedTransaction = await passkeyClient.signTransaction(aaTx);
  const tx = await provider.broadcastTransaction(signedTransaction);
  const transactionHash2 = tx.hash as Hash;
  const receipt2 = await waitForTransactionReceipt(passkeyClientInitial, { hash: transactionHash2 });
  if (receipt2.status !== "success") throw new Error("addSessionKey Transaction reverted");

  return {
    address: proxyAccountAddress,
    transactionReceipt: transactionReceipt
  };
}
