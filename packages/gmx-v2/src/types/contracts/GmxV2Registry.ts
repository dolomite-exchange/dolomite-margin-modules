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
} from "../common";

export interface GmxV2RegistryInterface extends utils.Interface {
  functions: {
    "DOLOMITE_MARGIN()": FunctionFragment;
    "callbackGasLimit()": FunctionFragment;
    "dolomiteRegistry()": FunctionFragment;
    "getUnwrapperByToken(address)": FunctionFragment;
    "getWrapperByToken(address)": FunctionFragment;
    "gmxDataStore()": FunctionFragment;
    "gmxDepositHandler()": FunctionFragment;
    "gmxDepositVault()": FunctionFragment;
    "gmxExchangeRouter()": FunctionFragment;
    "gmxReader()": FunctionFragment;
    "gmxRouter()": FunctionFragment;
    "gmxWithdrawalHandler()": FunctionFragment;
    "gmxWithdrawalVault()": FunctionFragment;
    "initialize(address,address,address,address,address,address,uint256,address)": FunctionFragment;
    "isHandler(address)": FunctionFragment;
    "ownerSetCallbackGasLimit(uint256)": FunctionFragment;
    "ownerSetDolomiteRegistry(address)": FunctionFragment;
    "ownerSetGmxDataStore(address)": FunctionFragment;
    "ownerSetGmxDepositVault(address)": FunctionFragment;
    "ownerSetGmxExchangeRouter(address)": FunctionFragment;
    "ownerSetGmxReader(address)": FunctionFragment;
    "ownerSetGmxRouter(address)": FunctionFragment;
    "ownerSetGmxWithdrawalVault(address)": FunctionFragment;
    "ownerSetIsHandler(address,bool)": FunctionFragment;
    "ownerSetUnwrapperByToken(address,address)": FunctionFragment;
    "ownerSetWrapperByToken(address,address)": FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | "DOLOMITE_MARGIN"
      | "callbackGasLimit"
      | "dolomiteRegistry"
      | "getUnwrapperByToken"
      | "getWrapperByToken"
      | "gmxDataStore"
      | "gmxDepositHandler"
      | "gmxDepositVault"
      | "gmxExchangeRouter"
      | "gmxReader"
      | "gmxRouter"
      | "gmxWithdrawalHandler"
      | "gmxWithdrawalVault"
      | "initialize"
      | "isHandler"
      | "ownerSetCallbackGasLimit"
      | "ownerSetDolomiteRegistry"
      | "ownerSetGmxDataStore"
      | "ownerSetGmxDepositVault"
      | "ownerSetGmxExchangeRouter"
      | "ownerSetGmxReader"
      | "ownerSetGmxRouter"
      | "ownerSetGmxWithdrawalVault"
      | "ownerSetIsHandler"
      | "ownerSetUnwrapperByToken"
      | "ownerSetWrapperByToken"
  ): FunctionFragment;

  encodeFunctionData(
    functionFragment: "DOLOMITE_MARGIN",
    values?: undefined
  ): string;
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
  encodeFunctionData(
    functionFragment: "gmxDataStore",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "gmxDepositHandler",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "gmxDepositVault",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "gmxExchangeRouter",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "gmxReader", values?: undefined): string;
  encodeFunctionData(functionFragment: "gmxRouter", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "gmxWithdrawalHandler",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "gmxWithdrawalVault",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "initialize",
    values: [
      string,
      string,
      string,
      string,
      string,
      string,
      BigNumberish,
      string
    ]
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
    functionFragment: "ownerSetGmxDataStore",
    values: [string]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerSetGmxDepositVault",
    values: [string]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerSetGmxExchangeRouter",
    values: [string]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerSetGmxReader",
    values: [string]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerSetGmxRouter",
    values: [string]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerSetGmxWithdrawalVault",
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
    functionFragment: "DOLOMITE_MARGIN",
    data: BytesLike
  ): Result;
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
  decodeFunctionResult(
    functionFragment: "gmxDataStore",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "gmxDepositHandler",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "gmxDepositVault",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "gmxExchangeRouter",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "gmxReader", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "gmxRouter", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "gmxWithdrawalHandler",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "gmxWithdrawalVault",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "initialize", data: BytesLike): Result;
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
    functionFragment: "ownerSetGmxDataStore",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerSetGmxDepositVault",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerSetGmxExchangeRouter",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerSetGmxReader",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerSetGmxRouter",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerSetGmxWithdrawalVault",
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
    "GmxDataStoreSet(address)": EventFragment;
    "GmxDepositVaultSet(address)": EventFragment;
    "GmxExchangeRouterSet(address)": EventFragment;
    "GmxReaderSet(address)": EventFragment;
    "GmxRouterSet(address)": EventFragment;
    "GmxV2UnwrapperTraderSet(address)": EventFragment;
    "GmxV2WrapperTraderSet(address)": EventFragment;
    "GmxWithdrawalVaultSet(address)": EventFragment;
    "HandlerSet(address,bool)": EventFragment;
    "Initialized(uint8)": EventFragment;
    "UnwrapperTraderSet(address,address)": EventFragment;
    "WrapperTraderSet(address,address)": EventFragment;
  };

  getEvent(nameOrSignatureOrTopic: "CallbackGasLimitSet"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "DolomiteRegistrySet"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "GmxDataStoreSet"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "GmxDepositVaultSet"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "GmxExchangeRouterSet"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "GmxReaderSet"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "GmxRouterSet"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "GmxV2UnwrapperTraderSet"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "GmxV2WrapperTraderSet"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "GmxWithdrawalVaultSet"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "HandlerSet"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "Initialized"): EventFragment;
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

