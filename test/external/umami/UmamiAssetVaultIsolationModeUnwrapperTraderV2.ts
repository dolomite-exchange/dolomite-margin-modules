import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber, ethers } from 'ethers';
import {
  IGmxRegistryV1,
  IUmamiAssetVault,
  UmamiAssetVaultIsolationModeTokenVaultV1,
  UmamiAssetVaultIsolationModeTokenVaultV1__factory,
  UmamiAssetVaultIsolationModeUnwrapperTraderV2,
  UmamiAssetVaultIsolationModeVaultFactory,
  UmamiAssetVaultIsolationModeWrapperTraderV2,
  UmamiAssetVaultPriceOracle,
  UmamiAssetVaultRegistry,
} from '../../../src/types';
import { Account } from '../../../src/types/IDolomiteMargin';
import { BYTES_EMPTY, Network, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import {
  createUmamiAssetVaultIsolationModeTokenVaultV1,
  createUmamiAssetVaultIsolationModeUnwrapperTraderV2,
  createUmamiAssetVaultIsolationModeVaultFactory,
  createUmamiAssetVaultIsolationModeWrapperTraderV2,
  createUmamiAssetVaultPriceOracle,
  createUmamiAssetVaultRegistry,
} from '../../utils/ecosystem-token-utils/umami';
import {
  CoreProtocol,
  setupCoreProtocol,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '../../utils/setup';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const usdcAmount = amountWei.div(1e12).mul(8);
const usableUsdcAmount = usdcAmount.div(2);

const abiCoder = ethers.utils.defaultAbiCoder;

describe('UmamiAssetVaultIsolationModeUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IUmamiAssetVault;
  let underlyingMarketId: BigNumber;
  let gmxRegistry: IGmxRegistryV1;
  let umamiRegistry: UmamiAssetVaultRegistry;
  let unwrapper: UmamiAssetVaultIsolationModeUnwrapperTraderV2;
  let wrapper: UmamiAssetVaultIsolationModeWrapperTraderV2;
  let factory: UmamiAssetVaultIsolationModeVaultFactory;
  let vault: UmamiAssetVaultIsolationModeTokenVaultV1;
  let priceOracle: UmamiAssetVaultPriceOracle;
  let defaultAccount: Account.InfoStruct;

  let solidUser: SignerWithAddress;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 100_000_001,
      network: Network.ArbitrumOne,
    });
    underlyingToken = core.umamiEcosystem!.umUsdc;
    const userVaultImplementation = await createUmamiAssetVaultIsolationModeTokenVaultV1();
    gmxRegistry = core.gmxEcosystem!.live.gmxRegistry!;
    umamiRegistry = await createUmamiAssetVaultRegistry(core);
    factory = await createUmamiAssetVaultIsolationModeVaultFactory(
      core,
      umamiRegistry,
      underlyingToken,
      core.usdc,
      userVaultImplementation,
    );

    unwrapper = await createUmamiAssetVaultIsolationModeUnwrapperTraderV2(core, umamiRegistry, factory);
    wrapper = await createUmamiAssetVaultIsolationModeWrapperTraderV2(core, umamiRegistry, factory);
    priceOracle = await createUmamiAssetVaultPriceOracle(core, umamiRegistry, factory);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);
    await core.dolomiteMargin.ownerSetPriceOracle(underlyingMarketId, priceOracle.address);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(
      underlyingMarketId,
      core.liquidatorProxyV4.address,
    );

    solidUser = core.hhUser5;

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<UmamiAssetVaultIsolationModeTokenVaultV1>(
      vaultAddress,
      UmamiAssetVaultIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };

    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.umamiEcosystem!.umUsdc);
    await core.umamiEcosystem!.umUsdc.connect(core.hhUser1).deposit(usableUsdcAmount, core.hhUser1.address);
    await core.umamiEcosystem!.umUsdc.connect(core.hhUser1).approve(vault.address, amountWei);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

    expect(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);
    expect((await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId)).value).to.eq(amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Actions.Call and Actions.Sell for non-liquidation', () => {
    it('should work when called with the normal conditions', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 0;
      const actions = await unwrapper.createActionsForUnwrapping(
        solidAccountId,
        liquidAccountId,
        vault.address,
        vault.address,
        core.marketIds.usdc,
        underlyingMarketId,
        ZERO_BI,
        amountWei,
        BYTES_EMPTY,
      );

      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(underlyingMarketId, core.hhUser5.address);
      const result = await core.dolomiteMargin.connect(core.hhUser5).operate(
        [defaultAccount],
        actions,
      );

      // jUSDC's value goes up every second. To get the correct amountOut, we need to use the same block #
      const amountOut = await unwrapper.getExchangeCost(
        factory.address,
        core.usdc.address,
        amountWei,
        BYTES_EMPTY,
        { blockTag: result.blockNumber },
      );

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
      expect(underlyingBalanceWei.value).to.eq(ZERO_BI);
      expect(await vault.underlyingBalanceOf()).to.eq(ZERO_BI);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.usdc);
      expect(otherBalanceWei.sign).to.eq(true);
      expect(otherBalanceWei.value).to.eq(amountOut);
    });
  });

  describe('#callFunction', () => {
    it('should fail if sender function param is not a valid liquidator', async () => {
      const impersonator = await impersonate(core.dolomiteMargin.address, true);
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser1.address, true);
      const liquidators = await core.liquidatorAssetRegistry.getLiquidatorsForAsset(underlyingMarketId);
      expect(liquidators.length).to.eq(1);
      expect(liquidators[0]).to.eq(core.liquidatorProxyV4.address);

      expect(await core.liquidatorAssetRegistry.isAssetWhitelistedForLiquidation(
        underlyingMarketId,
        core.hhUser1.address,
      )).to.eq(false);
      await expectThrow(
        unwrapper.connect(impersonator).callFunction(
          core.hhUser1.address,
          { owner: solidUser.address, number: ZERO_BI },
          BYTES_EMPTY,
        ),
        `UmamiAssetVaultUnwrapperV2: Sender must be a liquidator <${core.hhUser1.address.toLowerCase()}>`,
      );

      await core.liquidatorAssetRegistry.ownerRemoveLiquidatorFromAssetWhitelist(
        underlyingMarketId,
        core.liquidatorProxyV4.address,
      );
      expect((await core.liquidatorAssetRegistry.getLiquidatorsForAsset(underlyingMarketId)).length).to.eq(0);
      expect(await core.liquidatorAssetRegistry.isAssetWhitelistedForLiquidation(
        underlyingMarketId,
        core.hhUser1.address,
      )).to.eq(true); // returns true because the length is 0

      await expectThrow(
        unwrapper.connect(impersonator).callFunction(
          core.hhUser1.address,
          { owner: solidUser.address, number: ZERO_BI },
          BYTES_EMPTY,
        ),
        `UmamiAssetVaultUnwrapperV2: Sender must be a liquidator <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.usdc.address,
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
          core.usdc.address,
          core.weth.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `IsolationModeUnwrapperTraderV2: Invalid input token <${core.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await core.umamiEcosystem!.umUsdc.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.dfsGlp!.address,
          factory.address,
          amountWei,
          abiCoder.encode(['uint256'], [otherAmountWei]),
        ),
        `IsolationModeUnwrapperTraderV2: Invalid output token <${core.dfsGlp!.address.toLowerCase()}>`,
      );
    });

    it('should fail if input amount is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await core.umamiEcosystem!.umUsdc.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.usdc.address,
          factory.address,
          ZERO_BI,
          abiCoder.encode(['uint256'], [otherAmountWei]),
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

  describe('#getExchangeCost', () => {
    it('should work normally', async () => {
      const jUSDCExchangeRateNumerator = await underlyingToken.totalAssets();
      const jUSDCExchangeRateDenominator = await underlyingToken.totalSupply();

      const amountBeforeRetention = amountWei
        .mul(jUSDCExchangeRateNumerator)
        .div(jUSDCExchangeRateDenominator);
      const retentionFee = amountBeforeRetention.mul('97').div('10000');
      const expectedAmount = amountBeforeRetention.sub(retentionFee);

      expect(await unwrapper.getExchangeCost(factory.address, core.usdc.address, amountWei, BYTES_EMPTY))
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

        expect(await unwrapper.getExchangeCost(factory.address, core.usdc.address, weirdAmount, BYTES_EMPTY))
          .to
          .eq(expectedAmount);
      }
    });
  });
});
