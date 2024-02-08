import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { DolomiteMargin } from '../../../test/utils/dolomite';
import { CoreProtocolType } from '../../../test/utils/setup';
import {
  EventEmitterRegistry,
  IDolomiteMargin,
  IDolomiteMarginV2,
  IERC20,
  IIsolationModeVaultFactory,
} from '../../types';
import { IDolomiteInterestSetter, IDolomiteStructs } from '../../types/contracts/protocol/interfaces/IDolomiteMargin';
import { Network, NetworkType, ZERO_BI } from '../no-deps-constants';
import InterestRateStruct = IDolomiteInterestSetter.InterestRateStruct;
import MonetaryPriceStruct = IDolomiteStructs.MonetaryPriceStruct;

export enum TargetCollateralization {
  Base = '1.00',
  _120 = '1.20',
  _125 = '1.25',
  _150 = '1.50',
  _166 = '1.66666666',
}

export enum TargetLiquidationPenalty {
  Base = '0',
  _6 = '0.06',
  _7 = '0.07',
  _8 = '0.08',
  _10 = '0.10',
  _15 = '0.15',
}

export function getRegistryProxyConstructorParams<T extends NetworkType>(
  implementationAddress: string,
  implementationCalldata: string,
  dolomiteMargin: DolomiteMargin<T>,
): any[] {
  return [implementationAddress, dolomiteMargin.address, implementationCalldata];
}

export function getIsolationModeFreezableLiquidatorProxyConstructorParams<T extends Network>(
  core: CoreProtocolType<T>,
): any[] {
  return [
    core.dolomiteRegistry.address,
    core.liquidatorAssetRegistry.address,
    core.dolomiteMargin.address,
    core.expiry.address,
    core.config.networkNumber,
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
  targetCollateralization: TargetCollateralization,
): BigNumber {
  if (targetCollateralization === TargetCollateralization.Base) {
    return ZERO_BI;
  }

  const one = parseEther('1');
  const baseCollateralization = parseEther('1.15');
  return parseEther(targetCollateralization).mul(one).div(baseCollateralization).sub(one);
}

export function getLiquidationPremiumForTargetLiquidationPenalty(
  targetPenalty: TargetLiquidationPenalty,
): BigNumber {
  if (targetPenalty === TargetLiquidationPenalty.Base) {
    return ZERO_BI;
  }

  const one = parseEther('1');
  const baseAmount = parseEther('0.05');
  return parseEther(targetPenalty).mul(one).div(baseAmount).sub(one);
}

export function getOwnerAddMarketParametersForIsolationMode<T extends NetworkType>(
  core: CoreProtocolType<T>,
  token: IIsolationModeVaultFactory,
  priceOracle: { address: string; getPrice: (token: string) => Promise<MonetaryPriceStruct> },
  interestSetter: {
    address: string;
    getInterestRate: (token: string, borrowWei: BigNumberish, supplyWei: BigNumberish) => Promise<InterestRateStruct>
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