export interface GmxDataStoreSetEventObject {
  _gmxDataStore: string;
}
export type GmxDataStoreSetEvent = TypedEvent<
  [string],
  GmxDataStoreSetEventObject
>;

export type GmxDataStoreSetEventFilter = TypedEventFilter<GmxDataStoreSetEvent>;

export interface GmxDepositVaultSetEventObject {
  _gmxDepositVault: string;
}
export type GmxDepositVaultSetEvent = TypedEvent<
  [string],
  GmxDepositVaultSetEventObject
>;

export type GmxDepositVaultSetEventFilter =
  TypedEventFilter<GmxDepositVaultSetEvent>;

export interface GmxExchangeRouterSetEventObject {
  _gmxExchangeRouter: string;
}
export type GmxExchangeRouterSetEvent = TypedEvent<
  [string],
  GmxExchangeRouterSetEventObject
>;

export type GmxExchangeRouterSetEventFilter =
  TypedEventFilter<GmxExchangeRouterSetEvent>;

export interface GmxReaderSetEventObject {
  _gmxReader: string;
}
export type GmxReaderSetEvent = TypedEvent<[string], GmxReaderSetEventObject>;

export type GmxReaderSetEventFilter = TypedEventFilter<GmxReaderSetEvent>;

export interface GmxRouterSetEventObject {
  _gmxRouter: string;
}
export type GmxRouterSetEvent = TypedEvent<[string], GmxRouterSetEventObject>;

export type GmxRouterSetEventFilter = TypedEventFilter<GmxRouterSetEvent>;

export interface GmxV2UnwrapperTraderSetEventObject {
  _gmxV2UnwrapperTrader: string;
}
export type GmxV2UnwrapperTraderSetEvent = TypedEvent<
  [string],
  GmxV2UnwrapperTraderSetEventObject
>;

export type GmxV2UnwrapperTraderSetEventFilter =
  TypedEventFilter<GmxV2UnwrapperTraderSetEvent>;

export interface GmxV2WrapperTraderSetEventObject {
  _gmxV2WrapperTrader: string;
}
export type GmxV2WrapperTraderSetEvent = TypedEvent<
  [string],
  GmxV2WrapperTraderSetEventObject
>;

export type GmxV2WrapperTraderSetEventFilter =
  TypedEventFilter<GmxV2WrapperTraderSetEvent>;

export interface GmxWithdrawalVaultSetEventObject {
  _gmxDepositVault: string;
}
export type GmxWithdrawalVaultSetEvent = TypedEvent<
  [string],
  GmxWithdrawalVaultSetEventObject
>;

export type GmxWithdrawalVaultSetEventFilter =
  TypedEventFilter<GmxWithdrawalVaultSetEvent>;

export interface HandlerSetEventObject {
  _handler: string;
  _isTrusted: boolean;
}
export type HandlerSetEvent = TypedEvent<
  [string, boolean],
  HandlerSetEventObject
>;

export type HandlerSetEventFilter = TypedEventFilter<HandlerSetEvent>;

export interface InitializedEventObject {
  version: number;
}
export type InitializedEvent = TypedEvent<[number], InitializedEventObject>;

export type InitializedEventFilter = TypedEventFilter<InitializedEvent>;

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

