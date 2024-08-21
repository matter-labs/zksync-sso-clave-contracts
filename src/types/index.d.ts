import { type Address } from "viem";

export type ChainData = {
  id: number;
  capabilities: Record<string, unknown>;
  contracts: {
    session: Address; // Session, spend limit, etc.
  }
};
