import { AccountInfoStruct } from '@dolomite-exchange/modules-base/src/utils';
import { Network, ONE_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  getRealLatestBlockNumber,
  revertToSnapshotAndCapture,
  snapshot,
  waitTime,
} from '@dolomite-exchange/modules-base/test/utils';
import {
  expectProtocolBalance,
  expectProtocolBalanceDustyOrZero,
  expectProtocolBalanceIsGreaterThan,
  expectWalletBalanceOrDustyIfZero,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setExpiry } from '@dolomite-exchange/modules-base/test/utils/expiry-utils';
import {
  getLastZapAmountToBigNumber,
  liquidateV4WithZap,
  toZapBigNumber,
} from '@dolomite-exchange/modules-base/test/utils/liquidation-utils';
import {
  setupCoreProtocol,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { checkForParaswapSuccess } from '@dolomite-exchange/modules-base/test/utils/trader-utils';
import { ApiToken, DolomiteZap, Network as ZapNetwork } from '@dolomite-exchange/zap-sdk';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import deployments from  '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import {
  IERC4626,
  IPlutusVaultGLPIsolationModeVaultFactory,
  PlutusVaultGLPIsolationModeTokenVaultV1,
  PlutusVaultGLPIsolationModeTokenVaultV1__factory,
  PlutusVaultGLPIsolationModeUnwrapperTraderV2,
  PlutusVaultGLPIsolationModeUnwrapperTraderV2__factory,
} from '../src/types';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';

const defaultAccountNumber = '0';
const otherAccountNumber = '420';
const heldAmountWei = BigNumber.from('200000000000000000000'); // $200
const minCollateralizationNumerator = BigNumber.from('120');
const minCollateralizationDenominator = BigNumber.from('100');
const liquidationSpreadNumerator = BigNumber.from('105');
const liquidationSpreadDenominator = BigNumber.from('100');
const expirationCollateralizationNumerator = BigNumber.from('150');
const expirationCollateralizationDenominator = BigNumber.from('100');

