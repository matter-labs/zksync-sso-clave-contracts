import { type Chain, type Transport } from "viem";

import { createSession, type CreateSessionArgs, type CreateSessionReturnType } from "../actions/session.js";
import type { ClientWithZksyncAccountPasskeyData } from "../clients/passkey.js";

export type ZksyncAccountPasskeyActions = {
  createSession: (args: Omit<CreateSessionArgs, "contracts">) => Promise<CreateSessionReturnType>;
};

export function zksyncAccountPasskeyActions<
  transport extends Transport,
  chain extends Chain,
>(client: ClientWithZksyncAccountPasskeyData<transport, chain>): ZksyncAccountPasskeyActions {
  return {
    createSession: async (args: Omit<CreateSessionArgs, "contracts">) => {
      return await createSession(client, {
        ...args,
        contracts: client.contracts,
      });
    },
  };
}
