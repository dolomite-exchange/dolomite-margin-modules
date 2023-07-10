import { ApiToken, DolomiteZap, Network as ZapNetwork } from '@dolomite-exchange/zap-sdk/dist';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { BaseRouter, Router } from '@pendle/sdk-v2';
import { CHAIN_ID_MAPPING } from '@pendle/sdk-v2/dist/common/ChainId';
import { expect } from 'chai';
import 'dotenv/config';
import { BigNumber } from 'ethers';
import deployments from '../../../scripts/deployments.json';
import {
  IPendlePtToken,
  PendlePtGLP2024IsolationModeTokenVaultV1,
  PendlePtGLP2024IsolationModeTokenVaultV1__factory,
  PendlePtGLP2024IsolationModeUnwrapperTraderV2,
  PendlePtGLP2024IsolationModeUnwrapperTraderV2__factory,
  PendlePtGLP2024IsolationModeVaultFactory,
  PendlePtGLP2024IsolationModeVaultFactory__factory,
  PendlePtGLP2024IsolationModeWrapperTraderV2,
  PendlePtGLP2024IsolationModeWrapperTraderV2__factory,
} from '../../../src/types';
import { AccountInfoStruct } from '../../../src/utils';
import { Network, ONE_BI, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot, waitTime } from '../../utils';
import {
  expectProtocolBalance,
  expectProtocolBalanceDustyOrZero,
  expectProtocolBalanceIsGreaterThan,
  expectVaultBalanceToMatchAccountBalances,
  expectWalletBalance,
} from '../../utils/assertions';
import { setExpiry } from '../../utils/expiry-utils';
import {
  checkForParaswapSuccess,
  getLastZapAmountToBigNumber,
  liquidateV4WithZap,
  toZapBigNumber,
} from '../../utils/liquidation-utils';
import {
  CoreProtocol,
  disableInterestAccrual,
  setupCoreProtocol,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '../../utils/setup';

const defaultAccountNumber = '0';
const borrowAccountNumber = '420';
const heldAmountWei = BigNumber.from('200000000000000000000'); // 200 units
const minCollateralizationNumerator = BigNumber.from('120');
const minCollateralizationDenominator = BigNumber.from('100');
const liquidationSpreadNumerator = BigNumber.from('105');
const liquidationSpreadDenominator = BigNumber.from('100');
const expirationCollateralizationNumerator = BigNumber.from('150');
const expirationCollateralizationDenominator = BigNumber.from('100');

describe('PendlePtGLP2024IsolationModeLiquidationWithZap', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IPendlePtToken;
  let underlyingMarketId: BigNumber;
  let unwrapper: PendlePtGLP2024IsolationModeUnwrapperTraderV2;
  let wrapper: PendlePtGLP2024IsolationModeWrapperTraderV2;
  let factory: PendlePtGLP2024IsolationModeVaultFactory;
  let vault: PendlePtGLP2024IsolationModeTokenVaultV1;
  let defaultAccountStruct: AccountInfoStruct;
  let liquidAccountStruct: AccountInfoStruct;
  let solidAccountStruct: AccountInfoStruct;
  let router: BaseRouter;
  let zap: DolomiteZap;
  let ptGlpApiToken: ApiToken;

  const defaultSlippageNumerator = BigNumber.from('10');
  const defaultSlippageDenominator = BigNumber.from('10000');
  const defaultSlippage = defaultSlippageNumerator.toNumber() / defaultSlippageDenominator.toNumber();

  before(async () => {
    const blockNumber = await getRealLatestBlockNumber(true, Network.ArbitrumOne);
    core = await setupCoreProtocol({
      blockNumber,
      network: Network.ArbitrumOne,
    });
    const cacheDurationSeconds = 60;
    zap = new DolomiteZap(
      ZapNetwork.ARBITRUM_ONE,
      process.env.SUBGRAPH_URL as string,
      core.hhUser1.provider!,
      cacheDurationSeconds,
      defaultSlippage,
    );
    underlyingToken = core.pendleEcosystem!.ptGlpToken.connect(core.hhUser1);
    factory = PendlePtGLP2024IsolationModeVaultFactory__factory.connect(
      deployments.PendlePtGLP2024IsolationModeVaultFactory[Network.ArbitrumOne].address,
      core.hhUser1,
    );
    unwrapper = PendlePtGLP2024IsolationModeUnwrapperTraderV2__factory.connect(
      deployments.PendlePtGLP2024IsolationModeUnwrapperTraderV2[Network.ArbitrumOne].address,
      core.hhUser1,
    );
    wrapper = PendlePtGLP2024IsolationModeWrapperTraderV2__factory.connect(
      deployments.PendlePtGLP2024IsolationModeWrapperTraderV2[Network.ArbitrumOne].address,
      core.hhUser1,
    );
    underlyingMarketId = await core.dolomiteMargin.getMarketIdByTokenAddress(factory.address);
    ptGlpApiToken = {
      marketId: underlyingMarketId.toNumber(),
      symbol: 'PT-GLP',
      name: 'Isolation Mode:',
      decimals: 18,
      tokenAddress: factory.address,
    };

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await core.liquidatorAssetRegistry.connect(core.governance)
      .ownerAddLiquidatorToAssetWhitelist(underlyingMarketId, core.liquidatorProxyV4.address);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<PendlePtGLP2024IsolationModeTokenVaultV1>(
      vaultAddress,
      PendlePtGLP2024IsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    defaultAccountStruct = { owner: vault.address, number: defaultAccountNumber };
    liquidAccountStruct = { owner: vault.address, number: borrowAccountNumber };
    solidAccountStruct = { owner: core.hhUser5.address, number: defaultAccountNumber };

    await disableInterestAccrual(core, core.marketIds.usdc);
    await disableInterestAccrual(core, core.marketIds.weth);

    router = Router.getRouter({
      chainId: CHAIN_ID_MAPPING.ARBITRUM,
      provider: core.hhUser1.provider,
      signer: core.hhUser1,
    });

    const usdcAmount = heldAmountWei.div(1e12).mul(8);
    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
    await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
      .mintAndStakeGlp(core.tokens.usdc.address, usdcAmount, 0, 0);
    const glpAmount = heldAmountWei.mul(4);
    await core.gmxEcosystem!.sGlp.connect(core.hhUser1)
      .approve(core.pendleEcosystem!.pendleRouter.address, glpAmount);

    await router.swapExactTokenForPt(
      core.pendleEcosystem!.ptGlpMarket.address as any,
      core.gmxEcosystem!.sGlp.address as any,
      glpAmount,
      defaultSlippage,
    );
    await core.pendleEcosystem!.ptGlpToken.connect(core.hhUser1).approve(vault.address, heldAmountWei);
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
      const usdcDebtAmount = supplyValue.value.mul(minCollateralizationDenominator)
        .div(minCollateralizationNumerator)
        .div(usdcPrice.value);
      await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, heldAmountWei);
      await vault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcDebtAmount,
        BalanceCheckFlag.To,
      );
      await core.testPriceOracle!.setPrice(core.tokens.usdc.address, '1050000000000000000000000000000');
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.usdc, core.testPriceOracle!.address);

      const newAccountValues = await core.dolomiteMargin.getAccountValues(liquidAccountStruct);
      // check that the position is indeed under collateralized
      expect(newAccountValues[0].value)
        .to
        .lt(newAccountValues[1].value.mul(minCollateralizationNumerator).div(minCollateralizationDenominator));

      const owedMarketPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.usdc);
      const ptGlpPrice = await core.dolomiteMargin.getMarketPrice(underlyingMarketId);
      const owedAmount = await core.dolomiteMargin.getAccountWei(liquidAccountStruct, core.marketIds.usdc);
      const heldUpdatedWithReward = await owedAmount.value
        .mul(owedMarketPrice.value.mul(liquidationSpreadNumerator).div(liquidationSpreadDenominator))
        .div(ptGlpPrice.value);

      const zapOutputs = await zap.getSwapExactTokensForTokensParams(
        ptGlpApiToken,
        toZapBigNumber(heldUpdatedWithReward),
        core.apiTokens.usdc,
        toZapBigNumber(owedAmount.value),
        core.hhUser5.address,
      );
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
        underlyingMarketId,
        ZERO_BI,
      );
      await expectProtocolBalanceIsGreaterThan(
        core,
        solidAccountStruct,
        core.marketIds.usdc,
        usdcDebtAmount.mul(5).div(100),
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
      await expectVaultBalanceToMatchAccountBalances(
        core,
        vault,
        [liquidAccountStruct, defaultAccountStruct],
        underlyingMarketId,
      );
      await expectWalletBalance(core.liquidatorProxyV4!.address, factory, ZERO_BI);
      await expectWalletBalance(core.liquidatorProxyV4!.address, core.tokens.weth, ZERO_BI);
      await expectWalletBalance(unwrapper, core.pendleEcosystem!.ptGlpToken, ZERO_BI);
      await expectWalletBalance(unwrapper, core.gmxEcosystem!.fsGlp, ZERO_BI);
      await expectWalletBalance(unwrapper, core.tokens.usdc, ZERO_BI);
    });

    it('should work when liquid account is borrowing a different output token (WETH)', async () => {
      const [supplyValue, borrowValue] = await core.dolomiteMargin.getAccountValues(defaultAccountStruct);
      expect(borrowValue.value).to.eq(ZERO_BI);

      const wethPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.weth);
      const wethDebtAmount = supplyValue.value.mul(minCollateralizationDenominator)
        .div(minCollateralizationNumerator)
        .div(wethPrice.value);
      await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, heldAmountWei);
      await vault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.weth,
        wethDebtAmount,
        BalanceCheckFlag.To,
      );
      // set the price of USDC to be 105% of the current price
      await core.testPriceOracle!.setPrice(
        core.tokens.weth.address,
        wethPrice.value.mul('105').div('100'),
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

      const zapOutputs = await zap.getSwapExactTokensForTokensParams(
        ptGlpApiToken,
        toZapBigNumber(heldUpdatedWithReward),
        core.apiTokens.weth,
        toZapBigNumber(wethDebtAmount),
        core.hhUser5.address,
      );
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
        underlyingMarketId,
        ZERO_BI,
      );
      await expectProtocolBalanceDustyOrZero(
        core,
        solidAccountStruct.owner,
        solidAccountStruct.number,
        core.marketIds.usdc,
        newAccountValues[1].value.mul(106).div(100).mul(defaultSlippageNumerator).div(defaultSlippageDenominator),
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
      await expectVaultBalanceToMatchAccountBalances(
        core,
        vault,
        [liquidAccountStruct, defaultAccountStruct],
        underlyingMarketId,
      );
      await expectWalletBalance(core.liquidatorProxyV4!.address, factory, ZERO_BI);
      await expectWalletBalance(core.liquidatorProxyV4!.address, core.tokens.usdc, ZERO_BI);
      await expectWalletBalance(core.liquidatorProxyV4!.address, core.tokens.weth, ZERO_BI);
      await expectWalletBalance(unwrapper, core.pendleEcosystem!.ptGlpToken, ZERO_BI);
      await expectWalletBalance(unwrapper, core.gmxEcosystem!.fsGlp, ZERO_BI);
      await expectWalletBalance(unwrapper, core.tokens.usdc, ZERO_BI);
      await expectWalletBalance(unwrapper, core.tokens.weth, ZERO_BI);
    });
  });

  describe('Perform expiration with full integration', () => {
    it('should work when expired account is borrowing the output token (USDC)', async () => {
      await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, heldAmountWei);
      const [supplyValue, borrowValue] = await core.dolomiteMargin.getAccountValues(liquidAccountStruct);
      expect(borrowValue.value).to.eq(ZERO_BI);

      const usdcPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.usdc);
      const usdcDebtAmount = supplyValue.value.mul(expirationCollateralizationDenominator)
        .div(expirationCollateralizationNumerator)
        .div(usdcPrice.value);
      await vault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
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

      const zapOutputs = await zap.getSwapExactTokensForTokensParams(
        ptGlpApiToken,
        toZapBigNumber(heldUpdatedWithReward),
        core.apiTokens.usdc,
        toZapBigNumber(usdcDebtAmount),
        core.hhUser5.address,
      );
      const txResult = await liquidateV4WithZap(
        core,
        solidAccountStruct,
        liquidAccountStruct,
        zapOutputs,
        expiry,
      );
      const receipt = await txResult.wait();
      console.log('\tliquidatorProxy#liquidate gas used:', receipt.gasUsed.toString());

      const amountWeisPath = zapOutputs[0].amountWeisPath;
      const usdcAmountOut = BigNumber.from(amountWeisPath[amountWeisPath.length - 1].toString());
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
        usdcAmountOut.sub(usdcDebtAmount),
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
      await expectVaultBalanceToMatchAccountBalances(
        core,
        vault,
        [liquidAccountStruct, defaultAccountStruct],
        underlyingMarketId,
      );
      await expectWalletBalance(core.liquidatorProxyV4!.address, factory, ZERO_BI);
      await expectWalletBalance(core.liquidatorProxyV4!.address, core.tokens.usdc, ZERO_BI);
      await expectWalletBalance(core.liquidatorProxyV4!.address, core.tokens.weth, ZERO_BI);
      await expectWalletBalance(unwrapper, core.pendleEcosystem!.ptGlpToken, ZERO_BI);
      await expectWalletBalance(unwrapper, core.gmxEcosystem!.fsGlp, ZERO_BI);
      await expectWalletBalance(unwrapper, core.tokens.usdc, ZERO_BI);
      await expectWalletBalance(unwrapper, core.tokens.weth, ZERO_BI);
    });

    it('should work when expired account is borrowing a different output token (WETH)', async () => {
      const ptGlpPrice = await core.dolomiteMargin.getMarketPrice(underlyingMarketId);
      const wethPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.weth);
      const wethDebtAmount = heldAmountWei.mul(ptGlpPrice.value)
        .mul(expirationCollateralizationDenominator)
        .div(expirationCollateralizationNumerator)
        .div(wethPrice.value);
      await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, heldAmountWei);
      await vault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.weth,
        wethDebtAmount,
        BalanceCheckFlag.To,
      );

      const [supplyValue, borrowValue] = await core.dolomiteMargin.getAccountValues(liquidAccountStruct);
      // check that the position is indeed over collateralized
      expect(supplyValue.value)
        .to
        .gte(borrowValue.value.mul(minCollateralizationNumerator).div(minCollateralizationDenominator));

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

      const owedAmount = (await core.dolomiteMargin.getAccountWei(liquidAccountStruct, core.marketIds.weth)).value;
      const heldUpdatedWithReward = owedAmount.mul(owedPriceAdj.value).div(heldPrice.value);

      const zapOutputs = await zap.getSwapExactTokensForTokensParams(
        ptGlpApiToken,
        toZapBigNumber(heldUpdatedWithReward),
        core.apiTokens.weth,
        toZapBigNumber(wethDebtAmount),
        core.hhUser5.address,
      );
      const amountWeisPath = zapOutputs[0].amountWeisPath;
      const wethOutputAmount = BigNumber.from(amountWeisPath[amountWeisPath.length - 1].toString());
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
        borrowValue.value.mul(106).div(100).mul(defaultSlippageNumerator).div(defaultSlippageDenominator),
      );
      await expectProtocolBalanceIsGreaterThan(
        core,
        solidAccountStruct,
        core.marketIds.weth,
        wethOutputAmount.sub(owedAmount),
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
      await expectVaultBalanceToMatchAccountBalances(
        core,
        vault,
        [liquidAccountStruct, defaultAccountStruct],
        underlyingMarketId,
      );
      await expectWalletBalance(core.liquidatorProxyV4!.address, factory, ZERO_BI);
      await expectWalletBalance(core.liquidatorProxyV4!.address, core.tokens.usdc, ZERO_BI);
      await expectWalletBalance(core.liquidatorProxyV4!.address, core.tokens.weth, ZERO_BI);
      await expectWalletBalance(unwrapper, core.pendleEcosystem!.ptGlpToken, ZERO_BI);
      await expectWalletBalance(unwrapper, core.gmxEcosystem!.fsGlp, ZERO_BI);
      await expectWalletBalance(unwrapper, core.tokens.usdc, ZERO_BI);
      await expectWalletBalance(unwrapper, core.tokens.weth, ZERO_BI);
    });
  });
});
