import { ActionType, AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { expect } from 'chai';
import { BigNumber, ethers } from 'ethers';
import { IERC4626, MagicGLPPriceOracle, MagicGLPWrapperTraderV2 } from '../../../src/types';
import { IDolomiteStructs } from '../../../src/types/contracts/protocol/interfaces/IDolomiteMargin';
import { depositIntoDolomiteMargin } from '../../../src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import {
  createMagicGLPPriceOracle,
  createMagicGLPWrapperTraderV2,
} from '../../utils/ecosystem-token-utils/abracadabra';
import {
  CoreProtocol,
  disableInterestAccrual,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUSDCBalance,
} from '../../utils/setup';
import AccountInfoStruct = IDolomiteStructs.AccountInfoStruct;
import ActionArgsStruct = IDolomiteStructs.ActionArgsStruct;

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const usdcAmount = amountWei.div(1e12).mul(5);
const usableUsdcAmount = usdcAmount.div(2);

const abiCoder = ethers.utils.defaultAbiCoder;

describe('MagicGLPWrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let magicGlp: IERC4626;
  let marketId: BigNumber;
  let wrapper: MagicGLPWrapperTraderV2;
  let magicGlpPriceOracle: MagicGLPPriceOracle;
  let defaultAccount: AccountInfoStruct;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    magicGlp = core.abraEcosystem!.magicGlp;
    magicGlpPriceOracle = await createMagicGLPPriceOracle(core);

    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, magicGlp, true, magicGlpPriceOracle);

    wrapper = await createMagicGLPWrapperTraderV2(core);

    defaultAccount = { owner: core.hhUser1.address, number: defaultAccountNumber };

    // setting the interest rate to 0 makes calculations more consistent
    await disableInterestAccrual(core, core.marketIds.usdc);

    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
    await core.tokens.usdc.connect(core.hhUser1).approve(core.gmxEcosystem!.glpManager.address, usdcAmount);
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
        magicGlp.address,
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
          data: ethers.utils.defaultAbiCoder.encode(['uint256', 'bytes'], [amountWei, []]),
        },
      ];

      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await core.dolomiteMargin.connect(core.hhUser5).operate(
        [defaultAccount],
        actions,
      );

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, marketId);
      expect(underlyingBalanceWei.value).to.eq(amountOut);
      expect(underlyingBalanceWei.sign).to.eq(true);
      expect(await magicGlp.balanceOf(core.dolomiteMargin.address)).to.eq(amountOut);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.usdc);
      expect(otherBalanceWei.value).to.eq(ZERO_BI);
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        wrapper.connect(core.hhUser1).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          magicGlp.address,
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
          magicGlp.address,
          core.tokens.dfsGlp!.address,
          usableUsdcAmount,
          abiCoder.encode(['uint256'], [ZERO_BI]),
        ),
        `MagicGLPWrapperTraderV2: Invalid input token <${core.tokens.dfsGlp!.address.toLowerCase()}>`,
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
          abiCoder.encode(['uint256'], [otherAmountWei]),
        ),
        `MagicGLPWrapperTraderV2: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if input amount is 0', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          magicGlp.address,
          core.tokens.usdc.address,
          ZERO_BI,
          abiCoder.encode(['uint256'], [otherAmountWei]),
        ),
        'MagicGLPWrapperTraderV2: Invalid input amount',
      );
    });
  });

  describe('#MAGIC_GLP', () => {
    it('should work', async () => {
      expect(await wrapper.MAGIC_GLP()).to.eq(magicGlp.address);
    });
  });

  describe('#GMX_REGISTRY', () => {
    it('should work', async () => {
      expect(await wrapper.GMX_REGISTRY()).to.eq(core.gmxEcosystem!.live.gmxRegistry!.address);
    });
  });

  describe('#getExchangeCost', () => {
    it('should work normally', async () => {
      const inputAmount = usableUsdcAmount;
      const glpAmount = await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
        .callStatic
        .mintAndStakeGlp(
          core.tokens.usdc.address,
          inputAmount,
          1,
          1,
        );
      const expectedAmount = await magicGlp.convertToShares(glpAmount);
      expect(await wrapper.getExchangeCost(core.tokens.usdc.address, magicGlp.address, inputAmount, BYTES_EMPTY))
        .to
        .eq(expectedAmount);
    });

    it('should work for 10 random numbers, as long as balance is sufficient', async () => {
      for (let i = 0; i < 10; i++) {
        // create a random number from 1 to 99 and divide by 101 (making the number, at-most, slightly smaller)
        const randomNumber = BigNumber.from(Math.floor(Math.random() * 99) + 1);
        const weirdAmount = usableUsdcAmount.mul(randomNumber).div(101);
        const glpAmount = await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
          .callStatic
          .mintAndStakeGlp(
            core.tokens.usdc.address,
            weirdAmount,
            1,
            1,
          );
        const expectedAmount = await magicGlp.convertToShares(glpAmount);
        expect(await wrapper.getExchangeCost(core.tokens.usdc.address, magicGlp.address, weirdAmount, BYTES_EMPTY))
          .to
          .eq(expectedAmount);
      }
    });

    it('should fail if the input token is not in GLP', async () => {
      await expectThrow(
        wrapper.getExchangeCost(core.tokens.dfsGlp!.address, magicGlp.address, usableUsdcAmount, BYTES_EMPTY),
        `MagicGLPWrapperTraderV2: Invalid input token <${core.tokens.dfsGlp!.address.toLowerCase()}>`,
      );
    });

    it('should fail if the output token is not dfsGLP', async () => {
      await expectThrow(
        wrapper.getExchangeCost(core.tokens.usdc.address, core.tokens.weth.address, usableUsdcAmount, BYTES_EMPTY),
        `MagicGLPWrapperTraderV2: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if the input amount is 0', async () => {
      await expectThrow(
        wrapper.getExchangeCost(core.tokens.usdc.address, magicGlp.address, ZERO_BI, BYTES_EMPTY),
        'MagicGLPWrapperTraderV2: Invalid desired input amount',
      );
    });
  });
});
