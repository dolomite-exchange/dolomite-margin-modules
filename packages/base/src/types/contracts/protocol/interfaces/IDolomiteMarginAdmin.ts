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
} from "../../../common";

export declare namespace IDolomiteStructs {
  export type DecimalStruct = { value: BigNumberish };

  export type DecimalStructOutput = [BigNumber] & { value: BigNumber };

  export type MonetaryValueStruct = { value: BigNumberish };

  export type MonetaryValueStructOutput = [BigNumber] & { value: BigNumber };
}

export interface IDolomiteMarginAdminInterface extends utils.Interface {
  functions: {
    "ownerAddMarket(address,address,address,(uint256),(uint256),uint256,bool,bool)": FunctionFragment;
    "ownerRemoveMarkets(uint256[],address)": FunctionFragment;
    "ownerSetAccountMaxNumberOfMarketsWithBalances(uint256)": FunctionFragment;
    "ownerSetAutoTraderSpecial(address,bool)": FunctionFragment;
    "ownerSetEarningsRate((uint256))": FunctionFragment;
    "ownerSetGlobalOperator(address,bool)": FunctionFragment;
    "ownerSetInterestSetter(uint256,address)": FunctionFragment;
    "ownerSetIsClosing(uint256,bool)": FunctionFragment;
    "ownerSetLiquidationSpread((uint256))": FunctionFragment;
    "ownerSetMarginPremium(uint256,(uint256))": FunctionFragment;
    "ownerSetMarginRatio((uint256))": FunctionFragment;
    "ownerSetMaxWei(uint256,uint256)": FunctionFragment;
    "ownerSetMinBorrowedValue((uint256))": FunctionFragment;
    "ownerSetPriceOracle(uint256,address)": FunctionFragment;
    "ownerSetSpreadPremium(uint256,(uint256))": FunctionFragment;
    "ownerWithdrawExcessTokens(uint256,address)": FunctionFragment;
    "ownerWithdrawUnsupportedTokens(address,address)": FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | "ownerAddMarket"
      | "ownerRemoveMarkets"
      | "ownerSetAccountMaxNumberOfMarketsWithBalances"
      | "ownerSetAutoTraderSpecial"
      | "ownerSetEarningsRate"
      | "ownerSetGlobalOperator"
      | "ownerSetInterestSetter"
      | "ownerSetIsClosing"
      | "ownerSetLiquidationSpread"
      | "ownerSetMarginPremium"
      | "ownerSetMarginRatio"
      | "ownerSetMaxWei"
      | "ownerSetMinBorrowedValue"
      | "ownerSetPriceOracle"
      | "ownerSetSpreadPremium"
      | "ownerWithdrawExcessTokens"
      | "ownerWithdrawUnsupportedTokens"
  ): FunctionFragment;

