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
} from "../common";

export declare namespace IDolomiteInterestSetter {
  export type InterestRateStruct = { value: BigNumberish };

  export type InterestRateStructOutput = [BigNumber] & { value: BigNumber };
}

export interface LinearStepFunctionInterestSetterInterface
  extends utils.Interface {
  functions: {
    "LOWER_OPTIMAL_PERCENT()": FunctionFragment;
    "NINETY_PERCENT()": FunctionFragment;
    "ONE_HUNDRED_PERCENT()": FunctionFragment;
    "OPTIMAL_UTILIZATION()": FunctionFragment;
    "SECONDS_IN_A_YEAR()": FunctionFragment;
    "TEN_PERCENT()": FunctionFragment;
    "UPPER_OPTIMAL_PERCENT()": FunctionFragment;
    "getInterestRate(address,uint256,uint256)": FunctionFragment;
    "interestSetterType()": FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | "LOWER_OPTIMAL_PERCENT"
      | "NINETY_PERCENT"
      | "ONE_HUNDRED_PERCENT"
      | "OPTIMAL_UTILIZATION"
      | "SECONDS_IN_A_YEAR"
      | "TEN_PERCENT"
      | "UPPER_OPTIMAL_PERCENT"
      | "getInterestRate"
      | "interestSetterType"
  ): FunctionFragment;

  encodeFunctionData(
    functionFragment: "LOWER_OPTIMAL_PERCENT",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "NINETY_PERCENT",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "ONE_HUNDRED_PERCENT",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "OPTIMAL_UTILIZATION",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "SECONDS_IN_A_YEAR",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "TEN_PERCENT",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "UPPER_OPTIMAL_PERCENT",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "getInterestRate",
    values: [string, BigNumberish, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "interestSetterType",
    values?: undefined
  ): string;

  decodeFunctionResult(
    functionFragment: "LOWER_OPTIMAL_PERCENT",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "NINETY_PERCENT",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "ONE_HUNDRED_PERCENT",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "OPTIMAL_UTILIZATION",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "SECONDS_IN_A_YEAR",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "TEN_PERCENT",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "UPPER_OPTIMAL_PERCENT",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getInterestRate",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "interestSetterType",
    data: BytesLike
  ): Result;

  events: {};
}

export interface LinearStepFunctionInterestSetter extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: LinearStepFunctionInterestSetterInterface;

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
    LOWER_OPTIMAL_PERCENT(overrides?: CallOverrides): Promise<[BigNumber]>;

    NINETY_PERCENT(overrides?: CallOverrides): Promise<[BigNumber]>;

    ONE_HUNDRED_PERCENT(overrides?: CallOverrides): Promise<[BigNumber]>;

    OPTIMAL_UTILIZATION(overrides?: CallOverrides): Promise<[BigNumber]>;

    SECONDS_IN_A_YEAR(overrides?: CallOverrides): Promise<[BigNumber]>;

    TEN_PERCENT(overrides?: CallOverrides): Promise<[BigNumber]>;

    UPPER_OPTIMAL_PERCENT(overrides?: CallOverrides): Promise<[BigNumber]>;

    getInterestRate(
      arg0: string,
      _borrowWei: BigNumberish,
      _supplyWei: BigNumberish,
      overrides?: CallOverrides
    ): Promise<[IDolomiteInterestSetter.InterestRateStructOutput]>;

    interestSetterType(overrides?: CallOverrides): Promise<[number]>;
  };

  LOWER_OPTIMAL_PERCENT(overrides?: CallOverrides): Promise<BigNumber>;

  NINETY_PERCENT(overrides?: CallOverrides): Promise<BigNumber>;

  ONE_HUNDRED_PERCENT(overrides?: CallOverrides): Promise<BigNumber>;

  OPTIMAL_UTILIZATION(overrides?: CallOverrides): Promise<BigNumber>;

  SECONDS_IN_A_YEAR(overrides?: CallOverrides): Promise<BigNumber>;

  TEN_PERCENT(overrides?: CallOverrides): Promise<BigNumber>;

  UPPER_OPTIMAL_PERCENT(overrides?: CallOverrides): Promise<BigNumber>;

  getInterestRate(
    arg0: string,
    _borrowWei: BigNumberish,
    _supplyWei: BigNumberish,
    overrides?: CallOverrides
  ): Promise<IDolomiteInterestSetter.InterestRateStructOutput>;

  interestSetterType(overrides?: CallOverrides): Promise<number>;

  callStatic: {
    LOWER_OPTIMAL_PERCENT(overrides?: CallOverrides): Promise<BigNumber>;

    NINETY_PERCENT(overrides?: CallOverrides): Promise<BigNumber>;

    ONE_HUNDRED_PERCENT(overrides?: CallOverrides): Promise<BigNumber>;

    OPTIMAL_UTILIZATION(overrides?: CallOverrides): Promise<BigNumber>;

    SECONDS_IN_A_YEAR(overrides?: CallOverrides): Promise<BigNumber>;

    TEN_PERCENT(overrides?: CallOverrides): Promise<BigNumber>;

    UPPER_OPTIMAL_PERCENT(overrides?: CallOverrides): Promise<BigNumber>;

    getInterestRate(
      arg0: string,
      _borrowWei: BigNumberish,
      _supplyWei: BigNumberish,
      overrides?: CallOverrides
    ): Promise<IDolomiteInterestSetter.InterestRateStructOutput>;

    interestSetterType(overrides?: CallOverrides): Promise<number>;
  };

  filters: {};

  estimateGas: {
    LOWER_OPTIMAL_PERCENT(overrides?: CallOverrides): Promise<BigNumber>;

    NINETY_PERCENT(overrides?: CallOverrides): Promise<BigNumber>;

    ONE_HUNDRED_PERCENT(overrides?: CallOverrides): Promise<BigNumber>;

    OPTIMAL_UTILIZATION(overrides?: CallOverrides): Promise<BigNumber>;

    SECONDS_IN_A_YEAR(overrides?: CallOverrides): Promise<BigNumber>;

    TEN_PERCENT(overrides?: CallOverrides): Promise<BigNumber>;

    UPPER_OPTIMAL_PERCENT(overrides?: CallOverrides): Promise<BigNumber>;

    getInterestRate(
      arg0: string,
      _borrowWei: BigNumberish,
      _supplyWei: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    interestSetterType(overrides?: CallOverrides): Promise<BigNumber>;
  };

  populateTransaction: {
    LOWER_OPTIMAL_PERCENT(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    NINETY_PERCENT(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    ONE_HUNDRED_PERCENT(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    OPTIMAL_UTILIZATION(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    SECONDS_IN_A_YEAR(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    TEN_PERCENT(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    UPPER_OPTIMAL_PERCENT(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    getInterestRate(
      arg0: string,
      _borrowWei: BigNumberish,
      _supplyWei: BigNumberish,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    interestSetterType(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;
  };
}