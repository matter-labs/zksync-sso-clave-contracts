import { standardErrors } from '../errors/index.js';
import type { RequestArguments } from '../client-gateway/interface.js';

export async function fetchRPCRequest(request: RequestArguments, rpcUrl: string) {
  const requestBody = {
    ...request,
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
  };
  const res = await window.fetch(rpcUrl, {
    method: 'POST',
    body: JSON.stringify(requestBody),
    mode: 'cors',
    headers: { 'Content-Type': 'application/json' },
  });
  const response = await res.json();
  return response.result;
}

/**
 * Validates the arguments for an invalid request and returns an error if any validation fails.
 * Valid request args are defined here: https://eips.ethereum.org/EIPS/eip-1193#request
 * @param args The request arguments to validate.
 * @returns An error object if the arguments are invalid, otherwise undefined.
 */
export function checkErrorForInvalidRequestArgs(args: unknown) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    throw standardErrors.rpc.invalidParams({
      message: 'Expected a single, non-array, object argument.',
      data: args,
    });
  }

  const { method, params } = args as RequestArguments;

  if (typeof method !== 'string' || method.length === 0) {
    throw standardErrors.rpc.invalidParams({
      message: "'args.method' must be a non-empty string.",
      data: args,
    });
  }

  if (
    params !== undefined &&
    !Array.isArray(params) &&
    (typeof params !== 'object' || params === null)
  ) {
    throw standardErrors.rpc.invalidParams({
      message: "'args.params' must be an object or array if provided.",
      data: args,
    });
  }
}