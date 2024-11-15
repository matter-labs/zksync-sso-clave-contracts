import { type Address, encodeAbiParameters, encodeFunctionData, type Hash, type Hex, parseAbiParameters, toHex } from "viem";

import { SessionKeyModuleAbi } from "../abi/SessionKeyModule.js";
import type { SessionConfig } from "../utils/session.js";

export const encodeSession = (sessionConfig: SessionConfig) => {
  const callData = encodeFunctionData({
    abi: SessionKeyModuleAbi,
    functionName: "createSession",
    args: [sessionConfig],
  });
  const selector = callData.slice(0, "0x".length + 8) as Hex; // first 4 bytes for function selector
  const args = `0x${callData.slice(selector.length, callData.length)}` as Hex; // the rest is the arguments
  return args;
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
