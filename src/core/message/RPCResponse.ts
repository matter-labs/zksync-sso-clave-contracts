import type { SerializedEthereumRpcError } from '../error/index.js';
import type { SessionData } from '../provider/index.js';

export type RPCResponse<T> = {
  result:
    | {
        value: T; // JSON-RPC result
      }
    | {
        error: SerializedEthereumRpcError;
      };
  data?: {
    // optional data
    chains?: { [key: number]: string };
    capabilities?: Record<`0x${string}`, Record<string, unknown>>;
    session?: SessionData;
  };
};
