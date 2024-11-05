import { EventEmitter } from "eventemitter3";
import type { AbiFunction, Address, Hash, RpcSchema as RpcSchemaGeneric } from "viem";

import type { ExtractParams, ExtractReturnType, Method, RpcSchema } from "./rpc.js";

export interface RequestArguments<M extends Method<TSchema>, TSchema extends RpcSchemaGeneric = RpcSchema> {
  readonly method: M;
  readonly params?: ExtractParams<M, TSchema>;
}

export interface ProviderRpcError extends Error {
  message: string;
  code: number;
  data?: unknown;
}

interface ProviderMessage {
  type: string;
  data: unknown;
}

interface ProviderConnectInfo {
  readonly chainId: string;
}

export interface ProviderInterface extends EventEmitter {
  request<M extends Method>(args: RequestArguments<M>): Promise<ExtractReturnType<M>>;
  disconnect(): Promise<void>;
  on(event: "connect", listener: (info: ProviderConnectInfo) => void): this;
  on(event: "disconnect", listener: (error: ProviderRpcError) => void): this;
  on(event: "chainChanged", listener: (chainId: string) => void): this;
  on(event: "accountsChanged", listener: (accounts: string[]) => void): this;
  on(event: "message", listener: (message: ProviderMessage) => void): this;
}

export interface AppMetadata {
  name: string;
  icon: string | null;
}

export enum Condition {
  Unconstrained = 0,
  Equal = 1,
  Greater = 2,
  Less = 3,
  GreaterEqual = 4,
  LessEqual = 5,
  NotEqual = 6,
}

export type Limit = {
  limit: bigint;
  period?: bigint;
};

export type CallPolicy = {
  target: Address;
  function?: string | AbiFunction;
  selector?: Hash; // if function is not provided
  maxValuePerUse?: bigint;
  valueLimit?: bigint | Limit;
  constraints?: {
    index: number | bigint;
    condition?: Condition | keyof typeof Condition;
    refValue?: Hash;
    limit?: Limit;
  }[];
};

export type TransferPolicy = {
  target: Address;
  maxValuePerUse?: bigint;
  valueLimit?: bigint | Limit;
};

export interface SessionPreferences {
  expiresAt?: bigint;
  feeLimit?: bigint | Limit;
  callPolicies?: CallPolicy[];
  transferPolicies?: TransferPolicy[];
};

export interface SessionData extends SessionPreferences {
  sessionPublicKey: Address;
}
