import { AccountInfoStruct } from '@dolomite-exchange/modules-base/src/utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  encodeExternalSellActionDataWithNoData,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  GLPIsolationModeTokenVaultV1,
  GLPIsolationModeTokenVaultV1__factory,
  GLPIsolationModeVaultFactory,
  GLPIsolationModeWrapperTraderV1,
  GLPPriceOracleV1,
  GmxRegistryV1,
  IERC20,
} from '../src/types';
import {
  createGLPIsolationModeTokenVaultV1,
  createGLPIsolationModeVaultFactory,
  createGLPPriceOracleV1,
  createGLPIsolationModeWrapperTraderV1,
  createGmxRegistry,
} from './glp-ecosystem-utils';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const usdcAmount = amountWei.div(1e12).mul(5);
const usableUsdcAmount = usdcAmount.div(2);

describe('GLPIsolationModeWrapperTraderV1', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: IERC20;
  let underlyingMarketId: BigNumber;
  let gmxRegistry: GmxRegistryV1;
  let wrapper: GLPIsolationModeWrapperTraderV1;
  let factory: GLPIsolationModeVaultFactory;
  let vault: GLPIsolationModeTokenVaultV1;
  let priceOracle: GLPPriceOracleV1;
  let defaultAccount: AccountInfoStruct;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = core.gmxEcosystem.fsGlp;
    const userVaultImplementation = await createGLPIsolationModeTokenVaultV1();
    gmxRegistry = await createGmxRegistry(core);
    factory = await createGLPIsolationModeVaultFactory(core, gmxRegistry, userVaultImplementation);
    priceOracle = await createGLPPriceOracleV1(factory, gmxRegistry);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);
    await core.dolomiteMargin.ownerSetPriceOracle(underlyingMarketId, priceOracle.address);

    wrapper = await createGLPIsolationModeWrapperTraderV1(core, factory, gmxRegistry);
    await factory.connect(core.governance).ownerInitialize([wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<GLPIsolationModeTokenVaultV1>(
      vaultAddress,
      GLPIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };

    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem.glpManager);
    await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
      .mintAndStakeGlp(core.tokens.usdc.address, usableUsdcAmount, 0, 0);
    await core.gmxEcosystem.sGlp.connect(core.hhUser1).approve(vault.address, amountWei);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

    expect(await underlyingToken.connect(core.hhUser1).balanceOf(vault.address)).to.eq(amountWei);
    expect((await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId)).value).to.eq(amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Call and Exchange for non-liquidation sale', () => {
    it('should work when called with the normal conditions', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 0;
      const actions = await wrapper.createActionsForWrapping(
        solidAccountId,
        liquidAccountId,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        underlyingMarketId,
        core.marketIds.usdc,
        ZERO_BI,
        usableUsdcAmount,
      );

      const amountOut = await wrapper.getExchangeCost(
        core.tokens.usdc.address,
        factory.address,
        usableUsdcAmount,
        BYTES_EMPTY,
      );

      await core.tokens.usdc.connect(core.hhUser1).transfer(core.dolomiteMargin.address, usableUsdcAmount);
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await core.dolomiteMargin.connect(core.hhUser5).operate(
        [defaultAccount],
        actions,
      );

      const expectedTotalBalance = amountWei.add(amountOut);
      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
      expect(underlyingBalanceWei.value).to.eq(expectedTotalBalance);
      expect(underlyingBalanceWei.sign).to.eq(true);
      expect(await vault.underlyingBalanceOf()).to.eq(expectedTotalBalance);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.usdc);
      expect(otherBalanceWei.sign).to.eq(false);
      expect(otherBalanceWei.value).to.eq(usableUsdcAmount);
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        wrapper.connect(core.hhUser1).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          factory.address,
          core.tokens.usdc.address,
          usableUsdcAmount,
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if input token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          factory.address,
          core.tokens.weth.address,
          usableUsdcAmount,
          encodeExternalSellActionDataWithNoData(ZERO_BI),
        ),
        `GLPIsolationModeWrapperV1: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.weth.address,
          core.tokens.usdc.address,
          amountWei,
          encodeExternalSellActionDataWithNoData(otherAmountWei),
        ),
        `IsolationModeWrapperTraderV1: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if the input amount is 0', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          factory.address,
          core.tokens.usdc.address,
          ZERO_BI,
          encodeExternalSellActionDataWithNoData(ZERO_BI),
        ),
        'IsolationModeWrapperTraderV1: Invalid input amount',
      );
    });
  });

  describe('#usdc', () => {
    it('should work', async () => {
      expect(await wrapper.USDC()).to.eq(core.tokens.usdc.address);
    });
  });

  describe('#gmxRegistry', () => {
    it('should work', async () => {
      expect(await wrapper.GMX_REGISTRY()).to.eq(gmxRegistry.address);
    });
  });

  describe('#getExchangeCost', () => {
    it('should work normally', async () => {
      const inputAmount = usableUsdcAmount;
      const expectedAmount = await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
        .callStatic
        .mintAndStakeGlp(
          core.tokens.usdc.address,
          inputAmount,
          1,
          1,
        );
      expect(await wrapper.getExchangeCost(core.tokens.usdc.address, factory.address, inputAmount, BYTES_EMPTY))
        .to
        .eq(expectedAmount);
    });

    it('should work for 10 random numbers, as long as balance is sufficient', async () => {
      for (let i = 0; i < 10; i++) {
        // create a random number from 1 to 99 and divide by 101 (making the number, at-most, slightly smaller)
        const randomNumber = BigNumber.from(Math.floor(Math.random() * 99) + 1);
        const weirdAmount = usableUsdcAmount.mul(randomNumber).div(101);
        const expectedAmount = await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
          .callStatic
          .mintAndStakeGlp(
            core.tokens.usdc.address,
            weirdAmount,
            1,
            1,
          );
        expect(await wrapper.getExchangeCost(core.tokens.usdc.address, factory.address, weirdAmount, BYTES_EMPTY))
          .to
          .eq(expectedAmount);
      }
    });

    it('should fail if the input token is not USDC', async () => {
      await expectThrow(
        wrapper.getExchangeCost(core.tokens.weth.address, factory.address, usableUsdcAmount, BYTES_EMPTY),
        `GLPIsolationModeWrapperV1: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if the output token is not dfsGLP', async () => {
      await expectThrow(
        wrapper.getExchangeCost(core.tokens.usdc.address, core.tokens.weth.address, usableUsdcAmount, BYTES_EMPTY),
        `GLPIsolationModeWrapperV1: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if the input amount is 0', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).getExchangeCost(
          core.tokens.usdc.address,
          factory.address,
          ZERO_BI,
          encodeExternalSellActionDataWithNoData(ZERO_BI),
        ),
        'GLPIsolationModeWrapperV1: Invalid desired input amount',
      );
    });
  });
});
