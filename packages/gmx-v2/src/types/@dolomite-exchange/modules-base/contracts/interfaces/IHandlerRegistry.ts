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
import type {
  FunctionFragment,
  Result,
  EventFragment,
} from "@ethersproject/abi";
import type { Listener, Provider } from "@ethersproject/providers";
import type {
  TypedEventFilter,
  TypedEvent,
  TypedListener,
  OnEvent,
} from "../../../../common";

export interface IHandlerRegistryInterface extends utils.Interface {
  functions: {
    "callbackGasLimit()": FunctionFragment;
    "dolomiteRegistry()": FunctionFragment;
    "getUnwrapperByToken(address)": FunctionFragment;
    "getWrapperByToken(address)": FunctionFragment;
    "isHandler(address)": FunctionFragment;
    "ownerSetCallbackGasLimit(uint256)": FunctionFragment;
    "ownerSetDolomiteRegistry(address)": FunctionFragment;
    "ownerSetIsHandler(address,bool)": FunctionFragment;
    "ownerSetUnwrapperByToken(address,address)": FunctionFragment;
    "ownerSetWrapperByToken(address,address)": FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | "callbackGasLimit"
      | "dolomiteRegistry"
      | "getUnwrapperByToken"
      | "getWrapperByToken"
      | "isHandler"
      | "ownerSetCallbackGasLimit"
      | "ownerSetDolomiteRegistry"
      | "ownerSetIsHandler"
      | "ownerSetUnwrapperByToken"
      | "ownerSetWrapperByToken"
  ): FunctionFragment;

  encodeFunctionData(
    functionFragment: "callbackGasLimit",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "dolomiteRegistry",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "getUnwrapperByToken",
    values: [string]
  ): string;
  encodeFunctionData(
    functionFragment: "getWrapperByToken",
    values: [string]
  ): string;
  encodeFunctionData(functionFragment: "isHandler", values: [string]): string;
  encodeFunctionData(
    functionFragment: "ownerSetCallbackGasLimit",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerSetDolomiteRegistry",
    values: [string]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerSetIsHandler",
    values: [string, boolean]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerSetUnwrapperByToken",
    values: [string, string]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerSetWrapperByToken",
    values: [string, string]
  ): string;

  decodeFunctionResult(
    functionFragment: "callbackGasLimit",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "dolomiteRegistry",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getUnwrapperByToken",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getWrapperByToken",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "isHandler", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "ownerSetCallbackGasLimit",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerSetDolomiteRegistry",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerSetIsHandler",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerSetUnwrapperByToken",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerSetWrapperByToken",
    data: BytesLike
  ): Result;

  events: {
    "CallbackGasLimitSet(uint256)": EventFragment;
    "DolomiteRegistrySet(address)": EventFragment;
    "HandlerSet(address,bool)": EventFragment;
    "UnwrapperTraderSet(address,address)": EventFragment;
    "WrapperTraderSet(address,address)": EventFragment;
  };

  getEvent(nameOrSignatureOrTopic: "CallbackGasLimitSet"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "DolomiteRegistrySet"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "HandlerSet"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "UnwrapperTraderSet"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "WrapperTraderSet"): EventFragment;
}

export interface CallbackGasLimitSetEventObject {
  _callbackGasLimit: BigNumber;
}
export type CallbackGasLimitSetEvent = TypedEvent<
  [BigNumber],
  CallbackGasLimitSetEventObject
>;

export type CallbackGasLimitSetEventFilter =
  TypedEventFilter<CallbackGasLimitSetEvent>;

export interface DolomiteRegistrySetEventObject {
  _dolomiteRegistry: string;
}
export type DolomiteRegistrySetEvent = TypedEvent<
  [string],
  DolomiteRegistrySetEventObject
>;

export type DolomiteRegistrySetEventFilter =
  TypedEventFilter<DolomiteRegistrySetEvent>;

export interface HandlerSetEventObject {
  _handler: string;
  _isTrusted: boolean;
}
export type HandlerSetEvent = TypedEvent<
  [string, boolean],
  HandlerSetEventObject
>;

export type HandlerSetEventFilter = TypedEventFilter<HandlerSetEvent>;

export interface UnwrapperTraderSetEventObject {
  _token: string;
  _unwrapperTrader: string;
}
export type UnwrapperTraderSetEvent = TypedEvent<
  [string, string],
  UnwrapperTraderSetEventObject
>;

export type UnwrapperTraderSetEventFilter =
  TypedEventFilter<UnwrapperTraderSetEvent>;

export interface WrapperTraderSetEventObject {
  _token: string;
  _wrapperTrader: string;
}
export type WrapperTraderSetEvent = TypedEvent<
  [string, string],
  WrapperTraderSetEventObject
>;

export type WrapperTraderSetEventFilter =
  TypedEventFilter<WrapperTraderSetEvent>;

