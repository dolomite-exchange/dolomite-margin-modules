import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  GLPIsolationModeTokenVaultV1,
  GLPIsolationModeTokenVaultV1__factory,
  GLPIsolationModeUnwrapperTraderV2,
  GLPIsolationModeVaultFactory,
  GLPIsolationModeWrapperTraderV2,
  GLPPriceOracleV1,
  GmxRegistryV1,
  IERC20,
} from '../src/types';
import { AccountInfoStruct } from '@dolomite-exchange/modules-base/src/utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { encodeExternalSellActionDataWithNoData, impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  createGLPIsolationModeTokenVaultV1,
  createGLPIsolationModeVaultFactory,
  createGLPPriceOracleV1,
  createGLPUnwrapperTraderV2,
  createGLPWrapperTraderV2,
  createGmxRegistry,
} from './utils/glp';
import {
  CoreProtocol,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { setupNewGenericTraderProxy } from '@dolomite-exchange/modules-base/test/utils/dolomite';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10

describe('GLPIsolationModeUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IERC20;
  let underlyingMarketId: BigNumber;
  let gmxRegistry: GmxRegistryV1;
  let unwrapper: GLPIsolationModeUnwrapperTraderV2;
  let wrapper: GLPIsolationModeWrapperTraderV2;
  let factory: GLPIsolationModeVaultFactory;
  let vault: GLPIsolationModeTokenVaultV1;
  let priceOracle: GLPPriceOracleV1;
  let defaultAccount: AccountInfoStruct;

  let solidUser: SignerWithAddress;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = core.gmxEcosystem!.fsGlp;
    const userVaultImplementation = await createGLPIsolationModeTokenVaultV1();
    gmxRegistry = await createGmxRegistry(core);
    factory = await createGLPIsolationModeVaultFactory(core, gmxRegistry, userVaultImplementation);
    priceOracle = await createGLPPriceOracleV1(factory, gmxRegistry);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);
    await core.dolomiteMargin.ownerSetPriceOracle(underlyingMarketId, priceOracle.address);

    unwrapper = await createGLPUnwrapperTraderV2(core, factory, gmxRegistry);
    wrapper = await createGLPWrapperTraderV2(core, factory, gmxRegistry);
    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    solidUser = core.hhUser5;

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<GLPIsolationModeTokenVaultV1>(
      vaultAddress,
      GLPIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };

    const usdcAmount = amountWei.div(1e12).mul(4);
    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
    await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
      .mintAndStakeGlp(core.tokens.usdc.address, usdcAmount, 0, 0);
    await core.gmxEcosystem!.sGlp.connect(core.hhUser1).approve(vault.address, amountWei);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

    expect(await underlyingToken.connect(core.hhUser1).balanceOf(vault.address)).to.eq(amountWei);
    expect((await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId)).value).to.eq(amountWei);

    await setupNewGenericTraderProxy(core, underlyingMarketId);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Actions.Call and Actions.Sell for non-liquidation', () => {
    it('should work when called with the normal conditions', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 0;
      const actions = await unwrapper.createActionsForUnwrapping({
        primaryAccountId: solidAccountId,
        otherAccountId: liquidAccountId,
        primaryAccountOwner: vault.address,
        primaryAccountNumber: defaultAccountNumber,
        otherAccountOwner: vault.address,
        otherAccountNumber: defaultAccountNumber,
        outputMarket: core.marketIds.usdc,
        inputMarket: underlyingMarketId,
        minOutputAmount: ZERO_BI,
        inputAmount: amountWei,
        orderData: BYTES_EMPTY,
      });

      const amountOut = await unwrapper.getExchangeCost(
        factory.address,
        core.tokens.usdc.address,
        amountWei,
        BYTES_EMPTY,
      );

      const genericTrader = await impersonate(core.genericTraderProxy!, true);
      await core.dolomiteMargin.connect(genericTrader).operate(
        [defaultAccount],
        actions,
      );

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
      expect(underlyingBalanceWei.value).to.eq(ZERO_BI);
      expect(await vault.underlyingBalanceOf()).to.eq(ZERO_BI);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.usdc);
      expect(otherBalanceWei.sign).to.eq(true);
      expect(otherBalanceWei.value).to.eq(amountOut);
    });

    it('should fail for invalid input market', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 0;
      await expectThrow(
        unwrapper.createActionsForUnwrapping({
          primaryAccountId: solidAccountId,
          otherAccountId: liquidAccountId,
          primaryAccountOwner: vault.address,
          primaryAccountNumber: defaultAccountNumber,
          otherAccountOwner: vault.address,
          otherAccountNumber: defaultAccountNumber,
          outputMarket: core.marketIds.usdc,
          inputMarket: core.marketIds.weth,
          minOutputAmount: ZERO_BI,
          inputAmount: amountWei,
          orderData: BYTES_EMPTY,
        }),
        `IsolationModeUnwrapperTraderV2: Invalid input market <${core.marketIds.weth.toString()}>`,
      );
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.usdc.address,
          factory.address,
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
        `IsolationModeUnwrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
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
          factory.address,
          amountWei,
          encodeExternalSellActionDataWithNoData(otherAmountWei),
        ),
        `IsolationModeUnwrapperTraderV2: Invalid output token <${core.tokens.dfsGlp!.address.toLowerCase()}>`,
      );
    });

    it('should fail if input amount is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await core.gmxEcosystem!.sGlp.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.usdc.address,
          factory.address,
          ZERO_BI,
          encodeExternalSellActionDataWithNoData(otherAmountWei),
        ),
        'IsolationModeUnwrapperTraderV2: Invalid input amount',
      );
    });
  });

  describe('#token', () => {
    it('should work', async () => {
      expect(await unwrapper.token()).to.eq(factory.address);
    });
  });

  describe('#actionsLength', () => {
    it('should work', async () => {
      expect(await unwrapper.actionsLength()).to.eq(2);
    });
  });

  describe('#gmxRegistry', () => {
    it('should work', async () => {
      expect(await unwrapper.GMX_REGISTRY()).to.eq(gmxRegistry.address);
    });
  });

  describe('#getExchangeCost', () => {
    it('should be greater than oracle price for $10M redemption', async () => {
      const ONE_WEI = BigNumber.from('1000000000000000000');
      const TEN_MILLION = BigNumber.from('10000000');
      const amount = ONE_WEI.mul(TEN_MILLION);
      const decimalDelta = BigNumber.from('1000000000000');
      const outputAmount = await unwrapper.getExchangeCost(
        factory.address,
        core.tokens.usdc.address,
        amount,
        BYTES_EMPTY,
      );
      const oraclePrice = (await priceOracle.getPrice(factory.address)).value.div(decimalDelta);
      // the effective price should be greater than the oracle price and less than the oracle price + 0.75%
      expect(outputAmount.div(TEN_MILLION)).to.be.gt(oraclePrice);
      expect(outputAmount.div(TEN_MILLION)).to.be.lt(oraclePrice.mul('10075').div('10000'));
    });

    it('should work normally', async () => {
      const expectedAmount = await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
        .callStatic
        .unstakeAndRedeemGlp(
          core.tokens.usdc.address,
          amountWei,
          1,
          core.hhUser1.address,
        );
      expect(await unwrapper.getExchangeCost(factory.address, core.tokens.usdc.address, amountWei, BYTES_EMPTY))
        .to
        .eq(expectedAmount);
    });

    it('should work for 10 random numbers, as long as balance is sufficient', async () => {
      for (let i = 0; i < 10; i++) {
        // create a random number from 1 to 99 and divide by 101 (making the number, at-most, slightly smaller)
        const randomNumber = BigNumber.from(Math.floor(Math.random() * 99) + 1);
        const weirdAmount = amountWei.mul(randomNumber).div(101);
        const expectedAmount = await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
          .callStatic
          .unstakeAndRedeemGlp(
            core.tokens.usdc.address,
            weirdAmount,
            1,
            core.hhUser1.address,
          );
        expect(await unwrapper.getExchangeCost(factory.address, core.tokens.usdc.address, weirdAmount, BYTES_EMPTY))
          .to
          .eq(expectedAmount);
      }
    });
  });
});
