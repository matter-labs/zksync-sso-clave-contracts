import { type Chain, type Transport } from "viem";

import { createSession, type CreateSessionArgs, type CreateSessionReturnType } from "../actions/session.js";
import type { ClientWithZksyncSsoPasskeyData } from "../clients/passkey.js";

export type ZksyncSsoPasskeyActions = {
  createSession: (args: Omit<CreateSessionArgs, "contracts">) => Promise<CreateSessionReturnType>;
};

export function zksyncSsoPasskeyActions<
  transport extends Transport,
  chain extends Chain,
>(client: ClientWithZksyncSsoPasskeyData<transport, chain>): ZksyncSsoPasskeyActions {
  return {
    createSession: async (args: Omit<CreateSessionArgs, "contracts">) => {
      return await createSession(client, {
        ...args,
        contracts: client.contracts,
      });
    },
  };
}