export interface IHandlerRegistry extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: IHandlerRegistryInterface;

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
    callbackGasLimit(overrides?: CallOverrides): Promise<[BigNumber]>;

    dolomiteRegistry(overrides?: CallOverrides): Promise<[string]>;

    getUnwrapperByToken(
      _factoryToken: string,
      overrides?: CallOverrides
    ): Promise<[string]>;

    getWrapperByToken(
      _factoryToken: string,
      overrides?: CallOverrides
    ): Promise<[string]>;

    isHandler(_handler: string, overrides?: CallOverrides): Promise<[boolean]>;

    ownerSetCallbackGasLimit(
      _callbackGasLimit: BigNumberish,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerSetDolomiteRegistry(
      _dolomiteRegistry: string,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerSetIsHandler(
      _handler: string,
      _isTrusted: boolean,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerSetUnwrapperByToken(
      _factoryToken: string,
      _unwrapperTrader: string,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerSetWrapperByToken(
      _factoryToken: string,
      _wrapperTrader: string,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;
  };

  callbackGasLimit(overrides?: CallOverrides): Promise<BigNumber>;

  dolomiteRegistry(overrides?: CallOverrides): Promise<string>;

  getUnwrapperByToken(
    _factoryToken: string,
    overrides?: CallOverrides
  ): Promise<string>;

  getWrapperByToken(
    _factoryToken: string,
    overrides?: CallOverrides
  ): Promise<string>;

  isHandler(_handler: string, overrides?: CallOverrides): Promise<boolean>;

  ownerSetCallbackGasLimit(
    _callbackGasLimit: BigNumberish,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerSetDolomiteRegistry(
    _dolomiteRegistry: string,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerSetIsHandler(
    _handler: string,
    _isTrusted: boolean,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerSetUnwrapperByToken(
    _factoryToken: string,
    _unwrapperTrader: string,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerSetWrapperByToken(
    _factoryToken: string,
    _wrapperTrader: string,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  callStatic: {
    callbackGasLimit(overrides?: CallOverrides): Promise<BigNumber>;

    dolomiteRegistry(overrides?: CallOverrides): Promise<string>;

    getUnwrapperByToken(
      _factoryToken: string,
      overrides?: CallOverrides
    ): Promise<string>;

    getWrapperByToken(
      _factoryToken: string,
      overrides?: CallOverrides
    ): Promise<string>;

    isHandler(_handler: string, overrides?: CallOverrides): Promise<boolean>;

    ownerSetCallbackGasLimit(
      _callbackGasLimit: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerSetDolomiteRegistry(
      _dolomiteRegistry: string,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerSetIsHandler(
      _handler: string,
      _isTrusted: boolean,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerSetUnwrapperByToken(
      _factoryToken: string,
      _unwrapperTrader: string,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerSetWrapperByToken(
      _factoryToken: string,
      _wrapperTrader: string,
      overrides?: CallOverrides
    ): Promise<void>;
  };

  filters: {
    "CallbackGasLimitSet(uint256)"(
      _callbackGasLimit?: null
    ): CallbackGasLimitSetEventFilter;
    CallbackGasLimitSet(
      _callbackGasLimit?: null
    ): CallbackGasLimitSetEventFilter;

    "DolomiteRegistrySet(address)"(
      _dolomiteRegistry?: string | null
    ): DolomiteRegistrySetEventFilter;
    DolomiteRegistrySet(
      _dolomiteRegistry?: string | null
    ): DolomiteRegistrySetEventFilter;

    "HandlerSet(address,bool)"(
      _handler?: null,
      _isTrusted?: null
    ): HandlerSetEventFilter;
    HandlerSet(_handler?: null, _isTrusted?: null): HandlerSetEventFilter;

    "UnwrapperTraderSet(address,address)"(
      _token?: null,
      _unwrapperTrader?: null
    ): UnwrapperTraderSetEventFilter;
    UnwrapperTraderSet(
      _token?: null,
      _unwrapperTrader?: null
    ): UnwrapperTraderSetEventFilter;

    "WrapperTraderSet(address,address)"(
      _token?: null,
      _wrapperTrader?: null
    ): WrapperTraderSetEventFilter;
    WrapperTraderSet(
      _token?: null,
      _wrapperTrader?: null
    ): WrapperTraderSetEventFilter;
  };

  estimateGas: {
    callbackGasLimit(overrides?: CallOverrides): Promise<BigNumber>;

    dolomiteRegistry(overrides?: CallOverrides): Promise<BigNumber>;

    getUnwrapperByToken(
      _factoryToken: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    getWrapperByToken(
      _factoryToken: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    isHandler(_handler: string, overrides?: CallOverrides): Promise<BigNumber>;

    ownerSetCallbackGasLimit(
      _callbackGasLimit: BigNumberish,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerSetDolomiteRegistry(
      _dolomiteRegistry: string,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerSetIsHandler(
      _handler: string,
      _isTrusted: boolean,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerSetUnwrapperByToken(
      _factoryToken: string,
      _unwrapperTrader: string,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerSetWrapperByToken(
      _factoryToken: string,
      _wrapperTrader: string,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    callbackGasLimit(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    dolomiteRegistry(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    getUnwrapperByToken(
      _factoryToken: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    getWrapperByToken(
      _factoryToken: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    isHandler(
      _handler: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    ownerSetCallbackGasLimit(
      _callbackGasLimit: BigNumberish,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerSetDolomiteRegistry(
      _dolomiteRegistry: string,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerSetIsHandler(
      _handler: string,
      _isTrusted: boolean,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerSetUnwrapperByToken(
      _factoryToken: string,
      _unwrapperTrader: string,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerSetWrapperByToken(
      _factoryToken: string,
      _wrapperTrader: string,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;
  };
}