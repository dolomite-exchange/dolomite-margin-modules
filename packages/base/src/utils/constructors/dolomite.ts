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
import { BYTES_EMPTY, Network, DolomiteNetwork, ZERO_BI } from '../no-deps-constants';
import InterestRateStruct = IDolomiteInterestSetter.InterestRateStruct;
import MonetaryPriceStruct = IDolomiteStructs.MonetaryPriceStruct;
import { AdminRegistry } from 'packages/admin/src/types/contracts/AdminRegistry';

export enum LowerPercentage {
  _1 = '0.01',
  _2 = '0.02',
  _3 = '0.03',
  _3_9 = '0.039',
  _4 = '0.04',
  _5 = '0.05',
  _6 = '0.06',
  _7 = '0.07',
  _8 = '0.08',
  _9 = '0.09',
  _10 = '0.10',
  _11 = '0.11',
  _12 = '0.12',
  _13 = '0.13',
  _14 = '0.14',
  _15 = '0.15',
  _16 = '0.16',
  _17 = '0.17',
  _18 = '0.18',
  _19 = '0.19',
  _20 = '0.20',
  _25 = '0.25',
  _30 = '0.30',
  _35 = '0.35',
  _40 = '0.40',
  _45 = '0.45',
  _50 = '0.50',
  _60 = '0.60',
  _70 = '0.70',
}

export enum UpperPercentage {
  _30 = '0.30',
  _40 = '0.40',
  _45 = '0.45',
  _50 = '0.50',
  _60 = '0.60',
  _70 = '0.70',
  _80 = '0.80',
  _90 = '0.90',
  _100 = '1.00',
  _110 = '1.10',
  _120 = '1.20',
  _125 = '1.25',
  _150 = '1.50',
  _175 = '1.75',
  _200 = '2.00',
  _225 = '2.25',
  _250 = '2.50',
  _300 = '3.00',
}

export enum OptimalUtilizationRate {
  _40 = '0.40',
  _50 = '0.50',
  _60 = '0.60',
  _70 = '0.70',
  _75 = '0.75',
  _80 = '0.80',
  _90 = '0.90',
  _91 = '0.91',
  _92 = '0.92',
  _95 = '0.95',
  _99 = '0.99',
}

export enum TargetCollateralization {
  Base = '1.00',

  /**
   * 105.263% collateralization || 95.00% LTV
   */
  _105 = '1.052631578947368421',

  /**
   * 109% collateralization || 91% LTV
   */
  _109 = '1.098901098901098901',

  /**
   * 108% collateralization || 92% LTV
   */
  _108 = '1.086956521739130434',

  /**
   * 107% collateralization || 93% LTV
   */
  _107 = '1.071428571428571428',

  /**
   * 111% collateralization || 90% LTV
   */
  _111 = '1.111111111111111111',

  /**
   * 117.64% collateralization || 85% LTV
   */
  _117 = '1.176470588235294117',

  /**
   * 120% collateralization || 83.33% LTV
   */
  _120 = '1.20',

  /**
   * 121.95% collateralization || 82% LTV
   */
  _121 = '1.219512195121951219',

  /**
   * 125% collateralization || 80.00% LTV
   */
  _125 = '1.25',

  /**
   * 128.205% collateralization || 78.00% LTV
   */
  _128 = '1.282051282051282051',

  /**
   * 133% collateralization || 75.00% LTV
   */
  _133 = '1.333333333333333333',

  /**
   * 136% collateralization || 73.00% LTV
   */
  _136 = '1.369863013698630136',

  /**
   * 142.85% collateralization || 70.00% LTV
   */
  _142 = '1.428571428571428571',

  /**
   * 150% collateralization || 66.66% LTV
   */
  _150 = '1.50',

  /**
   * 166.66% collateralization || 60.00% LTV
   */
  _166 = '1.666666666666666666',

  /**
   * 200% collateralization || 50.00% LTV
   */
  _200 = '2.00',
}

