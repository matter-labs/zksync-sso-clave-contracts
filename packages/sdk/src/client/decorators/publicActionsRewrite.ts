import type { Account, Chain, Hex, PublicActions, Transport } from "viem";
import { estimateContractGas, estimateGas } from "viem/actions";

import { type ClientWithZksyncAccountSessionData, signSessionTransaction } from "../clients/session.js";

const emptySignature = "0x" + "1b".padStart(65 * 2, "0") as Hex;

export function publicActionsRewrite<
  transport extends Transport,
  chain extends Chain,
  account extends Account,
>(
  client: ClientWithZksyncAccountSessionData<transport, chain, account>,
): Pick<PublicActions<transport, chain, account>, "estimateContractGas" | "estimateGas"> {
  return {
    estimateContractGas: (args) => {
      if (!("customSignature" in args)) {
        (args as any).customSignature = signSessionTransaction({
          sessionKeySignedHash: emptySignature,
          sessionContract: client.contracts.session,
          sessionConfig: client.sessionConfig,
        });
      }
      return estimateContractGas(client, args as any);
    },
    estimateGas: async (args) => {
      if (!("customSignature" in args)) {
        (args as any).customSignature = signSessionTransaction({
          sessionKeySignedHash: emptySignature,
          sessionContract: client.contracts.session,
          sessionConfig: client.sessionConfig,
        });
      }
      return await estimateGas(client, args);
    },
  };
}
