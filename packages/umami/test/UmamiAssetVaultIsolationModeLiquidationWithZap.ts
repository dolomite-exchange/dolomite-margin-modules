import { ApiToken, DolomiteZap, Network as ZapNetwork } from '@dolomite-exchange/zap-sdk/dist';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import deployments from '@dolomite-exchange/dolomite-margin-modules/scripts/deployments.json';
import {
  IUmamiAssetVault,
  UmamiAssetVaultIsolationModeTokenVaultV1,
  UmamiAssetVaultIsolationModeTokenVaultV1__factory,
  UmamiAssetVaultIsolationModeUnwrapperTraderV2,
  UmamiAssetVaultIsolationModeUnwrapperTraderV2__factory,
  UmamiAssetVaultIsolationModeVaultFactory,
  UmamiAssetVaultIsolationModeVaultFactory__factory,
  UmamiAssetVaultIsolationModeWrapperTraderV2,
  UmamiAssetVaultIsolationModeWrapperTraderV2__factory,
  UmamiAssetVaultPriceOracle,
  UmamiAssetVaultPriceOracle__factory,
  UmamiAssetVaultRegistry,
  UmamiAssetVaultRegistry__factory,
} from '../src/types';
import { AccountInfoStruct } from '@dolomite-exchange/modules-base/src/utils';
import { depositIntoDolomiteMargin } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ONE_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot, waitDays, waitTime } from '@dolomite-exchange/modules-base/test/utils';
import {
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectWalletBalanceOrDustyIfZero,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setExpiry } from '@dolomite-exchange/modules-base/test/utils/expiry-utils';
import { liquidateV4WithZap, toZapBigNumber } from '@dolomite-exchange/modules-base/test/utils/liquidation-utils';
import { CoreProtocol, setupCoreProtocol, setupUSDCBalance, setupUserVaultProxy } from '@dolomite-exchange/modules-base/test/utils/setup';
import { setupWhitelistAndAggregateVault } from './umami-utils';

const defaultAccountNumber = '0';
const otherAccountNumber = '420';
const heldAmountWei = BigNumber.from('200000000'); // 200 units
const usdcAmount = heldAmountWei.mul(8);
const usableUsdcAmount = usdcAmount.div(2);
const minCollateralizationNumerator = BigNumber.from('115');
const minCollateralizationDenominator = BigNumber.from('100');
const liquidationSpreadNumerator = BigNumber.from('105');
const liquidationSpreadDenominator = BigNumber.from('100');
const expirationCollateralizationNumerator = BigNumber.from('150');
const expirationCollateralizationDenominator = BigNumber.from('100');

describe('UmamiAssetVaultIsolationModeLiquidationWithZap', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IUmamiAssetVault;
  let heldMarketId: BigNumber;
  let umamiRegistry: UmamiAssetVaultRegistry;
  let unwrapper: UmamiAssetVaultIsolationModeUnwrapperTraderV2;
  let wrapper: UmamiAssetVaultIsolationModeWrapperTraderV2;
  let factory: UmamiAssetVaultIsolationModeVaultFactory;
  let vault: UmamiAssetVaultIsolationModeTokenVaultV1;
  let priceOracle: UmamiAssetVaultPriceOracle;
  let defaultAccountStruct: AccountInfoStruct;
  let liquidAccountStruct: AccountInfoStruct;
  let solidAccountStruct: AccountInfoStruct;
  let glpUsdcApiToken: ApiToken;
  let zap: DolomiteZap;

  before(async () => {
    const network = Network.ArbitrumOne;
    const blockNumber = await getRealLatestBlockNumber(true, network);
    core = await setupCoreProtocol({
      blockNumber,
      network,
    });
    underlyingToken = core.umamiEcosystem!.glpUsdc.connect(core.hhUser1);
    umamiRegistry = await UmamiAssetVaultRegistry__factory.connect(
      deployments.UmamiAssetVaultRegistry[network].address,
      core.hhUser1,
    );
    factory = UmamiAssetVaultIsolationModeVaultFactory__factory.connect(
      deployments.UmamiAssetVaultIsolationModeVaultFactory[network].address,
      core.hhUser1,
    );
    unwrapper = UmamiAssetVaultIsolationModeUnwrapperTraderV2__factory.connect(
      deployments.UmamiAssetVaultIsolationModeUnwrapperTraderV2[network].address,
      core.hhUser1,
    );
    wrapper = UmamiAssetVaultIsolationModeWrapperTraderV2__factory.connect(
      deployments.UmamiAssetVaultIsolationModeWrapperTraderV2[network].address,
      core.hhUser1,
    );
    priceOracle = UmamiAssetVaultPriceOracle__factory.connect(
      deployments.UmamiAssetVaultPriceOracle[network].address,
      core.hhUser1,
    );

    heldMarketId = await core.dolomiteMargin.getMarketIdByTokenAddress(factory.address);

    glpUsdcApiToken = {
      marketId: heldMarketId.toNumber(),
      symbol: 'dglpUSDC',
      name: 'Dolomite Isolation: glpUSDC',
      decimals: 6,
      tokenAddress: factory.address,
    };
    zap = new DolomiteZap(
      ZapNetwork.ARBITRUM_ONE,
      process.env.SUBGRAPH_URL as string,
      core.hhUser1.provider!,
    );

    // admin setup
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await core.liquidatorAssetRegistry.connect(core.governance).ownerAddLiquidatorToAssetWhitelist(
      heldMarketId,
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

    expect(await underlyingToken.balanceOf(vault.address)).to.eq(heldAmountWei);
    expect((await core.dolomiteMargin.getAccountWei(defaultAccountStruct, heldMarketId)).value).to.eq(heldAmountWei);

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

      const jUSDCPrice = await core.dolomiteMargin.getMarketPrice(heldMarketId);
      const heldUpdatedWithReward = await newAccountValues[1].value.mul(liquidationSpreadNumerator)
        .div(liquidationSpreadDenominator)
        .div(jUSDCPrice.value);

      const zapOutputs = await zap.getSwapExactTokensForTokensParams(
        glpUsdcApiToken,
        toZapBigNumber(heldUpdatedWithReward),
        core.apiTokens.usdc,
        toZapBigNumber(usdcDebtAmountBefore),
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
        heldMarketId,
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
        heldMarketId,
        core.marketIds.usdc,
        expiry,
      );

      const heldUpdatedWithReward = usdcDebtAmount.mul(owedPriceAdj.value).div(heldPrice.value);

      const zapOutputs = await zap.getSwapExactTokensForTokensParams(
        glpUsdcApiToken,
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
        heldMarketId,
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
      await expectWalletBalanceOrDustyIfZero(core, unwrapper.address, core.umamiEcosystem!.glpUsdc.address, ZERO_BI);
      await expectWalletBalanceOrDustyIfZero(core, unwrapper.address, core.tokens.usdc.address, ZERO_BI);
    });
  });
});
