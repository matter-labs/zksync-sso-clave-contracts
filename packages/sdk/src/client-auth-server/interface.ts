import { EventEmitter } from "eventemitter3";
import type { RpcSchema as RpcSchemaGeneric } from "viem";

import type { ZksyncSsoSessionClient } from "../client/index.js";
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
  getClient(parameters?: { chainId?: number }): Promise<ZksyncSsoSessionClient> | ZksyncSsoSessionClient;
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
