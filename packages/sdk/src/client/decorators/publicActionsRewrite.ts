import type { Account, Chain, Hex, PublicActions, Transport } from "viem";
import { estimateContractGas, estimateGas, prepareTransactionRequest } from "viem/actions";

import { type ClientWithZksyncSsoSessionData, signSessionTransaction } from "../clients/session.js";

const emptySignature = "0x" + "1b".padStart(65 * 2, "0") as Hex;

export function publicActionsRewrite<
  transport extends Transport,
  chain extends Chain,
  account extends Account,
>(
  client: ClientWithZksyncSsoSessionData<transport, chain, account>,
): Pick<PublicActions<transport, chain, account>, "estimateContractGas" | "estimateGas" | "prepareTransactionRequest"> {
  return {
    prepareTransactionRequest: async (args) => {
      console.log("prepareTransactionRequest", args);
      if (!("customSignature" in args)) {
        (args as any).customSignature = signSessionTransaction({
          sessionKeySignedHash: emptySignature,
          sessionContract: client.contracts.session,
          sessionConfig: client.sessionConfig,
        });
      }
      console.log("Initial args", args);
      const request = await prepareTransactionRequest(client, args as any) as any;
      /* const request = await prepareTransactionRequest(client, {
        chainId: client.chain.id,
        parameters: ["gas", "nonce", "fees"],
        ...args,
        type: "eip712",
      } as any) as any; */
      console.log("After prepare", request);
      return request;
    },
    estimateContractGas: (args) => {
      console.log("estimateContractGas", args);
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
      console.log("estimateGas", args);
      if (!("customSignature" in args)) {
        (args as any).customSignature = signSessionTransaction({
          sessionKeySignedHash: emptySignature,
          sessionContract: client.contracts.session,
          sessionConfig: client.sessionConfig,
        });
      }
      const estimated = await estimateGas(client, args);
      console.log("Estimated", estimated);
      return estimated;
    },
  };
}
