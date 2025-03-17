import { BaseContract, BigNumber, BigNumberish, PopulatedTransaction } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { DolomiteMargin } from '../../../test/utils/dolomite';
import { CoreProtocolConfig, CoreProtocolType } from '../../../test/utils/setup';
import {
  DolomiteERC20,
  EventEmitterRegistry,
  IDolomiteMargin,
  IDolomiteMarginV2,
  IDolomiteRegistry,
  IERC20,
  IERC20Metadata__factory,
  IIsolationModeVaultFactory,
  ILiquidatorAssetRegistry,
  RegistryProxy,
} from '../../types';
import { IDolomiteInterestSetter, IDolomiteStructs } from '../../types/contracts/protocol/interfaces/IDolomiteMargin';
import { BYTES_EMPTY, Network, NetworkType, ZERO_BI } from '../no-deps-constants';
import InterestRateStruct = IDolomiteInterestSetter.InterestRateStruct;
import MonetaryPriceStruct = IDolomiteStructs.MonetaryPriceStruct;

export enum TargetCollateralization {
  Base = '1.00',

  /**
   * 120% collateralization || 83.33% LTV
   */
  _120 = '1.20',

  /**
   * 125% collateralization || 80.00% LTV
   */
  _125 = '1.25',

  /**
   * 133% collateralization || 75.00% LTV
   */
  _133 = '1.333333333333',

  /**
   * 150% collateralization || 66.66% LTV
   */
  _150 = '1.50',

  /**
   * 166.66% collateralization || 60.00% LTV
   */
  _166 = '1.666666666666',

  /**
   * 200% collateralization || 50.00% LTV
   */
  _200 = '2.00',
}

export enum TargetLiquidationPenalty {
  Base = '0.000',
  /**
   * 6%
   */
  _6 = '0.060',
  /**
   * 7%
   */
  _7 = '0.070',
  /**
   * 8%
   */
  _8 = '0.080',
  /**
   * 8.5%
   */
  _8_5 = '0.085',
  /**
   * 9%
   */
  _9 = '0.090',
  /**
   * 10%
   */
  _10 = '0.100',
  /**
   * 12%
   */
  _12 = '0.120',
  /**
   * 15%
   */
  _15 = '0.150',
}

export function getDolomiteOwnerConstructorParams(gnosisSafeAddress: string, secondsTimeLocked: BigNumberish): any[] {
  return [gnosisSafeAddress, secondsTimeLocked];
}

export function getRegistryProxyConstructorParams<T extends NetworkType>(
  implementationAddress: string,
  implementationCalldata: string,
  dolomiteMargin: DolomiteMargin<T>,
): any[] {
  return [implementationAddress, dolomiteMargin.address, implementationCalldata];
}

export function getRouterProxyConstructorParams<T extends NetworkType>(
  implementationAddress: string,
  implementationCalldata: string,
  dolomiteMargin: DolomiteMargin<T>,
): any[] {
  return [implementationAddress, dolomiteMargin.address, implementationCalldata];
}

export function getUpgradeableProxyConstructorParams<T extends NetworkType>(
  implementationAddress: string,
  implementationCalldata: PopulatedTransaction | null,
  dolomiteMargin: DolomiteMargin<T>,
): any[] {
  return [implementationAddress, dolomiteMargin.address, implementationCalldata?.data! ?? BYTES_EMPTY];
}

export function getIsolationModeFreezableLiquidatorProxyConstructorParams<T extends NetworkType>(
  core: CoreProtocolType<T>,
): any[] {
  return getIsolationModeFreezableLiquidatorProxyConstructorParamsWithoutCore(
    core.dolomiteRegistry,
    core.liquidatorAssetRegistry,
    core.dolomiteMargin,
    core.expiry,
    core.config,
  );
}