  encodeFunctionData(
    functionFragment: "ownerAddMarket",
    values: [
      string,
      string,
      string,
      IDolomiteStructs.DecimalStruct,
      IDolomiteStructs.DecimalStruct,
      BigNumberish,
      boolean,
      boolean
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerRemoveMarkets",
    values: [BigNumberish[], string]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerSetAccountMaxNumberOfMarketsWithBalances",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerSetAutoTraderSpecial",
    values: [string, boolean]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerSetEarningsRate",
    values: [IDolomiteStructs.DecimalStruct]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerSetGlobalOperator",
    values: [string, boolean]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerSetInterestSetter",
    values: [BigNumberish, string]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerSetIsClosing",
    values: [BigNumberish, boolean]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerSetLiquidationSpread",
    values: [IDolomiteStructs.DecimalStruct]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerSetMarginPremium",
    values: [BigNumberish, IDolomiteStructs.DecimalStruct]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerSetMarginRatio",
    values: [IDolomiteStructs.DecimalStruct]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerSetMaxWei",
    values: [BigNumberish, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerSetMinBorrowedValue",
    values: [IDolomiteStructs.MonetaryValueStruct]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerSetPriceOracle",
    values: [BigNumberish, string]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerSetSpreadPremium",
    values: [BigNumberish, IDolomiteStructs.DecimalStruct]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerWithdrawExcessTokens",
    values: [BigNumberish, string]
  ): string;
  encodeFunctionData(
    functionFragment: "ownerWithdrawUnsupportedTokens",
    values: [string, string]
  ): string;

  decodeFunctionResult(
    functionFragment: "ownerAddMarket",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerRemoveMarkets",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerSetAccountMaxNumberOfMarketsWithBalances",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerSetAutoTraderSpecial",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerSetEarningsRate",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerSetGlobalOperator",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerSetInterestSetter",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerSetIsClosing",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerSetLiquidationSpread",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerSetMarginPremium",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerSetMarginRatio",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerSetMaxWei",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerSetMinBorrowedValue",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerSetPriceOracle",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerSetSpreadPremium",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerWithdrawExcessTokens",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ownerWithdrawUnsupportedTokens",
    data: BytesLike
  ): Result;

  events: {};
}

export interface IDolomiteMarginAdmin extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: IDolomiteMarginAdminInterface;

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
    ownerAddMarket(
      token: string,
      priceOracle: string,
      interestSetter: string,
      marginPremium: IDolomiteStructs.DecimalStruct,
      spreadPremium: IDolomiteStructs.DecimalStruct,
      maxWei: BigNumberish,
      isClosing: boolean,
      isRecyclable: boolean,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerRemoveMarkets(
      marketIds: BigNumberish[],
      salvager: string,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerSetAccountMaxNumberOfMarketsWithBalances(
      accountMaxNumberOfMarketsWithBalances: BigNumberish,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerSetAutoTraderSpecial(
      autoTrader: string,
      special: boolean,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerSetEarningsRate(
      earningsRate: IDolomiteStructs.DecimalStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerSetGlobalOperator(
      operator: string,
      approved: boolean,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerSetInterestSetter(
      marketId: BigNumberish,
      interestSetter: string,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerSetIsClosing(
      marketId: BigNumberish,
      isClosing: boolean,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerSetLiquidationSpread(
      spread: IDolomiteStructs.DecimalStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerSetMarginPremium(
      marketId: BigNumberish,
      marginPremium: IDolomiteStructs.DecimalStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerSetMarginRatio(
      ratio: IDolomiteStructs.DecimalStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerSetMaxWei(
      marketId: BigNumberish,
      maxWei: BigNumberish,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerSetMinBorrowedValue(
      minBorrowedValue: IDolomiteStructs.MonetaryValueStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerSetPriceOracle(
      marketId: BigNumberish,
      priceOracle: string,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerSetSpreadPremium(
      marketId: BigNumberish,
      spreadPremium: IDolomiteStructs.DecimalStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerWithdrawExcessTokens(
      marketId: BigNumberish,
      recipient: string,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    ownerWithdrawUnsupportedTokens(
      token: string,
      recipient: string,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;
  };

  ownerAddMarket(
    token: string,
    priceOracle: string,
    interestSetter: string,
    marginPremium: IDolomiteStructs.DecimalStruct,
    spreadPremium: IDolomiteStructs.DecimalStruct,
    maxWei: BigNumberish,
    isClosing: boolean,
    isRecyclable: boolean,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerRemoveMarkets(
    marketIds: BigNumberish[],
    salvager: string,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerSetAccountMaxNumberOfMarketsWithBalances(
    accountMaxNumberOfMarketsWithBalances: BigNumberish,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerSetAutoTraderSpecial(
    autoTrader: string,
    special: boolean,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerSetEarningsRate(
    earningsRate: IDolomiteStructs.DecimalStruct,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerSetGlobalOperator(
    operator: string,
    approved: boolean,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerSetInterestSetter(
    marketId: BigNumberish,
    interestSetter: string,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerSetIsClosing(
    marketId: BigNumberish,
    isClosing: boolean,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerSetLiquidationSpread(
    spread: IDolomiteStructs.DecimalStruct,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerSetMarginPremium(
    marketId: BigNumberish,
    marginPremium: IDolomiteStructs.DecimalStruct,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerSetMarginRatio(
    ratio: IDolomiteStructs.DecimalStruct,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerSetMaxWei(
    marketId: BigNumberish,
    maxWei: BigNumberish,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerSetMinBorrowedValue(
    minBorrowedValue: IDolomiteStructs.MonetaryValueStruct,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerSetPriceOracle(
    marketId: BigNumberish,
    priceOracle: string,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerSetSpreadPremium(
    marketId: BigNumberish,
    spreadPremium: IDolomiteStructs.DecimalStruct,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerWithdrawExcessTokens(
    marketId: BigNumberish,
    recipient: string,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  ownerWithdrawUnsupportedTokens(
    token: string,
    recipient: string,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  callStatic: {
    ownerAddMarket(
      token: string,
      priceOracle: string,
      interestSetter: string,
      marginPremium: IDolomiteStructs.DecimalStruct,
      spreadPremium: IDolomiteStructs.DecimalStruct,
      maxWei: BigNumberish,
      isClosing: boolean,
      isRecyclable: boolean,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerRemoveMarkets(
      marketIds: BigNumberish[],
      salvager: string,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerSetAccountMaxNumberOfMarketsWithBalances(
      accountMaxNumberOfMarketsWithBalances: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerSetAutoTraderSpecial(
      autoTrader: string,
      special: boolean,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerSetEarningsRate(
      earningsRate: IDolomiteStructs.DecimalStruct,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerSetGlobalOperator(
      operator: string,
      approved: boolean,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerSetInterestSetter(
      marketId: BigNumberish,
      interestSetter: string,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerSetIsClosing(
      marketId: BigNumberish,
      isClosing: boolean,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerSetLiquidationSpread(
      spread: IDolomiteStructs.DecimalStruct,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerSetMarginPremium(
      marketId: BigNumberish,
      marginPremium: IDolomiteStructs.DecimalStruct,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerSetMarginRatio(
      ratio: IDolomiteStructs.DecimalStruct,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerSetMaxWei(
      marketId: BigNumberish,
      maxWei: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerSetMinBorrowedValue(
      minBorrowedValue: IDolomiteStructs.MonetaryValueStruct,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerSetPriceOracle(
      marketId: BigNumberish,
      priceOracle: string,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerSetSpreadPremium(
      marketId: BigNumberish,
      spreadPremium: IDolomiteStructs.DecimalStruct,
      overrides?: CallOverrides
    ): Promise<void>;

    ownerWithdrawExcessTokens(
      marketId: BigNumberish,
      recipient: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    ownerWithdrawUnsupportedTokens(
      token: string,
      recipient: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;
  };

  filters: {};

  estimateGas: {
    ownerAddMarket(
      token: string,
      priceOracle: string,
      interestSetter: string,
      marginPremium: IDolomiteStructs.DecimalStruct,
      spreadPremium: IDolomiteStructs.DecimalStruct,
      maxWei: BigNumberish,
      isClosing: boolean,
      isRecyclable: boolean,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerRemoveMarkets(
      marketIds: BigNumberish[],
      salvager: string,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerSetAccountMaxNumberOfMarketsWithBalances(
      accountMaxNumberOfMarketsWithBalances: BigNumberish,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerSetAutoTraderSpecial(
      autoTrader: string,
      special: boolean,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerSetEarningsRate(
      earningsRate: IDolomiteStructs.DecimalStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerSetGlobalOperator(
      operator: string,
      approved: boolean,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerSetInterestSetter(
      marketId: BigNumberish,
      interestSetter: string,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerSetIsClosing(
      marketId: BigNumberish,
      isClosing: boolean,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerSetLiquidationSpread(
      spread: IDolomiteStructs.DecimalStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerSetMarginPremium(
      marketId: BigNumberish,
      marginPremium: IDolomiteStructs.DecimalStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerSetMarginRatio(
      ratio: IDolomiteStructs.DecimalStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerSetMaxWei(
      marketId: BigNumberish,
      maxWei: BigNumberish,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerSetMinBorrowedValue(
      minBorrowedValue: IDolomiteStructs.MonetaryValueStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerSetPriceOracle(
      marketId: BigNumberish,
      priceOracle: string,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerSetSpreadPremium(
      marketId: BigNumberish,
      spreadPremium: IDolomiteStructs.DecimalStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerWithdrawExcessTokens(
      marketId: BigNumberish,
      recipient: string,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    ownerWithdrawUnsupportedTokens(
      token: string,
      recipient: string,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    ownerAddMarket(
      token: string,
      priceOracle: string,
      interestSetter: string,
      marginPremium: IDolomiteStructs.DecimalStruct,
      spreadPremium: IDolomiteStructs.DecimalStruct,
      maxWei: BigNumberish,
      isClosing: boolean,
      isRecyclable: boolean,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerRemoveMarkets(
      marketIds: BigNumberish[],
      salvager: string,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerSetAccountMaxNumberOfMarketsWithBalances(
      accountMaxNumberOfMarketsWithBalances: BigNumberish,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerSetAutoTraderSpecial(
      autoTrader: string,
      special: boolean,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerSetEarningsRate(
      earningsRate: IDolomiteStructs.DecimalStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerSetGlobalOperator(
      operator: string,
      approved: boolean,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerSetInterestSetter(
      marketId: BigNumberish,
      interestSetter: string,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerSetIsClosing(
      marketId: BigNumberish,
      isClosing: boolean,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerSetLiquidationSpread(
      spread: IDolomiteStructs.DecimalStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerSetMarginPremium(
      marketId: BigNumberish,
      marginPremium: IDolomiteStructs.DecimalStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerSetMarginRatio(
      ratio: IDolomiteStructs.DecimalStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerSetMaxWei(
      marketId: BigNumberish,
      maxWei: BigNumberish,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerSetMinBorrowedValue(
      minBorrowedValue: IDolomiteStructs.MonetaryValueStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerSetPriceOracle(
      marketId: BigNumberish,
      priceOracle: string,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerSetSpreadPremium(
      marketId: BigNumberish,
      spreadPremium: IDolomiteStructs.DecimalStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerWithdrawExcessTokens(
      marketId: BigNumberish,
      recipient: string,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    ownerWithdrawUnsupportedTokens(
      token: string,
      recipient: string,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;
  };
}