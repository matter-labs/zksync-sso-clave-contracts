import { type AbiStateMutability } from "viem";

// Helper type to convert string indices to numeric indices
type ToNumber<S extends string> = S extends `${infer N extends number}` ? N : never;

// Extract numeric keys as strings
type NumericKeys<T extends unknown[]> = Extract<keyof T, `${number}`>;

// Updated IndexedValues type with numeric indices
export type IndexedValues<T extends unknown[]> = Array<{
  [K in NumericKeys<T>]: { index: ToNumber<K>; value?: T[K] };
}[NumericKeys<T>]>;

export type ContractWriteMutability = Extract<AbiStateMutability, "nonpayable" | "payable">;