export function getIsolationModeFreezableLiquidatorProxyConstructorParamsWithoutCore<T extends NetworkType>(
  dolomiteRegistry: IDolomiteRegistry | RegistryProxy,
  liquidatorAssetRegistry: ILiquidatorAssetRegistry,
  dolomiteMargin: DolomiteMargin<T>,
  expiry: BaseContract,
  config: CoreProtocolConfig<T>,
): any[] {
  return [
    dolomiteRegistry.address,
    liquidatorAssetRegistry.address,
    dolomiteMargin.address,
    expiry.address,
    config.networkNumber,
  ];
}

export function getIsolationModeTraderProxyConstructorParams<T extends Network>(
  implementationAddress: string,
  implementationCalldata: string,
  core: CoreProtocolType<T>,
): any[] {
  return [implementationAddress, core.dolomiteMargin.address, implementationCalldata];
}

export async function getEventEmitterRegistryConstructorParams<T extends Network>(
  core: CoreProtocolType<T>,
  implementation: EventEmitterRegistry,
): Promise<any[]> {
  const initializationCallData = await implementation.populateTransaction.initialize();
  return [implementation.address, core.dolomiteMargin.address, initializationCallData.data!];
}

type OwnerAddMarketParameters<T extends Network> = T extends Network.ArbitrumOne
  ? Parameters<IDolomiteMargin['functions']['ownerAddMarket']>
  : Parameters<IDolomiteMarginV2['functions']['ownerAddMarket']>;

export interface BaseOracleContract {
  address: string;
  getPrice: (token: string) => Promise<MonetaryPriceStruct>;
}

export interface BaseInterestRateSetterContract {
  address: string;
  getInterestRate: (token: string, borrowWei: BigNumberish, supplyWei: BigNumberish) => Promise<InterestRateStruct>;
}

export function getOwnerAddMarketParameters<T extends NetworkType>(
  core: CoreProtocolType<T>,
  token: IERC20,
  priceOracle: BaseOracleContract,
  interestSetter: BaseInterestRateSetterContract,
  marginPremium: BigNumberish,
  spreadPremium: BigNumberish,
  maxSupplyWei: BigNumberish,
  maxBorrowWei: BigNumberish,
  isCollateralOnly: boolean,
  earningsRateOverride: BigNumberish = ZERO_BI,
): OwnerAddMarketParameters<T> {
  if (core.network === Network.ArbitrumOne) {
    return [
      token.address,
      priceOracle.address,
      interestSetter.address,
      { value: marginPremium },
      { value: spreadPremium },
      maxSupplyWei,
      isCollateralOnly,
      false,
    ] as Parameters<IDolomiteMargin['functions']['ownerAddMarket']> as any;
  }

  if (BigNumber.from(maxBorrowWei).gt(maxSupplyWei)) {
    throw new Error('maxBorrowWei must be smaller than maxSupplyWei');
  }

  return [
    token.address,
    priceOracle.address,
    interestSetter.address,
    { value: marginPremium },
    { value: spreadPremium },
    maxSupplyWei,
    maxBorrowWei,
    { value: earningsRateOverride },
    isCollateralOnly,
  ] as Parameters<IDolomiteMarginV2['functions']['ownerAddMarket']> as any;
}

export function getMarginPremiumForTargetCollateralization(
  baseCollateralization: BigNumber,
  targetCollateralization: TargetCollateralization,
): BigNumber {
  const one = parseEther('1');
  if (baseCollateralization.lte(one)) {
    throw new Error('Base collateralization must be greater than 100% (1.00)');
  }

  if (targetCollateralization === TargetCollateralization.Base) {
    return ZERO_BI;
  }

  return parseEther(targetCollateralization).mul(one).div(baseCollateralization).sub(one);
}

export function getLiquidationPremiumForTargetLiquidationPenalty(
  baseLiquidationPenalty: BigNumber,
  targetPenalty: TargetLiquidationPenalty,
): BigNumber {
  if (baseLiquidationPenalty.gte(parseEther('1.00'))) {
    throw new Error('Base collateralization must be less than 100% (1.00)');
  }

  if (targetPenalty === TargetLiquidationPenalty.Base) {
    return ZERO_BI;
  }

  const one = parseEther('1');
  return parseEther(targetPenalty).mul(one).div(baseLiquidationPenalty).sub(one);
}

