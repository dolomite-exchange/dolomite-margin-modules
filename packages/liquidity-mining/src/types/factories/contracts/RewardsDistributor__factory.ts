/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import type { Provider, TransactionRequest } from "@ethersproject/providers";
import type {
  RewardsDistributor,
  RewardsDistributorInterface,
} from "../../contracts/RewardsDistributor";

const _abi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_dolomiteMargin",
        type: "address",
      },
      {
        internalType: "contract IOARB",
        name: "_oARB",
        type: "address",
      },
      {
        internalType: "address[]",
        name: "_initialHandlers",
        type: "address[]",
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
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "epoch",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "Claimed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "handler",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "isHandler",
        type: "bool",
      },
    ],
    name: "HandlerSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "epoch",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "bytes32",
        name: "merkleRoot",
        type: "bytes32",
      },
    ],
    name: "MerkleRootSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "contract IOARB",
        name: "oARB",
        type: "address",
      },
    ],
    name: "OARBSet",
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
    inputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "epoch",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "amount",
            type: "uint256",
          },
          {
            internalType: "bytes32[]",
            name: "proof",
            type: "bytes32[]",
          },
        ],
        internalType: "struct IRewardsDistributor.ClaimInfo[]",
        name: "_claimInfo",
        type: "tuple[]",
      },
    ],
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_user",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "_epoch",
        type: "uint256",
      },
    ],
    name: "getClaimStatusByUserAndEpoch",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_epoch",
        type: "uint256",
      },
    ],
    name: "getMerkleRootByEpoch",
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
        internalType: "uint256",
        name: "_epoch",
        type: "uint256",
      },
      {
        internalType: "bytes32",
        name: "_merkleRoot",
        type: "bytes32",
      },
    ],
    name: "handlerSetMerkleRoot",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_from",
        type: "address",
      },
    ],
    name: "isHandler",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "oARB",
    outputs: [
      {
        internalType: "contract IOARB",
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
        name: "_handler",
        type: "address",
      },
      {
        internalType: "bool",
        name: "_isHandler",
        type: "bool",
      },
    ],
    name: "ownerSetHandler",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_epoch",
        type: "uint256",
      },
      {
        internalType: "bytes32",
        name: "_merkleRoot",
        type: "bytes32",
      },
    ],
    name: "ownerSetMerkleRoot",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "contract IOARB",
        name: "_oARB",
        type: "address",
      },
    ],
    name: "ownerSetOARB",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const _bytecode =
  "0x60a06040523480156200001157600080fd5b50604051620016ee380380620016ee833981016040819052620000349162000295565b6001600160a01b03838116608052600080546001600160a01b0319169184169190911781555b8151811015620000a657620000938282815181106200007d576200007d62000309565b60200260200101516001620000b060201b60201c565b6200009e8162000335565b90506200005a565b5050505062000362565b6001600160a01b03821660008181526001602052604090819020805460ff1916841515179055517f6cc67219f62a9e5d66cc9f2a62e16634cffcf48facd698a829bafcc1ad2c5c83906200010690849062000353565b60405180910390a25050565b60006001600160a01b0382165b92915050565b620001308162000112565b81146200013c57600080fd5b50565b80516200011f8162000125565b60006200011f8262000112565b62000130816200014c565b80516200011f8162000159565b634e487b7160e01b600052604160045260246000fd5b601f19601f83011681018181106001600160401b0382111715620001af57620001af62000171565b6040525050565b6000620001c260405190565b9050620001d0828262000187565b919050565b60006001600160401b03821115620001f157620001f162000171565b5060209081020190565b6000620002126200020c84620001d5565b620001b6565b83815290506020808201908402830185811115620002335762000233600080fd5b835b818110156200025b57806200024b88826200013f565b8452506020928301920162000235565b5050509392505050565b600082601f8301126200027b576200027b600080fd5b81516200028d848260208601620001fb565b949350505050565b600080600060608486031215620002af57620002af600080fd5b6000620002bd86866200013f565b9350506020620002d08682870162000164565b92505060408401516001600160401b03811115620002f157620002f1600080fd5b620002ff8682870162000265565b9150509250925092565b634e487b7160e01b600052603260045260246000fd5b634e487b7160e01b600052601160045260246000fd5b60006000198214156200034c576200034c6200031f565b5060010190565b8115158152602081016200011f565b60805161135c620003926000396000818160a5015281816104f8015281816105df0152610613015261135c6000f3fe608060405234801561001057600080fd5b506004361061009e5760003560e01c806355cdccc61161006657806355cdccc61461014f57806385ba681114610162578063971d911a1461018f578063e8616b24146101a2578063fa898843146101b557600080fd5b806315c14a4a146100a357806317891c27146100db5780633b718dc6146100f057806346ea87af14610103578063540aa27d1461013c575b600080fd5b7f00000000000000000000000000000000000000000000000000000000000000005b6040516100d29190610d09565b60405180910390f35b6100ee6100e9366004610d32565b6101c8565b005b6100ee6100fe366004610dc1565b610223565b61012f610111366004610e1d565b6001600160a01b031660009081526001602052604090205460ff1690565b6040516100d29190610e46565b61012f61014a366004610e54565b6104c4565b6100ee61015d366004610d32565b6104f2565b610182610170366004610e76565b60009081526002602052604090205490565b6040516100d29190610e9d565b6100ee61019d366004610ebe565b6105d9565b6000546100c5906001600160a01b031681565b6100ee6101c3366004610f05565b61060d565b336000818152600160205260409020546102149060ff16712932bbb0b93239a234b9ba3934b13aba37b960711b7413db9b1e481a185b991b195c8818d85b8818d85b1b605a1b8461068e565b61021e8383610703565b505050565b8060005b818110156104be5761029161025e85858481811061024757610247610f26565b90506020028101906102599190610f3c565b610746565b712932bbb0b93239a234b9ba3934b13aba37b960711b7324b73b30b634b21036b2b935b63290383937b7b360611b6107a9565b33600090815260036020526040812061030c918686858181106102b6576102b6610f26565b90506020028101906102c89190610f3c565b35815260208101919091526040016000205460ff1615712932bbb0b93239a234b9ba3934b13aba37b960711b6e105b1c9958591e4818db185a5b5959608a1b6107a9565b33600090815260036020526040812060019186868581811061033057610330610f26565b90506020028101906103429190610f3c565b35815260208101919091526040016000908120805460ff191692151592909217909155546001600160a01b031663a0712d6885858481811061038657610386610f26565b90506020028101906103989190610f3c565b602001356040518263ffffffff1660e01b81526004016103b89190610e9d565b600060405180830381600087803b1580156103d257600080fd5b505af11580156103e6573d6000803e3d6000fd5b505050506104293385858481811061040057610400610f26565b90506020028101906104129190610f3c565b6000546001600160a01b03169190602001356107d8565b337f987d620f307ff6b94d58743cb7a7509f24071586a77759b77c2d4e29f75a2f9a85858481811061045d5761045d610f26565b905060200281019061046f9190610f3c565b3586868581811061048257610482610f26565b90506020028101906104949190610f3c565b602001356040516104a6929190610f60565b60405180910390a26104b781610f91565b9050610227565b50505050565b6001600160a01b038216600090815260036020908152604080832084845290915290205460ff165b92915050565b336102147f00000000000000000000000000000000000000000000000000000000000000005b6001600160a01b0316638da5cb5b6040518163ffffffff1660e01b815260040160206040518083038186803b15801561055057600080fd5b505afa158015610564573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906105889190610fb7565b6001600160a01b0316826001600160a01b0316147127b7363ca237b637b6b4ba32a6b0b933b4b760711b7f43616c6c6572206973206e6f74206f776e6572206f6620446f6c6f6d697465008461068e565b336106037f0000000000000000000000000000000000000000000000000000000000000000610518565b61021e838361082e565b336106377f0000000000000000000000000000000000000000000000000000000000000000610518565b600080546001600160a01b0319166001600160a01b0384161790556040517fcf3117cdd360b80afde7697abd040d86b9a7603c5927e3176e32f24e5bd94c9290610682908490610d09565b60405180910390a15050565b836104be5761069c8361088e565b6101d160f51b6106ab8461088e565b61080f60f21b6106ba85610929565b6040516106d4959493929190601f60f91b90602001611046565b60408051601f198184030181529082905262461bcd60e51b82526106fa916004016110d6565b60405180910390fd5b60008281526002602052604090819020829055517fb04b7d6145a7588fdcf339a22877d5965f861c171204fc37688058c5f6c06d3b906106829084908490610f60565b6000803383602001356040516020016107609291906110f0565b6040516020818303038152906040528051906020012090506107a283806040019061078b91906110fe565b853560009081526002602052604090205484610a6f565b9392505050565b8261021e576107b78261088e565b6101d160f51b6107c68361088e565b6040516020016106d49392919061115b565b61021e8363a9059cbb60e01b84846040516024016107f79291906110f0565b60408051601f198184030181529190526020810180516001600160e01b03166001600160e01b031990931692909217909152610a89565b6001600160a01b03821660008181526001602052604090819020805460ff1916841515179055517f6cc67219f62a9e5d66cc9f2a62e16634cffcf48facd698a829bafcc1ad2c5c8390610882908490610e46565b60405180910390a25050565b60606000826040516020016108a3919061118c565b60408051601f19818403018152919052905060205b801561090e57806108c8816111a1565b9150508181815181106108dd576108dd610f26565b01602001516001600160f81b031916156109095760006108fe8260016111b8565b835250909392505050565b6108b8565b5060408051600080825260208201909252905b509392505050565b60408051602a80825260608281019093526001600160a01b03841691600091602082018180368337019050509050603060f81b8160008151811061096f5761096f610f26565b60200101906001600160f81b031916908160001a905350607860f81b8160018151811061099e5761099e610f26565b60200101906001600160f81b031916908160001a90535060005b60148110156109215760006109ce8260026111d0565b90506109dc600f8516610b1b565b836109e88360296111ef565b815181106109f8576109f8610f26565b60200101906001600160f81b031916908160001a905350600484901c9350610a22600f8516610b1b565b83610a2e8360286111ef565b81518110610a3e57610a3e610f26565b60200101906001600160f81b031916908160001a9053505060049290921c9180610a6781610f91565b9150506109b8565b600082610a7d868685610b45565b1490505b949350505050565b6000610ade826040518060400160405280602081526020017f5361666545524332303a206c6f772d6c6576656c2063616c6c206661696c6564815250856001600160a01b0316610b919092919063ffffffff16565b9050805160001480610aff575080806020019051810190610aff9190611211565b61021e5760405162461bcd60e51b81526004016106fa9061127c565b6000600a821015610b3a57610b316030836111b8565b60f81b92915050565b610b316057836111b8565b600081815b84811015610b8857610b7482878784818110610b6857610b68610f26565b90506020020135610ba0565b915080610b8081610f91565b915050610b4a565b50949350505050565b6060610a818484600085610bcc565b6000818310610bbc5760008281526020849052604090206107a2565b5060009182526020526040902090565b606082471015610bee5760405162461bcd60e51b81526004016106fa906112cf565b600080866001600160a01b03168587604051610c0a91906112df565b60006040518083038185875af1925050503d8060008114610c47576040519150601f19603f3d011682016040523d82523d6000602084013e610c4c565b606091505b5091509150610c5d87838387610c68565b979650505050505050565b60608315610ca4578251610c9d576001600160a01b0385163b610c9d5760405162461bcd60e51b81526004016106fa906112eb565b5081610a81565b610a818383815115610cb95781518083602001fd5b8060405162461bcd60e51b81526004016106fa91906110d6565b60006001600160a01b0382166104ec565b60006104ec82610cd3565b60006104ec82610ce4565b610d0381610cef565b82525050565b602081016104ec8284610cfa565b805b8114610d2457600080fd5b50565b80356104ec81610d17565b60008060408385031215610d4857610d48600080fd5b6000610d548585610d27565b9250506020610d6585828601610d27565b9150509250929050565b60008083601f840112610d8457610d84600080fd5b50813567ffffffffffffffff811115610d9f57610d9f600080fd5b602083019150836020820283011115610dba57610dba600080fd5b9250929050565b60008060208385031215610dd757610dd7600080fd5b823567ffffffffffffffff811115610df157610df1600080fd5b610dfd85828601610d6f565b92509250509250929050565b610d1981610cd3565b80356104ec81610e09565b600060208284031215610e3257610e32600080fd5b6000610a818484610e12565b801515610d03565b602081016104ec8284610e3e565b60008060408385031215610e6a57610e6a600080fd5b6000610d548585610e12565b600060208284031215610e8b57610e8b600080fd5b6000610a818484610d27565b80610d03565b602081016104ec8284610e97565b801515610d19565b80356104ec81610eab565b60008060408385031215610ed457610ed4600080fd5b6000610ee08585610e12565b9250506020610d6585828601610eb3565b610d1981610ce4565b80356104ec81610ef1565b600060208284031215610f1a57610f1a600080fd5b6000610a818484610efa565b634e487b7160e01b600052603260045260246000fd5b60008235605e1936849003018112610f5657610f56600080fd5b9190910192915050565b60408101610f6e8285610e97565b6107a26020830184610e97565b634e487b7160e01b600052601160045260246000fd5b6000600019821415610fa557610fa5610f7b565b5060010190565b80516104ec81610e09565b600060208284031215610fcc57610fcc600080fd5b6000610a818484610fac565b60005b83811015610ff3578181015183820152602001610fdb565b838111156104be5750506000910152565b600061100e825190565b61101c818560208601610fd8565b9290920192915050565b6001600160f01b03198116610d03565b6001600160f81b03198116610d03565b60006110528289611004565b915061105e8288611026565b60028201915061106e8287611004565b915061107a8286611026565b60028201915061108a8285611004565b91506110968284611036565b506001019695505050505050565b60006110ae825190565b8084526020840193506110c5818560208601610fd8565b601f01601f19169290920192915050565b602080825281016107a281846110a4565b610d0381610cd3565b60408101610f6e82856110e7565b6000808335601e193685900301811261111957611119600080fd5b80840192508235915067ffffffffffffffff82111561113a5761113a600080fd5b6020928301928202360383131561115357611153600080fd5b509250929050565b60006111678286611004565b91506111738285611026565b6002820191506111838284611004565b95945050505050565b60006111988284610e97565b50602001919050565b6000816111b0576111b0610f7b565b506000190190565b600082198211156111cb576111cb610f7b565b500190565b60008160001904831182151516156111ea576111ea610f7b565b500290565b60008282101561120157611201610f7b565b500390565b80516104ec81610eab565b60006020828403121561122657611226600080fd5b6000610a818484611206565b602a81526000602082017f5361666545524332303a204552433230206f7065726174696f6e20646964206e8152691bdd081cdd58d8d9595960b21b602082015291505b5060400190565b602080825281016104ec81611232565b602681526000602082017f416464726573733a20696e73756666696369656e742062616c616e636520666f8152651c8818d85b1b60d21b60208201529150611275565b602080825281016104ec8161128c565b60006107a28284611004565b602080825281016104ec81601d81527f416464726573733a2063616c6c20746f206e6f6e2d636f6e747261637400000060208201526040019056fea2646970667358221220a820f078263d6b3f4ce748056ac6f5bda32bc4811dd6a944cd1bc410b8b4767d64736f6c63430008090033";

