export const SessionPasskeySpendLimitModuleAbi = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "smartAccount",
        "type": "address"
      }
    ],
    "name": "AlreadyInitialized",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "smartAccount",
        "type": "address"
      }
    ],
    "name": "NotInitialized",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "Disabled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "Inited",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "publicKey",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "expiration",
        "type": "uint256"
      }
    ],
    "name": "addSessionKey",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "disable",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "initData",
        "type": "bytes"
      }
    ],
    "name": "init",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "smartAccount",
        "type": "address"
      }
    ],
    "name": "isInitialized",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "typeID",
        "type": "uint256"
      }
    ],
    "name": "isModuleType",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_hash",
        "type": "bytes32"
      },
      {
        "internalType": "bytes",
        "name": "_signature",
        "type": "bytes"
      }
    ],
    "name": "isValidSignature",
    "outputs": [
      {
        "internalType": "bytes4",
        "name": "magic",
        "type": "bytes4"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      }
    ],
    "name": "onInstall",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      }
    ],
    "name": "onUninstall",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "hookData",
        "type": "bytes"
      }
    ],
    "name": "postCheck",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "msgSender",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "msgValue",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "msgData",
        "type": "bytes"
      }
    ],
    "name": "preCheck",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "hookData",
        "type": "bytes"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      }
    ],
    "name": "removeSpendingLimit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "internalType": "bytes",
            "name": "publicKey",
            "type": "bytes"
          },
          {
            "internalType": "uint256",
            "name": "limit",
            "type": "uint256"
          }
        ],
        "internalType": "struct SessionPasskeySpendLimitModule.TokenConfig[]",
        "name": "configs",
        "type": "tuple[]"
      }
    ],
    "name": "setSpendingLimits",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      }
    ],
    "name": "spendingLimits",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "limit",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "publicKey",
        "type": "bytes"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "interfaceId",
        "type": "bytes4"
      }
    ],
    "name": "supportsInterface",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "version",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  }
] as const;