import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import {
  IERC4626,
  IPlutusVaultGLPIsolationModeVaultFactory,
  PlutusVaultGLPIsolationModeTokenVaultV1,
  PlutusVaultGLPIsolationModeTokenVaultV1__factory,
  PlutusVaultGLPIsolationModeUnwrapperTraderV2,
  PlutusVaultGLPIsolationModeWrapperTraderV2,
  PlutusVaultRegistry,
} from '../src/types';
import { AccountInfoStruct } from '@dolomite-exchange/modules-base/src/utils';
import { BYTES_EMPTY, Network, NO_PARASWAP_TRADER_PARAM, ONE_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot, waitTime } from '@dolomite-exchange/modules-base/test/utils';
import {
  expectProtocolBalance,
  expectProtocolBalanceDustyOrZero,
  expectProtocolBalanceIsGreaterThan,
  expectWalletBalanceOrDustyIfZero,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  createPlutusVaultGLPIsolationModeUnwrapperTraderV2,
  createPlutusVaultGLPIsolationModeWrapperTraderV2,
  createPlutusVaultRegistry,
} from './plutus-ecosystem-utils';
import { setExpiry } from '@dolomite-exchange/modules-base/test/utils/expiry-utils';
import { liquidateV4WithIsolationMode } from '@dolomite-exchange/modules-base/test/utils/liquidation-utils';
import { CoreProtocol, setupCoreProtocol, setupUSDCBalance, setupUserVaultProxy } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  checkForParaswapSuccess,
  getCalldataForParaswap,
  getParaswapTraderParamStruct,
} from '@dolomite-exchange/modules-base/test/utils/trader-utils';

const defaultAccountNumber = '0';
const otherAccountNumber = '420';
const heldAmountWei = BigNumber.from('200000000000000000000'); // $200
const minCollateralizationNumerator = BigNumber.from('120');
const minCollateralizationDenominator = BigNumber.from('100');
const liquidationSpreadNumerator = BigNumber.from('105');
const liquidationSpreadDenominator = BigNumber.from('100');
const expirationCollateralizationNumerator = BigNumber.from('150');
const expirationCollateralizationDenominator = BigNumber.from('100');

