/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
  BaseContract,
  BigNumber,
  BigNumberish,
  BytesLike,
  CallOverrides,
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

export declare namespace GmxDeposit {
  export type AddressesStruct = {
    account: string;
    receiver: string;
    callbackContract: string;
    uiFeeReceiver: string;
    market: string;
    initialLongToken: string;
    initialShortToken: string;
    longTokenSwapPath: string[];
    shortTokenSwapPath: string[];
  };

  export type AddressesStructOutput = [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string[],
    string[]
  ] & {
    account: string;
    receiver: string;
    callbackContract: string;
    uiFeeReceiver: string;
    market: string;
    initialLongToken: string;
    initialShortToken: string;
    longTokenSwapPath: string[];
    shortTokenSwapPath: string[];
  };

  export type NumbersStruct = {
    initialLongTokenAmount: BigNumberish;
    initialShortTokenAmount: BigNumberish;
    minMarketTokens: BigNumberish;
    updatedAtBlock: BigNumberish;
    executionFee: BigNumberish;
    callbackGasLimit: BigNumberish;
  };

  export type NumbersStructOutput = [
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber
  ] & {
    initialLongTokenAmount: BigNumber;
    initialShortTokenAmount: BigNumber;
    minMarketTokens: BigNumber;
    updatedAtBlock: BigNumber;
    executionFee: BigNumber;
    callbackGasLimit: BigNumber;
  };

  export type FlagsStruct = { shouldUnwrapNativeToken: boolean };

  export type FlagsStructOutput = [boolean] & {
    shouldUnwrapNativeToken: boolean;
  };

  export type DepositPropsStruct = {
    addresses: GmxDeposit.AddressesStruct;
    numbers: GmxDeposit.NumbersStruct;
    flags: GmxDeposit.FlagsStruct;
  };

  export type DepositPropsStructOutput = [
    GmxDeposit.AddressesStructOutput,
    GmxDeposit.NumbersStructOutput,
    GmxDeposit.FlagsStructOutput
  ] & {
    addresses: GmxDeposit.AddressesStructOutput;
    numbers: GmxDeposit.NumbersStructOutput;
    flags: GmxDeposit.FlagsStructOutput;
  };
}

export declare namespace GmxMarket {
  export type MarketPropsStruct = {
    marketToken: string;
    indexToken: string;
    longToken: string;
    shortToken: string;
  };

  export type MarketPropsStructOutput = [string, string, string, string] & {
    marketToken: string;
    indexToken: string;
    longToken: string;
    shortToken: string;
  };

  export type MarketPricesStruct = {
    indexTokenPrice: GmxPrice.PricePropsStruct;
    longTokenPrice: GmxPrice.PricePropsStruct;
    shortTokenPrice: GmxPrice.PricePropsStruct;
  };

  export type MarketPricesStructOutput = [
    GmxPrice.PricePropsStructOutput,
    GmxPrice.PricePropsStructOutput,
    GmxPrice.PricePropsStructOutput
  ] & {
    indexTokenPrice: GmxPrice.PricePropsStructOutput;
    longTokenPrice: GmxPrice.PricePropsStructOutput;
    shortTokenPrice: GmxPrice.PricePropsStructOutput;
  };
}

export declare namespace GmxPrice {
  export type PricePropsStruct = { min: BigNumberish; max: BigNumberish };

  export type PricePropsStructOutput = [BigNumber, BigNumber] & {
    min: BigNumber;
    max: BigNumber;
  };
}

export declare namespace GmxMarketPoolValueInfo {
  export type PoolValueInfoPropsStruct = {
    poolValue: BigNumberish;
    longPnl: BigNumberish;
    shortPnl: BigNumberish;
    netPnl: BigNumberish;
    longTokenAmount: BigNumberish;
    shortTokenAmount: BigNumberish;
    longTokenUsd: BigNumberish;
    shortTokenUsd: BigNumberish;
    totalBorrowingFees: BigNumberish;
    borrowingFeePoolFactor: BigNumberish;
    impactPoolAmount: BigNumberish;
  };

