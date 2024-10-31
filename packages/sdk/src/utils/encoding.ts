import { type Address, encodeAbiParameters, type Hash, parseAbiParameters, toHex } from "viem";

import type { SessionData } from "../client-gateway/interface.js";
import { getSession } from "../utils/session.js";

export const encodeCreateSessionParameters = (session: SessionData) => {
  const sessionSpec = {
    components: [
      { name: "signer", type: "address" },
      { name: "expiresAt", type: "uint256" },
      {
        components: [
          { name: "limitType", type: "uint8" },
          { name: "limit", type: "uint256" },
          { name: "period", type: "uint256" },
        ],
        name: "feeLimit",
        type: "tuple",
      },
      {
        components: [
          { name: "target", type: "address" },
          { name: "selector", type: "bytes4" },
          { name: "maxValuePerUse", type: "uint256" },
          {
            components: [
              { name: "limitType", type: "uint8" },
              { name: "limit", type: "uint256" },
              { name: "period", type: "uint256" },
            ],
            name: "valueLimit",
            type: "tuple",
          },
          {
            components: [
              { name: "condition", type: "uint8" },
              { name: "index", type: "uint64" },
              { name: "refValue", type: "bytes32" },
              {
                components: [
                  { name: "limitType", type: "uint8" },
                  { name: "limit", type: "uint256" },
                  { name: "period", type: "uint256" },
                ],
                name: "limit",
                type: "tuple",
              },
            ],
            name: "constraints",
            type: "tuple[]",
          },
        ],
        name: "callPolicies",
        type: "tuple[]",
      },
      {
        components: [
          { name: "target", type: "address" },
          { name: "maxValuePerUse", type: "uint256" },
          {
            components: [
              { name: "limitType", type: "uint8" },
              { name: "limit", type: "uint256" },
              { name: "period", type: "uint256" },
            ],
            name: "valueLimit",
            type: "tuple",
          },
        ],
        name: "transferPolicies",
        type: "tuple[]",
      },
    ],
    name: "newSession",
    type: "tuple",
  };

  return encodeAbiParameters(
    [sessionSpec],
    [{ ...getSession(session), signer: session.sessionPublicKey }],
  );
};

export const encodePasskeyModuleParameters = (passkey: { passkeyPublicKey: [Buffer, Buffer]; expectedOrigin: string }) => {
  return encodeAbiParameters(
    [
      { type: "bytes32[2]", name: "xyPublicKeys" },
      { type: "string", name: "expectedOrigin" },
    ],
    [
      [toHex(passkey.passkeyPublicKey[0]), toHex(passkey.passkeyPublicKey[1])],
      passkey.expectedOrigin,
    ],
  );
};

export const encodeModuleData = (moduleData: { address: Address; parameters: Hash }) => {
  const moduleParams = parseAbiParameters("address, bytes");
  return encodeAbiParameters(
    moduleParams,
    [moduleData.address, moduleData.parameters],
  );
};
