import type { Address } from "viem";

export type ZksyncAccountContracts = {
  session: Address; // Session, spend limit, etc.
  accountFactory?: Address; // For account creation
}