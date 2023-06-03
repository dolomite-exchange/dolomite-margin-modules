import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  IERC4626,
  PlutusVaultGLPIsolationModeTokenVaultV1,
  PlutusVaultGLPIsolationModeTokenVaultV1__factory,
  PlutusVaultGLPIsolationModeUnwrapperTraderV1,
  PlutusVaultGLPIsolationModeVaultFactory,
  PlutusVaultGLPIsolationModeWrapperTraderV1,
  PlutusVaultGLPPriceOracle,
  PlutusVaultRegistry,
} from '../../../src/types';
import { Account } from '../../../src/types/IDolomiteMargin';
import { BYTES_EMPTY, Network, NO_EXPIRY, ONE_BI, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot, waitTime } from '../../utils';
import {
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectThrow,
  expectWalletBalanceOrDustyIfZero,
} from '../../utils/assertions';
import {
  createPlutusVaultGLPIsolationModeTokenVaultV1,
  createPlutusVaultGLPIsolationModeUnwrapperTraderV1,
  createPlutusVaultGLPIsolationModeVaultFactory,
  createPlutusVaultGLPIsolationModeWrapperTraderV1,
  createPlutusVaultGLPPriceOracle,
  createPlutusVaultRegistry,
} from '../../utils/ecosystem-token-utils/plutus';
import { setExpiry } from '../../utils/expiry-utils';
import { getCalldataForParaswap } from '../../utils/liquidation-utils';
import {
  CoreProtocol,
  setupCoreProtocol,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '../../utils/setup';
import { createAndSetPlutusVaultWhitelist } from './plutus-utils';

const defaultAccountNumber = '0';
const otherAccountNumber = '420';
const heldAmountWei = BigNumber.from('200000000000000000000'); // $200
const minCollateralizationNumerator = BigNumber.from('115');
const minCollateralizationDenominator = BigNumber.from('100');
const liquidationSpreadNumerator = BigNumber.from('105');
const liquidationSpreadDenominator = BigNumber.from('100');
const expirationCollateralizationNumerator = BigNumber.from('150');
const expirationCollateralizationDenominator = BigNumber.from('100');

describe('PlutusVaultGLPLiquidation', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IERC4626;
  let underlyingMarketId: BigNumber;
  let plutusVaultRegistry: PlutusVaultRegistry;
  let unwrapper: PlutusVaultGLPIsolationModeUnwrapperTraderV1;
  let wrapper: PlutusVaultGLPIsolationModeWrapperTraderV1;
  let factory: PlutusVaultGLPIsolationModeVaultFactory;
  let vault: PlutusVaultGLPIsolationModeTokenVaultV1;
  let priceOracle: PlutusVaultGLPPriceOracle;
  let defaultAccountStruct: Account.InfoStruct;
  let liquidAccountStruct: Account.InfoStruct;
  let solidAccountStruct: Account.InfoStruct;

  before(async () => {
    const blockNumber = await getRealLatestBlockNumber(true, Network.ArbitrumOne);
    core = await setupCoreProtocol({
      blockNumber,
      network: Network.ArbitrumOne,
    });
    underlyingToken = core.plutusEcosystem!.plvGlp.connect(core.hhUser1);
    const userVaultImplementation = await createPlutusVaultGLPIsolationModeTokenVaultV1();
    plutusVaultRegistry = await createPlutusVaultRegistry(core);
    factory = await createPlutusVaultGLPIsolationModeVaultFactory(
      core,
      plutusVaultRegistry,
      core.plutusEcosystem!.plvGlp,
      userVaultImplementation,
    );
    unwrapper = await createPlutusVaultGLPIsolationModeUnwrapperTraderV1(core, plutusVaultRegistry, factory);
    wrapper = await createPlutusVaultGLPIsolationModeWrapperTraderV1(core, plutusVaultRegistry, factory);
    priceOracle = await createPlutusVaultGLPPriceOracle(core, plutusVaultRegistry, factory, unwrapper);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
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
      .mintAndStakeGlp(core.usdc.address, usdcAmount, 0, 0);
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

    await core.liquidatorProxyV3!.connect(core.governance).setMarketIdToTokenUnwrapperForLiquidationMap(
      underlyingMarketId,
      unwrapper.address,
    );
    await createAndSetPlutusVaultWhitelist(core, core.plutusEcosystem!.plvGlpRouter, unwrapper, wrapper, factory);
    await createAndSetPlutusVaultWhitelist(core, core.plutusEcosystem!.plvGlpFarm, unwrapper, wrapper, factory);

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
      await core.testPriceOracle!.setPrice(core.usdc.address, '1050000000000000000000000000000');
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.usdc, core.testPriceOracle!.address);

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
        core.usdc.address,
        heldUpdatedWithReward,
        BYTES_EMPTY,
      );

      const txResult = await core.liquidatorProxyV3!.connect(core.hhUser5).liquidate(
        solidAccountStruct,
        liquidAccountStruct,
        core.marketIds.usdc,
        underlyingMarketId,
        NO_EXPIRY,
        BYTES_EMPTY,
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

      await expectWalletBalanceOrDustyIfZero(core, core.liquidatorProxyV3!.address, factory.address, ZERO_BI);
      await expectWalletBalanceOrDustyIfZero(core, core.liquidatorProxyV3!.address, core.weth.address, ZERO_BI);
      await expectWalletBalanceOrDustyIfZero(core, unwrapper.address, core.plutusEcosystem!.plvGlp.address, ZERO_BI);
      await expectWalletBalanceOrDustyIfZero(core, unwrapper.address, core.usdc.address, ZERO_BI);
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
      await core.testPriceOracle!.setPrice(
        core.weth.address,
        wethPrice.value.mul(liquidationSpreadNumerator).div(liquidationSpreadDenominator),
      );
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testPriceOracle!.address);

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
        core.usdc.address,
        heldUpdatedWithReward,
        BYTES_EMPTY,
      );
      const { calldata: paraswapCalldata, outputAmount: wethOutputAmount } = await getCalldataForParaswap(
        usdcOutputAmount,
        core.usdc,
        6,
        ONE_BI,
        core.weth,
        18,
        core.hhUser5,
        core.liquidatorProxyV3!,
        core,
      );
      const usdcLiquidatorBalanceBefore = await core.usdc.connect(core.hhUser1)
        .balanceOf(core.liquidatorProxyV3!.address);
      const wethLiquidatorBalanceBefore = await core.weth.connect(core.hhUser1)
        .balanceOf(core.liquidatorProxyV3!.address);

      const txResultPromise = core.liquidatorProxyV3!.connect(core.hhUser5).liquidate(
        solidAccountStruct,
        liquidAccountStruct,
        core.marketIds.weth,
        underlyingMarketId,
        NO_EXPIRY,
        paraswapCalldata,
      );
      try {
        const txResult = await txResultPromise;
        const receipt = await txResult.wait();
        console.log('\tliquidatorProxy#liquidate gas used:', receipt.gasUsed.toString());
      } catch (e) {
        await expectThrow(
          txResultPromise,
          'ParaswapTraderProxyWithBackup: External call failed',
        );
        console.warn(
          '\tParaswap call failed. This can happen when mixing a mainnet data with  Skipping the rest of the test.',
        );
        return;
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
        core.liquidatorProxyV3!.address,
        core.usdc.address,
        ZERO_BI,
        usdcLiquidatorBalanceBefore,
      );
      await expectWalletBalanceOrDustyIfZero(
        core,
        core.liquidatorProxyV3!.address,
        core.weth.address,
        ZERO_BI,
        wethLiquidatorBalanceBefore,
      );
      await expectWalletBalanceOrDustyIfZero(core, unwrapper.address, core.plutusEcosystem!.plvGlp.address, ZERO_BI);
      await expectWalletBalanceOrDustyIfZero(core, unwrapper.address, core.usdc.address, ZERO_BI);
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
        core.usdc.address,
        heldUpdatedWithReward,
        BYTES_EMPTY,
      );

      const txResult = await core.liquidatorProxyV3!.connect(core.hhUser5).liquidate(
        solidAccountStruct,
        liquidAccountStruct,
        core.marketIds.usdc,
        underlyingMarketId,
        expiry,
        BYTES_EMPTY,
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

      await expectWalletBalanceOrDustyIfZero(core, core.liquidatorProxyV3!.address, factory.address, ZERO_BI);
      await expectWalletBalanceOrDustyIfZero(core, core.liquidatorProxyV3!.address, core.weth.address, ZERO_BI);
      await expectWalletBalanceOrDustyIfZero(core, unwrapper.address, core.plutusEcosystem!.plvGlp.address, ZERO_BI);
      await expectWalletBalanceOrDustyIfZero(core, unwrapper.address, core.usdc.address, ZERO_BI);
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
        core.usdc.address,
        heldUpdatedWithReward,
        BYTES_EMPTY,
      );
      const { calldata: paraswapCalldata, outputAmount: wethOutputAmount } = await getCalldataForParaswap(
        usdcOutputAmount,
        core.usdc,
        6,
        wethDebtAmount,
        core.weth,
        18,
        core.hhUser5,
        core.liquidatorProxyV3!,
        core,
      );

      const usdcLiquidatorBalanceBefore = await core.usdc.connect(core.hhUser1)
        .balanceOf(core.liquidatorProxyV3!.address);
      const wethLiquidatorBalanceBefore = await core.weth.connect(core.hhUser1)
        .balanceOf(core.liquidatorProxyV3!.address);

      const txResultPromise = core.liquidatorProxyV3!.connect(core.hhUser5).liquidate(
        solidAccountStruct,
        liquidAccountStruct,
        core.marketIds.weth,
        underlyingMarketId,
        expiry,
        paraswapCalldata,
      );
      try {
        const txResult = await txResultPromise;
        const receipt = await txResult.wait();
        console.log('\tliquidatorProxy#liquidate gas used:', receipt.gasUsed.toString());
      } catch (e) {
        await expectThrow(
          txResultPromise,
          'ParaswapTraderProxyWithBackup: External call failed',
        );
        console.warn(
          '\tParaswap call failed. This can happen when mixing a mainnet data with  Skipping the rest of the test.',
        );
        return;
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
        core.liquidatorProxyV3!.address,
        core.usdc.address,
        ZERO_BI,
        usdcLiquidatorBalanceBefore,
      );
      await expectWalletBalanceOrDustyIfZero(
        core,
        core.liquidatorProxyV3!.address,
        core.weth.address,
        ZERO_BI,
        wethLiquidatorBalanceBefore,
      );
      await expectWalletBalanceOrDustyIfZero(core, unwrapper.address, core.plutusEcosystem!.plvGlp.address, ZERO_BI);
      await expectWalletBalanceOrDustyIfZero(core, unwrapper.address, core.usdc.address, ZERO_BI);
    });
  });
});
