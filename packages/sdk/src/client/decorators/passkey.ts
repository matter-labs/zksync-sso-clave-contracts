import { type Account, type Address, type Chain, type Transport } from 'viem'

import type { ClientWithZksyncAccountSessionData } from '../clients/session.js';

import {
  addSessionKey, type AddSessionKeyArgs, type AddSessionKeyReturnType,
  getTokenSpendLimit, type GetTokenSpendLimitReturnType,
} from '../actions/session.js';

export type ZksyncAccountPasskeyActions = {
  addSessionKey: (args: Omit<AddSessionKeyArgs, 'accountAddress' | 'contracts'>) => Promise<AddSessionKeyReturnType>;
  getTokenSpendLimit: (tokenAddress: Address) => Promise<GetTokenSpendLimitReturnType>;
};

export function zksyncAccountPasskeyActions<
  transport extends Transport,
  chain extends Chain,
  account extends Account,
>(client: ClientWithZksyncAccountSessionData<transport, chain, account>): ZksyncAccountPasskeyActions {
  return {
    addSessionKey: async (args: Omit<AddSessionKeyArgs, 'accountAddress' | 'contracts'>) => {
      return await addSessionKey(client, {
        ...args,
        accountAddress: client.account.address,
        contracts: client.contracts,
      });
    },
    getTokenSpendLimit: async (tokenAddress: Address) => {
      return await getTokenSpendLimit(client, {
        accountAddress: client.account.address,
        tokenAddress,
        contracts: client.contracts,
      });
    },
  }
}