export interface GmxV2Registry extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: GmxV2RegistryInterface;

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
    DOLOMITE_MARGIN(overrides?: CallOverrides): Promise<[string]>;

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

    gmxDataStore(overrides?: CallOverrides): Promise<[string]>;

    gmxDepositHandler(overrides?: CallOverrides): Promise<[string]>;

    gmxDepositVault(overrides?: CallOverrides): Promise<[string]>;

    gmxExchangeRouter(overrides?: CallOverrides): Promise<[string]>;

    gmxReader(overrides?: CallOverrides): Promise<[string]>;

    gmxRouter(overrides?: CallOverrides): Promise<[string]>;

    gmxWithdrawalHandler(overrides?: CallOverrides): Promise<[string]>;

    gmxWithdrawalVault(overrides?: CallOverrides): Promise<[string]>;

    initialize(
      _gmxDataStore: string,
      _gmxDepositVault: string,
      _gmxExchangeRouter: string,
      _gmxReader: string,
      _gmxRouter: string,
      _gmxWithdrawalVault: string,
      _callbackGasLimit: BigNumberish,
      _dolomiteRegistry: string,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    isHandler(_handler: string, overrides?: CallOverrides): Promise<[boolean]>;

    ownerSetCallbackGasLimit(
      _callbackGasLimit: BigNumberish,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerSetDolomiteRegistry(
      _dolomiteRegistry: string,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerSetGmxDataStore(
      _gmxDataStore: string,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerSetGmxDepositVault(
      _gmxDepositVault: string,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerSetGmxExchangeRouter(
      _gmxExchangeRouter: string,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerSetGmxReader(
      _gmxReader: string,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerSetGmxRouter(
      _gmxRouter: string,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerSetGmxWithdrawalVault(
      _gmxWithdrawalVault: string,
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

  DOLOMITE_MARGIN(overrides?: CallOverrides): Promise<string>;

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

  gmxDataStore(overrides?: CallOverrides): Promise<string>;

  gmxDepositHandler(overrides?: CallOverrides): Promise<string>;

  gmxDepositVault(overrides?: CallOverrides): Promise<string>;

  gmxExchangeRouter(overrides?: CallOverrides): Promise<string>;

  gmxReader(overrides?: CallOverrides): Promise<string>;

  gmxRouter(overrides?: CallOverrides): Promise<string>;

  gmxWithdrawalHandler(overrides?: CallOverrides): Promise<string>;

  gmxWithdrawalVault(overrides?: CallOverrides): Promise<string>;

  initialize(
    _gmxDataStore: string,
    _gmxDepositVault: string,
    _gmxExchangeRouter: string,
    _gmxReader: string,
    _gmxRouter: string,
    _gmxWithdrawalVault: string,
    _callbackGasLimit: BigNumberish,
    _dolomiteRegistry: string,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  isHandler(_handler: string, overrides?: CallOverrides): Promise<boolean>;

  ownerSetCallbackGasLimit(
    _callbackGasLimit: BigNumberish,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerSetDolomiteRegistry(
    _dolomiteRegistry: string,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerSetGmxDataStore(
    _gmxDataStore: string,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerSetGmxDepositVault(
    _gmxDepositVault: string,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerSetGmxExchangeRouter(
    _gmxExchangeRouter: string,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerSetGmxReader(
    _gmxReader: string,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerSetGmxRouter(
    _gmxRouter: string,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerSetGmxWithdrawalVault(
    _gmxWithdrawalVault: string,
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
    DOLOMITE_MARGIN(overrides?: CallOverrides): Promise<string>;

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

    gmxDataStore(overrides?: CallOverrides): Promise<string>;

    gmxDepositHandler(overrides?: CallOverrides): Promise<string>;

    gmxDepositVault(overrides?: CallOverrides): Promise<string>;

    gmxExchangeRouter(overrides?: CallOverrides): Promise<string>;

    gmxReader(overrides?: CallOverrides): Promise<string>;

    gmxRouter(overrides?: CallOverrides): Promise<string>;

    gmxWithdrawalHandler(overrides?: CallOverrides): Promise<string>;

    gmxWithdrawalVault(overrides?: CallOverrides): Promise<string>;

    initialize(
      _gmxDataStore: string,
      _gmxDepositVault: string,
      _gmxExchangeRouter: string,
      _gmxReader: string,
      _gmxRouter: string,
      _gmxWithdrawalVault: string,
      _callbackGasLimit: BigNumberish,
      _dolomiteRegistry: string,
      overrides?: CallOverrides
    ): Promise<void>;

    isHandler(_handler: string, overrides?: CallOverrides): Promise<boolean>;

    ownerSetCallbackGasLimit(
      _callbackGasLimit: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerSetDolomiteRegistry(
      _dolomiteRegistry: string,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerSetGmxDataStore(
      _gmxDataStore: string,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerSetGmxDepositVault(
      _gmxDepositVault: string,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerSetGmxExchangeRouter(
      _gmxExchangeRouter: string,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerSetGmxReader(
      _gmxReader: string,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerSetGmxRouter(
      _gmxRouter: string,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerSetGmxWithdrawalVault(
      _gmxWithdrawalVault: string,
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

    "GmxDataStoreSet(address)"(
      _gmxDataStore?: null
    ): GmxDataStoreSetEventFilter;
    GmxDataStoreSet(_gmxDataStore?: null): GmxDataStoreSetEventFilter;

    "GmxDepositVaultSet(address)"(
      _gmxDepositVault?: null
    ): GmxDepositVaultSetEventFilter;
    GmxDepositVaultSet(_gmxDepositVault?: null): GmxDepositVaultSetEventFilter;

    "GmxExchangeRouterSet(address)"(
      _gmxExchangeRouter?: null
    ): GmxExchangeRouterSetEventFilter;
    GmxExchangeRouterSet(
      _gmxExchangeRouter?: null
    ): GmxExchangeRouterSetEventFilter;

    "GmxReaderSet(address)"(_gmxReader?: null): GmxReaderSetEventFilter;
    GmxReaderSet(_gmxReader?: null): GmxReaderSetEventFilter;

    "GmxRouterSet(address)"(_gmxRouter?: null): GmxRouterSetEventFilter;
    GmxRouterSet(_gmxRouter?: null): GmxRouterSetEventFilter;

    "GmxV2UnwrapperTraderSet(address)"(
      _gmxV2UnwrapperTrader?: null
    ): GmxV2UnwrapperTraderSetEventFilter;
    GmxV2UnwrapperTraderSet(
      _gmxV2UnwrapperTrader?: null
    ): GmxV2UnwrapperTraderSetEventFilter;

    "GmxV2WrapperTraderSet(address)"(
      _gmxV2WrapperTrader?: null
    ): GmxV2WrapperTraderSetEventFilter;
    GmxV2WrapperTraderSet(
      _gmxV2WrapperTrader?: null
    ): GmxV2WrapperTraderSetEventFilter;

    "GmxWithdrawalVaultSet(address)"(
      _gmxDepositVault?: null
    ): GmxWithdrawalVaultSetEventFilter;
    GmxWithdrawalVaultSet(
      _gmxDepositVault?: null
    ): GmxWithdrawalVaultSetEventFilter;

    "HandlerSet(address,bool)"(
      _handler?: null,
      _isTrusted?: null
    ): HandlerSetEventFilter;
    HandlerSet(_handler?: null, _isTrusted?: null): HandlerSetEventFilter;

    "Initialized(uint8)"(version?: null): InitializedEventFilter;
    Initialized(version?: null): InitializedEventFilter;

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
    DOLOMITE_MARGIN(overrides?: CallOverrides): Promise<BigNumber>;

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

    gmxDataStore(overrides?: CallOverrides): Promise<BigNumber>;

    gmxDepositHandler(overrides?: CallOverrides): Promise<BigNumber>;

    gmxDepositVault(overrides?: CallOverrides): Promise<BigNumber>;

    gmxExchangeRouter(overrides?: CallOverrides): Promise<BigNumber>;

    gmxReader(overrides?: CallOverrides): Promise<BigNumber>;

    gmxRouter(overrides?: CallOverrides): Promise<BigNumber>;

    gmxWithdrawalHandler(overrides?: CallOverrides): Promise<BigNumber>;

    gmxWithdrawalVault(overrides?: CallOverrides): Promise<BigNumber>;

    initialize(
      _gmxDataStore: string,
      _gmxDepositVault: string,
      _gmxExchangeRouter: string,
      _gmxReader: string,
      _gmxRouter: string,
      _gmxWithdrawalVault: string,
      _callbackGasLimit: BigNumberish,
      _dolomiteRegistry: string,
      overrides?: Overrides & { from?: string }
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

    ownerSetGmxDataStore(
      _gmxDataStore: string,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerSetGmxDepositVault(
      _gmxDepositVault: string,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerSetGmxExchangeRouter(
      _gmxExchangeRouter: string,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerSetGmxReader(
      _gmxReader: string,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerSetGmxRouter(
      _gmxRouter: string,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerSetGmxWithdrawalVault(
      _gmxWithdrawalVault: string,
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
    DOLOMITE_MARGIN(overrides?: CallOverrides): Promise<PopulatedTransaction>;

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

    gmxDataStore(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    gmxDepositHandler(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    gmxDepositVault(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    gmxExchangeRouter(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    gmxReader(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    gmxRouter(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    gmxWithdrawalHandler(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    gmxWithdrawalVault(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    initialize(
      _gmxDataStore: string,
      _gmxDepositVault: string,
      _gmxExchangeRouter: string,
      _gmxReader: string,
      _gmxRouter: string,
      _gmxWithdrawalVault: string,
      _callbackGasLimit: BigNumberish,
      _dolomiteRegistry: string,
      overrides?: Overrides & { from?: string }
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

    ownerSetGmxDataStore(
      _gmxDataStore: string,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerSetGmxDepositVault(
      _gmxDepositVault: string,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerSetGmxExchangeRouter(
      _gmxExchangeRouter: string,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerSetGmxReader(
      _gmxReader: string,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerSetGmxRouter(
      _gmxRouter: string,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerSetGmxWithdrawalVault(
      _gmxWithdrawalVault: string,
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