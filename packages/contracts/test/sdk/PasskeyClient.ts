import type { Account, Address, Chain, Client, Prettify, PublicRpcSchema, RpcSchema, Transport, WalletClientConfig, WalletRpcSchema } from "viem";
import { createClient, encodeAbiParameters, getAddress, publicActions, toHex, walletActions } from "viem";
import { toSmartAccount } from "viem/zksync";

import { base64UrlToUint8Array, unwrapEC2Signature } from "./utils/passkey";

export function createZksyncPasskeyClient<
  transport extends Transport,
  chain extends Chain,
  rpcSchema extends RpcSchema | undefined = undefined,
>(_parameters: ZksyncAccountPasskeyClientConfig<transport, chain, rpcSchema>): ZksyncAccountPasskeyClient<transport, chain, rpcSchema> {
  type WalletClientParameters = typeof _parameters;
  const parameters: WalletClientParameters & {
    key: NonNullable<WalletClientParameters["key"]>;
    name: NonNullable<WalletClientParameters["name"]>;
  } = {
    ..._parameters,
    address: getAddress(_parameters.address),
    key: _parameters.key || "wallet",
    name: _parameters.name || "ZKsync Account Passkey Client",
  };

  const account = toSmartAccount({
    address: parameters.address,
    sign: async () => {
      const passkeySignature = {
        passkeyAuthenticationResponse: {
          response: await parameters.signHash(),
        },
      };
      // console.log("Passkey signature", passkeySignature);
      const authData = passkeySignature.passkeyAuthenticationResponse.response.authenticatorData;
      const clientDataJson = passkeySignature.passkeyAuthenticationResponse.response.clientDataJSON;
      const signature = unwrapEC2Signature(base64UrlToUint8Array(passkeySignature.passkeyAuthenticationResponse.response.signature));
      const fatSignature = encodeAbiParameters(
        [
          { type: "bytes" }, // authData
          { type: "bytes" }, // clientDataJson
          { type: "bytes32[2]" }, // signature (two elements)
        ],
        [toHex(base64UrlToUint8Array(authData)), toHex(base64UrlToUint8Array(clientDataJson)), [toHex(signature.r), toHex(signature.s)]],
      );
      // console.log("fatSignature(PasskeyClient)", fatSignature, fatSignature.length);
      // XXX: This will need to be updated if the code changes
      const validator = "0xdE9F7597aee36fF89c387aE087971f408050bA24";
      const fullFormattedSig = encodeAbiParameters(
        [
          { type: "bytes" }, // fat signature
          { type: "address" }, // validator address
          { type: "bytes[]" }, // validator data
        ],
        [fatSignature, validator, []],
      );
      // console.log("fullFormattedSig(PasskeyClient)", fullFormattedSig, fullFormattedSig.length);

      return fullFormattedSig;
    },
  });
  const client = createClient<transport, chain, Account, rpcSchema>({
    ...parameters,
    account,
    type: "walletClient",
  })
    .extend(() => ({
      userName: parameters.userName,
      userDisplayName: parameters.userDisplayName,
    }))
    .extend(publicActions)
    .extend(walletActions);
  return client;
}

type ZksyncAccountPasskeyData = {
  userName: string;
  userDisplayName: string;
};

export type ClientWithZksyncAccountPasskeyData<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  account extends Account = Account,
> = Client<transport, chain, account> & ZksyncAccountPasskeyData;

export type ZksyncAccountPasskeyClient<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  rpcSchema extends RpcSchema | undefined = undefined,
  account extends Account = Account,
> = Prettify<
  Client<
    transport,
    chain,
    account,
    rpcSchema extends RpcSchema
      ? [...PublicRpcSchema, ...WalletRpcSchema, ...rpcSchema]
      : [...PublicRpcSchema, ...WalletRpcSchema]
  > & ZksyncAccountPasskeyData
>;

export interface ZksyncAccountPasskeyClientConfig<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  rpcSchema extends RpcSchema | undefined = undefined,
> extends Omit<WalletClientConfig<transport, chain, Account, rpcSchema>, "account"> {
  chain: NonNullable<chain>;
  address: Address;
  userName: string;
  userDisplayName: string;
  signHash: () => Promise<{
    authenticatorData: string;
    clientDataJSON: string;
    signature: string;
  }>;
  key?: string;
  name?: string;
}
