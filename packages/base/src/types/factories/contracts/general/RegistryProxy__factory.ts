/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import {
  Signer,
  utils,
  Contract,
  ContractFactory,
  BytesLike,
  Overrides,
} from "ethers";
import type { Provider, TransactionRequest } from "@ethersproject/providers";
import type {
  RegistryProxy,
  RegistryProxyInterface,
} from "../../../contracts/general/RegistryProxy";

const _abi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_implementation",
        type: "address",
      },
      {
        internalType: "address",
        name: "_dolomiteMargin",
        type: "address",
      },
      {
        internalType: "bytes",
        name: "_initializationCalldata",
        type: "bytes",
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
        name: "implementation",
        type: "address",
      },
    ],
    name: "ImplementationSet",
    type: "event",
  },
  {
    stateMutability: "nonpayable",
    type: "fallback",
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
    inputs: [
      {
        internalType: "address",
        name: "_newImplementation",
        type: "address",
      },
    ],
    name: "upgradeTo",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_newImplementation",
        type: "address",
      },
      {
        internalType: "bytes",
        name: "_upgradeCalldata",
        type: "bytes",
      },
    ],
    name: "upgradeToAndCall",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const _bytecode =
  "0x60806040523480156200001157600080fd5b50604051620012e4380380620012e4833981016040819052620000349162000546565b6200003f836200008e565b6200004a8262000147565b62000084620000586200017b565b82604051806060016040528060248152602001620012a060249139620001a660201b620002bb1760201c565b505050506200075a565b620000eb620000a8826200022560201b620003331760201c565b6c526567697374727950726f787960981b7f496d706c656d656e746174696f6e206973206e6f74206120636f6e74726163746200023460201b620003421760201c565b620001106200010b6001600080516020620012c4833981519152620005d0565b829055565b6040516001600160a01b038216907fab64f92ab780ecbf4f3866f57cee465ff36c89450dcce20237ca7a8d81fb7d1390600090a250565b620001786200010b60017f01095cd170b13c49f67c675e3bc004094df00c531fa118e86b230655aba7aa17620005d0565b50565b6000620001a16200019d6001600080516020620012c4833981519152620005d0565b5490565b905090565b6060600080856001600160a01b031685604051620001c591906200060f565b600060405180830381855af49150503d806000811462000202576040519150601f19603f3d011682016040523d82523d6000602084013e62000207565b606091505b5090925090506200021b86838387620002a0565b9695505050505050565b6001600160a01b03163b151590565b826200029b576200024582620002f6565b6101d160f51b6200025683620002f6565b6040516020016200026a9392919062000636565b60408051601f198184030181529082905262461bcd60e51b82526200029291600401620006a2565b60405180910390fd5b505050565b60608315620002e2578251620002da576001600160a01b0385163b620002da5760405162461bcd60e51b81526004016200029290620006b5565b5081620002ee565b620002ee8383620003b5565b949350505050565b60606000826040516020016200030d9190620006f8565b60408051601f19818403018152919052905060205b80156200039a578062000335816200070f565b9150508181815181106200034d576200034d62000729565b01602001517fff00000000000000000000000000000000000000000000000000000000000000161562000394576000620003898260016200073f565b835250909392505050565b62000322565b5060408051600080825260208201909252905b509392505050565b815115620003c65781518083602001fd5b8060405162461bcd60e51b8152600401620002929190620006a2565b60006001600160a01b0382165b92915050565b6200040081620003e2565b81146200017857600080fd5b8051620003ef81620003f5565b634e487b7160e01b600052604160045260246000fd5b601f19601f83011681018181106001600160401b038211171562000457576200045762000419565b6040525050565b60006200046a60405190565b90506200047882826200042f565b919050565b60006001600160401b0382111562000499576200049962000419565b601f19601f83011660200192915050565b60005b83811015620004c7578181015183820152602001620004ad565b83811115620004d7576000848401525b50505050565b6000620004f4620004ee846200047d565b6200045e565b905082815260208101848484011115620005115762000511600080fd5b620003ad848285620004aa565b600082601f830112620005345762000534600080fd5b8151620002ee848260208601620004dd565b600080600060608486031215620005605762000560600080fd5b60006200056e86866200040c565b935050602062000581868287016200040c565b92505060408401516001600160401b03811115620005a257620005a2600080fd5b620005b0868287016200051e565b9150509250925092565b634e487b7160e01b600052601160045260246000fd5b600082821015620005e557620005e5620005ba565b500390565b6000620005f5825190565b62000605818560208601620004aa565b9290920192915050565b60006200061d8284620005ea565b9392505050565b6001600160f01b031981165b82525050565b6000620006448286620005ea565b915062000652828562000624565b600282019150620006648284620005ea565b95945050505050565b600062000678825190565b80845260208401935062000691818560208601620004aa565b601f01601f19169290920192915050565b602080825281016200061d81846200066d565b60208082528101620003ef81601d81527f416464726573733a2063616c6c20746f206e6f6e2d636f6e7472616374000000602082015260400190565b8062000630565b6000620007068284620006f1565b50602001919050565b600081620007215762000721620005ba565b506000190190565b634e487b7160e01b600052603260045260246000fd5b60008219821115620007555762000755620005ba565b500190565b610b36806200076a6000396000f3fe608060405234801561001057600080fd5b506004361061004c5760003560e01c806315c14a4a1461005e5780633659cfe61461007c5780634f1ef2861461008f5780635c60da1b146100a2575b61005c6100576100b7565b6100f0565b005b610066610119565b6040516100739190610758565b60405180910390f35b61005c61008a366004610799565b610149565b61005c61009d36600461080c565b610223565b6100aa6100b7565b6040516100739190610871565b60006100eb6100e760017f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbd610895565b5490565b905090565b3660008037600080366000845af43d6000803e80801561010f573d6000f35b3d6000fd5b505050565b60006100eb6100e760017f01095cd170b13c49f67c675e3bc004094df00c531fa118e86b230655aba7aa17610895565b33610216610155610119565b6001600160a01b0316638da5cb5b6040518163ffffffff1660e01b815260040160206040518083038186803b15801561018d57600080fd5b505afa1580156101a1573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906101c591906108b7565b6001600160a01b0316826001600160a01b0316147127b7363ca237b637b6b4ba32a6b0b933b4b760711b7f43616c6c6572206973206e6f74206f776e6572206f6620446f6c6f6d69746500846103a0565b61021f826103ec565b5050565b3361022f610155610119565b610238846103ec565b6102b46102436100b7565b84848080601f0160208091040260200160405190810160405280939291908181526020018383808284376000920191909152505060408051808201909152601d81527f526567697374727950726f78793a2055706772616465206661696c6564000000602082015291506102bb9050565b5050505050565b6060600080856001600160a01b0316856040516102d89190610926565b600060405180830381855af49150503d8060008114610313576040519150601f19603f3d011682016040523d82523d6000602084013e610318565b606091505b50915091506103298683838761049d565b9695505050505050565b6001600160a01b03163b151590565b8261011457610350826104eb565b6101d160f51b61035f836104eb565b60405160200161037193929190610949565b60408051601f198184030181529082905262461bcd60e51b8252610397916004016109ac565b60405180910390fd5b836103e6576103ae836104eb565b6101d160f51b6103bd846104eb565b61080f60f21b6103cc85610586565b604051610371959493929190601f60f91b906020016109cd565b50505050565b6104336001600160a01b0382163b15156c526567697374727950726f787960981b7f496d706c656d656e746174696f6e206973206e6f74206120636f6e7472616374610342565b61046661046160017f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbd610895565b829055565b6040516001600160a01b038216907fab64f92ab780ecbf4f3866f57cee465ff36c89450dcce20237ca7a8d81fb7d1390600090a250565b606083156104d95782516104d2576001600160a01b0385163b6104d25760405162461bcd60e51b815260040161039790610a2b565b50816104e3565b6104e383836106cc565b949350505050565b60606000826040516020016105009190610a6c565b60408051601f19818403018152919052905060205b801561056b578061052581610a81565b91505081818151811061053a5761053a610a98565b01602001516001600160f81b0319161561056657600061055b826001610aae565b835250909392505050565b610515565b5060408051600080825260208201909252905b509392505050565b60408051602a80825260608281019093526001600160a01b03841691600091602082018180368337019050509050603060f81b816000815181106105cc576105cc610a98565b60200101906001600160f81b031916908160001a905350607860f81b816001815181106105fb576105fb610a98565b60200101906001600160f81b031916908160001a90535060005b601481101561057e57600061062b826002610ac6565b9050610639600f85166106f6565b83610645836029610895565b8151811061065557610655610a98565b60200101906001600160f81b031916908160001a905350600484901c935061067f600f85166106f6565b8361068b836028610895565b8151811061069b5761069b610a98565b60200101906001600160f81b031916908160001a9053505060049290921c91806106c481610ae5565b915050610615565b8151156106dc5781518083602001fd5b8060405162461bcd60e51b815260040161039791906109ac565b6000600a8210156107155761070c603083610aae565b60f81b92915050565b61070c605783610aae565b60006001600160a01b0382165b92915050565b600061072d82610720565b600061072d82610733565b6107528161073e565b82525050565b6020810161072d8284610749565b60006001600160a01b03821661072d565b61078081610766565b811461078b57600080fd5b50565b803561072d81610777565b6000602082840312156107ae576107ae600080fd5b60006104e3848461078e565b60008083601f8401126107cf576107cf600080fd5b50813567ffffffffffffffff8111156107ea576107ea600080fd5b60208301915083600182028301111561080557610805600080fd5b9250929050565b60008060006040848603121561082457610824600080fd5b6000610830868661078e565b935050602084013567ffffffffffffffff81111561085057610850600080fd5b61085c868287016107ba565b92509250509250925092565b61075281610766565b6020810161072d8284610868565b634e487b7160e01b600052601160045260246000fd5b6000828210156108a7576108a761087f565b500390565b805161072d81610777565b6000602082840312156108cc576108cc600080fd5b60006104e384846108ac565b60005b838110156108f35781810151838201526020016108db565b838111156103e65750506000910152565b600061090e825190565b61091c8185602086016108d8565b9290920192915050565b60006109328284610904565b9392505050565b6001600160f01b03198116610752565b60006109558286610904565b91506109618285610939565b6002820191506109718284610904565b95945050505050565b6000610984825190565b80845260208401935061099b8185602086016108d8565b601f01601f19169290920192915050565b60208082528101610932818461097a565b6001600160f81b03198116610752565b60006109d98289610904565b91506109e58288610939565b6002820191506109f58287610904565b9150610a018286610939565b600282019150610a118285610904565b9150610a1d82846109bd565b506001019695505050505050565b6020808252810161072d81601d81527f416464726573733a2063616c6c20746f206e6f6e2d636f6e7472616374000000602082015260400190565b80610752565b6000610a788284610a66565b50602001919050565b600081610a9057610a9061087f565b506000190190565b634e487b7160e01b600052603260045260246000fd5b60008219821115610ac157610ac161087f565b500190565b6000816000190483118215151615610ae057610ae061087f565b500290565b6000600019821415610af957610af961087f565b506001019056fea26469706673582212206f59e024c78d2be3cc3bb62ff0ed9c20d520c7394447c25b0edbc2a9ca1cc80564736f6c63430008090033526567697374727950726f78793a20496e697469616c697a6174696f6e206661696c6564360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbd";

