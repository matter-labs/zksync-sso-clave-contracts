import { type Account, type Address, type Chain, type Transport } from 'viem'

import type { ClientWithZksyncAccountSessionData } from '../clients/session.js';

import { getTokenSpendLimit, requestSession, type GetTokenSpendLimitArgs, type GetTokenSpendLimitReturnType, type RequestSessionArgs, type RequestSessionReturnType } from '../actions/session.js';

export type ZksyncAccountSessionActions<chain extends Chain> = {
  requestSession: (args: RequestSessionArgs) => Promise<RequestSessionReturnType<chain>>;
  getTokenSpendLimit: (tokenAddress: Address) => Promise<GetTokenSpendLimitReturnType>;
};

export function zksyncAccountSessionActions<
  transport extends Transport,
  chain extends Chain,
  account extends Account,
>(client: ClientWithZksyncAccountSessionData<transport, chain, account>): ZksyncAccountSessionActions<chain> {
  return {
    requestSession: async (args: Omit<RequestSessionArgs, 'contracts'> & { updateClientSessionKey?: boolean }) => {
      const response = await requestSession(client, {
        ...args,
        sessionKey: args.sessionKey || client.sessionKey,
        contracts: client.contracts,
      } as RequestSessionArgs);
      if (args.updateClientSessionKey === true) client.sessionKey = response.sessionKey;
      return response;
    },
    getTokenSpendLimit: async (tokenAddress: Address) => {
      if (!client.sessionKey) throw new Error("Session key not set");
      return await getTokenSpendLimit(client, {
        tokenAddress,
        sessionKey: client.sessionKey,
        contracts: client.contracts,
      } as GetTokenSpendLimitArgs);
    },
  }
}

