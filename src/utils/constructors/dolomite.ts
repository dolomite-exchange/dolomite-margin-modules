import { BigNumberish } from 'ethers';
import { CoreProtocol } from '../../../test/utils/setup';
import { IERC20 } from '../../types';
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