describe('PlutusVaultGLPIsolationModeLiquidationWithZap', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: IERC4626;
  let heldMarketId: BigNumberish;
  let unwrapper: PlutusVaultGLPIsolationModeUnwrapperTraderV2;
  let factory: IPlutusVaultGLPIsolationModeVaultFactory;
  let vault: PlutusVaultGLPIsolationModeTokenVaultV1;
  let defaultAccountStruct: AccountInfoStruct;
  let liquidAccountStruct: AccountInfoStruct;
  let solidAccountStruct: AccountInfoStruct;
  let plvGlpApiToken: ApiToken;
  let zap: DolomiteZap;

  before(async () => {
    const network = Network.ArbitrumOne;
    const blockNumber = await getRealLatestBlockNumber(true, network);
    core = await setupCoreProtocol({
      blockNumber,
      network,
    });
    underlyingToken = core.plutusEcosystem!.plvGlp.connect(core.hhUser1);
    factory = core.plutusEcosystem!.live.dPlvGlp.connect(core.hhUser1);
    unwrapper = PlutusVaultGLPIsolationModeUnwrapperTraderV2__factory.connect(
      deployments.PlutusVaultGLPIsolationModeUnwrapperTraderV4[network].address,
      core.hhUser1,
    );

    heldMarketId = BigNumber.from(core.marketIds.dplvGlp!);
    plvGlpApiToken = {
      marketId: toZapBigNumber(heldMarketId.toNumber()),
      symbol: 'dplvGLP',
      name: 'Dolomite Isolation: Plutus Vault GLP',
      decimals: 18,
      tokenAddress: factory.address,
    };
    zap = new DolomiteZap({
      network: ZapNetwork.ARBITRUM_ONE,
      subgraphUrl: process.env.SUBGRAPH_URL as string,
      web3Provider: core.hhUser1.provider!,
      cacheSeconds: 60,
      defaultIsLiquidation: true,
    });

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

    expect(await underlyingToken.connect(core.hhUser1).balanceOf(vault.address)).to.eq(ZERO_BI);
    expect((await core.dolomiteMargin.getAccountWei(defaultAccountStruct, heldMarketId)).value)
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

      const plvGlpPrice = await core.dolomiteMargin.getMarketPrice(heldMarketId);
      const heldUpdatedWithReward = newAccountValues[1].value.mul(liquidationSpreadNumerator)
        .div(liquidationSpreadDenominator)
        .div(plvGlpPrice.value);

      const zapOutputs = await zap.getSwapExactTokensForTokensParams(
        plvGlpApiToken,
        toZapBigNumber(heldUpdatedWithReward),
        core.apiTokens.usdc,
        toZapBigNumber(usdcDebtAmount),
        core.hhUser5.address,
      );
      // const zapParams = await getLiquidateIsolationModeZapPath(
      //   [heldMarketId, core.marketIds.weth, core.marketIds.usdc],
      //   [heldUpdatedWithReward, ONE_BI, usdcDebtAmount],
      //   unwrapper,
      //   core
      // );
      zapOutputs[0].traderParams[0].trader = unwrapper.address;
      const txResult = await liquidateV4WithZap(
        core,
        solidAccountStruct,
        liquidAccountStruct,
        zapOutputs,
      );
      const receipt = await txResult.wait();
      console.log('\tliquidatorProxy#liquidate gas used:', receipt.gasUsed.toString());

      await expectProtocolBalance(
        core,
        solidAccountStruct.owner,
        solidAccountStruct.number,
        heldMarketId,
        ZERO_BI,
      );
      await expectProtocolBalanceIsGreaterThan(
        core,
        solidAccountStruct,
        core.marketIds.usdc,
        getLastZapAmountToBigNumber(zapOutputs[0]).sub(usdcDebtAmount),
        '5',
      );
      await expectProtocolBalanceIsGreaterThan(
        core,
        liquidAccountStruct,
        heldMarketId,
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

      const glpPrice = await core.dolomiteMargin.getMarketPrice(heldMarketId);
      const heldUpdatedWithReward = newAccountValues[1].value.mul(liquidationSpreadNumerator)
        .div(liquidationSpreadDenominator)
        .div(glpPrice.value);
      const usdcLiquidatorBalanceBefore = await core.tokens.usdc.connect(core.hhUser1)
        .balanceOf(core.liquidatorProxyV4!.address);
      const wethLiquidatorBalanceBefore = await core.tokens.weth.connect(core.hhUser1)
        .balanceOf(core.liquidatorProxyV4!.address);

      const zapOutputs = await zap.getSwapExactTokensForTokensParams(
        plvGlpApiToken,
        toZapBigNumber(heldUpdatedWithReward),
        core.apiTokens.weth,
        toZapBigNumber(wethDebtAmount),
        core.hhUser5.address,
      );
      zapOutputs[0].traderParams[0].trader = unwrapper.address;
      const isSuccessful = await checkForParaswapSuccess(
        liquidateV4WithZap(
          core,
          solidAccountStruct,
          liquidAccountStruct,
          zapOutputs,
        ),
      );
      if (!isSuccessful) {
        return;
      }

      await expectProtocolBalance(
        core,
        solidAccountStruct.owner,
        solidAccountStruct.number,
        heldMarketId,
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
        getLastZapAmountToBigNumber(zapOutputs[0]).sub(wethDebtAmount),
        '500',
      );
      await expectProtocolBalanceIsGreaterThan(
        core,
        liquidAccountStruct,
        heldMarketId,
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
        heldMarketId,
        core.marketIds.usdc,
        expiry,
      );

      const heldUpdatedWithReward = usdcDebtAmount.mul(owedPriceAdj.value).div(heldPrice.value);

      const zapOutputs = await zap.getSwapExactTokensForTokensParams(
        plvGlpApiToken,
        toZapBigNumber(heldUpdatedWithReward),
        core.apiTokens.usdc,
        toZapBigNumber(usdcDebtAmount),
        core.hhUser5.address,
      );
      zapOutputs[0].traderParams[0].trader = unwrapper.address;
      const txResult = await liquidateV4WithZap(
        core,
        solidAccountStruct,
        liquidAccountStruct,
        zapOutputs,
        expiry,
      );
      const receipt = await txResult.wait();
      console.log('\tliquidatorProxy#liquidate gas used:', receipt.gasUsed.toString());

      await expectProtocolBalance(
        core,
        solidAccountStruct.owner,
        solidAccountStruct.number,
        heldMarketId,
        ZERO_BI,
      );
      await expectProtocolBalanceIsGreaterThan(
        core,
        solidAccountStruct,
        core.marketIds.usdc,
        getLastZapAmountToBigNumber(zapOutputs[0]).sub(usdcDebtAmount),
        '5',
      );
      await expectProtocolBalanceIsGreaterThan(
        core,
        liquidAccountStruct,
        heldMarketId,
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
        heldMarketId,
        core.marketIds.weth,
        expiry,
      );

      const heldUpdatedWithReward = wethDebtAmount.mul(owedPriceAdj.value).div(heldPrice.value);

      const usdcLiquidatorBalanceBefore = await core.tokens.usdc.connect(core.hhUser1)
        .balanceOf(core.liquidatorProxyV4!.address);
      const wethLiquidatorBalanceBefore = await core.tokens.weth.connect(core.hhUser1)
        .balanceOf(core.liquidatorProxyV4!.address);

      const zapOutputs = await zap.getSwapExactTokensForTokensParams(
        plvGlpApiToken,
        toZapBigNumber(heldUpdatedWithReward),
        core.apiTokens.weth,
        toZapBigNumber(wethDebtAmount),
        core.hhUser5.address,
      );
      zapOutputs[0].traderParams[0].trader = unwrapper.address;
      const isSuccessful = await checkForParaswapSuccess(
        liquidateV4WithZap(
          core,
          solidAccountStruct,
          liquidAccountStruct,
          zapOutputs,
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
        heldMarketId,
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
        getLastZapAmountToBigNumber(zapOutputs[0]).sub(wethDebtAmount),
        '500',
      );
      await expectProtocolBalanceIsGreaterThan(
        core,
        liquidAccountStruct,
        heldMarketId,
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
