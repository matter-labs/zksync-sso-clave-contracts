import type { RequestArguments } from '../provider/interface.js';

export type RPCRequest = {
  action: RequestArguments; // JSON-RPC call
  chainId: number;
};
