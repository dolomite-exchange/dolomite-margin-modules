/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
  BaseContract,
  BigNumber,
  BigNumberish,
  BytesLike,
  CallOverrides,
  ContractTransaction,
  Overrides,
  PopulatedTransaction,
  Signer,
  utils,
} from "ethers";
import type { FunctionFragment, Result } from "@ethersproject/abi";
import type { Listener, Provider } from "@ethersproject/providers";
import type {
  TypedEventFilter,
  TypedEvent,
  TypedListener,
  OnEvent,
} from "../../common";

export declare namespace IJonesWhitelistController {
  export type RoleInfoStruct = {
    jGLP_BYPASS_CAP: boolean;
    jUSDC_BYPASS_TIME: boolean;
    jGLP_RETENTION: BigNumberish;
    jUSDC_RETENTION: BigNumberish;
  };

  export type RoleInfoStructOutput = [
    boolean,
    boolean,
    BigNumber,
    BigNumber
  ] & {
    jGLP_BYPASS_CAP: boolean;
    jUSDC_BYPASS_TIME: boolean;
    jGLP_RETENTION: BigNumber;
    jUSDC_RETENTION: BigNumber;
  };
}

export interface IJonesWhitelistControllerInterface extends utils.Interface {
  functions: {
    "BASIS_POINTS()": FunctionFragment;
    "addToRole(bytes32,address)": FunctionFragment;
    "addToWhitelistContracts(address)": FunctionFragment;
    "createRole(bytes32,(bool,bool,uint256,uint256))": FunctionFragment;
    "getRoleInfo(bytes32)": FunctionFragment;
    "getUserRole(address)": FunctionFragment;
    "isWhitelistedContract(address)": FunctionFragment;
    "owner()": FunctionFragment;
    "removeFromWhitelistContract(address)": FunctionFragment;
    "removeUserFromRole(address)": FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | "BASIS_POINTS"
      | "addToRole"
      | "addToWhitelistContracts"
      | "createRole"
      | "getRoleInfo"
      | "getUserRole"
      | "isWhitelistedContract"
      | "owner"
      | "removeFromWhitelistContract"
      | "removeUserFromRole"
  ): FunctionFragment;

  encodeFunctionData(
    functionFragment: "BASIS_POINTS",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "addToRole",
    values: [BytesLike, string]
  ): string;
  encodeFunctionData(
    functionFragment: "addToWhitelistContracts",
    values: [string]
  ): string;
  encodeFunctionData(
    functionFragment: "createRole",
    values: [BytesLike, IJonesWhitelistController.RoleInfoStruct]
  ): string;
  encodeFunctionData(
    functionFragment: "getRoleInfo",
    values: [BytesLike]
  ): string;
  encodeFunctionData(functionFragment: "getUserRole", values: [string]): string;
  encodeFunctionData(
    functionFragment: "isWhitelistedContract",
    values: [string]
  ): string;
  encodeFunctionData(functionFragment: "owner", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "removeFromWhitelistContract",
    values: [string]
  ): string;
  encodeFunctionData(
    functionFragment: "removeUserFromRole",
    values: [string]
  ): string;

  decodeFunctionResult(
    functionFragment: "BASIS_POINTS",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "addToRole", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "addToWhitelistContracts",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "createRole", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "getRoleInfo",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getUserRole",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "isWhitelistedContract",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "owner", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "removeFromWhitelistContract",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "removeUserFromRole",
    data: BytesLike
  ): Result;

  events: {};
}

