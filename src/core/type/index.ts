import type { Address } from "viem";

// Copyright (c) 2018-2024 Coinbase, Inc. <https://www.coinbase.com/>
interface Tag<T extends string, RealType> {
  __tag__: T;
  __realType__: RealType;
}

export type OpaqueType<T extends string, U> = U & Tag<T, U>;

export function OpaqueType<T extends Tag<string, unknown>>() {
  return (value: T extends Tag<string, infer U> ? U : never): T => value as T;
}

export type HexString = OpaqueType<'HexString', string>;
export const HexString = OpaqueType<HexString>();

export type IntNumber = OpaqueType<'IntNumber', number>;
export function IntNumber(num: number): IntNumber {
  return Math.floor(num) as IntNumber;
}

export type ChainData = {
  id: number;
  name: string;
  rpcUrl: string;
  capabilities: Record<string, unknown>;
  contracts: {
    session: Address; // Session, spend limit, etc.
  }
};