  export type PoolValueInfoPropsStructOutput = [
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber
  ] & {
    poolValue: BigNumber;
    longPnl: BigNumber;
    shortPnl: BigNumber;
    netPnl: BigNumber;
    longTokenAmount: BigNumber;
    shortTokenAmount: BigNumber;
    longTokenUsd: BigNumber;
    shortTokenUsd: BigNumber;
    totalBorrowingFees: BigNumber;
    borrowingFeePoolFactor: BigNumber;
    impactPoolAmount: BigNumber;
  };
}

export declare namespace GmxWithdrawal {
  export type AddressesStruct = {
    account: string;
    receiver: string;
    callbackContract: string;
    uiFeeReceiver: string;
    market: string;
    longTokenSwapPath: string[];
    shortTokenSwapPath: string[];
  };

  export type AddressesStructOutput = [
    string,
    string,
    string,
    string,
    string,
    string[],
    string[]
  ] & {
    account: string;
    receiver: string;
    callbackContract: string;
    uiFeeReceiver: string;
    market: string;
    longTokenSwapPath: string[];
    shortTokenSwapPath: string[];
  };

  export type NumbersStruct = {
    marketTokenAmount: BigNumberish;
    minLongTokenAmount: BigNumberish;
    minShortTokenAmount: BigNumberish;
    updatedAtBlock: BigNumberish;
    executionFee: BigNumberish;
    callbackGasLimit: BigNumberish;
  };

  export type NumbersStructOutput = [
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber
  ] & {
    marketTokenAmount: BigNumber;
    minLongTokenAmount: BigNumber;
    minShortTokenAmount: BigNumber;
    updatedAtBlock: BigNumber;
    executionFee: BigNumber;
    callbackGasLimit: BigNumber;
  };

  export type FlagsStruct = { shouldUnwrapNativeToken: boolean };

  export type FlagsStructOutput = [boolean] & {
    shouldUnwrapNativeToken: boolean;
  };

  export type WithdrawalPropsStruct = {
    addresses: GmxWithdrawal.AddressesStruct;
    numbers: GmxWithdrawal.NumbersStruct;
    flags: GmxWithdrawal.FlagsStruct;
  };

  export type WithdrawalPropsStructOutput = [
    GmxWithdrawal.AddressesStructOutput,
    GmxWithdrawal.NumbersStructOutput,
    GmxWithdrawal.FlagsStructOutput
  ] & {
    addresses: GmxWithdrawal.AddressesStructOutput;
    numbers: GmxWithdrawal.NumbersStructOutput;
    flags: GmxWithdrawal.FlagsStructOutput;
  };
}

export interface IGmxReaderInterface extends utils.Interface {
  functions: {
    "getDeposit(address,bytes32)": FunctionFragment;
    "getMarketTokenPrice(address,(address,address,address,address),(uint256,uint256),(uint256,uint256),(uint256,uint256),bytes32,bool)": FunctionFragment;
    "getPnlToPoolFactor(address,address,((uint256,uint256),(uint256,uint256),(uint256,uint256)),bool,bool)": FunctionFragment;
    "getSwapPriceImpact(address,address,address,address,uint256,(uint256,uint256),(uint256,uint256))": FunctionFragment;
    "getWithdrawal(address,bytes32)": FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | "getDeposit"
      | "getMarketTokenPrice"
      | "getPnlToPoolFactor"
      | "getSwapPriceImpact"
      | "getWithdrawal"
  ): FunctionFragment;

