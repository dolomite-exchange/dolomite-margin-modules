import { ActionType, AmountDenomination, AmountReference } from '@dolomite-exchange/dolomite-margin/dist/src';
import { AccountInfoStruct, ActionArgsStruct } from '@dolomite-exchange/modules-base/src/utils';
import { depositIntoDolomiteMargin } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  encodeExternalSellActionDataWithNoData,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import { expectProtocolBalanceDustyOrZero, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  disableInterestAccrual,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUSDCBalance,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { GLPWrapperTraderV2, GmxRegistryV1, IERC20 } from '../src/types';
import { createGLPPriceOracleV1, createGLPWrapperTraderV2, createGmxRegistry } from './glp-ecosystem-utils';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const usdcAmount = amountWei.div(1e12).mul(5);
const usableUsdcAmount = usdcAmount.div(2);

describe('GLPWrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let glp: IERC20;
  let marketId: BigNumber;
  let wrapper: GLPWrapperTraderV2;
  let gmxRegistry: GmxRegistryV1;
  let defaultAccount: AccountInfoStruct;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    glp = core.gmxEcosystem.sGlp;

    marketId = BigNumber.from(core.marketIds.magicGlp!);

    gmxRegistry = await createGmxRegistry(core);

    const priceOracle = await createGLPPriceOracleV1(glp, gmxRegistry);

    marketId = BigNumber.from(core.marketIds.sGlp!);

    if ((await core.dolomiteMargin.getNumMarkets()).lte(marketId)) {
      await setupTestMarket(
        core,
        glp,
        true,
        priceOracle,
      );
      marketId = await core.dolomiteMargin.getMarketIdByTokenAddress(glp.address);
    } else {
      await core.dolomiteMargin.ownerSetMaxWei(marketId, 0);
    }

    wrapper = await createGLPWrapperTraderV2(core, glp, gmxRegistry);

    defaultAccount = { owner: core.hhUser1.address, number: defaultAccountNumber };

    // setting the interest rate to 0 makes calculations more consistent
    await disableInterestAccrual(core, core.marketIds.usdc);

    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
    await core.tokens.usdc.connect(core.hhUser1).approve(core.gmxEcosystem.glpManager.address, usdcAmount);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccount.number, core.marketIds.usdc, usableUsdcAmount);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Exchange for non-liquidation sale', () => {
    it('should work when called with the normal conditions', async () => {
      const amountOut = await wrapper.getExchangeCost(
        core.tokens.usdc.address,
        glp.address,
        usableUsdcAmount,
        BYTES_EMPTY,
      );
      const actions: ActionArgsStruct[] = [
        {
          actionType: ActionType.Sell,
          accountId: 0,
          amount: {
            sign: false,
            value: usableUsdcAmount,
            ref: AmountReference.Delta,
            denomination: AmountDenomination.Wei,
          },
          primaryMarketId: core.marketIds.usdc,
          secondaryMarketId: marketId,
          otherAddress: wrapper.address,
          otherAccountId: 0,
          data: encodeExternalSellActionDataWithNoData(amountWei),
        },
      ];

      const balanceBefore = await glp.balanceOf(core.dolomiteMargin.address);

      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await core.dolomiteMargin.connect(core.hhUser5).operate(
        [defaultAccount],
        actions,
      );

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, marketId);
      expect(underlyingBalanceWei.value).to.eq(amountOut);
      expect(underlyingBalanceWei.sign).to.eq(true);
      expect((await glp.balanceOf(core.dolomiteMargin.address)).sub(balanceBefore)).to.eq(amountOut);

      await expectProtocolBalanceDustyOrZero(core, core.hhUser1, defaultAccount.number, core.marketIds.usdc);
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        wrapper.connect(core.hhUser1).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          glp.address,
          core.tokens.usdc.address,
          usableUsdcAmount,
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if input token is not compatible with GLP', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          glp.address,
          core.tokens.dfsGlp.address,
          usableUsdcAmount,
          encodeExternalSellActionDataWithNoData(ZERO_BI),
        ),
        `GLPWrapperTraderV2: Invalid input token <${core.tokens.dfsGlp.address.toLowerCase()}>`,
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
        `GLPWrapperTraderV2: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if input amount is 0', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          glp.address,
          core.tokens.usdc.address,
          ZERO_BI,
          encodeExternalSellActionDataWithNoData(otherAmountWei),
        ),
        'GLPWrapperTraderV2: Invalid input amount',
      );
    });
  });

  describe('#GLP', () => {
    it('should work', async () => {
      expect(await wrapper.GLP()).to.eq(glp.address);
    });
  });

  describe('#GMX_REGISTRY', () => {
    it('should work', async () => {
      expect(await wrapper.GMX_REGISTRY()).to.eq(gmxRegistry.address);
    });
  });

  describe('#getExchangeCost', () => {
    it('should work normally', async () => {
      const inputAmount = usableUsdcAmount;
      const glpAmount = await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
        .callStatic
        .mintAndStakeGlp(
          core.tokens.usdc.address,
          inputAmount,
          1,
          1,
        );
      expect(await wrapper.getExchangeCost(core.tokens.usdc.address, glp.address, inputAmount, BYTES_EMPTY))
        .to
        .eq(glpAmount);
    });

    it('should work for 10 random numbers, as long as balance is sufficient', async () => {
      for (let i = 0; i < 10; i++) {
        // create a random number from 1 to 99 and divide by 101 (making the number, at-most, slightly smaller)
        const randomNumber = BigNumber.from(Math.floor(Math.random() * 99) + 1);
        const weirdAmount = usableUsdcAmount.mul(randomNumber).div(101);
        const glpAmount = await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
          .callStatic
          .mintAndStakeGlp(
            core.tokens.usdc.address,
            weirdAmount,
            1,
            1,
          );
        expect(await wrapper.getExchangeCost(core.tokens.usdc.address, glp.address, weirdAmount, BYTES_EMPTY))
          .to
          .eq(glpAmount);
      }
    });

    it('should fail if the input token is not in GLP', async () => {
      await expectThrow(
        wrapper.getExchangeCost(core.tokens.dfsGlp.address, glp.address, usableUsdcAmount, BYTES_EMPTY),
        `GLPWrapperTraderV2: Invalid input token <${core.tokens.dfsGlp.address.toLowerCase()}>`,
      );
    });

    it('should fail if the output token is not dfsGLP', async () => {
      await expectThrow(
        wrapper.getExchangeCost(core.tokens.usdc.address, core.tokens.weth.address, usableUsdcAmount, BYTES_EMPTY),
        `GLPWrapperTraderV2: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if the input amount is 0', async () => {
      await expectThrow(
        wrapper.getExchangeCost(core.tokens.usdc.address, glp.address, ZERO_BI, BYTES_EMPTY),
        'GLPWrapperTraderV2: Invalid desired input amount',
      );
    });
  });
});
