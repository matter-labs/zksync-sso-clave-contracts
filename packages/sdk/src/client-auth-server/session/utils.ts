import { type AbiFunction, type AbiParameter, type Address, encodeAbiParameters, type Hash, toHex } from "viem";

const DYNAMIC_ABI_INPUT_TYPES = ["bytes", "string"];

export const isDynamicInputType = (inputType: string) => {
  return inputType.endsWith("[]") || DYNAMIC_ABI_INPUT_TYPES.includes(inputType);
};

const includesDynamicInputType = (abiParameters: readonly AbiParameter[]): boolean => {
  return abiParameters.some((input) => {
    const isDynamicType = isDynamicInputType(input.type);
    if (isDynamicType) return true;

    if (input.type.startsWith("tuple")) {
      const components = (input as TupleAbiParameter).components;
      if (!components) throw new Error("Tuple without components is unsupported");
      return includesDynamicInputType(components);
    }
    return false;
  });
};

export const isFollowedByDynamicInputType = (abiFunction: AbiFunction, targetInputIndex: number) => {
  if (targetInputIndex >= abiFunction.inputs.length) {
    throw new Error(`Input index ${targetInputIndex} is out of bounds`);
  }

  return includesDynamicInputType(abiFunction.inputs.slice(0, targetInputIndex));
};

export const encodedInputToAbiChunks = (encodedInput: string) => {
  if (!encodedInput.startsWith("0x")) {
    throw new Error("Input is not a valid hex string");
  }
  return (encodedInput.slice(2).match(/.{1,64}/g) || []) as Hash[]; // 32 bytes abi chunks
};

const getDummyBytesValue = (type: string) => {
  const size = parseInt(type.slice(5)) || 32;
  return toHex("", { size });
};

// Function to generate dummy values for ABI types
const getDummyValue = (type: string) => {
  if (type === "address") return "0x36615Cf349d7F6344891B1e7CA7C72883F5dc049" as Address;
  if (type.startsWith("uint") || type.startsWith("int")) return 0n; // BigInt for numbers
  if (type.startsWith("bytes")) return getDummyBytesValue(type); // Empty bytes
  if (type === "bool") return false;
  if (type === "string") return ""; // Empty string
  throw new Error(`Unsupported ABI type: ${type}`);
};

function getArrayComponents(
  type: string,
): [length: number | null, innerType: string] | undefined {
  const matches = type.match(/^(.*)\[(\d+)?\]$/);
  return matches
    ? [matches[2] ? Number(matches[2]) : null, matches[1]]
    : undefined;
}

type TupleAbiParameter = AbiParameter & { components: readonly AbiParameter[] };

// Recursive function to fill dummy values for complex types like tuples
const getDummyValues = (inputs: readonly AbiParameter[]): unknown[] => {
  return inputs.map((input) => {
    const arrayComponents = getArrayComponents(input.type);
    if (arrayComponents) {
      // Recursively fill array components
      const [length, innerType] = arrayComponents;
      if (!length) throw new Error("Dynamic array length is unsupported");
      const arrayValue = Array.from({ length }, () => getDummyValues([{
        ...input,
        type: innerType,
      }]));
      return arrayValue;
    }
    if (input.type.startsWith("tuple")) {
      // Recursively fill tuple components
      const components = (input as TupleAbiParameter).components;
      if (!components) throw new Error("Tuple without components is unsupported");
      return getDummyValues(components);
    }
    return getDummyValue(input.type);
  });
};

export const getParameterChunkIndex = (
  abiFunction: AbiFunction,
  targetInputIndex: number,
): number => {
  if (targetInputIndex >= abiFunction.inputs.length) {
    throw new Error(`Input index ${targetInputIndex} is out of bounds`);
  }

  const inputs = abiFunction.inputs.slice(0, targetInputIndex);
  const dummyValues = getDummyValues(inputs);
  const encoded = encodeAbiParameters(inputs, dummyValues);
  const chunks = encodedInputToAbiChunks(encoded);
  const chunkIndex = chunks.length;

  return chunkIndex;
};

/* SessionKeyModuleAbi.forEach((abi) => {
  if (abi.type !== "function") return;
  const dummyValues = getDummyValues(abi.inputs);

  console.log(abi.name, abi.inputs, dummyValues);
  try {
    console.log("Encoded", encodeAbiParameters(abi.inputs, dummyValues as any));
  } catch (error) {
    console.error("Error", error);
  }
}); */
