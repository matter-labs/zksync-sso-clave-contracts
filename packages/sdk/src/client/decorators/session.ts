import { type Account, type Address, type Chain, type Transport } from 'viem'

import type { ClientWithZksyncAccountSessionData } from '../clients/session.js';

import { getTokenSpendLimit, type GetTokenSpendLimitReturnType } from '../actions/session.js';

export type ZksyncAccountSessionActions = {
  getTokenSpendLimit: (tokenAddress: Address) => Promise<GetTokenSpendLimitReturnType>;
};

export function zksyncAccountSessionActions<
  transport extends Transport,
  chain extends Chain,
  account extends Account,
>(client: ClientWithZksyncAccountSessionData<transport, chain, account>): ZksyncAccountSessionActions {
  return {
    getTokenSpendLimit: async (tokenAddress: Address) => {
      // if (!client.sessionKey) throw new Error("Session key not set");
      return await getTokenSpendLimit(client, {
        accountAddress: client.account.address,
        tokenAddress,
        // sessionKey: client.sessionKey,
        contracts: client.contracts,
      });
    },
  }
}

