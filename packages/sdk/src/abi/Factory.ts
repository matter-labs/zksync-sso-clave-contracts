export const FactoryAbi = [
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "_beaconProxyBytecodeHash",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "implementation",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "implementation",
        type: "address",
      },
    ],
    name: "Upgraded",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    name: "accountMappings",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "uniqueAccountId",
        type: "bytes32",
      },
    ],
    name: "addNewUniqueId",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "beaconProxyBytecodeHash",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "salt",
        type: "bytes32",
      },
      {
        internalType: "string",
        name: "uniqueAccountId",
        type: "string",
      },
      {
        internalType: "bytes[]",
        name: "initialValidators",
        type: "bytes[]",
      },
      {
        internalType: "bytes[]",
        name: "initialModules",
        type: "bytes[]",
      },
      {
        internalType: "address[]",
        name: "initialK1Owners",
        type: "address[]",
      },
    ],
    name: "deployProxySsoAccount",
    outputs: [
      {
        internalType: "address",
        name: "accountAddress",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "salt",
        type: "bytes32",
      },
      {
        internalType: "string",
        name: "uniqueAccountId",
        type: "string",
      },
      {
        internalType: "bytes[]",
        name: "initialValidators",
        type: "bytes[]",
      },
      {
        internalType: "bytes[]",
        name: "initialModules",
        type: "bytes[]",
      },
      {
        internalType: "address[]",
        name: "initialK1Owners",
        type: "address[]",
      },
    ],
    name: "deployProxySsoAccount",
    outputs: [
      {
        internalType: "address",
        name: "accountAddress",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "implementation",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newImplementation",
        type: "address",
      },
    ],
    name: "upgradeTo",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
