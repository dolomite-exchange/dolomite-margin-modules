import { expect } from 'chai';
import { BYTES_EMPTY, Network, ONE_BI, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectProtocolBalance, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupNativeUSDCBalance,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  GammaIsolationModeTokenVaultV1,
  GammaIsolationModeTokenVaultV1__factory,
  GammaIsolationModeUnwrapperTraderV2,
  GammaIsolationModeVaultFactory,
  GammaIsolationModeWrapperTraderV2,
  GammaPoolPriceOracle,
  GammaRegistry,
  IGammaPool
} from '../src/types';
import {
  createGammaIsolationModeTokenVaultV1,
  createGammaIsolationModeVaultFactory,
  createGammaPoolPriceOracle,
  createGammaRegistry,
  createGammaUnwrapperTraderV2,
  createGammaWrapperTraderV2
} from './gamma-ecosystem-utils';
import { BigNumber, ethers } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { AccountInfoStruct } from 'packages/base/src/utils';
import { depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { getCalldataForOdos } from 'packages/base/test/utils/trader-utils';
import { GenericTraderType } from '@dolomite-exchange/zap-sdk';
import { GenericEventEmissionType } from '@dolomite-exchange/dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import { createOdosAggregatorTrader } from 'packages/base/test/utils/ecosystem-utils/traders';
import { OdosAggregatorTrader } from 'packages/base/src/types';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const usdcAmount = BigNumber.from('1000000000'); // $1,000
const wethAmount = parseEther('.25');

describe('GammaIsolationModeWrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let gammaPool: IGammaPool;
  let gammaRegistry: GammaRegistry;
  let unwrapper: GammaIsolationModeUnwrapperTraderV2;
  let wrapper: GammaIsolationModeWrapperTraderV2;
  let gammaFactory: GammaIsolationModeVaultFactory;
  let vault: GammaIsolationModeTokenVaultV1;
  let gammaOracle: GammaPoolPriceOracle;
  let defaultAccount: AccountInfoStruct;
  let marketId: BigNumber;
  let odosAggregator: OdosAggregatorTrader;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: await getRealLatestBlockNumber(true, Network.ArbitrumOne),
      network: Network.ArbitrumOne,
    });
    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.nativeUsdc);

    odosAggregator = await createOdosAggregatorTrader(core);

    gammaRegistry = await createGammaRegistry(core);
    gammaPool = core.gammaEcosystem.gammaPools.wethUsdc;

    const vaultImplementation = await createGammaIsolationModeTokenVaultV1();
    gammaFactory = await createGammaIsolationModeVaultFactory(gammaRegistry, gammaPool, vaultImplementation, core);

    unwrapper = await createGammaUnwrapperTraderV2(core, gammaFactory, gammaRegistry);
    wrapper = await createGammaWrapperTraderV2(core, gammaFactory, gammaRegistry);
    gammaOracle = await createGammaPoolPriceOracle(core, gammaRegistry);
    await gammaOracle.connect(core.governance).ownerSetGammaPool(gammaFactory.address, true);

    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, gammaFactory, true, gammaOracle);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(gammaFactory.address, true);
    await gammaFactory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    await gammaFactory.createVault(core.hhUser1.address);
    vault = setupUserVaultProxy<GammaIsolationModeTokenVaultV1>(
      await gammaFactory.getVaultByAccount(core.hhUser1.address),
      GammaIsolationModeTokenVaultV1__factory,
      core.hhUser1
    );
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };

    await setupNativeUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
    await setupWETHBalance(core, core.hhUser1, wethAmount, core.dolomiteMargin);

    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.nativeUsdc, usdcAmount);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, wethAmount);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await vault.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });
  });

  describe('#exchange', () => {
    it('should work normally for token0', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        wethAmount,
        BalanceCheckFlag.None
      );
      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.weth, wethAmount);

      const { calldata } = await getCalldataForOdos(
        wethAmount.div(2),
        core.tokens.weth,
        18,
        ONE_BI,
        core.tokens.nativeUsdc,
        6,
        wrapper,
        core
      );
      const odosOrderData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [
          ONE_BI,
          calldata,
        ],
      );
      await vault.swapExactInputForOutput(
        borrowAccountNumber,
        [core.marketIds.weth, marketId],
        wethAmount,
        ONE_BI,
        [{
          trader: wrapper.address,
          traderType: GenericTraderType.IsolationModeWrapper,
          tradeData: ethers.utils.defaultAbiCoder.encode(['address', 'bytes'], [odosAggregator.address, odosOrderData]),
          makerAccountIndex: 0
        }],
        [],
        {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        }
      );
    });

    it('should work normally for token1', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.nativeUsdc,
        usdcAmount,
        BalanceCheckFlag.None
      );
      await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.nativeUsdc, usdcAmount);

      const { calldata } = await getCalldataForOdos(
        usdcAmount.div(2),
        core.tokens.nativeUsdc,
        6,
        ONE_BI,
        core.tokens.weth,
        18,
        wrapper,
        core
      );
      const odosOrderData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [
          ONE_BI,
          calldata,
        ],
      );
      await vault.swapExactInputForOutput(
        borrowAccountNumber,
        [core.marketIds.nativeUsdc, marketId],
        usdcAmount,
        ONE_BI,
        [{
          trader: wrapper.address,
          traderType: GenericTraderType.IsolationModeWrapper,
          tradeData: ethers.utils.defaultAbiCoder.encode(['address', 'bytes'], [odosAggregator.address, odosOrderData]),
          makerAccountIndex: 0
        }],
        [],
        {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        }
      );
    });
  });

  describe('#isValidInputToken', () => {
    it('should return true for either pool token', async () => {
      expect(await wrapper.isValidInputToken(core.tokens.weth.address)).to.equal(true);
      expect(await wrapper.isValidInputToken(core.tokens.nativeUsdc.address)).to.equal(true);
    });

    it('should return false for other tokens', async () => {
      expect(await wrapper.isValidInputToken(core.tokens.dai.address)).to.equal(false);
    });
  });

  describe('#getExchangeCost', () => {
    it('should fail because it is not implemented', async () => {
      await expectThrow(
        wrapper.getExchangeCost(core.tokens.nativeUsdc.address, gammaFactory.address, ONE_ETH_BI, BYTES_EMPTY),
        'GammaWrapperTraderV2: getExchangeCost is not implemented',
      );
    });
  });
});
