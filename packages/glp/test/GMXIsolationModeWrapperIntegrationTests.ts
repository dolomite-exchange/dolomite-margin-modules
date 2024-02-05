import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import deployments from '../../../scripts/deployments.json';
import {
  GenericEventEmissionType,
  GenericTraderParam,
  GenericTraderType,
  GenericUserConfig,
} from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import { BigNumber, BigNumberish } from 'ethers';
import { ethers } from 'hardhat';
import { AccountInfoStruct } from '@dolomite-exchange/modules-base/src/utils';
import { createTestToken, depositIntoDolomiteMargin } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { expectProtocolBalance, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { getSimpleZapParams, getUnwrapZapParams } from '@dolomite-exchange/modules-base/test/utils/zap-utils';
import {
  GLPIsolationModeVaultFactory,
  GMXIsolationModeTokenVaultV1,
  GMXIsolationModeTokenVaultV1__factory,
  GMXIsolationModeVaultFactory,
  GmxRegistryV1,
  GmxRegistryV1__factory,
} from '../src/types';
import {
  CustomTestToken,
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2,
  IIsolationModeUnwrapperTrader,
  IIsolationModeWrapperTrader,
  SimpleIsolationModeUnwrapperTraderV2__factory,
  SimpleIsolationModeWrapperTraderV2__factory,
} from '@dolomite-exchange/modules-base/src/types';
import { Network, ONE_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  createGLPIsolationModeTokenVaultV2,
  createGLPIsolationModeVaultFactory,
  createGMXIsolationModeTokenVaultV1,
  createGMXIsolationModeVaultFactory,
  createGmxRegistry,
  createGMXUnwrapperTraderV2,
  createGMXWrapperTraderV2,
} from './glp-ecosystem-utils';
import {
  CoreProtocol,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupGMXBalance,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { DEFAULT_BLOCK_NUMBER_FOR_GLP_WITH_VESTING } from './glp-utils';

const defaultAccountNumber = '0';
const gmxAmount = BigNumber.from('10000000000000000000'); // 10 GMX
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const accountNumber = ZERO_BI;
const otherAccountNumber = BigNumber.from('123');

describe('GMXIsolationModeWrapperIntegrationTests', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingMarketIdGmx: BigNumberish;
  let gmxMarketId: BigNumberish;
  let gmxRegistry: GmxRegistryV1;
  let unwrapper: SimpleIsolationModeUnwrapperTraderV2;
  let wrapper: SimpleIsolationModeWrapperTraderV2;
  let gmxFactory: GMXIsolationModeVaultFactory;
  let glpFactory: GLPIsolationModeVaultFactory;
  let gmxVault: GMXIsolationModeTokenVaultV1;
  let otherToken1: CustomTestToken;
  let otherMarketId1: BigNumber;

  before(async () => {
    const network = Network.ArbitrumOne;
    core = await setupCoreProtocol({
      network,
      blockNumber: await getRealLatestBlockNumber(true, network),
    });
    gmxRegistry = GmxRegistryV1__factory.connect(
      deployments.GmxRegistryProxy[network].address,
      core.hhUser1,
    );
    glpFactory = core.gmxEcosystem!.live.dGlp.connect(core.hhUser1);
    gmxFactory = core.gmxEcosystem!.live.dGmx.connect(core.hhUser1);

    await core.testEcosystem!.testPriceOracle.setPrice(glpFactory.address, '1000000000000000000');
    await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.dfsGlp!, core.testEcosystem!.testPriceOracle.address);

    unwrapper = SimpleIsolationModeUnwrapperTraderV2__factory.connect(
      deployments.GMXIsolationModeUnwrapperTraderV4[network].address,
      core.hhUser1,
    );
    wrapper = SimpleIsolationModeWrapperTraderV2__factory.connect(
      deployments.GMXIsolationModeWrapperTraderV4[network].address,
      core.hhUser1,
    );
    underlyingMarketIdGmx = core.marketIds.dGmx!;
    await core.testEcosystem!.testPriceOracle.setPrice(gmxFactory.address, '1000000000000000000');
    await core.dolomiteMargin.ownerSetPriceOracle(underlyingMarketIdGmx, core.testEcosystem!.testPriceOracle.address);

    gmxMarketId = core.marketIds.gmx!;
    await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.gmx!.address, '1000000000000000000');
    await core.dolomiteMargin.ownerSetPriceOracle(gmxMarketId, core.testEcosystem!.testPriceOracle.address);

    otherToken1 = await createTestToken();
    await core.testEcosystem!.testPriceOracle.setPrice(
      otherToken1.address,
      '1000000000000000000', // $1.00 in USDC
    );
    otherMarketId1 = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken1, false);

    await gmxFactory.createVault(core.hhUser1.address);
    const vaultAddress = await gmxFactory.getVaultByAccount(core.hhUser1.address);
    gmxVault = setupUserVaultProxy<GMXIsolationModeTokenVaultV1>(
      vaultAddress,
      GMXIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    await setupGMXBalance(core, core.hhUser1, amountWei, gmxVault);
    await gmxVault.connect(core.hhUser1).depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

    await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
    await core.gmxEcosystem!.gmx.connect(core.hhUser1).transfer(
      core.testEcosystem!.testExchangeWrapper.address,
      gmxAmount,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Wrapper', () => {
    it('should work normally', async () => {
      await otherToken1.connect(core.hhUser1).addBalance(core.hhUser1.address, otherAmountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, otherAmountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);
      await gmxVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        otherAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await expectProtocolBalance(core, gmxVault.address, otherAccountNumber, otherMarketId1, otherAmountWei);

      const zapParams = await getWrapperToUnderlyingGmxMarketParams(
        otherMarketId1,
        gmxMarketId,
        underlyingMarketIdGmx,
        otherAmountWei,
        otherAmountWei,
        wrapper,
        core,
      );

      await gmxVault.swapExactInputForOutput(
        123,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        otherAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
      await expectProtocolBalance(core, gmxVault.address, otherAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, gmxVault.address, otherAccountNumber, gmxMarketId, ZERO_BI);
      await expectProtocolBalance(core, gmxVault.address, otherAccountNumber, underlyingMarketIdGmx, otherAmountWei);
    });

    it('should fail if attempting to exchange to GMX', async () => {
      await otherToken1.connect(core.hhUser1).addBalance(core.hhUser1.address, otherAmountWei);
      await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, otherAmountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);
      await gmxVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        otherAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await expectProtocolBalance(core, gmxVault.address, otherAccountNumber, otherMarketId1, otherAmountWei);

      const zapParams = await getSimpleZapParams(
        otherMarketId1,
        otherAmountWei,
        gmxMarketId,
        otherAmountWei,
        core,
      );
      await expectThrow(
        gmxVault.swapExactInputForOutput(
          123,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        `OperationImpl: Total supply exceeds max supply <${gmxMarketId}>`,
      );
    });
  });

  describe('Unwrapper', () => {
    it('should work normally', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.transferIntoPositionWithUnderlyingToken(accountNumber, otherAccountNumber, gmxAmount);

      const zapParams = await getUnwrapperToOtherMarketParams(
        underlyingMarketIdGmx,
        gmxMarketId,
        otherMarketId1,
        gmxAmount,
        gmxAmount,
        unwrapper,
        core,
      );
      await gmxVault.swapExactInputForOutput(
        123,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, gmxVault.address, otherAccountNumber, underlyingMarketIdGmx, ZERO_BI);
      await expectProtocolBalance(core, gmxVault.address, otherAccountNumber, gmxMarketId, ZERO_BI);
      await expectProtocolBalance(core, gmxVault.address, otherAccountNumber, otherMarketId1, gmxAmount);
    });

    it('should fail if attempting to unwrap to GMX market', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.transferIntoPositionWithUnderlyingToken(accountNumber, otherAccountNumber, gmxAmount);

      const zapParams = await getUnwrapZapParams(
        underlyingMarketIdGmx,
        gmxAmount,
        gmxMarketId,
        gmxAmount,
        unwrapper,
        core,
      );
      await expectThrow(
        gmxVault.swapExactInputForOutput(
          123,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        `OperationImpl: Total supply exceeds max supply <${gmxMarketId}>`,
      );
    });
  });
});

