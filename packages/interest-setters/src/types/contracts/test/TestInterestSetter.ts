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

export declare namespace IDolomiteInterestSetter {
  export type InterestRateStruct = { value: BigNumberish };

  export type InterestRateStructOutput = [BigNumber] & { value: BigNumber };
}

export interface TestInterestSetterInterface extends utils.Interface {
  functions: {
    "g_interestRates(address)": FunctionFragment;
    "getInterestRate(address,uint256,uint256)": FunctionFragment;
    "interestSetterType()": FunctionFragment;
    "setInterestRate(address,(uint256))": FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | "g_interestRates"
      | "getInterestRate"
      | "interestSetterType"
      | "setInterestRate"
  ): FunctionFragment;

  encodeFunctionData(
    functionFragment: "g_interestRates",
    values: [string]
  ): string;
  encodeFunctionData(
    functionFragment: "getInterestRate",
    values: [string, BigNumberish, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "interestSetterType",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "setInterestRate",
    values: [string, IDolomiteInterestSetter.InterestRateStruct]
  ): string;

  decodeFunctionResult(
    functionFragment: "g_interestRates",
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
  decodeFunctionResult(
    functionFragment: "setInterestRate",
    data: BytesLike
  ): Result;

  events: {};
}

export interface TestInterestSetter extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: TestInterestSetterInterface;

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
    g_interestRates(
      arg0: string,
      overrides?: CallOverrides
    ): Promise<[BigNumber] & { value: BigNumber }>;

    getInterestRate(
      token: string,
      arg1: BigNumberish,
      arg2: BigNumberish,
      overrides?: CallOverrides
    ): Promise<[IDolomiteInterestSetter.InterestRateStructOutput]>;

    interestSetterType(overrides?: CallOverrides): Promise<[number]>;

    setInterestRate(
      token: string,
      rate: IDolomiteInterestSetter.InterestRateStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;
  };

  g_interestRates(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;

  getInterestRate(
    token: string,
    arg1: BigNumberish,
    arg2: BigNumberish,
    overrides?: CallOverrides
  ): Promise<IDolomiteInterestSetter.InterestRateStructOutput>;

  interestSetterType(overrides?: CallOverrides): Promise<number>;

  setInterestRate(
    token: string,
    rate: IDolomiteInterestSetter.InterestRateStruct,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  callStatic: {
    g_interestRates(
      arg0: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    getInterestRate(
      token: string,
      arg1: BigNumberish,
      arg2: BigNumberish,
      overrides?: CallOverrides
    ): Promise<IDolomiteInterestSetter.InterestRateStructOutput>;

    interestSetterType(overrides?: CallOverrides): Promise<number>;

    setInterestRate(
      token: string,
      rate: IDolomiteInterestSetter.InterestRateStruct,
      overrides?: CallOverrides
    ): Promise<void>;
  };

  filters: {};

  estimateGas: {
    g_interestRates(
      arg0: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    getInterestRate(
      token: string,
      arg1: BigNumberish,
      arg2: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    interestSetterType(overrides?: CallOverrides): Promise<BigNumber>;

    setInterestRate(
      token: string,
      rate: IDolomiteInterestSetter.InterestRateStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    g_interestRates(
      arg0: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    getInterestRate(
      token: string,
      arg1: BigNumberish,
      arg2: BigNumberish,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    interestSetterType(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    setInterestRate(
      token: string,
      rate: IDolomiteInterestSetter.InterestRateStruct,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;
  };
}