export enum TargetLiquidationPenalty {
  Base = '0.000',
  /**
   * 2%
   */
  _2 = '0.020',
  /**
   * 3%
   */
  _3 = '0.030',
  /**
   * 4%
   */
  _4 = '0.040',
  /**
   * 5%
   */
  _5 = '0.050',
  /**
   * 6%
   */
  _6 = '0.060',
  /**
   * 7%
   */
  _7 = '0.070',
  /**
   * 7.5%
   */
  _7_5 = '0.075',
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

export enum AccountRiskOverrideCategory {
  NONE = 0,
  BERA = 1,
  BTC = 2,
  ETH = 3,
  STABLE = 4,
}

export enum AccountRiskOverrideRiskFeature {
  NONE = 0,
  BORROW_ONLY = 1,
  SINGLE_COLLATERAL_WITH_STRICT_DEBT = 2,
}

export interface SingleCollateralWithStrictDebtParams {
  debtMarketIds: BigNumberish[];
  marginRatioOverride: TargetCollateralization;
  liquidationRewardOverride: TargetLiquidationPenalty;
}

export async function getAdminRegistryProxyConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  implementation: AdminRegistry,
): Promise<any[]> {
  const transaction = await implementation.populateTransaction.initialize();
  return [implementation.address, core.dolomiteMargin.address, transaction.data!];
}

export function getRegistryProxyConstructorParams<T extends DolomiteNetwork>(
  implementationAddress: string,
  implementationCalldata: string,
  dolomiteMargin: DolomiteMargin<T>,
): any[] {
  return [implementationAddress, dolomiteMargin.address, implementationCalldata];
}

export function getRouterProxyConstructorParams<T extends DolomiteNetwork>(
  implementationAddress: string,
  implementationCalldata: string,
  dolomiteMargin: DolomiteMargin<T>,
): any[] {
  return [implementationAddress, dolomiteMargin.address, implementationCalldata];
}

export function getUpgradeableProxyConstructorParams<T extends DolomiteNetwork>(
  implementationAddress: string,
  implementationCalldata: PopulatedTransaction | null,
  dolomiteMargin: DolomiteMargin<T>,
): any[] {
  return [implementationAddress, dolomiteMargin.address, implementationCalldata?.data! ?? BYTES_EMPTY];
}

export function getIsolationModeFreezableLiquidatorProxyConstructorParams<T extends DolomiteNetwork>(
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

export function getIsolationModeFreezableLiquidatorProxyConstructorParamsWithoutCore<T extends DolomiteNetwork>(
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

export function getIsolationModeTraderProxyConstructorParams<T extends DolomiteNetwork>(
  implementationAddress: string,
  implementationCalldata: string,
  core: CoreProtocolType<T>,
): any[] {
  return [implementationAddress, core.dolomiteMargin.address, implementationCalldata];
}

export async function getEventEmitterRegistryConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  implementation: EventEmitterRegistry,
): Promise<any[]> {
  const initializationCallData = await implementation.populateTransaction.initialize();
  return [implementation.address, core.dolomiteMargin.address, initializationCallData.data!];
}

type OwnerAddMarketParameters<T extends DolomiteNetwork> = T extends Network.ArbitrumOne
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

export function getOwnerAddMarketParameters<T extends DolomiteNetwork>(
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

export function getOwnerAddMarketParametersForIsolationMode<T extends DolomiteNetwork>(
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

export function getDolomiteMigratorConstructorParams<T extends DolomiteNetwork>(
  dolomiteMargin: DolomiteMargin<T>,
  dolomiteRegistry: IDolomiteRegistry,
  handler: string,
): any[] {
  return [dolomiteRegistry.address, handler, dolomiteMargin.address];
}

export function getDolomiteErc20ImplementationConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
): any[] {
  return [core.network];
}

export function getDolomiteErc20PayableImplementationConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
): any[] {
  return [core.tokens.payableToken.address, core.network];
}

export async function getDolomiteErc20ProxyConstructorParams<T extends DolomiteNetwork>(
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

export async function getDolomiteErc4626ImplementationConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
): Promise<any[]> {
  return [
    core.network,
    core.dolomiteRegistry.address,
    core.dolomiteMargin.address,
  ];
}

export async function getDolomiteErc4626ProxyConstructorParams<T extends DolomiteNetwork>(
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
  );
  return [implementationContract.address, core.dolomiteMargin.address, transaction.data!];
}

export async function getDolomiteErc4626WithPayableProxyConstructorParams<T extends DolomiteNetwork>(
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
  );
  return [implementationContract.address, core.dolomiteMargin.address, transaction.data!];
}

export function getIsolationModeTokenVaultMigratorConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  token: IERC20,
): any[] {
  return [core.dolomiteRegistry.address, token.address];
}
