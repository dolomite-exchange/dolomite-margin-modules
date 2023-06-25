import { ApiToken, DolomiteZap, Network as ZapNetwork } from '@dolomite-exchange/zap-sdk/dist';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import deployments from '../../../../scripts/deployments.json';
import {
  IERC4626,
  JonesUSDCIsolationModeTokenVaultV1,
  JonesUSDCIsolationModeTokenVaultV1__factory,
  JonesUSDCIsolationModeUnwrapperTraderV2,
  JonesUSDCIsolationModeUnwrapperTraderV2__factory,
  JonesUSDCIsolationModeVaultFactory,
  JonesUSDCIsolationModeVaultFactory__factory,
  JonesUSDCIsolationModeWrapperTraderV2, JonesUSDCIsolationModeWrapperTraderV2__factory,
  JonesUSDCPriceOracle,
  JonesUSDCPriceOracle__factory,
  JonesUSDCRegistry,
  JonesUSDCRegistry__factory,
} from '../../../../src/types';
import { Account } from '../../../../src/types/IDolomiteMargin';
import { depositIntoDolomiteMargin } from '../../../../src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ONE_BI, ZERO_BI } from '../../../../src/utils/no-deps-constants';
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot, waitDays, waitTime } from '../../../utils';
import {
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectWalletBalanceOrDustyIfZero,
} from '../../../utils/assertions';
import { setExpiry } from '../../../utils/expiry-utils';
import { liquidateV4WithZap, toZapBigNumber } from '../../../utils/liquidation-utils';
import { CoreProtocol, setupCoreProtocol, setupUSDCBalance, setupUserVaultProxy } from '../../../utils/setup';
import { createRoleAndWhitelistTrader } from './jones-utils';

const defaultAccountNumber = '0';
const otherAccountNumber = '420';
const heldAmountWei = BigNumber.from('200000000000000000000'); // $200
const usdcAmount = heldAmountWei.div(1e12).mul(8);
const usableUsdcAmount = usdcAmount.div(2);
const minCollateralizationNumerator = BigNumber.from('115');
const minCollateralizationDenominator = BigNumber.from('100');
const liquidationSpreadNumerator = BigNumber.from('105');
const liquidationSpreadDenominator = BigNumber.from('100');
const expirationCollateralizationNumerator = BigNumber.from('150');
const expirationCollateralizationDenominator = BigNumber.from('100');

describe('JonesUSDCIsolationModeLiquidationWithZap', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IERC4626;
  let heldMarketId: BigNumber;
  let jonesUSDCRegistry: JonesUSDCRegistry;
  let unwrapper: JonesUSDCIsolationModeUnwrapperTraderV2;
  let wrapper: JonesUSDCIsolationModeWrapperTraderV2;
  let factory: JonesUSDCIsolationModeVaultFactory;
  let vault: JonesUSDCIsolationModeTokenVaultV1;
  let priceOracle: JonesUSDCPriceOracle;
  let defaultAccountStruct: Account.InfoStruct;
  let liquidAccountStruct: Account.InfoStruct;
  let solidAccountStruct: Account.InfoStruct;
  let jUsdcApiToken: ApiToken;
  let zap: DolomiteZap;

  before(async () => {
    const network = Network.ArbitrumOne;
    const blockNumber = await getRealLatestBlockNumber(true, network);
    core = await setupCoreProtocol({
      blockNumber,
      network,
    });
    underlyingToken = core.jonesEcosystem!.jUSDC.connect(core.hhUser1);
    jonesUSDCRegistry = await JonesUSDCRegistry__factory.connect(
      deployments.JonesUSDCRegistry[network].address,
      core.hhUser1,
    );
    factory = JonesUSDCIsolationModeVaultFactory__factory.connect(
      deployments.JonesUSDCIsolationModeVaultFactory[network].address,
      core.hhUser1,
    );
    unwrapper = JonesUSDCIsolationModeUnwrapperTraderV2__factory.connect(
      deployments.JonesUSDCIsolationModeUnwrapperTraderV2[network].address,
      core.hhUser1,
    );
    wrapper = JonesUSDCIsolationModeWrapperTraderV2__factory.connect(
      deployments.JonesUSDCIsolationModeWrapperTraderV2[network].address,
      core.hhUser1,
    );
    await createRoleAndWhitelistTrader(core, unwrapper, wrapper);
    priceOracle = JonesUSDCPriceOracle__factory.connect(
      deployments.JonesUSDCPriceOracle[network].address,
      core.hhUser1,
    );

    heldMarketId = await core.dolomiteMargin.getMarketIdByTokenAddress(factory.address);

    jUsdcApiToken = {
      marketId: heldMarketId.toNumber(),
      symbol: 'jUSDC',
      name: 'Dolomite Isolation: Jones USDC',
      decimals: 18,
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
    vault = setupUserVaultProxy<JonesUSDCIsolationModeTokenVaultV1>(
      vaultAddress,
      JonesUSDCIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    defaultAccountStruct = { owner: vault.address, number: defaultAccountNumber };
    liquidAccountStruct = { owner: vault.address, number: otherAccountNumber };
    solidAccountStruct = { owner: core.hhUser5.address, number: defaultAccountNumber };

    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.jonesEcosystem!.glpAdapter);
    await core.jonesEcosystem!.glpAdapter.connect(core.hhUser1).depositStable(usableUsdcAmount, true);
    await core.jonesEcosystem!.jUSDC.connect(core.hhUser1).approve(vault.address, heldAmountWei);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, heldAmountWei);

    expect(await underlyingToken.connect(core.hhUser1).balanceOf(vault.address)).to.eq(heldAmountWei);
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
      await core.testInterestSetter!.setInterestRate(core.usdc.address, { value: '33295281582' }); // 100% APR
      await core.dolomiteMargin.ownerSetInterestSetter(core.marketIds.usdc, core.testInterestSetter!.address);
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
        jUsdcApiToken,
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
        core.usdc.address,
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
      await expectWalletBalanceOrDustyIfZero(core, core.liquidatorProxyV4!.address, core.weth.address, ZERO_BI);
      await expectWalletBalanceOrDustyIfZero(core, unwrapper.address, core.jonesEcosystem!.jUSDC.address, ZERO_BI);
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
        heldMarketId,
        core.marketIds.usdc,
        expiry,
      );

      const heldUpdatedWithReward = usdcDebtAmount.mul(owedPriceAdj.value).div(heldPrice.value);

      const zapOutputs = await zap.getSwapExactTokensForTokensParams(
        jUsdcApiToken,
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
        core.usdc.address,
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
      await expectWalletBalanceOrDustyIfZero(core, core.liquidatorProxyV4!.address, core.weth.address, ZERO_BI);
      await expectWalletBalanceOrDustyIfZero(core, unwrapper.address, core.jonesEcosystem!.jUSDC.address, ZERO_BI);
      await expectWalletBalanceOrDustyIfZero(core, unwrapper.address, core.usdc.address, ZERO_BI);
    });
  });
});
