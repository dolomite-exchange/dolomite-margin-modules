/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import {
  Signer,
  utils,
  Contract,
  ContractFactory,
  BigNumberish,
  Overrides,
} from "ethers";
import type { Provider, TransactionRequest } from "@ethersproject/providers";
import type {
  TestChainlinkAutomationPriceOracle,
  TestChainlinkAutomationPriceOracleInterface,
} from "../../../contracts/test/TestChainlinkAutomationPriceOracle";

const _abi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_dolomiteMargin",
        type: "address",
      },
      {
        internalType: "address",
        name: "_chainlinkRegistry",
        type: "address",
      },
      {
        internalType: "address",
        name: "_token",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "_marketId",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "_chainlinkRegistry",
        type: "address",
      },
    ],
    name: "ChainlinkRegistrySet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "_lastUpdateTimestamp",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_exchangeRateNumerator",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "_exchangeRateDenominator",
        type: "uint256",
      },
    ],
    name: "ExchangeRateUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "_forwarder",
        type: "address",
      },
    ],
    name: "ForwarderSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "_heartbeat",
        type: "uint256",
      },
    ],
    name: "GracePeriodSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "_heartbeat",
        type: "uint256",
      },
    ],
    name: "HeartbeatSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "_lowerEdge",
        type: "uint256",
      },
    ],
    name: "LowerEdgeSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "_upperEdge",
        type: "uint256",
      },
    ],
    name: "UpperEdgeSet",
    type: "event",
  },
  {
    inputs: [],
    name: "DOLOMITE_MARGIN",
    outputs: [
      {
        internalType: "contract IDolomiteMargin",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MARKET_ID",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "TOKEN",
    outputs: [
      {
        internalType: "contract ICustomTestVaultToken",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "chainlinkRegistry",
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
        internalType: "bytes",
        name: "",
        type: "bytes",
      },
    ],
    name: "checkUpkeep",
    outputs: [
      {
        internalType: "bool",
        name: "upkeepNeeded",
        type: "bool",
      },
      {
        internalType: "bytes",
        name: "",
        type: "bytes",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "exchangeRateDenominator",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "exchangeRateNumerator",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "forwarder",
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
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "getPrice",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "value",
            type: "uint256",
          },
        ],
        internalType: "struct IDolomiteStructs.MonetaryPrice",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "gracePeriod",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "heartbeat",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_upkeepId",
        type: "uint256",
      },
    ],
    name: "initializeForwarder",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "lastUpdateTimestamp",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "lowerEdge",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_chainlinkRegistry",
        type: "address",
      },
    ],
    name: "ownerSetChainlinkRegistry",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_forwarder",
        type: "address",
      },
    ],
    name: "ownerSetForwarder",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_gracePeriod",
        type: "uint256",
      },
    ],
    name: "ownerSetGracePeriod",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_heartbeat",
        type: "uint256",
      },
    ],
    name: "ownerSetHeartbeat",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_lowerEdge",
        type: "uint256",
      },
    ],
    name: "ownerSetLowerEdge",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_upperEdge",
        type: "uint256",
      },
    ],
    name: "ownerSetUpperEdge",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes",
        name: "",
        type: "bytes",
      },
    ],
    name: "performUpkeep",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "upperEdge",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const _bytecode =
  "0x60a06040523480156200001157600080fd5b5060405162001cdb38038062001cdb8339810160408190526200003491620005b4565b6001600160a01b03841660805283836200005162015180620000b9565b6200005e610e10620000fb565b6200006b61272962000132565b620000786126f7620001a9565b620000838162000220565b5050600980546001600160a01b0319166001600160a01b038416179055600a819055620000af620002ca565b505050506200081e565b60008190556040517fb28aba9038268da82e167f5387f1c36b2887f0c6b444f73315ca8487d44469e590620000f09083906200062a565b60405180910390a150565b60018190556040517f376aafccbf0af4f25bc38eb52182d4604f044d0d87e4cb26e1667b50e3a1de0590620000f09083906200062a565b62000172612710821160008051602062001cbb83398151915271496e76616c6964207570706572206564676560701b6200032060201b620006cc1760201c565b60028190556040517f9baf87ed88c59c47fcbc772097143ac1970e39ee06d569f34ad0d9775bf369b090620000f09083906200062a565b620001e9612710821060008051602062001cbb83398151915271496e76616c6964206c6f776572206564676560701b6200032060201b620006cc1760201c565b60038190556040517fe5d8954a6f6cd82676f6d093c48e3fcec885de57b0a0f9f2a279d994baa39f4090620000f09083906200062a565b6200027d60006001600160a01b0316826001600160a01b0316141560008051602062001cbb8339815191527f496e76616c696420636861696e6c696e6b2072656769737472790000000000006200032060201b620006cc1760201c565b600480546001600160a01b0319166001600160a01b0383161790556040517fff593e9760b2f47c7738eec0dd7255bc3bfbe6b90270c9e0a492e329bb1fe1a290620000f090839062000645565b620002d46200038c565b600781905560068290554260088190556040517f4a84129ac58651279fc65719b27818bccdff5de9a6efebaab1616a6d2f90bf24936200031693909162000655565b60405180910390a1565b8262000387576200033182620004ab565b6101d160f51b6200034283620004ab565b6040516020016200035693929190620006f4565b60408051601f198184030181529082905262461bcd60e51b82526200037e9160040162000760565b60405180910390fd5b505050565b600080600960009054906101000a90046001600160a01b03166001600160a01b03166301e1d1146040518163ffffffff1660e01b815260040160206040518083038186803b158015620003de57600080fd5b505afa158015620003f3573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906200041991906200077a565b600960009054906101000a90046001600160a01b03166001600160a01b03166318160ddd6040518163ffffffff1660e01b815260040160206040518083038186803b1580156200046857600080fd5b505afa1580156200047d573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190620004a391906200077a565b915091509091565b6060600082604051602001620004c29190620007a6565b60408051601f19818403018152919052905060205b80156200054f5780620004ea81620007d3565b915050818181518110620005025762000502620007ed565b01602001517fff000000000000000000000000000000000000000000000000000000000000001615620005495760006200053e82600162000803565b835250909392505050565b620004d7565b505060408051600081526020810190915292915050565b60006001600160a01b0382165b92915050565b620005848162000566565b81146200059057600080fd5b50565b8051620005738162000579565b8062000584565b80516200057381620005a0565b60008060008060808587031215620005cf57620005cf600080fd5b6000620005dd878762000593565b9450506020620005f08782880162000593565b9350506040620006038782880162000593565b92505060606200061687828801620005a7565b91505092959194509250565b805b82525050565b6020810162000573828462000622565b620006248162000566565b602081016200057382846200063a565b6060810162000665828662000622565b62000674602083018562000622565b62000683604083018462000622565b949350505050565b60005b83811015620006a85781810151838201526020016200068e565b83811115620006b8576000848401525b50505050565b6000620006c9825190565b620006d98185602086016200068b565b9290920192915050565b6001600160f01b0319811662000624565b6000620007028286620006be565b9150620007108285620006e3565b600282019150620007228284620006be565b95945050505050565b600062000736825190565b8084526020840193506200074f8185602086016200068b565b601f01601f19169290920192915050565b602080825281016200077381846200072b565b9392505050565b600060208284031215620007915762000791600080fd5b6000620006838484620005a7565b8062000624565b6000620007b482846200079f565b50602001919050565b634e487b7160e01b600052601160045260246000fd5b600081620007e557620007e5620007bd565b506000190190565b634e487b7160e01b600052603260045260246000fd5b60008219821115620008195762000819620007bd565b500190565b6080516114506200086b60003960008181610199015281816102fb015281816103ef01528181610422015281816105680152818161059b015281816105ce01526108ea01526114506000f3fe608060405234801561001057600080fd5b50600436106101425760003560e01c806356f560c5116100b8578063a06db7dc1161007c578063a06db7dc146102a1578063a2b6070c146102aa578063b5dae1cf146102b3578063db168228146102c6578063e54c75e2146102d9578063f645d4f9146102e257600080fd5b806356f560c51461023e5780636e04ff0d1461024757806382bfefc8146102685780638612130d1461027b5780638a3b4ca51461028e57600080fd5b806331e84b001161010a57806331e84b00146101c657806335784f1f146101e65780633defb962146101f957806341976e0914610202578063454dab23146102225780634585e33b1461022b57600080fd5b806302edbd211461014757806309492567146101665780630f8b75451461017b57806314bcec9f1461018e57806315c14a4a14610197575b600080fd5b61015060035481565b60405161015d9190610ecf565b60405180910390f35b610179610174366004610f13565b6102f5565b005b610179610189366004610f13565b6103e9565b61015060085481565b7f00000000000000000000000000000000000000000000000000000000000000005b60405161015d9190610f5b565b6004546101d9906001600160a01b031681565b60405161015d9190610f72565b6101796101f4366004610f91565b61041c565b61015060005481565b610215610210366004610f13565b61044f565b60405161015d9190610fc3565b610150600a5481565b61017961023936600461101c565b610479565b61015060025481565b61025a61025536600461101c565b610508565b60405161015d9291906110ca565b6009546101b9906001600160a01b031681565b610179610289366004610f91565b610562565b61017961029c366004610f91565b610595565b61015060015481565b61015060065481565b6101796102c1366004610f91565b6105c8565b6101796102d4366004610f91565b6105fb565b61015060075481565b6005546101d9906001600160a01b031681565b336103dc7f00000000000000000000000000000000000000000000000000000000000000005b6001600160a01b0316638da5cb5b6040518163ffffffff1660e01b815260040160206040518083038186803b15801561035357600080fd5b505afa158015610367573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061038b91906110f5565b6001600160a01b0316826001600160a01b0316147127b7363ca237b637b6b4ba32a6b0b933b4b760711b7f43616c6c6572206973206e6f74206f776e6572206f6620446f6c6f6d697465008461072f565b6103e58261077b565b5050565b336104137f000000000000000000000000000000000000000000000000000000000000000061031b565b6103e582610809565b336104467f000000000000000000000000000000000000000000000000000000000000000061031b565b6103e582610898565b60408051602081019091526000815260405180602001604052806104716108cd565b905292915050565b6005546104c0906001600160a01b031633146000805160206113fb8339815191527f43616c6c6572206973206e6f7420666f727761726465720000000000000000006106cc565b6105006104cb610973565b6000805160206113fb8339815191527f636865636b55706b65657020636f6e646974696f6e73206e6f74206d657400006106cc565b6103e5610a50565b6000606061053e32156000805160206113fb83398151915274537461746963207270632063616c6c73206f6e6c7960581b6106cc565b610546610973565b60405180602001604052806000815250915091505b9250929050565b3361058c7f000000000000000000000000000000000000000000000000000000000000000061031b565b6103e582610aa2565b336105bf7f000000000000000000000000000000000000000000000000000000000000000061031b565b6103e582610ad7565b336105f27f000000000000000000000000000000000000000000000000000000000000000061031b565b6103e582610b3e565b600554610641906001600160a01b0316156000805160206113fb8339815191527f466f7277617264657220616c726561647920696e697469616c697a65640000006106cc565b600480546040516379ea994360e01b81526106c9926001600160a01b03909216916379ea99439161067491869101610ecf565b60206040518083038186803b15801561068c57600080fd5b505afa1580156106a0573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906106c491906110f5565b61077b565b50565b8261072a576106da82610ba5565b6101d160f51b6106e983610ba5565b6040516020016106fb93929190611148565b60408051601f198184030181529082905262461bcd60e51b825261072191600401611179565b60405180910390fd5b505050565b836107755761073d83610ba5565b6101d160f51b61074c84610ba5565b61080f60f21b61075b85610c40565b6040516106fb959493929190601f60f91b906020016111a1565b50505050565b6107b36001600160a01b03821615156000805160206113fb8339815191527024b73b30b634b2103337b93bb0b93232b960791b6106cc565b600580546001600160a01b0319166001600160a01b0383161790556040517f01e06e871b32b0b127105fbd5dbecd24273b7e1191a8940de24f4ea249e355d6906107fe908390610f72565b60405180910390a150565b61084d6001600160a01b03821615156000805160206113fb8339815191527f496e76616c696420636861696e6c696e6b2072656769737472790000000000006106cc565b600480546001600160a01b0319166001600160a01b0383161790556040517fff593e9760b2f47c7738eec0dd7255bc3bfbe6b90270c9e0a492e329bb1fe1a2906107fe908390610f72565b60018190556040517f376aafccbf0af4f25bc38eb52182d4604f044d0d87e4cb26e1667b50e3a1de05906107fe908390610ecf565b600a546040516344941bc760e11b81526000916001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001691638928378e9161091d91600401610ecf565b60206040518083038186803b15801561093557600080fd5b505afa158015610949573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061096d919061129f565b51919050565b6000806000610980610d86565b9150915080600014156109965760009250505090565b6000600754670de0b6b3a76400006006546109b191906112d6565b6109bb919061130b565b90506000826109d2670de0b6b3a7640000866112d6565b6109dc919061130b565b90506000612710600254846109f191906112d6565b6109fb919061130b565b9050600061271060035485610a1091906112d6565b610a1a919061130b565b90508183101580610a2b5750808311155b80610a455750600054600854610a41919061131f565b4210155b965050505050505090565b610a58610d86565b600781905560068290554260088190556040517f4a84129ac58651279fc65719b27818bccdff5de9a6efebaab1616a6d2f90bf2493610a98939091611337565b60405180910390a1565b60008190556040517fb28aba9038268da82e167f5387f1c36b2887f0c6b444f73315ca8487d44469e5906107fe908390610ecf565b610b0961271082116000805160206113fb83398151915271496e76616c6964207570706572206564676560701b6106cc565b60028190556040517f9baf87ed88c59c47fcbc772097143ac1970e39ee06d569f34ad0d9775bf369b0906107fe908390610ecf565b610b7061271082106000805160206113fb83398151915271496e76616c6964206c6f776572206564676560701b6106cc565b60038190556040517fe5d8954a6f6cd82676f6d093c48e3fcec885de57b0a0f9f2a279d994baa39f40906107fe908390610ecf565b6060600082604051602001610bba9190611365565b60408051601f19818403018152919052905060205b8015610c255780610bdf8161137a565b915050818181518110610bf457610bf4611391565b01602001516001600160f81b03191615610c20576000610c1582600161131f565b835250909392505050565b610bcf565b5060408051600080825260208201909252905b509392505050565b60408051602a80825260608281019093526001600160a01b03841691600091602082018180368337019050509050603060f81b81600081518110610c8657610c86611391565b60200101906001600160f81b031916908160001a905350607860f81b81600181518110610cb557610cb5611391565b60200101906001600160f81b031916908160001a90535060005b6014811015610c38576000610ce58260026112d6565b9050610cf3600f8516610e9d565b83610cff8360296113a7565b81518110610d0f57610d0f611391565b60200101906001600160f81b031916908160001a905350600484901c9350610d39600f8516610e9d565b83610d458360286113a7565b81518110610d5557610d55611391565b60200101906001600160f81b031916908160001a9053505060049290921c9180610d7e816113be565b915050610ccf565b600080600960009054906101000a90046001600160a01b03166001600160a01b03166301e1d1146040518163ffffffff1660e01b815260040160206040518083038186803b158015610dd757600080fd5b505afa158015610deb573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610e0f91906113d9565b600960009054906101000a90046001600160a01b03166001600160a01b03166318160ddd6040518163ffffffff1660e01b815260040160206040518083038186803b158015610e5d57600080fd5b505afa158015610e71573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610e9591906113d9565b915091509091565b6000600a821015610ebc57610eb360308361131f565b60f81b92915050565b610eb360578361131f565b805b82525050565b60208101610edd8284610ec7565b92915050565b60006001600160a01b038216610edd565b610efd81610ee3565b81146106c957600080fd5b8035610edd81610ef4565b600060208284031215610f2857610f28600080fd5b6000610f348484610f08565b949350505050565b6000610edd82610ee3565b6000610edd82610f3c565b610ec981610f47565b60208101610edd8284610f52565b610ec981610ee3565b60208101610edd8284610f69565b80610efd565b8035610edd81610f80565b600060208284031215610fa657610fa6600080fd5b6000610f348484610f86565b805160208301906107758482610ec7565b60208101610edd8284610fb2565b60008083601f840112610fe657610fe6600080fd5b50813567ffffffffffffffff81111561100157611001600080fd5b60208301915083600182028301111561055b5761055b600080fd5b6000806020838503121561103257611032600080fd5b823567ffffffffffffffff81111561104c5761104c600080fd5b61105885828601610fd1565b92509250509250929050565b801515610ec9565b60005b8381101561108757818101518382015260200161106f565b838111156107755750506000910152565b60006110a2825190565b8084526020840193506110b981856020860161106c565b601f01601f19169290920192915050565b604081016110d88285611064565b8181036020830152610f348184611098565b8051610edd81610ef4565b60006020828403121561110a5761110a600080fd5b6000610f3484846110ea565b6000611120825190565b61112e81856020860161106c565b9290920192915050565b6001600160f01b03198116610ec9565b60006111548286611116565b91506111608285611138565b6002820191506111708284611116565b95945050505050565b6020808252810161118a8184611098565b9392505050565b6001600160f81b03198116610ec9565b60006111ad8289611116565b91506111b98288611138565b6002820191506111c98287611116565b91506111d58286611138565b6002820191506111e58285611116565b91506111f18284611191565b506001019695505050505050565b634e487b7160e01b600052604160045260246000fd5b601f19601f830116810181811067ffffffffffffffff8211171561123b5761123b6111ff565b6040525050565b600061124d60405190565b90506112598282611215565b919050565b8051610edd81610f80565b60006020828403121561127e5761127e600080fd5b6112886020611242565b90506000611296848461125e565b82525092915050565b6000602082840312156112b4576112b4600080fd5b6000610f348484611269565b634e487b7160e01b600052601160045260246000fd5b60008160001904831182151516156112f0576112f06112c0565b500290565b634e487b7160e01b600052601260045260246000fd5b60008261131a5761131a6112f5565b500490565b60008219821115611332576113326112c0565b500190565b606081016113458286610ec7565b6113526020830185610ec7565b610f346040830184610ec7565b80610ec9565b6000611371828461135f565b50602001919050565b600081611389576113896112c0565b506000190190565b634e487b7160e01b600052603260045260246000fd5b6000828210156113b9576113b96112c0565b500390565b60006000198214156113d2576113d26112c0565b5060010190565b6000602082840312156113ee576113ee600080fd5b6000610f34848461125e56fe436861696e6c696e6b4175746f6d6174696f6e50726963654f7261636c650000a26469706673582212207bdda535c22cabdba6fc3bf24e180acf44996caeb6c6af8cc264a434453dba8664736f6c63430008090033436861696e6c696e6b4175746f6d6174696f6e50726963654f7261636c650000";