describe('PlutusVaultGLPLiquidationWithUnwrapperV2', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IERC4626;
  let underlyingMarketId: BigNumberish;
  let plutusVaultRegistry: PlutusVaultRegistry;
  let unwrapper: PlutusVaultGLPIsolationModeUnwrapperTraderV2;
  let wrapper: PlutusVaultGLPIsolationModeWrapperTraderV2;
  let factory: IPlutusVaultGLPIsolationModeVaultFactory;
  let vault: PlutusVaultGLPIsolationModeTokenVaultV1;
  let defaultAccountStruct: AccountInfoStruct;
  let liquidAccountStruct: AccountInfoStruct;
  let solidAccountStruct: AccountInfoStruct;

  before(async () => {
    const blockNumber = await getRealLatestBlockNumber(true, Network.ArbitrumOne);
    core = await setupCoreProtocol({
      blockNumber,
      network: Network.ArbitrumOne,
    });
    underlyingToken = core.plutusEcosystem!.plvGlp.connect(core.hhUser1);
    plutusVaultRegistry = await createPlutusVaultRegistry(core);
    factory = core.plutusEcosystem!.live.plvGlpIsolationModeFactory.connect(core.hhUser1);
    unwrapper = await createPlutusVaultGLPIsolationModeUnwrapperTraderV2(core, plutusVaultRegistry, factory);
    wrapper = await createPlutusVaultGLPIsolationModeWrapperTraderV2(core, plutusVaultRegistry, factory);

    underlyingMarketId = await core.marketIds.dplvGlp!;

    await factory.connect(core.governance).ownerSetIsTokenConverterTrusted(unwrapper.address, true);
    await factory.connect(core.governance).ownerSetIsTokenConverterTrusted(wrapper.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<PlutusVaultGLPIsolationModeTokenVaultV1>(
      vaultAddress,
      PlutusVaultGLPIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    defaultAccountStruct = { owner: vault.address, number: defaultAccountNumber };
    liquidAccountStruct = { owner: vault.address, number: otherAccountNumber };
    solidAccountStruct = { owner: core.hhUser5.address, number: defaultAccountNumber };

    const usdcAmount = heldAmountWei.div(1e12).mul(4);
    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
    await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
      .mintAndStakeGlp(core.tokens.usdc.address, usdcAmount, 0, 0);
    const glpAmount = heldAmountWei.mul(2);
    await core.plutusEcosystem!.sGlp.connect(core.hhUser1)
      .approve(core.plutusEcosystem!.plvGlpRouter.address, glpAmount);
    await core.plutusEcosystem!.plvGlpRouter.connect(core.hhUser1).deposit(glpAmount);

    await underlyingToken.approve(vault.address, heldAmountWei);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, heldAmountWei);

    expect(await underlyingToken.connect(core.hhUser1).balanceOf(vault.address)).to.eq(heldAmountWei);
    expect((await core.dolomiteMargin.getAccountWei(defaultAccountStruct, underlyingMarketId)).value)
      .to
      .eq(heldAmountWei);

    await core.plutusEcosystem!.live.dolomiteWhitelistForGlpDepositor.connect(core.governance)
      .ownerSetPlvGlpUnwrapperTrader(unwrapper.address);
    await core.plutusEcosystem!.live.dolomiteWhitelistForPlutusChef.connect(core.governance)
      .ownerSetPlvGlpUnwrapperTrader(unwrapper.address);
    await core.plutusEcosystem!.live.dolomiteWhitelistForGlpDepositor.connect(core.governance)
      .ownerSetPlvGlpWrapperTrader(wrapper.address);
    await core.plutusEcosystem!.live.dolomiteWhitelistForPlutusChef.connect(core.governance)
      .ownerSetPlvGlpWrapperTrader(wrapper.address);

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
      const usdcDebtAmount = supplyValue.value.mul(minCollateralizationDenominator)
        .div(minCollateralizationNumerator)
        .div(usdcPrice.value);
      await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, otherAccountNumber, heldAmountWei);
      await vault.transferFromPositionWithOtherToken(
        otherAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcDebtAmount,
        BalanceCheckFlag.To,
      );
      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.usdc.address, '1050000000000000000000000000000');
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.usdc, core.testEcosystem!.testPriceOracle.address);

      const newAccountValues = await core.dolomiteMargin.getAccountValues(liquidAccountStruct);
      // check that the position is indeed under collateralized
      expect(newAccountValues[0].value)
        .to
        .lt(newAccountValues[1].value.mul(minCollateralizationNumerator).div(minCollateralizationDenominator));

      const plvGlpPrice = await core.dolomiteMargin.getMarketPrice(underlyingMarketId);
      const heldUpdatedWithReward = await newAccountValues[1].value.mul(liquidationSpreadNumerator)
        .div(liquidationSpreadDenominator)
        .div(plvGlpPrice.value);
      const usdcOutputAmount = await unwrapper.getExchangeCost(
        factory.address,
        core.tokens.usdc.address,
        heldUpdatedWithReward,
        BYTES_EMPTY,
      );

      const txResult = await liquidateV4WithIsolationMode(
        core,
        solidAccountStruct,
        liquidAccountStruct,
        [underlyingMarketId, core.marketIds.usdc],
        unwrapper,
      );
      const receipt = await txResult.wait();
      console.log('\tliquidatorProxy#liquidate gas used:', receipt.gasUsed.toString());

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
      await expectWalletBalanceOrDustyIfZero(core, unwrapper.address, core.plutusEcosystem!.plvGlp.address, ZERO_BI);
      await expectWalletBalanceOrDustyIfZero(core, unwrapper.address, core.tokens.usdc.address, ZERO_BI);
    });

    it('should work when liquid account is borrowing a different output token (WETH)', async () => {
      const [supplyValue, borrowValue] = await core.dolomiteMargin.getAccountValues(defaultAccountStruct);
      expect(borrowValue.value).to.eq(ZERO_BI);

      const wethPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.weth);
      const wethDebtAmount = supplyValue.value.mul(minCollateralizationDenominator)
        .div(minCollateralizationNumerator)
        .div(wethPrice.value);
      await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, otherAccountNumber, heldAmountWei);
      await vault.transferFromPositionWithOtherToken(
        otherAccountNumber,
        defaultAccountNumber,
        core.marketIds.weth,
        wethDebtAmount,
        BalanceCheckFlag.To,
      );
      // set the price of USDC to be 105% of the current price
      await core.testEcosystem!.testPriceOracle.setPrice(
        core.tokens.weth.address,
        wethPrice.value.mul(liquidationSpreadNumerator).div(liquidationSpreadDenominator),
      );
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);

      const newAccountValues = await core.dolomiteMargin.getAccountValues(liquidAccountStruct);
      // check that the position is indeed under collateralized
      expect(newAccountValues[0].value)
        .to
        .lt(newAccountValues[1].value.mul(minCollateralizationNumerator).div(minCollateralizationDenominator));

      const glpPrice = await core.dolomiteMargin.getMarketPrice(underlyingMarketId);
      const heldUpdatedWithReward = await newAccountValues[1].value.mul(liquidationSpreadNumerator)
        .div(liquidationSpreadDenominator)
        .div(glpPrice.value);
      const usdcOutputAmount = await unwrapper.getExchangeCost(
        factory.address,
        core.tokens.usdc.address,
        heldUpdatedWithReward,
        BYTES_EMPTY,
      );
      const { calldata: paraswapCalldata, outputAmount: wethOutputAmount } = await getCalldataForParaswap(
        usdcOutputAmount,
        core.tokens.usdc,
        6,
        ONE_BI,
        core.tokens.weth,
        18,
        core.hhUser5,
        core.paraswapTrader!,
        core,
      );
      const usdcLiquidatorBalanceBefore = await core.tokens.usdc.connect(core.hhUser1)
        .balanceOf(core.liquidatorProxyV4!.address);
      const wethLiquidatorBalanceBefore = await core.tokens.weth.connect(core.hhUser1)
        .balanceOf(core.liquidatorProxyV4!.address);

      const isSuccessful = await checkForParaswapSuccess(
        liquidateV4WithIsolationMode(
          core,
          solidAccountStruct,
          liquidAccountStruct,
          [underlyingMarketId, core.marketIds.usdc, core.marketIds.weth],
          unwrapper,
          BYTES_EMPTY,
          getParaswapTraderParamStruct(core, paraswapCalldata),
        ),
      );
      if (!isSuccessful) {
        return;
      }

      await expectProtocolBalance(
        core,
        solidAccountStruct.owner,
        solidAccountStruct.number,
        underlyingMarketId,
        ZERO_BI,
      );
      await expectProtocolBalanceDustyOrZero(
        core,
        solidAccountStruct.owner,
        solidAccountStruct.number,
        core.marketIds.usdc,
      );
      await expectProtocolBalanceIsGreaterThan(
        core,
        solidAccountStruct,
        core.marketIds.weth,
        wethOutputAmount.sub(wethDebtAmount),
        '500',
      );
      await expectProtocolBalanceIsGreaterThan(
        core,
        liquidAccountStruct,
        underlyingMarketId,
        heldAmountWei.sub(heldUpdatedWithReward),
        '10',
      );
      await expectProtocolBalance(
        core,
        liquidAccountStruct.owner,
        liquidAccountStruct.number,
        core.marketIds.weth,
        ZERO_BI,
      );

      await expectWalletBalanceOrDustyIfZero(
        core,
        core.liquidatorProxyV4!.address,
        core.tokens.usdc.address,
        ZERO_BI,
        usdcLiquidatorBalanceBefore,
      );
      await expectWalletBalanceOrDustyIfZero(
        core,
        core.liquidatorProxyV4!.address,
        core.tokens.weth.address,
        ZERO_BI,
        wethLiquidatorBalanceBefore,
      );
      await expectWalletBalanceOrDustyIfZero(core, unwrapper.address, core.plutusEcosystem!.plvGlp.address, ZERO_BI);
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
      const usdcOutputAmount = await unwrapper.getExchangeCost(
        factory.address,
        core.tokens.usdc.address,
        heldUpdatedWithReward,
        BYTES_EMPTY,
      );

      const txResult = await liquidateV4WithIsolationMode(
        core,
        solidAccountStruct,
        liquidAccountStruct,
        [underlyingMarketId, core.marketIds.usdc],
        unwrapper,
        BYTES_EMPTY,
        NO_PARASWAP_TRADER_PARAM,
        expiry,
      );
      const receipt = await txResult.wait();
      console.log('\tliquidatorProxy#liquidate gas used:', receipt.gasUsed.toString());

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
      await expectWalletBalanceOrDustyIfZero(core, unwrapper.address, core.plutusEcosystem!.plvGlp.address, ZERO_BI);
      await expectWalletBalanceOrDustyIfZero(core, unwrapper.address, core.tokens.usdc.address, ZERO_BI);
    });

    it('should work when expired account is borrowing a different output token (WETH)', async () => {
      const [supplyValue, borrowValue] = await core.dolomiteMargin.getAccountValues(defaultAccountStruct);
      expect(borrowValue.value).to.eq(ZERO_BI);

      const wethPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.weth);
      const wethDebtAmount = supplyValue.value.mul(expirationCollateralizationDenominator)
        .div(expirationCollateralizationNumerator)
        .div(wethPrice.value);
      await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, otherAccountNumber, heldAmountWei);
      await vault.transferFromPositionWithOtherToken(
        otherAccountNumber,
        defaultAccountNumber,
        core.marketIds.weth,
        wethDebtAmount,
        BalanceCheckFlag.To,
      );

      const newAccountValues = await core.dolomiteMargin.getAccountValues(liquidAccountStruct);
      // check that the position is indeed over collateralized
      expect(newAccountValues[0].value)
        .to
        .gte(newAccountValues[1].value.mul(minCollateralizationNumerator).div(minCollateralizationDenominator));

      const rampTime = await core.expiry.g_expiryRampTime();
      await setExpiry(core, liquidAccountStruct, core.marketIds.weth, 1);
      await waitTime(rampTime.add(ONE_BI).toNumber());
      const expiry = await core.expiry.getExpiry(liquidAccountStruct, core.marketIds.weth);
      expect(expiry).to.not.eq(0);

      const [heldPrice, owedPriceAdj] = await core.expiry.getSpreadAdjustedPrices(
        underlyingMarketId,
        core.marketIds.weth,
        expiry,
      );

      const heldUpdatedWithReward = wethDebtAmount.mul(owedPriceAdj.value).div(heldPrice.value);
      const usdcOutputAmount = await unwrapper.getExchangeCost(
        factory.address,
        core.tokens.usdc.address,
        heldUpdatedWithReward,
        BYTES_EMPTY,
      );
      const { calldata: paraswapCalldata, outputAmount: wethOutputAmount } = await getCalldataForParaswap(
        usdcOutputAmount,
        core.tokens.usdc,
        6,
        wethDebtAmount,
        core.tokens.weth,
        18,
        core.hhUser5,
        core.paraswapTrader!,
        core,
      );

      const usdcLiquidatorBalanceBefore = await core.tokens.usdc.connect(core.hhUser1)
        .balanceOf(core.liquidatorProxyV4!.address);
      const wethLiquidatorBalanceBefore = await core.tokens.weth.connect(core.hhUser1)
        .balanceOf(core.liquidatorProxyV4!.address);

      const isSuccessful = await checkForParaswapSuccess(
        liquidateV4WithIsolationMode(
          core,
          solidAccountStruct,
          liquidAccountStruct,
          [underlyingMarketId, core.marketIds.usdc, core.marketIds.weth],
          unwrapper,
          BYTES_EMPTY,
          getParaswapTraderParamStruct(core, paraswapCalldata),
          expiry,
        ),
      );
      if (!isSuccessful) {
        return false;
      }

      await expectProtocolBalance(
        core,
        solidAccountStruct.owner,
        solidAccountStruct.number,
        underlyingMarketId,
        ZERO_BI,
      );
      await expectProtocolBalance(
        core,
        solidAccountStruct.owner,
        solidAccountStruct.number,
        core.marketIds.usdc,
        ZERO_BI,
      );
      await expectProtocolBalanceIsGreaterThan(
        core,
        solidAccountStruct,
        core.marketIds.weth,
        wethOutputAmount.sub(wethDebtAmount),
        '500',
      );
      await expectProtocolBalanceIsGreaterThan(
        core,
        liquidAccountStruct,
        underlyingMarketId,
        heldAmountWei.sub(heldUpdatedWithReward),
        '10',
      );
      await expectProtocolBalance(
        core,
        liquidAccountStruct.owner,
        liquidAccountStruct.number,
        core.marketIds.weth,
        ZERO_BI,
      );

      await expectWalletBalanceOrDustyIfZero(
        core,
        core.liquidatorProxyV4!.address,
        core.tokens.usdc.address,
        ZERO_BI,
        usdcLiquidatorBalanceBefore,
      );
      await expectWalletBalanceOrDustyIfZero(
        core,
        core.liquidatorProxyV4!.address,
        core.tokens.weth.address,
        ZERO_BI,
        wethLiquidatorBalanceBefore,
      );
      await expectWalletBalanceOrDustyIfZero(core, unwrapper.address, core.plutusEcosystem!.plvGlp.address, ZERO_BI);
      await expectWalletBalanceOrDustyIfZero(core, unwrapper.address, core.tokens.usdc.address, ZERO_BI);
    });
  });
});
