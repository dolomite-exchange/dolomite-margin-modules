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

export interface IGmxVaultInterface extends utils.Interface {
  functions: {
    "adjustForDecimals(uint256,address,address)": FunctionFragment;
    "getFeeBasisPoints(address,uint256,uint256,uint256,bool)": FunctionFragment;
    "getMinPrice(address)": FunctionFragment;
    "getRedemptionAmount(address,uint256)": FunctionFragment;
    "mintBurnFeeBasisPoints()": FunctionFragment;
    "taxBasisPoints()": FunctionFragment;
    "usdg()": FunctionFragment;
    "whitelistedTokens(address)": FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | "adjustForDecimals"
      | "getFeeBasisPoints"
      | "getMinPrice"
      | "getRedemptionAmount"
      | "mintBurnFeeBasisPoints"
      | "taxBasisPoints"
      | "usdg"
      | "whitelistedTokens"
  ): FunctionFragment;

  encodeFunctionData(
    functionFragment: "adjustForDecimals",
    values: [BigNumberish, string, string]
  ): string;
  encodeFunctionData(
    functionFragment: "getFeeBasisPoints",
    values: [string, BigNumberish, BigNumberish, BigNumberish, boolean]
  ): string;
  encodeFunctionData(functionFragment: "getMinPrice", values: [string]): string;
  encodeFunctionData(
    functionFragment: "getRedemptionAmount",
    values: [string, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "mintBurnFeeBasisPoints",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "taxBasisPoints",
    values?: undefined
  ): string;
  encodeFunctionData(functionFragment: "usdg", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "whitelistedTokens",
    values: [string]
  ): string;

  decodeFunctionResult(
    functionFragment: "adjustForDecimals",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getFeeBasisPoints",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getMinPrice",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getRedemptionAmount",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "mintBurnFeeBasisPoints",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "taxBasisPoints",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "usdg", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "whitelistedTokens",
    data: BytesLike
  ): Result;

  events: {};
}

export interface IGmxVault extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: IGmxVaultInterface;

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
    adjustForDecimals(
      _amount: BigNumberish,
      _tokenDiv: string,
      _tokenMul: string,
      overrides?: CallOverrides
    ): Promise<[BigNumber]>;

    getFeeBasisPoints(
      _token: string,
      _usdgDelta: BigNumberish,
      _feeBasisPoints: BigNumberish,
      _taxBasisPoints: BigNumberish,
      _increment: boolean,
      overrides?: CallOverrides
    ): Promise<[BigNumber]>;

    getMinPrice(
      _token: string,
      overrides?: CallOverrides
    ): Promise<[BigNumber]>;

    getRedemptionAmount(
      _token: string,
      _usdgAmount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<[BigNumber]>;

    mintBurnFeeBasisPoints(overrides?: CallOverrides): Promise<[BigNumber]>;

    taxBasisPoints(overrides?: CallOverrides): Promise<[BigNumber]>;

    usdg(overrides?: CallOverrides): Promise<[string]>;

    whitelistedTokens(
      _token: string,
      overrides?: CallOverrides
    ): Promise<[boolean]>;
  };

  adjustForDecimals(
    _amount: BigNumberish,
    _tokenDiv: string,
    _tokenMul: string,
    overrides?: CallOverrides
  ): Promise<BigNumber>;

  getFeeBasisPoints(
    _token: string,
    _usdgDelta: BigNumberish,
    _feeBasisPoints: BigNumberish,
    _taxBasisPoints: BigNumberish,
    _increment: boolean,
    overrides?: CallOverrides
  ): Promise<BigNumber>;

  getMinPrice(_token: string, overrides?: CallOverrides): Promise<BigNumber>;

  getRedemptionAmount(
    _token: string,
    _usdgAmount: BigNumberish,
    overrides?: CallOverrides
  ): Promise<BigNumber>;

  mintBurnFeeBasisPoints(overrides?: CallOverrides): Promise<BigNumber>;

  taxBasisPoints(overrides?: CallOverrides): Promise<BigNumber>;

  usdg(overrides?: CallOverrides): Promise<string>;

  whitelistedTokens(
    _token: string,
    overrides?: CallOverrides
  ): Promise<boolean>;

  callStatic: {
    adjustForDecimals(
      _amount: BigNumberish,
      _tokenDiv: string,
      _tokenMul: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    getFeeBasisPoints(
      _token: string,
      _usdgDelta: BigNumberish,
      _feeBasisPoints: BigNumberish,
      _taxBasisPoints: BigNumberish,
      _increment: boolean,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    getMinPrice(_token: string, overrides?: CallOverrides): Promise<BigNumber>;

    getRedemptionAmount(
      _token: string,
      _usdgAmount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    mintBurnFeeBasisPoints(overrides?: CallOverrides): Promise<BigNumber>;

    taxBasisPoints(overrides?: CallOverrides): Promise<BigNumber>;

    usdg(overrides?: CallOverrides): Promise<string>;

    whitelistedTokens(
      _token: string,
      overrides?: CallOverrides
    ): Promise<boolean>;
  };

  filters: {};

  estimateGas: {
    adjustForDecimals(
      _amount: BigNumberish,
      _tokenDiv: string,
      _tokenMul: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    getFeeBasisPoints(
      _token: string,
      _usdgDelta: BigNumberish,
      _feeBasisPoints: BigNumberish,
      _taxBasisPoints: BigNumberish,
      _increment: boolean,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    getMinPrice(_token: string, overrides?: CallOverrides): Promise<BigNumber>;

    getRedemptionAmount(
      _token: string,
      _usdgAmount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    mintBurnFeeBasisPoints(overrides?: CallOverrides): Promise<BigNumber>;

    taxBasisPoints(overrides?: CallOverrides): Promise<BigNumber>;

    usdg(overrides?: CallOverrides): Promise<BigNumber>;

    whitelistedTokens(
      _token: string,
      overrides?: CallOverrides
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    adjustForDecimals(
      _amount: BigNumberish,
      _tokenDiv: string,
      _tokenMul: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    getFeeBasisPoints(
      _token: string,
      _usdgDelta: BigNumberish,
      _feeBasisPoints: BigNumberish,
      _taxBasisPoints: BigNumberish,
      _increment: boolean,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    getMinPrice(
      _token: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    getRedemptionAmount(
      _token: string,
      _usdgAmount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    mintBurnFeeBasisPoints(
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    taxBasisPoints(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    usdg(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    whitelistedTokens(
      _token: string,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;
  };
}