export interface IJonesWhitelistController extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: IJonesWhitelistControllerInterface;

  queryFilter<TEvent extends TypedEvent>(
    event: TypedEventFilter<TEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TEvent>>;

  listeners<TEvent extends TypedEvent>(
    eventFilter?: TypedEventFilter<TEvent>
  ): Array<TypedListener<TEvent>>;
  listeners(eventName?: string): Array<Listener>;
  removeAllListeners<TEvent extends TypedEvent>(
    eventFilter: TypedEventFilter<TEvent>
  ): this;
  removeAllListeners(eventName?: string): this;
  off: OnEvent<this>;
  on: OnEvent<this>;
  once: OnEvent<this>;
  removeListener: OnEvent<this>;

  functions: {
    BASIS_POINTS(overrides?: CallOverrides): Promise<[BigNumber]>;

    addToRole(
      _roleName: BytesLike,
      _account: string,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    addToWhitelistContracts(
      _account: string,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    createRole(
      _roleName: BytesLike,
      _roleInfo: IJonesWhitelistController.RoleInfoStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    getRoleInfo(
      _role: BytesLike,
      overrides?: CallOverrides
    ): Promise<[IJonesWhitelistController.RoleInfoStructOutput]>;

    getUserRole(_account: string, overrides?: CallOverrides): Promise<[string]>;

    isWhitelistedContract(
      _account: string,
      overrides?: CallOverrides
    ): Promise<[boolean]>;

    owner(overrides?: CallOverrides): Promise<[string]>;

    removeFromWhitelistContract(
      _account: string,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    removeUserFromRole(
      _account: string,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;
  };

  BASIS_POINTS(overrides?: CallOverrides): Promise<BigNumber>;

  addToRole(
    _roleName: BytesLike,
    _account: string,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  addToWhitelistContracts(
    _account: string,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  createRole(
    _roleName: BytesLike,
    _roleInfo: IJonesWhitelistController.RoleInfoStruct,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  getRoleInfo(
    _role: BytesLike,
    overrides?: CallOverrides
  ): Promise<IJonesWhitelistController.RoleInfoStructOutput>;

  getUserRole(_account: string, overrides?: CallOverrides): Promise<string>;

  isWhitelistedContract(
    _account: string,
    overrides?: CallOverrides
  ): Promise<boolean>;

  owner(overrides?: CallOverrides): Promise<string>;

  removeFromWhitelistContract(
    _account: string,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  removeUserFromRole(
    _account: string,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  callStatic: {
    BASIS_POINTS(overrides?: CallOverrides): Promise<BigNumber>;

    addToRole(
      _roleName: BytesLike,
      _account: string,
      overrides?: CallOverrides
    ): Promise<void>;

    addToWhitelistContracts(
      _account: string,
      overrides?: CallOverrides
    ): Promise<void>;

    createRole(
      _roleName: BytesLike,
      _roleInfo: IJonesWhitelistController.RoleInfoStruct,
      overrides?: CallOverrides
    ): Promise<void>;

    getRoleInfo(
      _role: BytesLike,
      overrides?: CallOverrides
    ): Promise<IJonesWhitelistController.RoleInfoStructOutput>;

    getUserRole(_account: string, overrides?: CallOverrides): Promise<string>;

    isWhitelistedContract(
      _account: string,
      overrides?: CallOverrides
    ): Promise<boolean>;

    owner(overrides?: CallOverrides): Promise<string>;

    removeFromWhitelistContract(
      _account: string,
      overrides?: CallOverrides
    ): Promise<void>;

    removeUserFromRole(
      _account: string,
      overrides?: CallOverrides
    ): Promise<void>;
  };

  filters: {};

  estimateGas: {
    BASIS_POINTS(overrides?: CallOverrides): Promise<BigNumber>;

    addToRole(
      _roleName: BytesLike,
      _account: string,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    addToWhitelistContracts(
      _account: string,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    createRole(
      _roleName: BytesLike,
      _roleInfo: IJonesWhitelistController.RoleInfoStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    getRoleInfo(
      _role: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    getUserRole(
      _account: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    isWhitelistedContract(
      _account: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    owner(overrides?: CallOverrides): Promise<BigNumber>;

    removeFromWhitelistContract(
      _account: string,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    removeUserFromRole(
      _account: string,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    BASIS_POINTS(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    addToRole(
      _roleName: BytesLike,
      _account: string,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    addToWhitelistContracts(
      _account: string,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    createRole(
      _roleName: BytesLike,
      _roleInfo: IJonesWhitelistController.RoleInfoStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    getRoleInfo(
      _role: BytesLike,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    getUserRole(
      _account: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    isWhitelistedContract(
      _account: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    owner(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    removeFromWhitelistContract(
      _account: string,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    removeUserFromRole(
      _account: string,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;
  };
}