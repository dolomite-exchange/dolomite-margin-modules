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
} from "../../../../../../common";

export declare namespace IIsolationModeUnwrapperTraderV2 {
  export type CreateActionsForUnwrappingParamsStruct = {
    primaryAccountId: BigNumberish;
    otherAccountId: BigNumberish;
    primaryAccountOwner: string;
    primaryAccountNumber: BigNumberish;
    otherAccountOwner: string;
    otherAccountNumber: BigNumberish;
    outputMarket: BigNumberish;
    inputMarket: BigNumberish;
    minOutputAmount: BigNumberish;
    inputAmount: BigNumberish;
    orderData: BytesLike;
  };

  export type CreateActionsForUnwrappingParamsStructOutput = [
    BigNumber,
    BigNumber,
    string,
    BigNumber,
    string,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    string
  ] & {
    primaryAccountId: BigNumber;
    otherAccountId: BigNumber;
    primaryAccountOwner: string;
    primaryAccountNumber: BigNumber;
    otherAccountOwner: string;
    otherAccountNumber: BigNumber;
    outputMarket: BigNumber;
    inputMarket: BigNumber;
    minOutputAmount: BigNumber;
    inputAmount: BigNumber;
    orderData: string;
  };
}

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

export interface AsyncIsolationModeUnwrapperTraderImplInterface
  extends utils.Interface {
  functions: {
    "createActionsForUnwrapping(UpgradeableAsyncIsolationModeUnwrapperTrader,(uint256,uint256,address,uint256,address,uint256,uint256,uint256,uint256,uint256,bytes))": FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic: "createActionsForUnwrapping"
  ): FunctionFragment;

  encodeFunctionData(
    functionFragment: "createActionsForUnwrapping",
    values: [
      string,
      IIsolationModeUnwrapperTraderV2.CreateActionsForUnwrappingParamsStruct
    ]
  ): string;

  decodeFunctionResult(
    functionFragment: "createActionsForUnwrapping",
    data: BytesLike
  ): Result;

  events: {};
}

export interface AsyncIsolationModeUnwrapperTraderImpl extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: AsyncIsolationModeUnwrapperTraderImplInterface;

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
    createActionsForUnwrapping(
      _unwrapper: string,
      _params: IIsolationModeUnwrapperTraderV2.CreateActionsForUnwrappingParamsStruct,
      overrides?: CallOverrides
    ): Promise<[IDolomiteStructs.ActionArgsStructOutput[]]>;
  };

  createActionsForUnwrapping(
    _unwrapper: string,
    _params: IIsolationModeUnwrapperTraderV2.CreateActionsForUnwrappingParamsStruct,
    overrides?: CallOverrides
  ): Promise<IDolomiteStructs.ActionArgsStructOutput[]>;

  callStatic: {
    createActionsForUnwrapping(
      _unwrapper: string,
      _params: IIsolationModeUnwrapperTraderV2.CreateActionsForUnwrappingParamsStruct,
      overrides?: CallOverrides
    ): Promise<IDolomiteStructs.ActionArgsStructOutput[]>;
  };

  filters: {};

  estimateGas: {
    createActionsForUnwrapping(
      _unwrapper: string,
      _params: IIsolationModeUnwrapperTraderV2.CreateActionsForUnwrappingParamsStruct,
      overrides?: CallOverrides
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    createActionsForUnwrapping(
      _unwrapper: string,
      _params: IIsolationModeUnwrapperTraderV2.CreateActionsForUnwrappingParamsStruct,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;
  };
}