type RegistryProxyConstructorParams =
  | [signer?: Signer]
  | ConstructorParameters<typeof ContractFactory>;

const isSuperArgs = (
  xs: RegistryProxyConstructorParams
): xs is ConstructorParameters<typeof ContractFactory> => xs.length > 1;

export class RegistryProxy__factory extends ContractFactory {
  constructor(...args: RegistryProxyConstructorParams) {
    if (isSuperArgs(args)) {
      super(...args);
    } else {
      super(_abi, _bytecode, args[0]);
    }
  }

  override deploy(
    _implementation: string,
    _dolomiteMargin: string,
    _initializationCalldata: BytesLike,
    overrides?: Overrides & { from?: string }
  ): Promise<RegistryProxy> {
    return super.deploy(
      _implementation,
      _dolomiteMargin,
      _initializationCalldata,
      overrides || {}
    ) as Promise<RegistryProxy>;
  }
  override getDeployTransaction(
    _implementation: string,
    _dolomiteMargin: string,
    _initializationCalldata: BytesLike,
    overrides?: Overrides & { from?: string }
  ): TransactionRequest {
    return super.getDeployTransaction(
      _implementation,
      _dolomiteMargin,
      _initializationCalldata,
      overrides || {}
    );
  }
  override attach(address: string): RegistryProxy {
    return super.attach(address) as RegistryProxy;
  }
  override connect(signer: Signer): RegistryProxy__factory {
    return super.connect(signer) as RegistryProxy__factory;
  }

  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): RegistryProxyInterface {
    return new utils.Interface(_abi) as RegistryProxyInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): RegistryProxy {
    return new Contract(address, _abi, signerOrProvider) as RegistryProxy;
  }
}