export function getOwnerAddMarketParametersForIsolationMode<T extends NetworkType>(
  core: CoreProtocolType<T>,
  token: IIsolationModeVaultFactory,
  priceOracle: { address: string; getPrice: (token: string) => Promise<MonetaryPriceStruct> },
  interestSetter: {
    address: string;
    getInterestRate: (token: string, borrowWei: BigNumberish, supplyWei: BigNumberish) => Promise<InterestRateStruct>;
  },
  marginPremium: BigNumberish,
  spreadPremium: BigNumberish,
  maxSupplyWei: BigNumberish,
  maxBorrowWei: BigNumberish,
  isCollateralOnly: boolean = true,
  earningsRateOverride: BigNumberish = ZERO_BI,
): OwnerAddMarketParameters<T> {
  return getOwnerAddMarketParameters(
    core,
    token as any as IERC20,
    priceOracle,
    interestSetter,
    marginPremium,
    spreadPremium,
    maxSupplyWei,
    maxBorrowWei,
    isCollateralOnly,
    earningsRateOverride,
  );
}

export function getDolomiteMigratorConstructorParams<T extends NetworkType>(
  dolomiteMargin: DolomiteMargin<T>,
  dolomiteRegistry: IDolomiteRegistry,
  handler: string,
): any[] {
  return [dolomiteRegistry.address, handler, dolomiteMargin.address];
}

export async function getDolomiteErc20ProxyConstructorParams<T extends NetworkType>(
  core: CoreProtocolType<T>,
  implementation: DolomiteERC20,
  marketId: BigNumberish,
): Promise<any[]> {
  const token = IERC20Metadata__factory.connect(
    await core.dolomiteMargin.getMarketTokenAddress(marketId),
    core.hhUser1,
  );
  const symbol = await token.symbol();
  const transaction = await implementation.populateTransaction.initialize(
    `Dolomite: ${symbol}`,
    `d${symbol}`,
    await token.decimals(),
    marketId,
  );
  return [implementation.address, core.dolomiteMargin.address, transaction.data!];
}

export async function getDolomiteErc4626ProxyConstructorParams<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
): Promise<any[]> {
  const token = IERC20Metadata__factory.connect(
    await core.dolomiteMargin.getMarketTokenAddress(marketId),
    core.hhUser1,
  );
  if (core.tokens.payableToken.address === token.address) {
    return Promise.reject(new Error(`Invalid token, found payable: ${token.address}`));
  }

  const symbol = await token.symbol();
  const implementationContract = core.implementationContracts.dolomiteERC4626Implementation;
  const transaction = await implementationContract.populateTransaction.initialize(
    `Dolomite: ${symbol}`,
    `d${symbol}`,
    await token.decimals(),
    marketId,
    core.dolomiteRegistry.address,
  );
  return [implementationContract.address, core.dolomiteMargin.address, transaction.data!];
}

export async function getDolomiteErc4626WithPayableProxyConstructorParams<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
): Promise<any[]> {
  const token = IERC20Metadata__factory.connect(
    await core.dolomiteMargin.getMarketTokenAddress(marketId),
    core.hhUser1,
  );
  if (core.tokens.payableToken.address !== token.address) {
    return Promise.reject(new Error(`Invalid payable token, found: ${token.address}`));
  }

  const implementationContract = core.implementationContracts.dolomiteERC4626WithPayableImplementation;
  const symbol = await token.symbol();
  const transaction = await implementationContract.populateTransaction.initialize(
    `Dolomite: ${symbol}`,
    `d${symbol}`,
    await token.decimals(),
    marketId,
    core.dolomiteRegistry.address,
  );
  return [implementationContract.address, core.dolomiteMargin.address, transaction.data!];
}

export function getIsolationModeTokenVaultMigratorConstructorParams<T extends NetworkType>(
  core: CoreProtocolType<T>,
  token: IERC20,
): any[] {
  return [core.dolomiteRegistry.address, token.address];
}
