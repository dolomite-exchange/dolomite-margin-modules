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
} from "../common";

export declare namespace IDolomiteStructs {
  export type AssetAmountStruct = {
    sign: boolean;
    denomination: BigNumberish;
    ref: BigNumberish;
    value: BigNumberish;
  };

  export type AssetAmountStructOutput = [boolean, number, number, BigNumber] & {
    sign: boolean;
    denomination: number;
    ref: number;
    value: BigNumber;
  };

  export type ActionArgsStruct = {
    actionType: BigNumberish;
    accountId: BigNumberish;
    amount: IDolomiteStructs.AssetAmountStruct;
    primaryMarketId: BigNumberish;
    secondaryMarketId: BigNumberish;
    otherAddress: string;
    otherAccountId: BigNumberish;
    data: BytesLike;
  };

  export type ActionArgsStructOutput = [
    number,
    BigNumber,
    IDolomiteStructs.AssetAmountStructOutput,
    BigNumber,
    BigNumber,
    string,
    BigNumber,
    string
  ] & {
    actionType: number;
    accountId: BigNumber;
    amount: IDolomiteStructs.AssetAmountStructOutput;
    primaryMarketId: BigNumber;
    secondaryMarketId: BigNumber;
    otherAddress: string;
    otherAccountId: BigNumber;
    data: string;
  };
}

export interface MagicGLPWrapperTraderV1Interface extends utils.Interface {
  functions: {
    "DOLOMITE_MARGIN()": FunctionFragment;
    "GMX_REGISTRY()": FunctionFragment;
    "MAGIC_GLP()": FunctionFragment;
    "actionsLength()": FunctionFragment;
    "createActionsForWrapping(uint256,uint256,address,address,uint256,uint256,uint256,uint256)": FunctionFragment;
    "exchange(address,address,address,address,uint256,bytes)": FunctionFragment;
    "getExchangeCost(address,address,uint256,bytes)": FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | "DOLOMITE_MARGIN"
      | "GMX_REGISTRY"
      | "MAGIC_GLP"
      | "actionsLength"
      | "createActionsForWrapping"
      | "exchange"
      | "getExchangeCost"
  ): FunctionFragment;

