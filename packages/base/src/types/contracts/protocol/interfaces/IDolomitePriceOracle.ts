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
} from "../../../common";

export declare namespace IDolomiteStructs {
  export type MonetaryPriceStruct = { value: BigNumberish };

  export type MonetaryPriceStructOutput = [BigNumber] & { value: BigNumber };
}

export interface IDolomitePriceOracleInterface extends utils.Interface {
  functions: {
    "getPrice(address)": FunctionFragment;
  };

  getFunction(nameOrSignatureOrTopic: "getPrice"): FunctionFragment;

  encodeFunctionData(functionFragment: "getPrice", values: [string]): string;

  decodeFunctionResult(functionFragment: "getPrice", data: BytesLike): Result;

  events: {};
}

export interface IDolomitePriceOracle extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: IDolomitePriceOracleInterface;

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
    getPrice(
      token: string,
      overrides?: CallOverrides
    ): Promise<[IDolomiteStructs.MonetaryPriceStructOutput]>;
  };

  getPrice(
    token: string,
    overrides?: CallOverrides
  ): Promise<IDolomiteStructs.MonetaryPriceStructOutput>;

  callStatic: {
    getPrice(
      token: string,
      overrides?: CallOverrides
    ): Promise<IDolomiteStructs.MonetaryPriceStructOutput>;
  };

  filters: {};

  estimateGas: {
    getPrice(token: string, overrides?: CallOverrides): Promise<BigNumber>;
  };

  populateTransaction: {
    getPrice(
      token: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;
  };
}