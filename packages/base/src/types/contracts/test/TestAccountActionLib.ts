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

  export type AccountInfoStruct = { owner: string; number: BigNumberish };

  export type AccountInfoStructOutput = [string, BigNumber] & {
    owner: string;
    number: BigNumber;
  };
}

export interface TestAccountActionLibInterface extends utils.Interface {
  functions: {
    "DOLOMITE_MARGIN()": FunctionFragment;
    "all()": FunctionFragment;
    "deposit(address,address,uint256,uint256,(bool,uint8,uint8,uint256))": FunctionFragment;
    "encodeCallAction(uint256,address,bytes)": FunctionFragment;
    "encodeDepositAction(uint256,uint256,(bool,uint8,uint8,uint256),address)": FunctionFragment;
    "encodeExpirationAction((address,uint256),uint256,uint256,address,uint256)": FunctionFragment;
    "encodeExpiryLiquidateAction(uint256,uint256,uint256,uint256,address,uint32,bool)": FunctionFragment;
    "encodeExternalSellAction(uint256,uint256,uint256,address,uint256,uint256,bytes)": FunctionFragment;
    "encodeInternalTradeAction(uint256,uint256,uint256,uint256,address,uint256,uint256)": FunctionFragment;
    "encodeLiquidateAction(uint256,uint256,uint256,uint256,uint256)": FunctionFragment;
    "encodeTransferAction(uint256,uint256,uint256,uint8,uint256)": FunctionFragment;
    "encodeWithdrawalAction(uint256,uint256,(bool,uint8,uint8,uint256),address)": FunctionFragment;
    "transfer(address,uint256,address,uint256,uint256,uint8,uint256,uint8)": FunctionFragment;
    "withdraw(address,uint256,address,uint256,(bool,uint8,uint8,uint256),uint8)": FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | "DOLOMITE_MARGIN"
      | "all"
      | "deposit"
      | "encodeCallAction"
      | "encodeDepositAction"
      | "encodeExpirationAction"
      | "encodeExpiryLiquidateAction"
      | "encodeExternalSellAction"
      | "encodeInternalTradeAction"
      | "encodeLiquidateAction"
      | "encodeTransferAction"
      | "encodeWithdrawalAction"
      | "transfer"
      | "withdraw"
  ): FunctionFragment;

