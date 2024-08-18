import { hashMessage, hashTypedData, keccak256, type Address, type CustomSource, type Hash, type LocalAccount } from 'viem'
import { sign as signWithPrivateKey, toAccount } from 'viem/accounts'
import { serializeTransaction, type ZksyncTransactionSerializableEIP712 } from 'viem/zksync'

export interface SessionKeyAccount<source extends string = 'sessionKeyAccount'> extends LocalAccount<source> {
  sign: NonNullable<CustomSource['sign']>;
};

export function toSessionKeyAccount(
  parameters: {
    address: Address;
    sessionKey: Hash;
  }
): SessionKeyAccount {
  const sign = async ({ hash }: { hash: Hash }) => {
    return await signWithPrivateKey({ hash, privateKey: parameters.sessionKey, to: 'hex' })
  }

  const account = toAccount({
    address: parameters.address,
    sign,
    async signMessage({ message }) {
      return await sign({
        hash: hashMessage(message),
      })
    },
    async signTransaction(transaction) {
      const signableTransaction = {
        ...transaction,
        from: this.address!,
      } as ZksyncTransactionSerializableEIP712;

      return serializeTransaction({
        ...signableTransaction,
        customSignature: await sign({
          hash: keccak256(serializeTransaction(signableTransaction)),
        }),
      })
    },
    async signTypedData(typedData) {
      return await sign({
        hash: hashTypedData(typedData),
      })
    },
  }) as SessionKeyAccount;

  return {
    ...account,
    source: 'sessionKeyAccount',
  };
}
