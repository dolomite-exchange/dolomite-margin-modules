import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  IUmamiAssetVault,
  UmamiAssetVaultIsolationModeTokenVaultV1,
  UmamiAssetVaultIsolationModeTokenVaultV1__factory,
  UmamiAssetVaultIsolationModeUnwrapperTraderV2,
  UmamiAssetVaultIsolationModeVaultFactory,
  UmamiAssetVaultIsolationModeWrapperTraderV2,
  UmamiAssetVaultPriceOracle,
  UmamiAssetVaultRegistry,
} from '../../../src/types';
import { AccountInfoStruct } from '../../../src/utils';
import { getUmamiTokenCollateralization } from '../../../src/utils/constructors/umami';
import { depositIntoDolomiteMargin } from '../../../src/utils/dolomite-utils';
import {
  BYTES_EMPTY,
  LIQUIDATE_ALL,
  Network,
  NO_PARASWAP_TRADER_PARAM,
  ONE_BI,
  SELL_ALL,
  ZERO_BI,
} from '../../../src/utils/no-deps-constants';
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot, waitDays, waitTime } from '../../utils';
import {
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectWalletBalanceOrDustyIfZero,
} from '../../utils/assertions';
import {
  createUmamiAssetVaultIsolationModeTokenVaultV1,
  createUmamiAssetVaultIsolationModeUnwrapperTraderV2,
  createUmamiAssetVaultIsolationModeVaultFactory,
  createUmamiAssetVaultIsolationModeWrapperTraderV2,
  createUmamiAssetVaultPriceOracle,
  createUmamiAssetVaultRegistry,
} from '../../utils/ecosystem-token-utils/umami';
import { setExpiry } from '../../utils/expiry-utils';
import { liquidateV4WithIsolationMode } from '../../utils/liquidation-utils';
import {
  CoreProtocol,
  setupCoreProtocol,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '../../utils/setup';
import { setupWhitelistAndAggregateVault } from './umami-utils';

const defaultAccountNumber = '0';
const otherAccountNumber = '420';
const heldAmountWei = BigNumber.from('200000000'); // $200
const usdcAmount = heldAmountWei.mul(8);
const usableUsdcAmount = usdcAmount.div(2);
const expirationCollateralizationNumerator = BigNumber.from('150');
const expirationCollateralizationDenominator = BigNumber.from('100');
const minCollateralizationDenominator = BigNumber.from('1000000000000000000');
const liquidationSpreadDenominator = BigNumber.from('1000000000000000000');

describe('UmamiAssetVaultIsolationModeLiquidationWithUnwrapperV2', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IUmamiAssetVault;
  let underlyingMarketId: BigNumber;
  let umamiRegistry: UmamiAssetVaultRegistry;
  let unwrapper: UmamiAssetVaultIsolationModeUnwrapperTraderV2;
  let wrapper: UmamiAssetVaultIsolationModeWrapperTraderV2;
  let factory: UmamiAssetVaultIsolationModeVaultFactory;
  let vault: UmamiAssetVaultIsolationModeTokenVaultV1;
  let priceOracle: UmamiAssetVaultPriceOracle;
  let defaultAccountStruct: AccountInfoStruct;
  let liquidAccountStruct: AccountInfoStruct;
  let solidAccountStruct: AccountInfoStruct;
  let minCollateralizationNumerator: BigNumber;
  let liquidationSpreadNumerator: BigNumber;

  before(async () => {
    const blockNumber = await getRealLatestBlockNumber(true, Network.ArbitrumOne);
    core = await setupCoreProtocol({
      blockNumber,
      network: Network.ArbitrumOne,
    });
    underlyingToken = core.umamiEcosystem!.glpUsdc.connect(core.hhUser1);
    const userVaultImplementation = await createUmamiAssetVaultIsolationModeTokenVaultV1();
    umamiRegistry = await createUmamiAssetVaultRegistry(core);
    factory = await createUmamiAssetVaultIsolationModeVaultFactory(
      core,
      umamiRegistry,
      underlyingToken,
      userVaultImplementation,
    );
    unwrapper = await createUmamiAssetVaultIsolationModeUnwrapperTraderV2(core, umamiRegistry, factory);
    wrapper = await createUmamiAssetVaultIsolationModeWrapperTraderV2(core, umamiRegistry, factory);
    priceOracle = await createUmamiAssetVaultPriceOracle(core, umamiRegistry, factory);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    const collateralizationData = getUmamiTokenCollateralization(core.umamiEcosystem!.glpUsdc, core);
    minCollateralizationNumerator = collateralizationData.minCollateralization;
    liquidationSpreadNumerator = collateralizationData.liquidationSpread;
    await setupTestMarket(
      core,
      factory,
      true,
      priceOracle,
      collateralizationData.marginPremium,
      collateralizationData.liquidationSpreadPremium,
    );

    // admin setup
    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await core.liquidatorAssetRegistry.connect(core.governance).ownerAddLiquidatorToAssetWhitelist(
      underlyingMarketId,
      core.liquidatorProxyV4.address,
    );

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<UmamiAssetVaultIsolationModeTokenVaultV1>(
      vaultAddress,
      UmamiAssetVaultIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    defaultAccountStruct = { owner: vault.address, number: defaultAccountNumber };
    liquidAccountStruct = { owner: vault.address, number: otherAccountNumber };
    solidAccountStruct = { owner: core.hhUser5.address, number: defaultAccountNumber };

    await setupWhitelistAndAggregateVault(core, umamiRegistry);

    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.umamiEcosystem!.glpUsdc);
    await core.umamiEcosystem!.glpUsdc.connect(core.hhUser1).deposit(usableUsdcAmount, core.hhUser1.address);
    await core.umamiEcosystem!.glpUsdc.connect(core.hhUser1).approve(vault.address, heldAmountWei);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, heldAmountWei);

    expect(await underlyingToken.connect(core.hhUser1).balanceOf(vault.address)).to.eq(heldAmountWei);
    expect((await core.dolomiteMargin.getAccountWei(defaultAccountStruct, underlyingMarketId)).value)
      .to
      .eq(heldAmountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Perform liquidation with full integration', () => {
    it('should work when liquid account is borrowing the output token (USDC)', async () => {
      const [supplyValue, borrowValue] = await core.dolomiteMargin.getAccountValues(defaultAccountStruct);
      expect(borrowValue.value).to.eq(ZERO_BI);

      const usdcPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.usdc);
      const usdcDebtAmountBefore = supplyValue.value
        .mul(minCollateralizationDenominator)
        .div(minCollateralizationNumerator)
        .div(usdcPrice.value);
      await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, otherAccountNumber, heldAmountWei);
      await vault.transferFromPositionWithOtherToken(
        otherAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcDebtAmountBefore,
        BalanceCheckFlag.To,
      );
      await core.testEcosystem!.testInterestSetter.setInterestRate(
        core.tokens.usdc.address,
        { value: '33295281582' }, // 100% APR
      );
      await core.dolomiteMargin.ownerSetInterestSetter(
        core.marketIds.usdc,
        core.testEcosystem!.testInterestSetter.address,
      );
      await waitDays(10); // accrue interest to push towards liquidation
      // deposit 0 to refresh account index
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, ZERO_BI);

      const newAccountValues = await core.dolomiteMargin.getAccountValues(liquidAccountStruct);
      // check that the position is indeed under collateralized
      expect(newAccountValues[0].value)
        .to
        .lt(newAccountValues[1].value.mul(minCollateralizationNumerator).div(minCollateralizationDenominator));

      const glpUsdcPrice = await core.dolomiteMargin.getMarketPrice(underlyingMarketId);
      const heldUpdatedWithReward = await newAccountValues[1].value.mul(liquidationSpreadNumerator)
        .div(liquidationSpreadDenominator)
        .div(glpUsdcPrice.value);

      const txResult = await liquidateV4WithIsolationMode(
        core,
        solidAccountStruct,
        liquidAccountStruct,
        [underlyingMarketId, core.marketIds.usdc],
        [SELL_ALL, LIQUIDATE_ALL],
        unwrapper,
      );
      const receipt = await txResult.wait();
      console.log('\tliquidatorProxy#liquidate gas used:', receipt.gasUsed.toString());

      const heldUsdcAfter = (await core.dolomiteMargin.getAccountWei(
        solidAccountStruct,
        core.marketIds.usdc,
      )).value;
      const usdcOutputAmount = await unwrapper.getExchangeCost(
        factory.address,
        core.tokens.usdc.address,
        heldUpdatedWithReward,
        BYTES_EMPTY,
        { blockTag: txResult.blockNumber },
      );

      await expectProtocolBalance(
        core,
        solidAccountStruct.owner,
        solidAccountStruct.number,
        underlyingMarketId,
        ZERO_BI,
      );
      await expectProtocolBalanceIsGreaterThan(
        core,
        solidAccountStruct,
        core.marketIds.usdc,
        heldUsdcAfter.sub(usdcOutputAmount),
        '5',
      );
      await expectProtocolBalanceIsGreaterThan(
        core,
        liquidAccountStruct,
        underlyingMarketId,
        heldAmountWei.sub(heldUpdatedWithReward),
        '5',
      );
      await expectProtocolBalance(
        core,
        liquidAccountStruct.owner,
        liquidAccountStruct.number,
        core.marketIds.usdc,
        ZERO_BI,
      );

      await expectWalletBalanceOrDustyIfZero(core, core.liquidatorProxyV4!.address, factory.address, ZERO_BI);
      await expectWalletBalanceOrDustyIfZero(core, core.liquidatorProxyV4!.address, core.tokens.weth.address, ZERO_BI);
      await expectWalletBalanceOrDustyIfZero(core, unwrapper.address, core.umamiEcosystem!.glpUsdc.address, ZERO_BI);
      await expectWalletBalanceOrDustyIfZero(core, unwrapper.address, core.tokens.usdc.address, ZERO_BI);
    });
  });

  describe('Perform expiration with full integration', () => {
    it('should work when expired account is borrowing the output token (USDC)', async () => {
      await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, otherAccountNumber, heldAmountWei);
      const [supplyValue, borrowValue] = await core.dolomiteMargin.getAccountValues(liquidAccountStruct);
      expect(borrowValue.value).to.eq(ZERO_BI);

      const usdcPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.usdc);
      const usdcDebtAmount = supplyValue.value.mul(expirationCollateralizationDenominator)
        .div(expirationCollateralizationNumerator)
        .div(usdcPrice.value);
      await vault.transferFromPositionWithOtherToken(
        otherAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcDebtAmount,
        BalanceCheckFlag.To,
      );

      await setExpiry(core, liquidAccountStruct, core.marketIds.usdc, 1);
      const rampTime = await core.expiry.g_expiryRampTime();
      await waitTime(rampTime.add(ONE_BI).toNumber());
      const expiry = await core.expiry.getExpiry(liquidAccountStruct, core.marketIds.usdc);
      expect(expiry).to.not.eq(0);

      const newAccountValues = await core.dolomiteMargin.getAccountValues(liquidAccountStruct);
      // check that the position is over collateralized
      expect(newAccountValues[0].value)
        .to
        .gte(newAccountValues[1].value.mul(minCollateralizationNumerator).div(minCollateralizationDenominator));

      const [heldPrice, owedPriceAdj] = await core.expiry.getSpreadAdjustedPrices(
        underlyingMarketId,
        core.marketIds.usdc,
        expiry,
      );

      const heldUpdatedWithReward = usdcDebtAmount.mul(owedPriceAdj.value).div(heldPrice.value);

      const txResult = await liquidateV4WithIsolationMode(
        core,
        solidAccountStruct,
        liquidAccountStruct,
        [underlyingMarketId, core.marketIds.usdc],
        [SELL_ALL, LIQUIDATE_ALL],
        unwrapper,
        BYTES_EMPTY,
        NO_PARASWAP_TRADER_PARAM,
        expiry,
      );
      const receipt = await txResult.wait();
      console.log('\tliquidatorProxy#liquidate gas used:', receipt.gasUsed.toString());

      const usdcOutputAmount = await unwrapper.getExchangeCost(
        factory.address,
        core.tokens.usdc.address,
        heldUpdatedWithReward,
        BYTES_EMPTY,
        { blockTag: txResult.blockNumber },
      );

      await expectProtocolBalance(
        core,
        solidAccountStruct.owner,
        solidAccountStruct.number,
        underlyingMarketId,
        ZERO_BI,
      );
      await expectProtocolBalanceIsGreaterThan(
        core,
        solidAccountStruct,
        core.marketIds.usdc,
        usdcOutputAmount.sub(usdcDebtAmount),
        '5',
      );
      await expectProtocolBalanceIsGreaterThan(
        core,
        liquidAccountStruct,
        underlyingMarketId,
        heldAmountWei.sub(heldUpdatedWithReward),
        '5',
      );
      await expectProtocolBalance(
        core,
        liquidAccountStruct.owner,
        liquidAccountStruct.number,
        core.marketIds.usdc,
        ZERO_BI,
      );

      await expectWalletBalanceOrDustyIfZero(core, core.liquidatorProxyV4!.address, factory.address, ZERO_BI);
      await expectWalletBalanceOrDustyIfZero(core, core.liquidatorProxyV4!.address, core.tokens.weth.address, ZERO_BI);
      await expectWalletBalanceOrDustyIfZero(core, unwrapper.address, core.umamiEcosystem!.glpUsdc.address, ZERO_BI);
      await expectWalletBalanceOrDustyIfZero(core, unwrapper.address, core.tokens.usdc.address, ZERO_BI);
    });
  });
});
