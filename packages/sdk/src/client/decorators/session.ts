import { type Account, type Chain, type Transport } from "viem";

import type { ClientWithZksyncSsoSessionData } from "../clients/session.js";

/* eslint-disable @typescript-eslint/no-empty-object-type */
export type ZksyncSsoSessionActions = {
};

export function zksyncSsoSessionActions<
  transport extends Transport,
  chain extends Chain,
  account extends Account,
  /* eslint-disable @typescript-eslint/no-unused-vars */
>(client: ClientWithZksyncSsoSessionData<transport, chain, account>): ZksyncSsoSessionActions {
  return {
  };
}
