import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import {
  GenericTraderParam,
  GenericTraderType,
  GenericUserConfig,
} from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import { BigNumber, BigNumberish, ethers } from 'ethers';
import {
  IIsolationModeUnwrapperTrader,
  IIsolationModeWrapperTrader,
  TestIsolationModeUnwrapperTraderV2,
  TestIsolationModeWrapperTraderV2,
} from '../../src/types';
import { AccountInfoStruct } from '../../src/utils';
import { CoreProtocol } from './setup';

export interface ZapParam {
  marketIdsPath: BigNumberish[];
  inputAmountWei: BigNumber;
  minOutputAmountWei: BigNumber;
  tradersPath: GenericTraderParam[];
  makerAccounts: AccountInfoStruct[];
  userConfig: GenericUserConfig;
}

export async function getSimpleZapParams(
  inputMarket: BigNumberish,
  inputAmountWei: BigNumber,
  outputMarket: BigNumberish,
  minOutputAmountWei: BigNumber,
  core: CoreProtocol,
): Promise<ZapParam> {
  if (!core.testEcosystem) {
    return Promise.reject('Core protocol does not have a test ecosystem');
  }

  const traderParam: GenericTraderParam = {
    trader: core.testEcosystem.testExchangeWrapper.address,
    traderType: GenericTraderType.ExternalLiquidity,
    tradeData: ethers.utils.defaultAbiCoder.encode(['uint256', 'bytes'], [minOutputAmountWei, []]),
    makerAccountIndex: 0,
  };
  return {
    inputAmountWei,
    minOutputAmountWei,
    marketIdsPath: [inputMarket, outputMarket],
    tradersPath: [traderParam],
    makerAccounts: [],
    userConfig: {
      deadline: '123123123123123',
      balanceCheckFlag: BalanceCheckFlag.None,
    },
  };
}

export async function getUnwrapZapParams(
  inputMarket: BigNumberish,
  inputAmountWei: BigNumber,
  outputMarket: BigNumberish,
  minOutputAmountWei: BigNumber,
  unwrapper: TestIsolationModeUnwrapperTraderV2 | IIsolationModeUnwrapperTrader,
  core: CoreProtocol,
): Promise<ZapParam> {
  if (!core.testEcosystem) {
    return Promise.reject('Core protocol does not have a test ecosystem');
  }

  const traderParam: GenericTraderParam = {
    trader: unwrapper.address,
    traderType: GenericTraderType.IsolationModeUnwrapper,
    tradeData: ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'bytes'],
      [minOutputAmountWei, ethers.utils.defaultAbiCoder.encode(['uint256'], [minOutputAmountWei])],
    ),
    makerAccountIndex: 0,
  };
  return {
    inputAmountWei,
    minOutputAmountWei,
    marketIdsPath: [inputMarket, outputMarket],
    tradersPath: [traderParam],
    makerAccounts: [],
    userConfig: {
      deadline: '123123123123123',
      balanceCheckFlag: BalanceCheckFlag.None,
    },
  };
}

export async function getWrapZapParams(
  inputMarket: BigNumberish,
  inputAmountWei: BigNumber,
  outputMarket: BigNumberish,
  minOutputAmountWei: BigNumber,
  wrapper: TestIsolationModeWrapperTraderV2 | IIsolationModeWrapperTrader,
  core: CoreProtocol,
): Promise<ZapParam> {
  if (!core.testEcosystem) {
    return Promise.reject('Core protocol does not have a test ecosystem');
  }

  const traderParam: GenericTraderParam = {
    trader: wrapper.address,
    traderType: GenericTraderType.IsolationModeWrapper,
    tradeData: ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'bytes'],
      [minOutputAmountWei, ethers.utils.defaultAbiCoder.encode(['uint256'], [minOutputAmountWei])],
    ),
    makerAccountIndex: 0,
  };
  return {
    inputAmountWei,
    minOutputAmountWei,
    marketIdsPath: [inputMarket, outputMarket],
    tradersPath: [traderParam],
    makerAccounts: [],
    userConfig: {
      deadline: '123123123123123',
      balanceCheckFlag: BalanceCheckFlag.None,
    },
  };
}
