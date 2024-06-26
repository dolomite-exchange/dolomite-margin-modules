import { IERC4626 } from '@dolomite-exchange/modules-base/src/types';
import { AccountInfoStruct } from '@dolomite-exchange/modules-base/src/utils';
import { BYTES_EMPTY, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '@dolomite-exchange/modules-base/src/utils/SignerWithAddressWithSafety';
import {
  encodeExternalSellActionDataWithNoData,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  setupCoreProtocol,
  setupNativeUSDCBalance,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  JonesUSDCIsolationModeTokenVaultV1,
  JonesUSDCIsolationModeTokenVaultV1__factory,
  JonesUSDCIsolationModeUnwrapperTraderV2,
  JonesUSDCIsolationModeVaultFactory,
  JonesUSDCIsolationModeWrapperTraderV2,
  JonesUSDCPriceOracle,
  JonesUSDCRegistry,
} from '../src/types';
import {
  createJonesUSDCIsolationModeTokenVaultV1,
  createJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation,
  createJonesUSDCIsolationModeUnwrapperTraderV2ForZap,
  createJonesUSDCIsolationModeVaultFactory,
  createJonesUSDCIsolationModeWrapperTraderV2,
  createJonesUSDCPriceOracle,
  createJonesUSDCRegistry,
} from './jones-ecosystem-utils';
import { createRoleAndWhitelistTraderV2, JONES_CORE_PROTOCOL_CONFIG } from './jones-utils';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const usdcAmount = amountWei.div(1e12).mul(8);
const usableUsdcAmount = usdcAmount.div(2);

describe('JonesUSDCIsolationModeUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: IERC4626;
  let marketId: BigNumber;
  let jonesUSDCRegistry: JonesUSDCRegistry;
  let unwrapperTraderForLiquidation: JonesUSDCIsolationModeUnwrapperTraderV2;
  let wrapper: JonesUSDCIsolationModeWrapperTraderV2;
  let factory: JonesUSDCIsolationModeVaultFactory;
  let vault: JonesUSDCIsolationModeTokenVaultV1;
  let priceOracle: JonesUSDCPriceOracle;
  let defaultAccount: AccountInfoStruct;

  let solidUser: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol(JONES_CORE_PROTOCOL_CONFIG);
    underlyingToken = core.jonesEcosystem.jUSDCV2.connect(core.hhUser1);
    const userVaultImplementation = await createJonesUSDCIsolationModeTokenVaultV1();
    jonesUSDCRegistry = await createJonesUSDCRegistry(core);
    factory = await createJonesUSDCIsolationModeVaultFactory(
      core,
      jonesUSDCRegistry,
      underlyingToken,
      userVaultImplementation,
    );

    unwrapperTraderForLiquidation = await createJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation(
      core,
      jonesUSDCRegistry,
      factory,
    );
    const unwrapperTraderForZap = await createJonesUSDCIsolationModeUnwrapperTraderV2ForZap(
      core,
      jonesUSDCRegistry,
      factory,
    );
    await jonesUSDCRegistry.initializeUnwrapperTraders(
      unwrapperTraderForLiquidation.address,
      unwrapperTraderForZap.address,
    );
    wrapper = await createJonesUSDCIsolationModeWrapperTraderV2(core, jonesUSDCRegistry, factory);
    await createRoleAndWhitelistTraderV2(core, unwrapperTraderForLiquidation, wrapper);
    priceOracle = await createJonesUSDCPriceOracle(core, jonesUSDCRegistry, factory);

    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);
    await core.dolomiteMargin.ownerSetPriceOracle(marketId, priceOracle.address);

    await factory.connect(core.governance).ownerInitialize([unwrapperTraderForLiquidation.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(
      marketId,
      core.liquidatorProxyV4.address,
    );

    solidUser = core.hhUser5;

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<JonesUSDCIsolationModeTokenVaultV1>(
      vaultAddress,
      JonesUSDCIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };

    await setupNativeUSDCBalance(core, core.hhUser1, usdcAmount, core.jonesEcosystem.jUSDCRouter);
    await core.jonesEcosystem.jUSDCRouter.connect(core.hhUser1).deposit(usableUsdcAmount, core.hhUser1.address);
    await underlyingToken.approve(vault.address, amountWei);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

    expect(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);
    expect((await core.dolomiteMargin.getAccountWei(defaultAccount, marketId)).value).to.eq(amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Actions.Call and Actions.Sell for non-liquidation', () => {
    it('should work when called with the normal conditions', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 0;
      const actions = await unwrapperTraderForLiquidation.createActionsForUnwrapping({
        primaryAccountId: solidAccountId,
        otherAccountId: liquidAccountId,
        primaryAccountOwner: vault.address,
        primaryAccountNumber: defaultAccountNumber,
        otherAccountOwner: vault.address,
        otherAccountNumber: defaultAccountNumber,
        outputMarket: core.marketIds.nativeUsdc,
        inputMarket: marketId,
        minOutputAmount: ZERO_BI,
        inputAmount: amountWei,
        orderData: BYTES_EMPTY,
      });

      const genericTrader = await impersonate(core.genericTraderProxy!, true);
      await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(marketId, genericTrader.address);
      const result = await core.dolomiteMargin.connect(genericTrader).operate(
        [defaultAccount],
        actions,
      );

      // jUSDC's value goes up every second. To get the correct amountOut, we need to use the same block #
      const amountOut = await unwrapperTraderForLiquidation.getExchangeCost(
        factory.address,
        core.tokens.nativeUsdc.address,
        amountWei,
        BYTES_EMPTY,
        { blockTag: result.blockNumber },
      );

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, marketId);
      expect(underlyingBalanceWei.value).to.eq(ZERO_BI);
      expect(await vault.underlyingBalanceOf()).to.eq(ZERO_BI);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.nativeUsdc);
      expect(otherBalanceWei.sign).to.eq(true);
      expect(otherBalanceWei.value).to.eq(amountOut);
    });
  });

  describe('#callFunction', () => {
    it('should fail if sender function param is not a valid liquidator', async () => {
      const impersonator = await impersonate(core.dolomiteMargin.address, true);
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser1.address, true);
      const liquidators = await core.liquidatorAssetRegistry.getLiquidatorsForAsset(marketId);
      expect(liquidators.length).to.eq(1);
      expect(liquidators[0]).to.eq(core.liquidatorProxyV4.address);

      expect(await core.liquidatorAssetRegistry.isAssetWhitelistedForLiquidation(
        marketId,
        core.hhUser1.address,
      )).to.eq(false);
      await expectThrow(
        unwrapperTraderForLiquidation.connect(impersonator).callFunction(
          core.genericTraderProxy!.address,
          { owner: solidUser.address, number: ZERO_BI },
          BYTES_EMPTY,
        ),
        `JonesUSDCUnwrapperV2Liquidation: Sender must be a liquidator <${core.genericTraderProxy!.address.toLowerCase()}>`,
      );

      await core.liquidatorAssetRegistry.ownerRemoveLiquidatorFromAssetWhitelist(
        marketId,
        core.liquidatorProxyV4.address,
      );
      expect((await core.liquidatorAssetRegistry.getLiquidatorsForAsset(marketId)).length).to.eq(0);
      expect(await core.liquidatorAssetRegistry.isAssetWhitelistedForLiquidation(
        marketId,
        core.hhUser1.address,
      )).to.eq(true); // returns true because the length is 0

      await expectThrow(
        unwrapperTraderForLiquidation.connect(impersonator).callFunction(
          core.genericTraderProxy!.address,
          { owner: solidUser.address, number: ZERO_BI },
          BYTES_EMPTY,
        ),
        `JonesUSDCUnwrapperV2Liquidation: Sender must be a liquidator <${core.genericTraderProxy!.address.toLowerCase()}>`,
      );
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        unwrapperTraderForLiquidation.connect(core.hhUser1).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.nativeUsdc.address,
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
        unwrapperTraderForLiquidation.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.nativeUsdc.address,
          core.tokens.weth.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `IsolationModeUnwrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await underlyingToken
        .transfer(unwrapperTraderForLiquidation.address, amountWei);
      await expectThrow(
        unwrapperTraderForLiquidation.connect(dolomiteMarginImpersonator).exchange(
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
      await underlyingToken
        .transfer(unwrapperTraderForLiquidation.address, amountWei);
      await expectThrow(
        unwrapperTraderForLiquidation.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.nativeUsdc.address,
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
      expect(await unwrapperTraderForLiquidation.token()).to.eq(factory.address);
    });
  });

  describe('#actionsLength', () => {
    it('should work', async () => {
      expect(await unwrapperTraderForLiquidation.actionsLength()).to.eq(2);
    });
  });

  describe('#jonesUSDCRegistry', () => {
    it('should work', async () => {
      expect(await unwrapperTraderForLiquidation.JONES_USDC_REGISTRY()).to.eq(jonesUSDCRegistry.address);
    });
  });

  describe('#getExchangeCost', () => {
    it('should work normally', async () => {
      const jUSDCExchangeRateNumerator = await underlyingToken.totalAssets();
      const jUSDCExchangeRateDenominator = await underlyingToken.totalSupply();

      const amountBeforeRetention = amountWei
        .mul(jUSDCExchangeRateNumerator)
        .div(jUSDCExchangeRateDenominator);
      const retentionFee = amountBeforeRetention.mul('97').div('10000');
      const expectedAmount = amountBeforeRetention.sub(retentionFee);

      expect(await unwrapperTraderForLiquidation.getExchangeCost(
        factory.address,
        core.tokens.nativeUsdc.address,
        amountWei,
        BYTES_EMPTY,
      ))
        .to
        .eq(expectedAmount);
    });

    it('should work for 10 random numbers, as long as balance is sufficient', async () => {
      const jUSDCExchangeRateNumerator = await underlyingToken.totalAssets();
      const jUSDCExchangeRateDenominator = await underlyingToken.totalSupply();

      for (let i = 0; i < 10; i++) {
        // create a random number from 1 to 99 and divide by 101 (making the number, at-most, slightly smaller)
        const randomNumber = BigNumber.from(Math.floor(Math.random() * 99) + 1);
        const weirdAmount = amountWei.mul(randomNumber).div(101);
        const amountBeforeRetention = weirdAmount
          .mul(jUSDCExchangeRateNumerator)
          .div(jUSDCExchangeRateDenominator);

        const expectedAmount = amountBeforeRetention.sub(amountBeforeRetention.mul('97').div('10000'));

        expect(await unwrapperTraderForLiquidation.getExchangeCost(
          factory.address,
          core.tokens.nativeUsdc.address,
          weirdAmount,
          BYTES_EMPTY,
        ))
          .to
          .eq(expectedAmount);
      }
    });
  });
});