type TestChainlinkAutomationPriceOracleConstructorParams =
  | [signer?: Signer]
  | ConstructorParameters<typeof ContractFactory>;

const isSuperArgs = (
  xs: TestChainlinkAutomationPriceOracleConstructorParams
): xs is ConstructorParameters<typeof ContractFactory> => xs.length > 1;

export class TestChainlinkAutomationPriceOracle__factory extends ContractFactory {
  constructor(...args: TestChainlinkAutomationPriceOracleConstructorParams) {
    if (isSuperArgs(args)) {
      super(...args);
    } else {
      super(_abi, _bytecode, args[0]);
    }
  }

  override deploy(
    _dolomiteMargin: string,
    _chainlinkRegistry: string,
    _token: string,
    _marketId: BigNumberish,
    overrides?: Overrides & { from?: string }
  ): Promise<TestChainlinkAutomationPriceOracle> {
    return super.deploy(
      _dolomiteMargin,
      _chainlinkRegistry,
      _token,
      _marketId,
      overrides || {}
    ) as Promise<TestChainlinkAutomationPriceOracle>;
  }
  override getDeployTransaction(
    _dolomiteMargin: string,
    _chainlinkRegistry: string,
    _token: string,
    _marketId: BigNumberish,
    overrides?: Overrides & { from?: string }
  ): TransactionRequest {
    return super.getDeployTransaction(
      _dolomiteMargin,
      _chainlinkRegistry,
      _token,
      _marketId,
      overrides || {}
    );
  }
  override attach(address: string): TestChainlinkAutomationPriceOracle {
    return super.attach(address) as TestChainlinkAutomationPriceOracle;
  }
  override connect(
    signer: Signer
  ): TestChainlinkAutomationPriceOracle__factory {
    return super.connect(signer) as TestChainlinkAutomationPriceOracle__factory;
  }

  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): TestChainlinkAutomationPriceOracleInterface {
    return new utils.Interface(
      _abi
    ) as TestChainlinkAutomationPriceOracleInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): TestChainlinkAutomationPriceOracle {
    return new Contract(
      address,
      _abi,
      signerOrProvider
    ) as TestChainlinkAutomationPriceOracle;
  }
}