  encodeFunctionData(
    functionFragment: "DOLOMITE_MARGIN",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "all", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "deposit",
    values: [
      string,
      string,
      BigNumberish,
      BigNumberish,
      IDolomiteStructs.AssetAmountStruct
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "encodeCallAction",
    values: [BigNumberish, string, BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "encodeDepositAction",
    values: [
      BigNumberish,
      BigNumberish,
      IDolomiteStructs.AssetAmountStruct,
      string
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "encodeExpirationAction",
    values: [
      IDolomiteStructs.AccountInfoStruct,
      BigNumberish,
      BigNumberish,
      string,
      BigNumberish
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "encodeExpiryLiquidateAction",
    values: [
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      string,
      BigNumberish,
      boolean
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "encodeExternalSellAction",
    values: [
      BigNumberish,
      BigNumberish,
      BigNumberish,
      string,
      BigNumberish,
      BigNumberish,
      BytesLike
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "encodeInternalTradeAction",
    values: [
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      string,
      BigNumberish,
      BigNumberish
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "encodeLiquidateAction",
    values: [
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "encodeTransferAction",
    values: [
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "encodeWithdrawalAction",
    values: [
      BigNumberish,
      BigNumberish,
      IDolomiteStructs.AssetAmountStruct,
      string
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "transfer",
    values: [
      string,
      BigNumberish,
      string,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish,
      BigNumberish
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "withdraw",
    values: [
      string,
      BigNumberish,
      string,
      BigNumberish,
      IDolomiteStructs.AssetAmountStruct,
      BigNumberish
    ]
  ): string;

  decodeFunctionResult(
    functionFragment: "DOLOMITE_MARGIN",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "all", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "deposit", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "encodeCallAction",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "encodeDepositAction",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "encodeExpirationAction",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "encodeExpiryLiquidateAction",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "encodeExternalSellAction",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "encodeInternalTradeAction",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "encodeLiquidateAction",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "encodeTransferAction",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "encodeWithdrawalAction",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "transfer", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "withdraw", data: BytesLike): Result;

  events: {};
}

export interface TestAccountActionLib extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: TestAccountActionLibInterface;

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

    all(overrides?: CallOverrides): Promise<[BigNumber]>;

    deposit(
      _accountOwner: string,
      _fromAccount: string,
      _toAccountNumber: BigNumberish,
      _marketId: BigNumberish,
      _amount: IDolomiteStructs.AssetAmountStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    encodeCallAction(
      _accountId: BigNumberish,
      _callee: string,
      _callData: BytesLike,
      overrides?: CallOverrides
    ): Promise<[IDolomiteStructs.ActionArgsStructOutput]>;

    encodeDepositAction(
      _accountId: BigNumberish,
      _marketId: BigNumberish,
      _amount: IDolomiteStructs.AssetAmountStruct,
      _fromAccount: string,
      overrides?: CallOverrides
    ): Promise<[IDolomiteStructs.ActionArgsStructOutput]>;

    encodeExpirationAction(
      _account: IDolomiteStructs.AccountInfoStruct,
      _accountId: BigNumberish,
      _owedMarketId: BigNumberish,
      _expiry: string,
      _expiryTimeDelta: BigNumberish,
      overrides?: CallOverrides
    ): Promise<[IDolomiteStructs.ActionArgsStructOutput]>;

    encodeExpiryLiquidateAction(
      _solidAccountId: BigNumberish,
      _liquidAccountId: BigNumberish,
      _owedMarketId: BigNumberish,
      _heldMarketId: BigNumberish,
      _expiryProxy: string,
      _expiry: BigNumberish,
      _flipMarkets: boolean,
      overrides?: CallOverrides
    ): Promise<[IDolomiteStructs.ActionArgsStructOutput]>;

    encodeExternalSellAction(
      _fromAccountId: BigNumberish,
      _primaryMarketId: BigNumberish,
      _secondaryMarketId: BigNumberish,
      _trader: string,
      _amountInWei: BigNumberish,
      _amountOutMinWei: BigNumberish,
      _orderData: BytesLike,
      overrides?: CallOverrides
    ): Promise<[IDolomiteStructs.ActionArgsStructOutput]>;

    encodeInternalTradeAction(
      _fromAccountId: BigNumberish,
      _toAccountId: BigNumberish,
      _primaryMarketId: BigNumberish,
      _secondaryMarketId: BigNumberish,
      _traderAddress: string,
      _amountInWei: BigNumberish,
      _amountOutWei: BigNumberish,
      overrides?: CallOverrides
    ): Promise<[IDolomiteStructs.ActionArgsStructOutput]>;

    encodeLiquidateAction(
      _solidAccountId: BigNumberish,
      _liquidAccountId: BigNumberish,
      _owedMarketId: BigNumberish,
      _heldMarketId: BigNumberish,
      _owedWeiToLiquidate: BigNumberish,
      overrides?: CallOverrides
    ): Promise<[IDolomiteStructs.ActionArgsStructOutput]>;

    encodeTransferAction(
      _fromAccountId: BigNumberish,
      _toAccountId: BigNumberish,
      _marketId: BigNumberish,
      _denomination: BigNumberish,
      _amount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<[IDolomiteStructs.ActionArgsStructOutput]>;

    encodeWithdrawalAction(
      _accountId: BigNumberish,
      _marketId: BigNumberish,
      _amount: IDolomiteStructs.AssetAmountStruct,
      _toAccount: string,
      overrides?: CallOverrides
    ): Promise<[IDolomiteStructs.ActionArgsStructOutput]>;

    transfer(
      _fromAccountOwner: string,
      _fromAccountNumber: BigNumberish,
      _toAccountOwner: string,
      _toAccountNumber: BigNumberish,
      _marketId: BigNumberish,
      _denomination: BigNumberish,
      _amount: BigNumberish,
      _balanceCheckFlag: BigNumberish,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;

    withdraw(
      _accountOwner: string,
      _fromAccountNumber: BigNumberish,
      _toAccount: string,
      _marketId: BigNumberish,
      _amount: IDolomiteStructs.AssetAmountStruct,
      _balanceCheckFlag: BigNumberish,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;
  };

  DOLOMITE_MARGIN(overrides?: CallOverrides): Promise<string>;

  all(overrides?: CallOverrides): Promise<BigNumber>;

  deposit(
    _accountOwner: string,
    _fromAccount: string,
    _toAccountNumber: BigNumberish,
    _marketId: BigNumberish,
    _amount: IDolomiteStructs.AssetAmountStruct,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  encodeCallAction(
    _accountId: BigNumberish,
    _callee: string,
    _callData: BytesLike,
    overrides?: CallOverrides
  ): Promise<IDolomiteStructs.ActionArgsStructOutput>;

  encodeDepositAction(
    _accountId: BigNumberish,
    _marketId: BigNumberish,
    _amount: IDolomiteStructs.AssetAmountStruct,
    _fromAccount: string,
    overrides?: CallOverrides
  ): Promise<IDolomiteStructs.ActionArgsStructOutput>;

  encodeExpirationAction(
    _account: IDolomiteStructs.AccountInfoStruct,
    _accountId: BigNumberish,
    _owedMarketId: BigNumberish,
    _expiry: string,
    _expiryTimeDelta: BigNumberish,
    overrides?: CallOverrides
  ): Promise<IDolomiteStructs.ActionArgsStructOutput>;

  encodeExpiryLiquidateAction(
    _solidAccountId: BigNumberish,
    _liquidAccountId: BigNumberish,
    _owedMarketId: BigNumberish,
    _heldMarketId: BigNumberish,
    _expiryProxy: string,
    _expiry: BigNumberish,
    _flipMarkets: boolean,
    overrides?: CallOverrides
  ): Promise<IDolomiteStructs.ActionArgsStructOutput>;

  encodeExternalSellAction(
    _fromAccountId: BigNumberish,
    _primaryMarketId: BigNumberish,
    _secondaryMarketId: BigNumberish,
    _trader: string,
    _amountInWei: BigNumberish,
    _amountOutMinWei: BigNumberish,
    _orderData: BytesLike,
    overrides?: CallOverrides
  ): Promise<IDolomiteStructs.ActionArgsStructOutput>;

  encodeInternalTradeAction(
    _fromAccountId: BigNumberish,
    _toAccountId: BigNumberish,
    _primaryMarketId: BigNumberish,
    _secondaryMarketId: BigNumberish,
    _traderAddress: string,
    _amountInWei: BigNumberish,
    _amountOutWei: BigNumberish,
    overrides?: CallOverrides
  ): Promise<IDolomiteStructs.ActionArgsStructOutput>;

  encodeLiquidateAction(
    _solidAccountId: BigNumberish,
    _liquidAccountId: BigNumberish,
    _owedMarketId: BigNumberish,
    _heldMarketId: BigNumberish,
    _owedWeiToLiquidate: BigNumberish,
    overrides?: CallOverrides
  ): Promise<IDolomiteStructs.ActionArgsStructOutput>;

  encodeTransferAction(
    _fromAccountId: BigNumberish,
    _toAccountId: BigNumberish,
    _marketId: BigNumberish,
    _denomination: BigNumberish,
    _amount: BigNumberish,
    overrides?: CallOverrides
  ): Promise<IDolomiteStructs.ActionArgsStructOutput>;

  encodeWithdrawalAction(
    _accountId: BigNumberish,
    _marketId: BigNumberish,
    _amount: IDolomiteStructs.AssetAmountStruct,
    _toAccount: string,
    overrides?: CallOverrides
  ): Promise<IDolomiteStructs.ActionArgsStructOutput>;

  transfer(
    _fromAccountOwner: string,
    _fromAccountNumber: BigNumberish,
    _toAccountOwner: string,
    _toAccountNumber: BigNumberish,
    _marketId: BigNumberish,
    _denomination: BigNumberish,
    _amount: BigNumberish,
    _balanceCheckFlag: BigNumberish,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  withdraw(
    _accountOwner: string,
    _fromAccountNumber: BigNumberish,
    _toAccount: string,
    _marketId: BigNumberish,
    _amount: IDolomiteStructs.AssetAmountStruct,
    _balanceCheckFlag: BigNumberish,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  callStatic: {
    DOLOMITE_MARGIN(overrides?: CallOverrides): Promise<string>;

    all(overrides?: CallOverrides): Promise<BigNumber>;

    deposit(
      _accountOwner: string,
      _fromAccount: string,
      _toAccountNumber: BigNumberish,
      _marketId: BigNumberish,
      _amount: IDolomiteStructs.AssetAmountStruct,
      overrides?: CallOverrides
    ): Promise<void>;

    encodeCallAction(
      _accountId: BigNumberish,
      _callee: string,
      _callData: BytesLike,
      overrides?: CallOverrides
    ): Promise<IDolomiteStructs.ActionArgsStructOutput>;

    encodeDepositAction(
      _accountId: BigNumberish,
      _marketId: BigNumberish,
      _amount: IDolomiteStructs.AssetAmountStruct,
      _fromAccount: string,
      overrides?: CallOverrides
    ): Promise<IDolomiteStructs.ActionArgsStructOutput>;

    encodeExpirationAction(
      _account: IDolomiteStructs.AccountInfoStruct,
      _accountId: BigNumberish,
      _owedMarketId: BigNumberish,
      _expiry: string,
      _expiryTimeDelta: BigNumberish,
      overrides?: CallOverrides
    ): Promise<IDolomiteStructs.ActionArgsStructOutput>;

    encodeExpiryLiquidateAction(
      _solidAccountId: BigNumberish,
      _liquidAccountId: BigNumberish,
      _owedMarketId: BigNumberish,
      _heldMarketId: BigNumberish,
      _expiryProxy: string,
      _expiry: BigNumberish,
      _flipMarkets: boolean,
      overrides?: CallOverrides
    ): Promise<IDolomiteStructs.ActionArgsStructOutput>;

    encodeExternalSellAction(
      _fromAccountId: BigNumberish,
      _primaryMarketId: BigNumberish,
      _secondaryMarketId: BigNumberish,
      _trader: string,
      _amountInWei: BigNumberish,
      _amountOutMinWei: BigNumberish,
      _orderData: BytesLike,
      overrides?: CallOverrides
    ): Promise<IDolomiteStructs.ActionArgsStructOutput>;

    encodeInternalTradeAction(
      _fromAccountId: BigNumberish,
      _toAccountId: BigNumberish,
      _primaryMarketId: BigNumberish,
      _secondaryMarketId: BigNumberish,
      _traderAddress: string,
      _amountInWei: BigNumberish,
      _amountOutWei: BigNumberish,
      overrides?: CallOverrides
    ): Promise<IDolomiteStructs.ActionArgsStructOutput>;

    encodeLiquidateAction(
      _solidAccountId: BigNumberish,
      _liquidAccountId: BigNumberish,
      _owedMarketId: BigNumberish,
      _heldMarketId: BigNumberish,
      _owedWeiToLiquidate: BigNumberish,
      overrides?: CallOverrides
    ): Promise<IDolomiteStructs.ActionArgsStructOutput>;

    encodeTransferAction(
      _fromAccountId: BigNumberish,
      _toAccountId: BigNumberish,
      _marketId: BigNumberish,
      _denomination: BigNumberish,
      _amount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<IDolomiteStructs.ActionArgsStructOutput>;

    encodeWithdrawalAction(
      _accountId: BigNumberish,
      _marketId: BigNumberish,
      _amount: IDolomiteStructs.AssetAmountStruct,
      _toAccount: string,
      overrides?: CallOverrides
    ): Promise<IDolomiteStructs.ActionArgsStructOutput>;

    transfer(
      _fromAccountOwner: string,
      _fromAccountNumber: BigNumberish,
      _toAccountOwner: string,
      _toAccountNumber: BigNumberish,
      _marketId: BigNumberish,
      _denomination: BigNumberish,
      _amount: BigNumberish,
      _balanceCheckFlag: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    withdraw(
      _accountOwner: string,
      _fromAccountNumber: BigNumberish,
      _toAccount: string,
      _marketId: BigNumberish,
      _amount: IDolomiteStructs.AssetAmountStruct,
      _balanceCheckFlag: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;
  };

  filters: {};

  estimateGas: {
    DOLOMITE_MARGIN(overrides?: CallOverrides): Promise<BigNumber>;

    all(overrides?: CallOverrides): Promise<BigNumber>;

    deposit(
      _accountOwner: string,
      _fromAccount: string,
      _toAccountNumber: BigNumberish,
      _marketId: BigNumberish,
      _amount: IDolomiteStructs.AssetAmountStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    encodeCallAction(
      _accountId: BigNumberish,
      _callee: string,
      _callData: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    encodeDepositAction(
      _accountId: BigNumberish,
      _marketId: BigNumberish,
      _amount: IDolomiteStructs.AssetAmountStruct,
      _fromAccount: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    encodeExpirationAction(
      _account: IDolomiteStructs.AccountInfoStruct,
      _accountId: BigNumberish,
      _owedMarketId: BigNumberish,
      _expiry: string,
      _expiryTimeDelta: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    encodeExpiryLiquidateAction(
      _solidAccountId: BigNumberish,
      _liquidAccountId: BigNumberish,
      _owedMarketId: BigNumberish,
      _heldMarketId: BigNumberish,
      _expiryProxy: string,
      _expiry: BigNumberish,
      _flipMarkets: boolean,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    encodeExternalSellAction(
      _fromAccountId: BigNumberish,
      _primaryMarketId: BigNumberish,
      _secondaryMarketId: BigNumberish,
      _trader: string,
      _amountInWei: BigNumberish,
      _amountOutMinWei: BigNumberish,
      _orderData: BytesLike,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    encodeInternalTradeAction(
      _fromAccountId: BigNumberish,
      _toAccountId: BigNumberish,
      _primaryMarketId: BigNumberish,
      _secondaryMarketId: BigNumberish,
      _traderAddress: string,
      _amountInWei: BigNumberish,
      _amountOutWei: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    encodeLiquidateAction(
      _solidAccountId: BigNumberish,
      _liquidAccountId: BigNumberish,
      _owedMarketId: BigNumberish,
      _heldMarketId: BigNumberish,
      _owedWeiToLiquidate: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    encodeTransferAction(
      _fromAccountId: BigNumberish,
      _toAccountId: BigNumberish,
      _marketId: BigNumberish,
      _denomination: BigNumberish,
      _amount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    encodeWithdrawalAction(
      _accountId: BigNumberish,
      _marketId: BigNumberish,
      _amount: IDolomiteStructs.AssetAmountStruct,
      _toAccount: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    transfer(
      _fromAccountOwner: string,
      _fromAccountNumber: BigNumberish,
      _toAccountOwner: string,
      _toAccountNumber: BigNumberish,
      _marketId: BigNumberish,
      _denomination: BigNumberish,
      _amount: BigNumberish,
      _balanceCheckFlag: BigNumberish,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;

    withdraw(
      _accountOwner: string,
      _fromAccountNumber: BigNumberish,
      _toAccount: string,
      _marketId: BigNumberish,
      _amount: IDolomiteStructs.AssetAmountStruct,
      _balanceCheckFlag: BigNumberish,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    DOLOMITE_MARGIN(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    all(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    deposit(
      _accountOwner: string,
      _fromAccount: string,
      _toAccountNumber: BigNumberish,
      _marketId: BigNumberish,
      _amount: IDolomiteStructs.AssetAmountStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    encodeCallAction(
      _accountId: BigNumberish,
      _callee: string,
      _callData: BytesLike,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    encodeDepositAction(
      _accountId: BigNumberish,
      _marketId: BigNumberish,
      _amount: IDolomiteStructs.AssetAmountStruct,
      _fromAccount: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    encodeExpirationAction(
      _account: IDolomiteStructs.AccountInfoStruct,
      _accountId: BigNumberish,
      _owedMarketId: BigNumberish,
      _expiry: string,
      _expiryTimeDelta: BigNumberish,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    encodeExpiryLiquidateAction(
      _solidAccountId: BigNumberish,
      _liquidAccountId: BigNumberish,
      _owedMarketId: BigNumberish,
      _heldMarketId: BigNumberish,
      _expiryProxy: string,
      _expiry: BigNumberish,
      _flipMarkets: boolean,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    encodeExternalSellAction(
      _fromAccountId: BigNumberish,
      _primaryMarketId: BigNumberish,
      _secondaryMarketId: BigNumberish,
      _trader: string,
      _amountInWei: BigNumberish,
      _amountOutMinWei: BigNumberish,
      _orderData: BytesLike,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    encodeInternalTradeAction(
      _fromAccountId: BigNumberish,
      _toAccountId: BigNumberish,
      _primaryMarketId: BigNumberish,
      _secondaryMarketId: BigNumberish,
      _traderAddress: string,
      _amountInWei: BigNumberish,
      _amountOutWei: BigNumberish,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    encodeLiquidateAction(
      _solidAccountId: BigNumberish,
      _liquidAccountId: BigNumberish,
      _owedMarketId: BigNumberish,
      _heldMarketId: BigNumberish,
      _owedWeiToLiquidate: BigNumberish,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    encodeTransferAction(
      _fromAccountId: BigNumberish,
      _toAccountId: BigNumberish,
      _marketId: BigNumberish,
      _denomination: BigNumberish,
      _amount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    encodeWithdrawalAction(
      _accountId: BigNumberish,
      _marketId: BigNumberish,
      _amount: IDolomiteStructs.AssetAmountStruct,
      _toAccount: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    transfer(
      _fromAccountOwner: string,
      _fromAccountNumber: BigNumberish,
      _toAccountOwner: string,
      _toAccountNumber: BigNumberish,
      _marketId: BigNumberish,
      _denomination: BigNumberish,
      _amount: BigNumberish,
      _balanceCheckFlag: BigNumberish,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;

    withdraw(
      _accountOwner: string,
      _fromAccountNumber: BigNumberish,
      _toAccount: string,
      _marketId: BigNumberish,
      _amount: IDolomiteStructs.AssetAmountStruct,
      _balanceCheckFlag: BigNumberish,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;
  };
}