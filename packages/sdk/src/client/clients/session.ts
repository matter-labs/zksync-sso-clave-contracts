import { type Account, type Address, type Chain, type Client, createClient, encodeAbiParameters, getAddress, type Hash, type Prettify, type PublicRpcSchema, type RpcSchema, type Transport, type WalletClientConfig, type WalletRpcSchema } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { encodeSession } from "../../utils/encoding.js";
import type { SessionConfig } from "../../utils/session.js";
import { walletActions, type ZksyncAccountWalletActions } from "../decorators/session_wallet.js";
import { toSmartAccount } from "../smart-account.js";

export const signSessionTransaction = (args: {
  sessionKeySignedHash: Hash;
  sessionContract: Address;
  sessionConfig: SessionConfig;
}) => {
  return encodeAbiParameters(
    [
      { type: "bytes" },
      { type: "address" },
      { type: "bytes[]" },
    ],
    [
      args.sessionKeySignedHash,
      args.sessionContract,
      [encodeSession(args.sessionConfig)], // FIXME: this is assuming there are no other hooks
    ],
  );
};

export function createZksyncSessionClient<
  transport extends Transport,
  chain extends Chain,
  rpcSchema extends RpcSchema | undefined = undefined,
>(_parameters: ZksyncAccountSessionClientConfig<transport, chain, rpcSchema>): ZksyncAccountSessionClient<transport, chain, rpcSchema> {
  type WalletClientParameters = typeof _parameters;
  const parameters: WalletClientParameters & {
    key: NonNullable<WalletClientParameters["key"]>;
    name: NonNullable<WalletClientParameters["name"]>;
  } = {
    ..._parameters,
    address: getAddress(_parameters.address),
    key: _parameters.key || "wallet",
    name: _parameters.name || "ZKsync Account Session Client",
  };

  const account = toSmartAccount({
    address: parameters.address,
    sign: async ({ hash }) => {
      const sessionKeySigner = privateKeyToAccount(parameters.sessionKey);
      const hashSignature = await sessionKeySigner.sign({ hash });
      return signSessionTransaction({
        sessionKeySignedHash: hashSignature,
        sessionContract: parameters.contracts.session,
        sessionConfig: parameters.sessionConfig,
      });
    },
  });
  let client = createClient<transport, chain, Account, rpcSchema>({
    ...parameters,
    account,
    type: "walletClient",
  })
    .extend(() => ({
      sessionKey: parameters.sessionKey,
      sessionConfig: parameters.sessionConfig,
      contracts: parameters.contracts,
    }));
  for (const prop in walletActions) {
    type keys = keyof typeof walletActions;
    client = client.extend((client) => {
      return {
        [prop]: (args: any) => walletActions[prop as keys](client, args),
      };
    });
  }
  console.log("Created client", client);
  return client as any;
}

export type SessionRequiredContracts = {
  session: Address; // Session, spend limit, etc.
};
type ZksyncAccountSessionData = {
  sessionKey: Hash;
  sessionConfig: SessionConfig;
  contracts: SessionRequiredContracts;
};

export type ClientWithZksyncAccountSessionData<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  account extends Account = Account,
> = Client<transport, chain, account> & ZksyncAccountSessionData;

export type ZksyncAccountSessionClient<
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
      : [...PublicRpcSchema, ...WalletRpcSchema],
    ZksyncAccountWalletActions<chain, account>
  > & ZksyncAccountSessionData
>;

export interface ZksyncAccountSessionClientConfig<
  transport extends Transport = Transport,
  chain extends Chain = Chain,
  rpcSchema extends RpcSchema | undefined = undefined,
> extends Omit<WalletClientConfig<transport, chain, Account, rpcSchema>, "account"> {
  chain: NonNullable<chain>;
  address: Address;
  sessionKey: Hash;
  sessionConfig: SessionConfig;
  contracts: SessionRequiredContracts;
  key?: string;
  name?: string;
}
