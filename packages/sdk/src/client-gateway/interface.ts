import { EventEmitter } from "eventemitter3";
import type { Address, RpcSchema as RpcSchemaGeneric } from "viem";

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
  limit: number | bigint;
  period?: number | bigint;
};

export interface SessionPreferences {
  expiresAt?: number | bigint;
  feeLimit?: Limit;
  callPolicies?: {
    target: string;
    selector?: string;
    maxValuePerUse?: number | bigint;
    valueLimit?: Limit;
    constraints?: {
      condition?: Condition;
      index: number | bigint;
      refValue?: string;
      limit?: Limit;
    }[];
  }[];
  transferPolicies?: {
    target: string;
    maxValuePerUse?: number | bigint;
    valueLimit?: Limit;
  }[];
};

export interface SessionData extends SessionPreferences {
  sessionPublicKey: Address;
}
