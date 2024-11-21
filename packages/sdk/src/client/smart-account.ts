import type { Address } from "abitype";
import { type CustomSource, type Hash, hashMessage, hashTypedData, type Hex, type LocalAccount } from "viem";
import { toAccount } from "viem/accounts";
import { serializeTransaction, type ZksyncTransactionSerializableEIP712 } from "viem/zksync";

import { getEip712Domain } from "./utils/getEip712Domain.js";

export type ToSmartAccountParameters = {
  /** Address of the deployed Account's Contract implementation. */
  address: Address;
  /** Function to sign a hash. */
  sign: (parameters: { hash: Hash }) => Promise<Hex>;
};

export type ZksyncSmartAccount = LocalAccount<"smartAccountZksync"> & {
  sign: NonNullable<CustomSource["sign"]>;
};

type ErrorType<name extends string = "Error"> = Error & { name: name };
export type ToSmartAccountErrorType = ErrorType;

/**
 * Creates a [ZKsync Smart Account](https://docs.zksync.io/build/developer-reference/account-abstraction/building-smart-accounts)
 * from a Contract Address and a custom sign function.
 */
export function toSmartAccount(
  parameters: ToSmartAccountParameters,
): ZksyncSmartAccount {
  const { address, sign } = parameters;

  const account = toAccount({
    address,
    sign,
    async signMessage({ message }) {
      return sign({
        hash: hashMessage(message),
      });
    },
    async signTransaction(transaction) {
      const signableTransaction = {
        ...transaction,
        from: this.address!,
        type: "eip712",
      } as ZksyncTransactionSerializableEIP712;

      const eip712DomainAndMessage = getEip712Domain(signableTransaction);
      const digest = hashTypedData(eip712DomainAndMessage);

      return serializeTransaction({
        ...signableTransaction,
        customSignature: await sign({
          hash: digest,
        }),
      });
    },
    async signTypedData(typedData) {
      return sign({
        hash: hashTypedData(typedData),
      });
    },
  });

  return {
    ...account,
    source: "smartAccountZksync",
  } as ZksyncSmartAccount;
}