type RewardsDistributorConstructorParams =
  | [signer?: Signer]
  | ConstructorParameters<typeof ContractFactory>;

const isSuperArgs = (
  xs: RewardsDistributorConstructorParams
): xs is ConstructorParameters<typeof ContractFactory> => xs.length > 1;

export class RewardsDistributor__factory extends ContractFactory {
  constructor(...args: RewardsDistributorConstructorParams) {
    if (isSuperArgs(args)) {
      super(...args);
    } else {
      super(_abi, _bytecode, args[0]);
    }
  }

  override deploy(
    _dolomiteMargin: string,
    _oARB: string,
    _initialHandlers: string[],
    overrides?: Overrides & { from?: string }
  ): Promise<RewardsDistributor> {
    return super.deploy(
      _dolomiteMargin,
      _oARB,
      _initialHandlers,
      overrides || {}
    ) as Promise<RewardsDistributor>;
  }
  override getDeployTransaction(
    _dolomiteMargin: string,
    _oARB: string,
    _initialHandlers: string[],
    overrides?: Overrides & { from?: string }
  ): TransactionRequest {
    return super.getDeployTransaction(
      _dolomiteMargin,
      _oARB,
      _initialHandlers,
      overrides || {}
    );
  }
  override attach(address: string): RewardsDistributor {
    return super.attach(address) as RewardsDistributor;
  }
  override connect(signer: Signer): RewardsDistributor__factory {
    return super.connect(signer) as RewardsDistributor__factory;
  }

  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): RewardsDistributorInterface {
    return new utils.Interface(_abi) as RewardsDistributorInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): RewardsDistributor {
    return new Contract(address, _abi, signerOrProvider) as RewardsDistributor;
  }
}