interface ZapParam {
  marketIdsPath: BigNumberish[];
  inputAmountWei: BigNumber;
  minOutputAmountWei: BigNumber;
  tradersPath: GenericTraderParam[];
  makerAccounts: AccountInfoStruct[];
  userConfig: GenericUserConfig;
}

async function getUnwrapperToOtherMarketParams(
  inputMarket: BigNumberish,
  intermediateMarket: BigNumberish,
  outputMarket: BigNumberish,
  inputAmountWei: BigNumber,
  minOutputAmountWei: BigNumber,
  unwrapper: SimpleIsolationModeUnwrapperTraderV2 | IIsolationModeUnwrapperTrader,
  core: CoreProtocol,
): Promise<ZapParam> {
  if (!core.testEcosystem) {
    return Promise.reject('Core protocol does not have a test ecosystem');
  }

  const unwrapperTraderParam: GenericTraderParam = {
    trader: unwrapper.address,
    traderType: GenericTraderType.IsolationModeUnwrapper,
    tradeData: ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'bytes'],
      [minOutputAmountWei, ethers.utils.defaultAbiCoder.encode(['uint256'], [minOutputAmountWei])],
    ),
    makerAccountIndex: 0,
  };

  const traderParam: GenericTraderParam = {
    trader: core.testEcosystem.testExchangeWrapper.address,
    traderType: GenericTraderType.ExternalLiquidity,
    tradeData: ethers.utils.defaultAbiCoder.encode(['uint256', 'bytes'], [minOutputAmountWei, []]),
    makerAccountIndex: 0,
  };

  return {
    inputAmountWei,
    minOutputAmountWei,
    marketIdsPath: [inputMarket, intermediateMarket, outputMarket],
    tradersPath: [unwrapperTraderParam, traderParam],
    makerAccounts: [],
    userConfig: {
      deadline: '123123123123123',
      balanceCheckFlag: BalanceCheckFlag.None,
      eventType: GenericEventEmissionType.None,
    },
  };
}

async function getWrapperToUnderlyingGmxMarketParams(
  inputMarket: BigNumberish,
  intermediateMarket: BigNumberish,
  outputMarket: BigNumberish,
  inputAmountWei: BigNumber,
  minOutputAmountWei: BigNumber,
  wrapper: SimpleIsolationModeWrapperTraderV2 | IIsolationModeWrapperTrader,
  core: CoreProtocol,
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

  const wrapperTraderParam: GenericTraderParam = {
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
    marketIdsPath: [inputMarket, intermediateMarket, outputMarket],
    tradersPath: [traderParam, wrapperTraderParam],
    makerAccounts: [],
    userConfig: {
      deadline: '123123123123123',
      balanceCheckFlag: BalanceCheckFlag.None,
      eventType: GenericEventEmissionType.None,
    },
  };
}