  encodeFunctionData(
    functionFragment: "getDeposit",
    values: [string, BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "getMarketTokenPrice",
    values: [
      string,
      GmxMarket.MarketPropsStruct,
      GmxPrice.PricePropsStruct,
      GmxPrice.PricePropsStruct,
      GmxPrice.PricePropsStruct,
      BytesLike,
      boolean
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "getPnlToPoolFactor",
    values: [string, string, GmxMarket.MarketPricesStruct, boolean, boolean]
  ): string;
  encodeFunctionData(
    functionFragment: "getSwapPriceImpact",
    values: [
      string,
      string,
      string,
      string,
      BigNumberish,
      GmxPrice.PricePropsStruct,
      GmxPrice.PricePropsStruct
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "getWithdrawal",
    values: [string, BytesLike]
  ): string;

  decodeFunctionResult(functionFragment: "getDeposit", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "getMarketTokenPrice",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getPnlToPoolFactor",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getSwapPriceImpact",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getWithdrawal",
    data: BytesLike
  ): Result;

  events: {};
}

export interface IGmxReader extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: IGmxReaderInterface;

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
    getDeposit(
      _dataStore: string,
      _key: BytesLike,
      overrides?: CallOverrides
    ): Promise<[GmxDeposit.DepositPropsStructOutput]>;

    getMarketTokenPrice(
      _dataStore: string,
      _market: GmxMarket.MarketPropsStruct,
      _indexTokenPrice: GmxPrice.PricePropsStruct,
      _longTokenPrice: GmxPrice.PricePropsStruct,
      _shortTokenPrice: GmxPrice.PricePropsStruct,
      _pnlFactorType: BytesLike,
      _maximize: boolean,
      overrides?: CallOverrides
    ): Promise<
      [BigNumber, GmxMarketPoolValueInfo.PoolValueInfoPropsStructOutput]
    >;

    getPnlToPoolFactor(
      _dataStore: string,
      _marketAddress: string,
      _prices: GmxMarket.MarketPricesStruct,
      _isLong: boolean,
      _maximize: boolean,
      overrides?: CallOverrides
    ): Promise<[BigNumber]>;

    getSwapPriceImpact(
      _dataStore: string,
      _marketKey: string,
      _tokenIn: string,
      _tokenOut: string,
      _amountIn: BigNumberish,
      _tokenInPrice: GmxPrice.PricePropsStruct,
      _tokenOutPrice: GmxPrice.PricePropsStruct,
      overrides?: CallOverrides
    ): Promise<[BigNumber, BigNumber]>;

    getWithdrawal(
      _dataStore: string,
      _key: BytesLike,
      overrides?: CallOverrides
    ): Promise<[GmxWithdrawal.WithdrawalPropsStructOutput]>;
  };

  getDeposit(
    _dataStore: string,
    _key: BytesLike,
    overrides?: CallOverrides
  ): Promise<GmxDeposit.DepositPropsStructOutput>;

  getMarketTokenPrice(
    _dataStore: string,
    _market: GmxMarket.MarketPropsStruct,
    _indexTokenPrice: GmxPrice.PricePropsStruct,
    _longTokenPrice: GmxPrice.PricePropsStruct,
    _shortTokenPrice: GmxPrice.PricePropsStruct,
    _pnlFactorType: BytesLike,
    _maximize: boolean,
    overrides?: CallOverrides
  ): Promise<
    [BigNumber, GmxMarketPoolValueInfo.PoolValueInfoPropsStructOutput]
  >;

  getPnlToPoolFactor(
    _dataStore: string,
    _marketAddress: string,
    _prices: GmxMarket.MarketPricesStruct,
    _isLong: boolean,
    _maximize: boolean,
    overrides?: CallOverrides
  ): Promise<BigNumber>;

  getSwapPriceImpact(
    _dataStore: string,
    _marketKey: string,
    _tokenIn: string,
    _tokenOut: string,
    _amountIn: BigNumberish,
    _tokenInPrice: GmxPrice.PricePropsStruct,
    _tokenOutPrice: GmxPrice.PricePropsStruct,
    overrides?: CallOverrides
  ): Promise<[BigNumber, BigNumber]>;

  getWithdrawal(
    _dataStore: string,
    _key: BytesLike,
    overrides?: CallOverrides
  ): Promise<GmxWithdrawal.WithdrawalPropsStructOutput>;

  callStatic: {
    getDeposit(
      _dataStore: string,
      _key: BytesLike,
      overrides?: CallOverrides
    ): Promise<GmxDeposit.DepositPropsStructOutput>;

    getMarketTokenPrice(
      _dataStore: string,
      _market: GmxMarket.MarketPropsStruct,
      _indexTokenPrice: GmxPrice.PricePropsStruct,
      _longTokenPrice: GmxPrice.PricePropsStruct,
      _shortTokenPrice: GmxPrice.PricePropsStruct,
      _pnlFactorType: BytesLike,
      _maximize: boolean,
      overrides?: CallOverrides
    ): Promise<
      [BigNumber, GmxMarketPoolValueInfo.PoolValueInfoPropsStructOutput]
    >;

    getPnlToPoolFactor(
      _dataStore: string,
      _marketAddress: string,
      _prices: GmxMarket.MarketPricesStruct,
      _isLong: boolean,
      _maximize: boolean,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    getSwapPriceImpact(
      _dataStore: string,
      _marketKey: string,
      _tokenIn: string,
      _tokenOut: string,
      _amountIn: BigNumberish,
      _tokenInPrice: GmxPrice.PricePropsStruct,
      _tokenOutPrice: GmxPrice.PricePropsStruct,
      overrides?: CallOverrides
    ): Promise<[BigNumber, BigNumber]>;

    getWithdrawal(
      _dataStore: string,
      _key: BytesLike,
      overrides?: CallOverrides
    ): Promise<GmxWithdrawal.WithdrawalPropsStructOutput>;
  };

  filters: {};

  estimateGas: {
    getDeposit(
      _dataStore: string,
      _key: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    getMarketTokenPrice(
      _dataStore: string,
      _market: GmxMarket.MarketPropsStruct,
      _indexTokenPrice: GmxPrice.PricePropsStruct,
      _longTokenPrice: GmxPrice.PricePropsStruct,
      _shortTokenPrice: GmxPrice.PricePropsStruct,
      _pnlFactorType: BytesLike,
      _maximize: boolean,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    getPnlToPoolFactor(
      _dataStore: string,
      _marketAddress: string,
      _prices: GmxMarket.MarketPricesStruct,
      _isLong: boolean,
      _maximize: boolean,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    getSwapPriceImpact(
      _dataStore: string,
      _marketKey: string,
      _tokenIn: string,
      _tokenOut: string,
      _amountIn: BigNumberish,
      _tokenInPrice: GmxPrice.PricePropsStruct,
      _tokenOutPrice: GmxPrice.PricePropsStruct,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    getWithdrawal(
      _dataStore: string,
      _key: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    getDeposit(
      _dataStore: string,
      _key: BytesLike,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    getMarketTokenPrice(
      _dataStore: string,
      _market: GmxMarket.MarketPropsStruct,
      _indexTokenPrice: GmxPrice.PricePropsStruct,
      _longTokenPrice: GmxPrice.PricePropsStruct,
      _shortTokenPrice: GmxPrice.PricePropsStruct,
      _pnlFactorType: BytesLike,
      _maximize: boolean,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    getPnlToPoolFactor(
      _dataStore: string,
      _marketAddress: string,
      _prices: GmxMarket.MarketPricesStruct,
      _isLong: boolean,
      _maximize: boolean,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    getSwapPriceImpact(
      _dataStore: string,
      _marketKey: string,
      _tokenIn: string,
      _tokenOut: string,
      _amountIn: BigNumberish,
      _tokenInPrice: GmxPrice.PricePropsStruct,
      _tokenOutPrice: GmxPrice.PricePropsStruct,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    getWithdrawal(
      _dataStore: string,
      _key: BytesLike,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;
  };
}