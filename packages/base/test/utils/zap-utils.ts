import { AmountDenomination, AmountReference, BalanceCheckFlag } from '@dolomite-margin/dist/src';
import {
  GenericEventEmissionType,
  GenericTraderParam,
  GenericTraderType,
  GenericUserConfig,
} from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import { BigNumber, BigNumberish, ethers } from 'ethers';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  IIsolationModeUnwrapperTrader,
  IIsolationModeUnwrapperTraderV2,
  IIsolationModeWrapperTrader,
  SimpleIsolationModeWrapperTraderV2,
  SmartDebtAutoTrader,
  TestDolomiteMarginInternalTrader,
  TestIsolationModeUnwrapperTraderV2,
  TestIsolationModeWrapperTraderV2,
} from '../../src/types';
import { AccountInfoStruct } from '../../src/utils';
import { CoreProtocolType } from './setup';

export interface ZapParam {
  marketIdsPath: BigNumberish[];
  inputAmountWei: BigNumber;
  minOutputAmountWei: BigNumber;
  tradersPath: GenericTraderParam[];
  makerAccounts: AccountInfoStruct[];
  userConfig: GenericUserConfig;
}

export async function getSimpleZapParams<T extends Network>(
  inputMarket: BigNumberish,
  inputAmountWei: BigNumber,
  outputMarket: BigNumberish,
  minOutputAmountWei: BigNumber,
  core: CoreProtocolType<T>,
): Promise<ZapParam> {
  if (!core.testEcosystem) {
    return Promise.reject('Core protocol does not have a test ecosystem');
  }

  const traderParam: GenericTraderParam = {
    trader: core.testEcosystem.testExchangeWrapper.address,
    traderType: GenericTraderType.ExternalLiquidity,
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
      eventType: GenericEventEmissionType.None,
    },
  };
}

export async function getSmartDebtZapParams<T extends Network>(
  inputMarket: BigNumberish,
  inputAmountWei: BigNumber,
  outputMarket: BigNumberish,
  minOutputAmountWei: BigNumber,
  trader: SmartDebtAutoTrader,
  makerAccount: AccountInfoStruct,
  core: CoreProtocolType<T>,
): Promise<ZapParam> {
  const traderParam: GenericTraderParam = {
    trader: trader.address,
    traderType: GenericTraderType.InternalLiquidity,
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
    makerAccounts: [makerAccount],
    userConfig: {
      deadline: '123123123123123',
      balanceCheckFlag: BalanceCheckFlag.None,
      eventType: GenericEventEmissionType.None,
    },
  };
}

export async function getUnwrapZapParams<T extends Network>(
  inputMarket: BigNumberish,
  inputAmountWei: BigNumber,
  outputMarket: BigNumberish,
  minOutputAmountWei: BigNumber,
  unwrapper: TestIsolationModeUnwrapperTraderV2 | IIsolationModeUnwrapperTrader | IIsolationModeUnwrapperTraderV2,
  core: CoreProtocolType<T>,
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
      eventType: GenericEventEmissionType.None,
    },
  };
}

export async function getUnwrapAndCustomTradeZapParams<T extends Network>(
  marketsPath: BigNumberish[],
  amountsPath: BigNumber[],
  unwrapper: TestIsolationModeUnwrapperTraderV2 | IIsolationModeUnwrapperTrader,
  internalTrader: TestDolomiteMarginInternalTrader,
  core: CoreProtocolType<T>,
): Promise<ZapParam> {
  if (!core.testEcosystem) {
    return Promise.reject('Core protocol does not have a test ecosystem');
  }
  if (marketsPath.length !== 3 || amountsPath.length !== 3) {
    return Promise.reject('Lengths must equal 3');
  }

  const traderParam1: GenericTraderParam = {
    trader: unwrapper.address,
    traderType: GenericTraderType.IsolationModeUnwrapper,
    tradeData: ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'bytes'],
      [amountsPath[1], ethers.utils.defaultAbiCoder.encode(['uint256'], [amountsPath[1]])],
    ),
    makerAccountIndex: 0,
  };

  await core.dolomiteMargin.connect(core.hhUser1).setOperators([
    {
      operator: internalTrader.address,
      trusted: true,
    },
  ]);
  const tradeId = BigNumber.from('4321');
  const outputData = {
    value: amountsPath[2],
    sign: false,
    denomination: AmountDenomination.Wei,
    ref: AmountReference.Delta,
  };
  await internalTrader.setData(tradeId, outputData);
  const traderParam2: GenericTraderParam = {
    trader: internalTrader.address,
    traderType: GenericTraderType.InternalLiquidity,
    tradeData: ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'bytes'],
      [amountsPath[1].sub(1), ethers.utils.defaultAbiCoder.encode(['uint256'], [tradeId])],
    ),
    makerAccountIndex: 0,
  };
  return {
    inputAmountWei: amountsPath[0],
    minOutputAmountWei: amountsPath[2],
    marketIdsPath: marketsPath,
    tradersPath: [traderParam1, traderParam2],
    makerAccounts: [
      {
        owner: core.hhUser1.address,
        number: 0,
      },
    ],
    userConfig: {
      deadline: '123123123123123',
      balanceCheckFlag: BalanceCheckFlag.None,
      eventType: GenericEventEmissionType.None,
    },
  };
}

export async function getWrapZapParams<T extends Network>(
  inputMarket: BigNumberish,
  inputAmountWei: BigNumber,
  outputMarket: BigNumberish,
  minOutputAmountWei: BigNumber,
  wrapper: TestIsolationModeWrapperTraderV2 | SimpleIsolationModeWrapperTraderV2 | IIsolationModeWrapperTrader,
  core: CoreProtocolType<T>,
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
      eventType: GenericEventEmissionType.None,
    },
  };
}

export async function getLiquidateIsolationModeZapPath<T extends Network>(
  marketIdsPath: BigNumberish[],
  amounts: BigNumber[],
  unwrapper: TestIsolationModeUnwrapperTraderV2 | IIsolationModeUnwrapperTrader | IIsolationModeUnwrapperTraderV2,
  core: CoreProtocolType<T>,
): Promise<ZapParam> {
  const unwrap = await getUnwrapZapParams(marketIdsPath[0], amounts[0], marketIdsPath[1], amounts[1], unwrapper, core);
  const simple = await getSimpleZapParams(marketIdsPath[1], amounts[1], marketIdsPath[2], amounts[2], core);
  return {
    marketIdsPath,
    inputAmountWei: amounts[0],
    minOutputAmountWei: amounts[amounts.length - 1],
    tradersPath: [unwrap.tradersPath[0], simple.tradersPath[0]],
    makerAccounts: [],
    userConfig: {
      deadline: '123123123123123',
      balanceCheckFlag: BalanceCheckFlag.None,
      eventType: GenericEventEmissionType.None,
    },
  };
}
