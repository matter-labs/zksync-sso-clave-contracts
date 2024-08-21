/* Copied from pending PR - https://github.com/wevm/viem/pull/2598 */

import type { Address } from 'abitype'
import { hashMessage, hashTypedData, keccak256, type CustomSource, type Hash, type Hex, type LocalAccount } from 'viem'
import { toAccount } from 'viem/accounts'
import { serializeTransaction, type ZksyncTransactionSerializableEIP712 } from 'viem/zksync'

export type ToSmartAccountParameters = {
  /** Address of the deployed Account's Contract implementation. */
  address: Address
  /** Function to sign a hash. */
  sign: (parameters: { hash: Hash }) => Promise<Hex>
}

export type ZksyncSmartAccount = LocalAccount<'smartAccountZksync'> & {
  sign: NonNullable<CustomSource['sign']>
}

type ErrorType<name extends string = 'Error'> = Error & { name: name }
export type ToSmartAccountErrorType = ErrorType

/**
 * Creates a [ZKsync Smart Account](https://docs.zksync.io/build/developer-reference/account-abstraction/building-smart-accounts)
 * from a Contract Address and a custom sign function.
 */
export function toSmartAccount(
  parameters: ToSmartAccountParameters,
): ZksyncSmartAccount {
  const { address, sign } = parameters

  const account = toAccount({
    address,
    sign,
    async signMessage({ message }) {
      return sign({
        hash: hashMessage(message),
      })
    },
    async signTransaction(transaction) {
      const signableTransaction = {
        ...transaction,
        from: this.address!,
      } as ZksyncTransactionSerializableEIP712

      return serializeTransaction({
        ...signableTransaction,
        customSignature: await sign({
          hash: keccak256(serializeTransaction(signableTransaction)),
        }),
      })
    },
    async signTypedData(typedData) {
      return sign({
        hash: hashTypedData(typedData),
      })
    },
  })

  return {
    ...account,
    source: 'smartAccountZksync',
  } as ZksyncSmartAccount
}
