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

export interface IJonesGLPVaultRouterInterface extends utils.Interface {
  functions: {
    "emergencyPaused()": FunctionFragment;
    "hasRole(bytes32,address)": FunctionFragment;
    "stableWithdrawalSignal(uint256,bool)": FunctionFragment;
    "toggleEmergencyPause()": FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | "emergencyPaused"
      | "hasRole"
      | "stableWithdrawalSignal"
      | "toggleEmergencyPause"
  ): FunctionFragment;

  encodeFunctionData(
    functionFragment: "emergencyPaused",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "hasRole",
    values: [BytesLike, string]
  ): string;
  encodeFunctionData(
    functionFragment: "stableWithdrawalSignal",
    values: [BigNumberish, boolean]
  ): string;
  encodeFunctionData(
    functionFragment: "toggleEmergencyPause",
    values?: undefined
  ): string;

  decodeFunctionResult(
    functionFragment: "emergencyPaused",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "hasRole", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "stableWithdrawalSignal",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "toggleEmergencyPause",
    data: BytesLike
  ): Result;

  events: {};
}

export interface IJonesGLPVaultRouter extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: IJonesGLPVaultRouterInterface;

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
    emergencyPaused(overrides?: CallOverrides): Promise<[boolean]>;

    hasRole(
      _role: BytesLike,
      _account: string,
      overrides?: CallOverrides
    ): Promise<[boolean]>;

    stableWithdrawalSignal(
      _shares: BigNumberish,
      _compound: boolean,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    toggleEmergencyPause(
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;
  };

  emergencyPaused(overrides?: CallOverrides): Promise<boolean>;

  hasRole(
    _role: BytesLike,
    _account: string,
    overrides?: CallOverrides
  ): Promise<boolean>;

  stableWithdrawalSignal(
    _shares: BigNumberish,
    _compound: boolean,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  toggleEmergencyPause(
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  callStatic: {
    emergencyPaused(overrides?: CallOverrides): Promise<boolean>;

    hasRole(
      _role: BytesLike,
      _account: string,
      overrides?: CallOverrides
    ): Promise<boolean>;

    stableWithdrawalSignal(
      _shares: BigNumberish,
      _compound: boolean,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    toggleEmergencyPause(overrides?: CallOverrides): Promise<void>;
  };

  filters: {};

  estimateGas: {
    emergencyPaused(overrides?: CallOverrides): Promise<BigNumber>;

    hasRole(
      _role: BytesLike,
      _account: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    stableWithdrawalSignal(
      _shares: BigNumberish,
      _compound: boolean,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    toggleEmergencyPause(
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    emergencyPaused(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    hasRole(
      _role: BytesLike,
      _account: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    stableWithdrawalSignal(
      _shares: BigNumberish,
      _compound: boolean,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    toggleEmergencyPause(
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;
  };
}