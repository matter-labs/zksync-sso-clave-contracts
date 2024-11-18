import { assertRequest, type AssertRequestErrorType, type ExactPartial } from "viem";
import type { SendTransactionParameters, zksync } from "viem/zksync";

import { InvalidEip712TransactionError, type InvalidEip712TransactionErrorType } from "./assertEip712Transaction.js";
import { isEIP712Transaction } from "./isEip712Transaction.js";

export type AssertEip712RequestParameters = ExactPartial<
  SendTransactionParameters<typeof zksync>
>;

/** @internal */
export type AssertEip712RequestErrorType =
  | InvalidEip712TransactionErrorType
  | AssertRequestErrorType;

export function assertEip712Request(args: AssertEip712RequestParameters) {
  if (!isEIP712Transaction(args as any))
    throw new InvalidEip712TransactionError();
  assertRequest(args as any);
}
