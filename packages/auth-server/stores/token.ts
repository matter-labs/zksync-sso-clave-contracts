import type { Address } from "viem";

export type Token = {
  address: Address;
  name?: string;
  symbol: string;
  decimals: number;
  iconUrl?: string;
  price?: number;
};
