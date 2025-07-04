import {
  DolomiteNetwork,
  DolomiteV2Network,
  MAX_UINT_256_BI,
  Network,
} from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolType } from 'packages/base/test/utils/setup';
import { IERC20, IVesterDiscountCalculator, IVotingEscrow, MockVotingEscrow, VotingEscrow } from './types';
import { BigNumberish } from 'ethers';
import { ethers } from 'hardhat';

const NO_MARKET_ID = MAX_UINT_256_BI;

export function getBuybackPoolConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  dolo: IERC20,
  oDolo: IERC20
): any[] {
  return [dolo.address, oDolo.address, core.dolomiteMargin.address];
}

export function getDOLOConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  treasury: string
): any[] {
  return [core.dolomiteMargin.address, treasury];
}

export function getODOLOConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>
): any[] {
  return [core.dolomiteMargin.address, 'oDOLO Token', 'oDOLO'];
}

export function getDOLOBuybackPoolConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  dolo: IERC20,
  oDolo: IERC20
): any[] {
  return [dolo.address, oDolo.address, core.dolomiteMargin.address];
}

export function getVeFeeCalculatorConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>
): any[] {
  return [core.dolomiteMargin.address];
}

export function getExternalVesterDiscountCalculatorConstructorParams(
  veToken: VotingEscrow | IVotingEscrow
): any[] {
  return [veToken.address];
}

export function getOptionAirdropConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  dolo: IERC20,
): any[] {
  return [dolo.address, core.dolomiteRegistry.address, core.dolomiteMargin.address];
}

export function getRegularAirdropConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  dolo: IERC20,
  veToken: VotingEscrow | MockVotingEscrow,
): any[] {
  return [dolo.address, veToken.address, core.dolomiteRegistry.address, core.dolomiteMargin.address];
}

export function getVestingClaimsConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  dolo: IERC20,
  tgeTimestamp: BigNumberish,
  duration: BigNumberish,
): any[] {
  return [dolo.address, tgeTimestamp, duration, core.dolomiteRegistry.address, core.dolomiteMargin.address];
}

export function getStrategicVestingClaimsConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  dolo: IERC20,
  tgeTimestamp: BigNumberish,
  duration: BigNumberish,
): any[] {
  return [dolo.address, tgeTimestamp, duration, core.dolomiteRegistry.address, core.dolomiteMargin.address];
}

export function getVeDoloVesterImplementationConstructorParams(core: CoreProtocolType<Network.Berachain>): any[] {
  return [
    core.dolomiteMargin.address,
    core.dolomiteRegistry.address,
    core.tokenomics.dolo.address, // pairToken
    NO_MARKET_ID,
    core.tokens.usdc.address, // payment token
    core.marketIds.usdc,
    core.tokenomics.dolo.address, // rewardToken
    NO_MARKET_ID,
  ];
}

export function getVeExternalVesterImplementationConstructorParams<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  pairToken: IERC20,
  pairMarketId: BigNumberish,
  paymentToken: IERC20,
  paymentMarketId: BigNumberish,
  rewardToken: IERC20,
  rewardMarketId: BigNumberish,
): any[] {
  return [
    core.dolomiteMargin.address,
    core.dolomiteRegistry.address,
    pairToken.address,
    pairMarketId,
    paymentToken.address,
    paymentMarketId,
    rewardToken.address,
    rewardMarketId,
  ];
}

export function getVeExternalVesterInitializationCalldata(
  oToken: IERC20,
  baseUri: string,
  name: string,
  symbol: string,
): string {
  return ethers.utils.defaultAbiCoder.encode(
    ['address', 'string', 'string', 'string'],
    [
      oToken.address,
      baseUri,
      name,
      symbol,
    ],
  );
}
