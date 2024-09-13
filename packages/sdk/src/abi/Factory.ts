export const FactoryAbi = [
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_testAaBytecodeHash",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "_proxyAaBytecodeHash",
        "type": "bytes32"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "accountMappings",
    "outputs": [
      {
        "internalType": "address",
        "name": "accountLocation",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "publicPasskey",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "salt",
        "type": "bytes32"
      },
      {
        "internalType": "string",
        "name": "uniqueUserId",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "socialType",
        "type": "string"
      },
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "deployLinkedSocialAccount",
    "outputs": [
      {
        "internalType": "address",
        "name": "accountAddress",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "salt",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "accountImplementionLocation",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "initialR1Owner",
        "type": "bytes"
      },
      {
        "internalType": "address",
        "name": "initialR1Validator",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "initialModule",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "initData",
        "type": "bytes"
      }
    ],
    "name": "deployProxy7579Account",
    "outputs": [
      {
        "internalType": "address",
        "name": "accountAddress",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "proxyAaBytecodeHash",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "socialType",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "uniqueUserId",
        "type": "string"
      },
      {
        "internalType": "address",
        "name": "updating",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "publicPasskey",
        "type": "string"
      }
    ],
    "name": "setLinkedEmbeddedAccountPasskey",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "testAaBytecodeHash",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;