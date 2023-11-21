import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { CoreProtocol } from '../../../test/utils/setup';
import { EventEmitterRegistry, IERC20 } from '../../types';
import { IDolomiteInterestSetter, IDolomiteStructs } from '../../types/contracts/protocol/interfaces/IDolomiteMargin';
import InterestRateStruct = IDolomiteInterestSetter.InterestRateStruct;
import MonetaryPriceStruct = IDolomiteStructs.MonetaryPriceStruct;

export function getRegistryProxyConstructorParams(
  implementationAddress: string,
  implementationCalldata: string,
  core: CoreProtocol,
): any[] {
  return [implementationAddress, core.dolomiteMargin.address, implementationCalldata];
}

export function getIsolationModeTraderProxyConstructorParams(
  implementationAddress: string,
  implementationCalldata: string,
  core: CoreProtocol,
): any[] {
  return [implementationAddress, core.dolomiteMargin.address, implementationCalldata];
}

export async function getEventEmitterRegistryConstructorParams(
  core: CoreProtocol,
  implementation: EventEmitterRegistry,
): Promise<any[]> {
  const initializationCallData = await implementation.populateTransaction.initialize();
  return [implementation.address, core.dolomiteMargin.address, initializationCallData.data!];
}

type OwnerAddMarketParameters = [
  string, string, string, { value: BigNumberish }, {
    value: BigNumberish
  }, BigNumberish, boolean, boolean
];

export function getOwnerAddMarketParameters(
  token: IERC20,
  priceOracle: { address: string; getPrice: (token: string) => Promise<MonetaryPriceStruct> },
  interestSetter: {
    address: string;
    getInterestRate: (token: string, borrowWei: BigNumberish, supplyWei: BigNumberish) => Promise<InterestRateStruct>
  },
  marginPremium: BigNumberish,
  spreadPremium: BigNumberish,
  maxWei: BigNumberish,
  isClosing: boolean,
  isRecyclable: boolean = false,
): OwnerAddMarketParameters {
  return [
    token.address,
    priceOracle.address,
    interestSetter.address,
    { value: marginPremium },
    { value: spreadPremium },
    maxWei,
    isClosing,
    isRecyclable,
  ];
}

export enum TargetCollateralization {
  _120 = '1.20',
  _125 = '1.25',
  _150 = '1.50',
}

export function getMarginPremiumForTargetCollateralization(
  targetCollateralization: TargetCollateralization,
): BigNumber {
  const one = parseEther('1');
  const baseCollateralization = parseEther('1.15');
  return parseEther(targetCollateralization).mul(one).div(baseCollateralization).sub(one);
}

export enum TargetLiquidationPremium {
  _6 = '0.06',
  _7 = '0.07',
  _10 = '0.10',
  _15 = '0.15',
}

export function getLiquidationPremiumForTargetCollateralization(
  targetPremium: TargetLiquidationPremium,
): BigNumber {
  const one = parseEther('1');
  const baseAmount = parseEther('0.05');
  return parseEther(targetPremium).mul(one).div(baseAmount).sub(one);
}

export function getOwnerAddMarketParametersForIsolationMode(
  token: { address: string, isIsolationAsset: () => Promise<boolean> },
  priceOracle: { address: string; getPrice: (token: string) => Promise<MonetaryPriceStruct> },
  interestSetter: {
    address: string;
    getInterestRate: (token: string, borrowWei: BigNumberish, supplyWei: BigNumberish) => Promise<InterestRateStruct>
  },
  marginPremium: BigNumberish,
  spreadPremium: BigNumberish,
  maxWei: BigNumberish,
  isClosing: boolean = true,
  isRecyclable: boolean = false,
): OwnerAddMarketParameters {
  return [
    token.address,
    priceOracle.address,
    interestSetter.address,
    { value: marginPremium },
    { value: spreadPremium },
    maxWei,
    isClosing,
    isRecyclable,
  ];
}
