/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
  BaseContract,
  BigNumber,
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

export interface IAuthorizationBaseInterface extends utils.Interface {
  functions: {
    "isCallerAuthorized(address)": FunctionFragment;
    "setIsCallerAuthorized(address,bool)": FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic: "isCallerAuthorized" | "setIsCallerAuthorized"
  ): FunctionFragment;

  encodeFunctionData(
    functionFragment: "isCallerAuthorized",
    values: [string]
  ): string;
  encodeFunctionData(
    functionFragment: "setIsCallerAuthorized",
    values: [string, boolean]
  ): string;

  decodeFunctionResult(
    functionFragment: "isCallerAuthorized",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setIsCallerAuthorized",
    data: BytesLike
  ): Result;

  events: {};
}

export interface IAuthorizationBase extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: IAuthorizationBaseInterface;

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
    isCallerAuthorized(
      _caller: string,
      overrides?: CallOverrides
    ): Promise<[boolean]>;

    setIsCallerAuthorized(
      _caller: string,
      _isAuthorized: boolean,
      overrides?: Overrides & { from?: string }
    ): Promise<ContractTransaction>;
  };

  isCallerAuthorized(
    _caller: string,
    overrides?: CallOverrides
  ): Promise<boolean>;

  setIsCallerAuthorized(
    _caller: string,
    _isAuthorized: boolean,
    overrides?: Overrides & { from?: string }
  ): Promise<ContractTransaction>;

  callStatic: {
    isCallerAuthorized(
      _caller: string,
      overrides?: CallOverrides
    ): Promise<boolean>;

    setIsCallerAuthorized(
      _caller: string,
      _isAuthorized: boolean,
      overrides?: CallOverrides
    ): Promise<void>;
  };

  filters: {};

  estimateGas: {
    isCallerAuthorized(
      _caller: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    setIsCallerAuthorized(
      _caller: string,
      _isAuthorized: boolean,
      overrides?: Overrides & { from?: string }
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    isCallerAuthorized(
      _caller: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    setIsCallerAuthorized(
      _caller: string,
      _isAuthorized: boolean,
      overrides?: Overrides & { from?: string }
    ): Promise<PopulatedTransaction>;
  };
}