  encodeFunctionData(
    functionFragment: "DOLOMITE_MARGIN",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "GMX_REGISTRY",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "MAGIC_GLP", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "actionsLength",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "createActionsForWrapping",
    values: [
      BigNumberish,
      BigNumberish,
      string,
      string,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "exchange",
    values: [string, string, string, string, BigNumberish, BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "getExchangeCost",
    values: [string, string, BigNumberish, BytesLike]
  ): string;

  decodeFunctionResult(
    functionFragment: "DOLOMITE_MARGIN",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "GMX_REGISTRY",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "MAGIC_GLP", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "actionsLength",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "createActionsForWrapping",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "exchange", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "getExchangeCost",
    data: BytesLike
  ): Result;

  events: {};
}

export interface MagicGLPWrapperTraderV1 extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: MagicGLPWrapperTraderV1Interface;

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

    GMX_REGISTRY(overrides?: CallOverrides): Promise<[string]>;

    MAGIC_GLP(overrides?: CallOverrides): Promise<[string]>;

    actionsLength(overrides?: CallOverrides): Promise<[BigNumber]>;

    createActionsForWrapping(
      _solidAccountId: BigNumberish,
      arg1: BigNumberish,
      arg2: string,
      arg3: string,
      _outputMarket: BigNumberish,
      _inputMarket: BigNumberish,
      arg6: BigNumberish,
      _inputAmount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<[IDolomiteStructs.ActionArgsStructOutput[]]>;

    exchange(
      arg0: string,
      _receiver: string,
      _outputToken: string,
      _inputToken: string,
      _inputAmount: BigNumberish,
      _orderData: BytesLike,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    getExchangeCost(
      _inputToken: string,
      _outputToken: string,
      _desiredInputAmount: BigNumberish,
      arg3: BytesLike,
      overrides?: CallOverrides
    ): Promise<[BigNumber]>;
  };

  DOLOMITE_MARGIN(overrides?: CallOverrides): Promise<string>;

  GMX_REGISTRY(overrides?: CallOverrides): Promise<string>;

  MAGIC_GLP(overrides?: CallOverrides): Promise<string>;

  actionsLength(overrides?: CallOverrides): Promise<BigNumber>;

  createActionsForWrapping(
    _solidAccountId: BigNumberish,
    arg1: BigNumberish,
    arg2: string,
    arg3: string,
    _outputMarket: BigNumberish,
    _inputMarket: BigNumberish,
    arg6: BigNumberish,
    _inputAmount: BigNumberish,
    overrides?: CallOverrides
  ): Promise<IDolomiteStructs.ActionArgsStructOutput[]>;

  exchange(
    arg0: string,
    _receiver: string,
    _outputToken: string,
    _inputToken: string,
    _inputAmount: BigNumberish,
    _orderData: BytesLike,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  getExchangeCost(
    _inputToken: string,
    _outputToken: string,
    _desiredInputAmount: BigNumberish,
    arg3: BytesLike,
    overrides?: CallOverrides
  ): Promise<BigNumber>;

  callStatic: {
    DOLOMITE_MARGIN(overrides?: CallOverrides): Promise<string>;

    GMX_REGISTRY(overrides?: CallOverrides): Promise<string>;

    MAGIC_GLP(overrides?: CallOverrides): Promise<string>;

    actionsLength(overrides?: CallOverrides): Promise<BigNumber>;

    createActionsForWrapping(
      _solidAccountId: BigNumberish,
      arg1: BigNumberish,
      arg2: string,
      arg3: string,
      _outputMarket: BigNumberish,
      _inputMarket: BigNumberish,
      arg6: BigNumberish,
      _inputAmount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<IDolomiteStructs.ActionArgsStructOutput[]>;

    exchange(
      arg0: string,
      _receiver: string,
      _outputToken: string,
      _inputToken: string,
      _inputAmount: BigNumberish,
      _orderData: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    getExchangeCost(
      _inputToken: string,
      _outputToken: string,
      _desiredInputAmount: BigNumberish,
      arg3: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;
  };

  filters: {};

  estimateGas: {
    DOLOMITE_MARGIN(overrides?: CallOverrides): Promise<BigNumber>;

    GMX_REGISTRY(overrides?: CallOverrides): Promise<BigNumber>;

    MAGIC_GLP(overrides?: CallOverrides): Promise<BigNumber>;

    actionsLength(overrides?: CallOverrides): Promise<BigNumber>;

    createActionsForWrapping(
      _solidAccountId: BigNumberish,
      arg1: BigNumberish,
      arg2: string,
      arg3: string,
      _outputMarket: BigNumberish,
      _inputMarket: BigNumberish,
      arg6: BigNumberish,
      _inputAmount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    exchange(
      arg0: string,
      _receiver: string,
      _outputToken: string,
      _inputToken: string,
      _inputAmount: BigNumberish,
      _orderData: BytesLike,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    getExchangeCost(
      _inputToken: string,
      _outputToken: string,
      _desiredInputAmount: BigNumberish,
      arg3: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    DOLOMITE_MARGIN(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    GMX_REGISTRY(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    MAGIC_GLP(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    actionsLength(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    createActionsForWrapping(
      _solidAccountId: BigNumberish,
      arg1: BigNumberish,
      arg2: string,
      arg3: string,
      _outputMarket: BigNumberish,
      _inputMarket: BigNumberish,
      arg6: BigNumberish,
      _inputAmount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    exchange(
      arg0: string,
      _receiver: string,
      _outputToken: string,
      _inputToken: string,
      _inputAmount: BigNumberish,
      _orderData: BytesLike,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    getExchangeCost(
      _inputToken: string,
      _outputToken: string,
      _desiredInputAmount: BigNumberish,
      arg3: BytesLike,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;
  };
}