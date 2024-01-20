import { ActionType, AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { MagicGLPPriceOracle, MagicGLPUnwrapperTraderV2 } from '../src/types';
import { IERC4626 } from '@dolomite-exchange/modules-base/src/types';
import { AccountInfoStruct, ActionArgsStruct } from '@dolomite-exchange/modules-base/src/utils';
import { depositIntoDolomiteMargin } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { encodeExternalSellActionDataWithNoData, impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  createMagicGLPPriceOracle,
  createMagicGLPUnwrapperTraderV2,
} from './utils/abracadabra';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol, setupUSDCBalance } from '@dolomite-exchange/modules-base/test/utils/setup';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10

describe('MagicGLPUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let magicGlp: IERC4626;
  let marketId: BigNumber;
  let unwrapper: MagicGLPUnwrapperTraderV2;
  let priceOracle: MagicGLPPriceOracle;
  let defaultAccount: AccountInfoStruct;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    magicGlp = core.abraEcosystem!.magicGlp;
    priceOracle = await createMagicGLPPriceOracle(core);

    marketId = BigNumber.from(core.marketIds.magicGlp!);

    unwrapper = await createMagicGLPUnwrapperTraderV2(core);

    defaultAccount = { owner: core.hhUser1.address, number: defaultAccountNumber };

    const usdcAmount = amountWei.div(1e12).mul(4);
    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
    await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
      .mintAndStakeGlp(core.tokens.usdc.address, usdcAmount, 0, 0);
    await core.gmxEcosystem!.sGlp.connect(core.hhUser1).approve(magicGlp.address, amountWei.mul(2));
    await magicGlp.connect(core.hhUser1).mint(amountWei, core.hhUser1.address);

    await magicGlp.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
    await depositIntoDolomiteMargin(
      core,
      core.hhUser1,
      defaultAccount.number,
      marketId,
      amountWei,
      core.hhUser1.address,
    );
    expect((await core.dolomiteMargin.getAccountWei(defaultAccount, marketId)).value).to.eq(amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('operate', () => {
    it('should work when called with the normal conditions', async () => {
      const amountOut = await unwrapper.getExchangeCost(
        magicGlp.address,
        core.tokens.usdc.address,
        amountWei,
        BYTES_EMPTY,
      );

      const actions: ActionArgsStruct[] = [
        {
          actionType: ActionType.Sell,
          accountId: 0,
          amount: { sign: false, value: amountWei, ref: AmountReference.Delta, denomination: AmountDenomination.Wei },
          primaryMarketId: marketId,
          secondaryMarketId: core.marketIds.usdc,
          otherAddress: unwrapper.address,
          otherAccountId: 0,
          data: encodeExternalSellActionDataWithNoData(amountOut),
        },
      ];

      const balanceBefore = await magicGlp.balanceOf(core.dolomiteMargin.address);

      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await core.dolomiteMargin.connect(core.hhUser5).operate(
        [defaultAccount],
        actions,
      );

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, marketId);
      expect(underlyingBalanceWei.value).to.eq(ZERO_BI);
      expect(balanceBefore.sub(await magicGlp.balanceOf(core.dolomiteMargin.address))).to.eq(amountWei);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.usdc);
      expect(otherBalanceWei.sign).to.eq(true);
      expect(otherBalanceWei.value).to.eq(amountOut);
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.usdc.address,
          magicGlp.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if input token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.usdc.address,
          core.tokens.weth.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `MagicGLPUnwrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await core.gmxEcosystem!.sGlp.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.dfsGlp!.address,
          magicGlp.address,
          amountWei,
          encodeExternalSellActionDataWithNoData(otherAmountWei),
        ),
        `MagicGLPUnwrapperTraderV2: Invalid output token <${core.tokens.dfsGlp!.address.toLowerCase()}>`,
      );
    });

    it('should fail if the input amount is 0', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await core.gmxEcosystem!.sGlp.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.usdc.address,
          magicGlp.address,
          ZERO_BI,
          encodeExternalSellActionDataWithNoData(otherAmountWei),
        ),
        'MagicGLPUnwrapperTraderV2: Invalid input amount',
      );
    });
  });

  describe('#MAGIC_GLP', () => {
    it('should work', async () => {
      expect(await unwrapper.MAGIC_GLP()).to.eq(magicGlp.address);
    });
  });

  describe('#GMX_REGISTRY', () => {
    it('should work', async () => {
      expect(await unwrapper.GMX_REGISTRY()).to.eq(core.gmxEcosystem!.live.gmxRegistry!.address);
    });
  });

  describe('#getExchangeCost', () => {
    it('should be greater than oracle price for $10M redemption', async () => {
      const ONE_WEI = BigNumber.from('1000000000000000000');
      const TEN_MILLION = BigNumber.from('10000000');
      const amount = ONE_WEI.mul(TEN_MILLION);
      const decimalDelta = BigNumber.from('1000000000000');
      const outputAmount = await unwrapper.getExchangeCost(
        magicGlp.address,
        core.tokens.usdc.address,
        amount,
        BYTES_EMPTY,
      );
      const oraclePrice = (await priceOracle.getPrice(magicGlp.address)).value.div(decimalDelta);
      // the effective price should be greater than the oracle price and less than the oracle price + 0.75%
      expect(outputAmount.div(TEN_MILLION)).to.be.gt(oraclePrice);
      expect(outputAmount.div(TEN_MILLION)).to.be.lt(oraclePrice.mul('10075').div('10000'));
    });

    it('should work normally', async () => {
      const glpAmount = await magicGlp.convertToAssets(amountWei);
      const expectedUsdcAmount = await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
        .callStatic
        .unstakeAndRedeemGlp(
          core.tokens.usdc.address,
          glpAmount,
          1,
          core.hhUser1.address,
        );
      expect(await unwrapper.getExchangeCost(magicGlp.address, core.tokens.usdc.address, amountWei, BYTES_EMPTY))
        .to
        .eq(expectedUsdcAmount);
    });

    it('should work for 10 random numbers, as long as balance is sufficient', async () => {
      for (let i = 0; i < 10; i++) {
        // create a random number from 1 to 99 and divide by 101 (making the number, at-most, slightly smaller)
        const randomNumber = BigNumber.from(Math.floor(Math.random() * 99) + 1);
        const weirdAmount = amountWei.mul(randomNumber).div(101);
        const glpAmount = await magicGlp.convertToAssets(weirdAmount);
        const expectedUsdcAmount = await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
          .callStatic
          .unstakeAndRedeemGlp(
            core.tokens.usdc.address,
            glpAmount,
            1,
            core.hhUser1.address,
          );
        expect(await unwrapper.getExchangeCost(magicGlp.address, core.tokens.usdc.address, weirdAmount, BYTES_EMPTY))
          .to
          .eq(expectedUsdcAmount);
      }
    });

    it('should fail if the input token is not dsfGLP', async () => {
      await expectThrow(
        unwrapper.getExchangeCost(core.tokens.weth.address, core.tokens.usdc.address, amountWei, BYTES_EMPTY),
        `MagicGLPUnwrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if the output token is not USDC', async () => {
      await expectThrow(
        unwrapper.getExchangeCost(magicGlp.address, core.tokens.dfsGlp!.address, amountWei, BYTES_EMPTY),
        `MagicGLPUnwrapperTraderV2: Invalid output token <${core.tokens.dfsGlp!.address.toLowerCase()}>`,
      );
    });

    it('should fail if the input token is not 0', async () => {
      await expectThrow(
        unwrapper.getExchangeCost(magicGlp.address, core.tokens.usdc.address, ZERO_BI, BYTES_EMPTY),
        'MagicGLPUnwrapperTraderV2: Invalid desired input amount',
      );
    });
  });
});
