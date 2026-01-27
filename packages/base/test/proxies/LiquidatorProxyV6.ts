import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { GenericEventEmissionType } from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import { setNextBlockTimestamp } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { ARBIsolationModeTokenVaultV1__factory } from 'packages/arb/src/types';
import { TestLiquidatorProxyV6, TestLiquidatorProxyV6__factory } from 'packages/base/src/types';
import {
  createContractWithAbi,
  createContractWithLibrary,
  createContractWithName,
  depositIntoDolomiteMargin,
} from 'packages/base/src/utils/dolomite-utils';
import { MAX_UINT_256_BI, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectEvent, expectProtocolBalance, expectThrow, expectWalletBalance } from '../utils/assertions';
import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { createAndUpgradeDolomiteRegistry } from '../utils/dolomite';
import {
  disableInterestAccrual,
  setupARBBalance,
  setupCoreProtocol,
  setupDAIBalance,
  setupUSDCBalance,
  setupWETHBalance,
} from '../utils/setup';
import {
  getLiquidateIsolationModeZapPath,
  getSimpleZapParams,
  getUnwrapZapParams,
  getWrapZapParams,
} from '../utils/zap-utils';
import { UpgradeableProxy__factory } from '@dolomite-exchange/modules-liquidity-mining/src/types';

const amountWei = parseEther('1000');
const usdcAmount = BigNumber.from('1000000000'); // $1000
const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from('123');

describe('LiquidatorProxyV6', () => {

  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let liquidatorProxy: TestLiquidatorProxyV6;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 417_155_000,
    });

    await createAndUpgradeDolomiteRegistry(core);
    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.dai);
    await disableInterestAccrual(core, core.marketIds.usdc);
    await disableInterestAccrual(core, core.marketIds.arb);

    await core.dolomiteRegistry.connect(core.governance).ownerSetFeeAgent(core.hhUser5.address);

    const liquidatorProxyLib = await createContractWithName('LiquidatorProxyLib', []);
    const genericTraderLib = await createContractWithName('GenericTraderProxyV2Lib', []);
    const liquidatorProxyImplementation = await createContractWithLibrary(
      'TestLiquidatorProxyV6',
      { GenericTraderProxyV2Lib: genericTraderLib.address, LiquidatorProxyLib: liquidatorProxyLib.address },
      [
        Network.ArbitrumOne,
        core.expiry.address,
        core.dolomiteMargin.address,
        core.dolomiteRegistry.address,
        core.liquidatorAssetRegistry.address,
        core.dolomiteAccountRiskOverrideSetterProxy.address
      ],
    );
    const data = await liquidatorProxyImplementation.populateTransaction.initialize();
    const proxy = await createContractWithAbi(UpgradeableProxy__factory.abi, UpgradeableProxy__factory.bytecode, [
      liquidatorProxyImplementation.address,
      core.dolomiteMargin.address,
      data.data!,
    ]);
    liquidatorProxy = TestLiquidatorProxyV6__factory.connect(proxy.address, core.hhUser1);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(liquidatorProxy.address, true);
    await liquidatorProxy.connect(core.governance).ownerSetDolomiteRake({ value: parseEther('.1') });
    await liquidatorProxy.connect(core.governance).ownerSetPartialLiquidationThreshold(parseEther('.95'));
    await liquidatorProxy.connect(core.governance).ownerSetIsPartialLiquidator(core.hhUser2.address, true);
    await liquidatorProxy.connect(core.governance).ownerSetMarketToPartialLiquidationSupported([core.marketIds.dai, core.marketIds.dArb], [true, true]);

    await setupWETHBalance(core, core.hhUser2, parseEther('5'), core.dolomiteMargin);
    await core.tokens.weth
      .connect(core.hhUser2)
      .transfer(core.testEcosystem!.testExchangeWrapper.address, parseEther('5'));

    await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('500'));
    await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.dai.address, parseEther('1'));
    await core.testEcosystem?.testPriceOracle.setPrice(
      core.tokens.usdc.address,
      BigNumber.from('1000000000000000000000000000000'),
    );
    await core.testEcosystem?.testPriceOracle.setPrice(core.arbEcosystem.live.dArb.address, parseEther('5'));
    await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.arb.address, parseEther('5'));
    await core.dolomiteMargin
      .connect(core.governance)
      .ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);
    await core.dolomiteMargin
      .connect(core.governance)
      .ownerSetPriceOracle(core.marketIds.dai, core.testEcosystem!.testPriceOracle.address);
    await core.dolomiteMargin
      .connect(core.governance)
      .ownerSetPriceOracle(core.marketIds.usdc, core.testEcosystem!.testPriceOracle.address);
    await core.dolomiteMargin
      .connect(core.governance)
      .ownerSetPriceOracle(core.marketIds.dArb, core.testEcosystem!.testPriceOracle.address);
    await core.dolomiteMargin
      .connect(core.governance)
      .ownerSetPriceOracle(core.marketIds.arb, core.testEcosystem!.testPriceOracle.address);
    await core.liquidatorAssetRegistry
      .connect(core.governance)
      .ownerAddLiquidatorToAssetWhitelist(core.marketIds.dArb, liquidatorProxy.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await liquidatorProxy.EXPIRY()).to.equal(core.expiry.address);
      expect(await liquidatorProxy.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
      expect(await liquidatorProxy.DOLOMITE_REGISTRY()).to.equal(core.dolomiteRegistry.address);
      expect(await liquidatorProxy.LIQUIDATOR_ASSET_REGISTRY()).to.equal(core.liquidatorAssetRegistry.address);
    });
  });

  describe('#initialize', () => {
    it('should fail if already initialized', async () => {
      await expectThrow(liquidatorProxy.initialize(), 'Initializable: contract is already initialized');
    });
  });

  describe('#liquidate', () => {
    it('should work normally with partial liquidation and 10% rake', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('900'));
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('.6'),
        core,
      );
      await liquidatorProxy.connect(core.hhUser2).liquidate({
        solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
        liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: MAX_UINT_256_BI,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        expirationTimestamp: ZERO_BI,
        withdrawAllReward: false,
      });

      /*
       * held = 1000 DAI
       * owed = 1 WETH
       * heldPrice = $1
       * owedPrice = $900
       * owedPriceAdj = 900 + .05(900) = $945
       *
       * partialOwed = .5 WETH * 945 = $472.5 DAI
       * .5 WETH * 900 = $450 DAI
       *
       * After liquidation action:
       *     liquid account dai = 1000 - 472.5 = 527.5
       *     liquid account weth = 1 - .5 = .5
       *     solid account dai = 472.5 - 2.25 = 470.25
       *     solid account weth = -.5
       *     dolomite rake account dai = 2.25 DAI
       *
       * After trade action where solid account swaps 472.5 dai for .6 weth:
       *     solid account dai = 0
       *     solid account weth = .6
       */
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, ZERO_BI.sub(parseEther('.5')));
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, parseEther('527.5').add(1));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, parseEther('.1'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, parseEther('0'));
      await expectProtocolBalance(core, core.hhUser5, defaultAccountNumber, core.marketIds.dai, parseEther('2.25').add(1));
      await expectWalletBalance(core.testEcosystem!.testExchangeWrapper.address, core.tokens.dai, parseEther('470.25'));
    });

    it('should work normally to liquidate an amount less than partial liquidation max', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('900'));
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('.5'),
        core,
      );
      await liquidatorProxy.connect(core.hhUser2).liquidate({
        solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
        liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: parseEther('.4'),
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        expirationTimestamp: ZERO_BI,
        withdrawAllReward: false,
      });

      /*
       * held = 1000 DAI
       * owed = 1 WETH
       * heldPrice = $1
       * owedPrice = $900
       * owedPriceAdj = 900 + .05(900) = $945
       *
       * partialOwed = .4 WETH * 945 = $378 DAI
       * .4 WETH * 900 = $360 DAI
       *
       * After liquidation action:
       *     liquid account dai = 1000 - 378 = 622
       *     liquid account weth = 1 - .4 = .6
       *     solid account dai = 378 - 1.8 = 376.2
       *     solid account weth = -.6
       *     dolomite rake account dai = 1.8 DAI
       *
       * After trade action where solid account swaps 376.2 dai for .5 weth:
       *     solid account dai = 0
       *     solid account weth = .1
       */
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, ZERO_BI.sub(parseEther('.6')));
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, parseEther('622'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, parseEther('.1').add(1));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, parseEther('0'));
      await expectProtocolBalance(core, core.hhUser5, defaultAccountNumber, core.marketIds.dai, parseEther('1.8'));
      await expectWalletBalance(core.testEcosystem!.testExchangeWrapper.address, core.tokens.dai, parseEther('376.2'));
    });

    it('should work normally with partial liquidation and 10% rake if user passes through > partial liquidation amount', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('900'));
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('.6'),
        core,
      );
      await liquidatorProxy.connect(core.hhUser2).liquidate({
        solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
        liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: parseEther('.7'),
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        expirationTimestamp: ZERO_BI,
        withdrawAllReward: false,
      });

      /*
       * held = 1000 DAI
       * owed = 1 WETH
       * heldPrice = $1
       * owedPrice = $900
       * owedPriceAdj = 900 + .05(900) = $945
       *
       * partialOwed = .5 WETH * 945 = $472.5 DAI
       * .5 WETH * 900 = $450 DAI
       *
       * After liquidation action:
       *     liquid account dai = 1000 - 472.5 = 527.5
       *     liquid account weth = 1 - .5 = .5
       *     solid account dai = 472.5 - 2.25 = 470.25
       *     solid account weth = -.5
       *     dolomite rake account dai = 2.25 DAI
       *
       * After trade action where solid account swaps 472.5 dai for .6 weth:
       *     solid account dai = 0
       *     solid account weth = .6
       */
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, ZERO_BI.sub(parseEther('.5')));
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, parseEther('527.5').add(1));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, parseEther('.1'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, parseEther('0'));
      await expectProtocolBalance(core, core.hhUser5, defaultAccountNumber, core.marketIds.dai, parseEther('2.25').add(1));
      await expectWalletBalance(core.testEcosystem!.testExchangeWrapper.address, core.tokens.dai, parseEther('470.25'));
    });

    it('should work normally to fully liquidate if user is below partial liquidation threshold', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('916'));
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('1.1'),
        core,
      );
      await liquidatorProxy.connect(core.hhUser2).liquidate({
        solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
        liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: MAX_UINT_256_BI,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        expirationTimestamp: ZERO_BI,
        withdrawAllReward: false,
      });

      /*
       * collateral ratio = 115%
       * health factor = ratio / 115% =

       * 1000 / x = 1.0925
       * owedPriceForFullLiquidation = 915.3318
       *
       * held = 1000 DAI
       * owed = 1 WETH
       * heldPrice = $1
       * owedPrice = $916
       * owedPriceAdj = 916 + .05(916) = $961.8
       *
       * After liquidation action:
       *     liquid account dai = 1000 - 961.8 = 38.2
       *     liquid account weth = 0
       *     solid account dai = 961.8 - 4.58 = 957.22
       *     solid account weth = -1
       *     dolomite rake account dai = (961.8 - 916) * .1 = 4.58
       *
       * After trade action where solid account swaps 957.22 dai for 1.1 weth:
       *     solid account dai = 0
       *     solid account weth = .1
       */
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, parseEther('38.2'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, parseEther('.1'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, parseEther('0'));
      await expectProtocolBalance(core, core.hhUser5, defaultAccountNumber, core.marketIds.dai, parseEther('4.58'));
      await expectWalletBalance(core.testEcosystem!.testExchangeWrapper.address, core.tokens.dai, parseEther('957.22'));
    });

    it('should work normally to fully liquidate if partials are not enabled for the collateral', async () => {
      await liquidatorProxy.connect(core.governance).ownerSetMarketToPartialLiquidationSupported([core.marketIds.dai], [false]);
      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('900'));
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('1.1'),
        core,
      );
      await liquidatorProxy.connect(core.hhUser2).liquidate({
        solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
        liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: MAX_UINT_256_BI,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        expirationTimestamp: ZERO_BI,
        withdrawAllReward: false,
      });

      /*
       * held = 1000 DAI
       * owed = 1 WETH
       * heldPrice = $1
       * owedPrice = $900
       * owedPriceAdj = 900 + .05(900) = $945
       *
       * After liquidation action:
       *     liquid account dai = 1000 - 945 = 55
       *     liquid account weth = 0
       *     solid account dai = 945 - 4.5 = 940.5
       *     solid account weth = -1
       *     dolomite rake account dai = 945 - 900 = 45 * .1 = 4.5
       *
       * After trade action where solid account swaps 940.5 dai for 1 weth:
       *     solid account dai = 0
       *     solid account weth = .1
       */
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, parseEther('55'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, parseEther('.1'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, parseEther('0').sub(1));
      await expectProtocolBalance(core, core.hhUser5, defaultAccountNumber, core.marketIds.dai, parseEther('4.5'));
      await expectWalletBalance(core.testEcosystem!.testExchangeWrapper.address, core.tokens.dai, parseEther('940.5'));
    });

    it('should work normally to partially liquidate if input amount is greater than max liquidation amount but not uint256 max', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('900'));
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('.6'),
        core,
      );
      await liquidatorProxy.connect(core.hhUser2).liquidate({
        solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
        liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: MAX_UINT_256_BI,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        expirationTimestamp: ZERO_BI,
        withdrawAllReward: false,
      });

      /*
       * held = 1000 DAI
       * owed = 1 WETH
       * heldPrice = $1
       * owedPrice = $900
       * owedPriceAdj = 900 + .05(900) = $945
       *
       * partialOwed = .5 WETH * 945 = $472.5 DAI
       * .5 WETH * 900 = $450 DAI
       *
       * After liquidation action:
       *     liquid account dai = 1000 - 472.5 = 527.5
       *     liquid account weth = 1 - .5 = .5
       *     solid account dai = 472.5 - 2.25 = 470.25
       *     solid account weth = -.5
       *     dolomite rake account dai = 2.25 DAI
       *
       * After trade action where solid account swaps 472.5 dai for .6 weth:
       *     solid account dai = 0
       *     solid account weth = .6
       */
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, ZERO_BI.sub(parseEther('.5')));
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, parseEther('527.5').add(1));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, parseEther('.1'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, parseEther('0'));
      await expectProtocolBalance(core, core.hhUser5, defaultAccountNumber, core.marketIds.dai, parseEther('2.25').add(1));
      await expectWalletBalance(core.testEcosystem!.testExchangeWrapper.address, core.tokens.dai, parseEther('470.25'));
    });

    it('should work normally with partial liquidation and no rake', async () => {
      await liquidatorProxy.connect(core.governance).ownerSetDolomiteRake({ value: ZERO_BI });
      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('900'));
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('.6'),
        core,
      );
      await liquidatorProxy.connect(core.hhUser2).liquidate({
        solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
        liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: MAX_UINT_256_BI,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        expirationTimestamp: ZERO_BI,
        withdrawAllReward: false,
      });

      /*
       * held = 1000 DAI
       * owed = 1 WETH
       * heldPrice = $1
       * owedPrice = $900
       * owedPriceAdj = 900 + .05(900) = $945
       *
       * partialOwed = .5 WETH * 945 = $472.5 DAI
       * .5 WETH * 900 = $450 DAI
       *
       * After liquidation action:
       *     liquid account dai = 1000 - 472.5 = 527.5
       *     liquid account weth = 1 - .5 = .5
       *     solid account dai = 472.5
       *     solid account weth = -.5
       *     dolomite rake account dai =
       *
       * After trade action where solid account swaps 472.5 dai for .6 weth:
       *     solid account dai = 0
       *     solid account weth = .6
       */
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, ZERO_BI.sub(parseEther('.5')));
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, parseEther('527.5').add(1));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, parseEther('.1'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, parseEther('0'));
      await expectProtocolBalance(core, core.hhUser5, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectWalletBalance(core.testEcosystem!.testExchangeWrapper.address, core.tokens.dai, parseEther('472.5'));
    });

    it('should work normally with 20% rake with partial liquidation', async () => {
      await liquidatorProxy.connect(core.governance).ownerSetDolomiteRake({ value: parseEther('.2') });
      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('900'));
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('.6'),
        core,
      );
      await liquidatorProxy.connect(core.hhUser2).liquidate({
        solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
        liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: MAX_UINT_256_BI,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        expirationTimestamp: ZERO_BI,
        withdrawAllReward: false,
      });

      /*
       * held = 1000 DAI
       * owed = 1 WETH
       * heldPrice = $1
       * owedPrice = $900
       * owedPriceAdj = 900 + .05(900) = $945
       *
       * partialOwed = .5 WETH * 945 = $472.5 DAI
       * .5 WETH * 900 = $450 DAI
       *
       * After liquidation action:
       *     liquid account dai = 1000 - 472.5 = 527.5
       *     liquid account weth = 1 - .5 = .5
       *     solid account dai = 472.5 - (22.5 * .2) = 468
       *     solid account weth = -.5
       *     dolomite rake account dai = 2.25 * 2 = 4.5
       *
       * After trade action where solid account swaps 472.5 dai for .6 weth:
       *     solid account dai = 0
       *     solid account weth = .6
       */
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, ZERO_BI.sub(parseEther('.5')));
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, parseEther('527.5').add(1));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, parseEther('.1'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, parseEther('0'));
      await expectProtocolBalance(core, core.hhUser5, defaultAccountNumber, core.marketIds.dai, parseEther('4.5'));
      await expectWalletBalance(core.testEcosystem!.testExchangeWrapper.address, core.tokens.dai, parseEther('468'));
    });

    xit('should work normally with 2 trades', async () => {
      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.usdc, usdcAmount);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('900'));
      const zap1 = await getSimpleZapParams(
        core.marketIds.usdc,
        MAX_UINT_256_BI,
        core.marketIds.dai,
        parseEther('1000'),
        core,
      );
      const zap2 = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('1.1'),
        core,
      );
      const zapParams = {
        marketIdsPath: [core.marketIds.usdc, core.marketIds.dai, core.marketIds.weth],
        inputAmountWei: MAX_UINT_256_BI,
        minOutputAmountWei: MAX_UINT_256_BI,
        tradersPath: [zap1.tradersPath[0], zap2.tradersPath[0]],
        makerAccounts: [],
        userConfig: {
          deadline: '123123123123123',
          balanceCheckFlag: BalanceCheckFlag.None,
          eventType: GenericEventEmissionType.None,
        },
      };
      await liquidatorProxy.connect(core.hhUser2).liquidate({
        solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
        liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: zapParams.minOutputAmountWei,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        expirationTimestamp: ZERO_BI,
        withdrawAllReward: false,
      });

      /*
       * held = 1000 USDC
       * owed = 1 WETH
       * heldPrice = $1
       * owedPrice = $900
       * owedPriceAdj = 900 + .05(900) = $945
       *
       * After liquidation action:
       *     liquid account usdc = 1000 - 945 = 55
       *     liquid account weth = 1 - 1 = 0
       *     solid account usdc = 945
       *     solid account weth = -1
       *
       * After trade action where solid account swaps 945 usdc for 1.1 weth:
       *     solid account usdc = 0
       *     solid account weth = .1
       */
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, parseEther('0'));
      await expectProtocolBalance(
        core,
        core.hhUser1,
        borrowAccountNumber,
        core.marketIds.usdc,
        BigNumber.from('55000000'),
      );
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, parseEther('.1'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.usdc, ZERO_BI);
    });

    it('should work normally to not sell all collateral received', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('900'));
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        parseEther('400'),
        core.marketIds.weth,
        parseEther('.6'),
        core,
      );
      await liquidatorProxy.connect(core.hhUser2).liquidate({
        solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
        liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: MAX_UINT_256_BI,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        expirationTimestamp: ZERO_BI,
        withdrawAllReward: false,
      });

      /*
       * held = 1000 DAI
       * owed = 1 WETH
       * heldPrice = $1
       * owedPrice = $900
       * owedPriceAdj = 900 + .05(900) = $945
       *
       * partialOwed = .5 WETH * 945 = $472.5 DAI
       * .5 WETH * 900 = $450 DAI
       *
       * After liquidation action:
       *     liquid account dai = 1000 - 472.5 = 527.5
       *     liquid account weth = 1 - .5 = .5
       *     solid account dai = 472.5 - 2.25 = 470.25
       *     solid account weth = -.5
       *     dolomite rake account dai = 2.25 DAI
       *
       * After trade action where solid account swaps 400 dai for .6 weth:
       *     solid account dai = 70.25
       *     solid account weth = .6
       */
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, ZERO_BI.sub(parseEther('.5')));
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, parseEther('527.5').add(1));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, parseEther('.1'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, parseEther('70.25'));
      await expectProtocolBalance(core, core.hhUser5, defaultAccountNumber, core.marketIds.dai, parseEther('2.25').add(1));
      await expectWalletBalance(core.testEcosystem!.testExchangeWrapper.address, core.tokens.dai, parseEther('400'));
    });

    it('should work normally with isolation mode and partial liquidation', async () => {
      const arbAmount = parseEther('200');
      await core.arbEcosystem.live.dArb.createVault(core.hhUser1.address);
      const vault = ARBIsolationModeTokenVaultV1__factory.connect(
        await core.arbEcosystem.live.dArb.getVaultByAccount(core.hhUser1.address),
        core.hhUser1,
      );
      await setupARBBalance(core, core.hhUser1, arbAmount, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, arbAmount);
      await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, arbAmount);
      await vault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.weth,
        ONE_ETH_BI,
        BalanceCheckFlag.None,
      );

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('850'));
      const zapParams = await getLiquidateIsolationModeZapPath(
        [core.marketIds.dArb, core.marketIds.arb, core.marketIds.weth],
        [MAX_UINT_256_BI, arbAmount, parseEther('.6')],
        { address: '0x77e91d3f06c2c4b643f29d3fe74ca5af5e55ee68' } as any,
        core,
      );
      await liquidatorProxy.connect(core.hhUser2).liquidate({
        solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
        liquidAccount: { owner: vault.address, number: borrowAccountNumber },
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: MAX_UINT_256_BI,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        expirationTimestamp: ZERO_BI,
        withdrawAllReward: false,
      });

      /*
       * .07 liquidation spread for the pair
       * 850 + 850 (.07) = 909.5 owedPriceAdjusted
       *
       * partialOwedAdj = .5 * 909.5 = $454.75 / 5 = 90.95 ARB
       * partialOwed = .5 WETH * 850 = $425 / 5 = 85 ARB
       *
       * no rake for isolation mode
       *
       * leftover ARB = 200 - 90.95 = 109.05 ARB
       * dolomite rake = 0
       * solid ARB = 90.95 = 90.95 ARB
       */
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, ZERO_BI.sub(parseEther('.5')));
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.dArb, parseEther('109.05'));
      await expectWalletBalance(vault, core.tokens.arb, parseEther('109.05')); // BROKEN
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, parseEther('.1'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dArb, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser5, defaultAccountNumber, core.marketIds.dArb, ZERO_BI);
      await expectWalletBalance(core.testEcosystem!.testExchangeWrapper.address, core.tokens.arb, parseEther('90.95'));
    });

    it('should work normally with isolation mode and full liquidation', async () => {
      const arbAmount = parseEther('200');
      await core.arbEcosystem.live.dArb.createVault(core.hhUser1.address);
      const vault = ARBIsolationModeTokenVaultV1__factory.connect(
        await core.arbEcosystem.live.dArb.getVaultByAccount(core.hhUser1.address),
        core.hhUser1,
      );
      await setupARBBalance(core, core.hhUser1, arbAmount, vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, arbAmount);
      await vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, arbAmount);
      await vault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.weth,
        ONE_ETH_BI,
        BalanceCheckFlag.None,
      );

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('900'));
      const zapParams = await getLiquidateIsolationModeZapPath(
        [core.marketIds.dArb, core.marketIds.arb, core.marketIds.weth],
        [MAX_UINT_256_BI, arbAmount, parseEther('1.1')],
        { address: '0x77e91d3f06c2c4b643f29d3fe74ca5af5e55ee68' } as any,
        core,
      );
      await liquidatorProxy.connect(core.hhUser2).liquidate({
        solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
        liquidAccount: { owner: vault.address, number: borrowAccountNumber },
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: MAX_UINT_256_BI,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        expirationTimestamp: ZERO_BI,
        withdrawAllReward: false,
      });

      /*
       * .07 liquidation spread for the pair
       * 900 + 900 (.7) = 963 owedPriceAdjusted
       * (1000 - 963) / 5 = 7.4 dArb leftover
       *
       * no rake for isolation mode
       *
       * testExchangeWrapper = 200 - 7.4 = 192.6 ARB
       */
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.dArb, parseEther('7.4'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, parseEther('.1'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dArb, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser5, defaultAccountNumber, core.marketIds.dArb, ZERO_BI);
      await expectWalletBalance(core.testEcosystem!.testExchangeWrapper.address, core.tokens.arb, parseEther('192.6'));
    });

    it('should work normally if min output amount is less than owed amount', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('900'));
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('1.1'),
        core,
      );
      await liquidatorProxy.connect(core.hhUser2).liquidate({
        solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
        liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: parseEther('0.5'),
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        expirationTimestamp: ZERO_BI,
        withdrawAllReward: false,
      });

      await expectProtocolBalance(
        core,
        core.hhUser1,
        borrowAccountNumber,
        core.marketIds.weth,
        ZERO_BI.sub(parseEther('0.5')),
      );
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, parseEther('527.5').add(1));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, parseEther('.6'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, 0);
    });

    it('should work normally if supply cap is reached for owed token / reward token', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('900'));
      await core.dolomiteMargin.connect(core.governance).ownerSetMaxWei(core.marketIds.weth, ONE_BI);
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('0.6'),
        core,
      );
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).liquidate({
          solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
          liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          expirationTimestamp: ZERO_BI,
          withdrawAllReward: false,
        }),
        `OperationImpl: Total supply exceeds max supply <${core.marketIds.weth.toString()}>`,
      );
      await liquidatorProxy.connect(core.hhUser2).liquidate({
        solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
        liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: zapParams.minOutputAmountWei,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        expirationTimestamp: ZERO_BI,
        withdrawAllReward: true,
      });

      /*
       * held = 1000 DAI
       * owed = 1 WETH
       * heldPrice = $1
       * owedPrice = $900
       * owedPriceAdj = 900 + .05(900) = $945
       *
       * partialOwed = .5 WETH * 945 = $472.5 DAI
       * .5 WETH * 900 = $450 DAI
       *
       * After liquidation action:
       *     liquid account dai = 1000 - 472.5 = 527.5
       *     liquid account weth = 1 - .5 = .5
       *     solid account dai = 472.5 - 2.25 = 470.25
       *     solid account weth = -.5
       *     dolomite rake account dai = 2.25 DAI
       *
       * After trade action where solid account swaps 472.5 dai for .6 weth:
       *     solid account dai = 0
       *     solid account weth = .6
       */
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, ZERO_BI.sub(parseEther('.5')));
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, parseEther('527.5').add(1));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser5, defaultAccountNumber, core.marketIds.dai, parseEther('2.25').add(1));
      await expectWalletBalance(core.hhUser2, core.tokens.weth, parseEther('.1'));
    });

    it('should work if user already has balance and withdraws all reward', async () => {
      await setupWETHBalance(core, core.hhUser2, parseEther('5'), core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, parseEther('5'));
      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('920'));
      await core.dolomiteMargin.connect(core.governance).ownerSetMaxWei(core.marketIds.weth, ONE_BI);
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('1.1'),
        core,
      );
      await liquidatorProxy.connect(core.hhUser2).liquidate({
        solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
        liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: zapParams.minOutputAmountWei,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        expirationTimestamp: ZERO_BI,
        withdrawAllReward: true,
      });

      /*
       * held = 1000 DAI
       * owed = 1 WETH
       * heldPrice = $1
       * owedPrice = $920
       * owedPriceAdj = 920 + .05(920) = $966
       *
       * After liquidation action:
       *     liquid account dai = 1000 - 966 = 34
       *     liquid account weth = 1 - 1 = 0
       *     dolomite rake account dai = (966 - 920) * .1 = 4.6
       *     solid account dai = 966 - 4.6 = 961.4
       *     solid account weth = -1
       *
       * After trade action where solid account swaps 961.4 dai for 1.1 weth:
       *     solid account dai = 0
       *     solid account weth = .1
       */
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, parseEther('0'));
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, parseEther('34'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, parseEther('5').add(1));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, parseEther('0'));
      await expectWalletBalance(core.hhUser2, core.tokens.weth, parseEther('.1'));
      await expectProtocolBalance(core, core.hhUser5, defaultAccountNumber, core.marketIds.dai, parseEther('4.6').add(1));
      await expectWalletBalance(core.testEcosystem!.testExchangeWrapper.address, core.tokens.dai, parseEther('961.4'));
    });

    it('should work normally if collateral value < debt value', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('2000'));
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('.5'),
        core,
      );
      await liquidatorProxy.connect(core.hhUser2).liquidate({
        solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
        liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: MAX_UINT_256_BI,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        expirationTimestamp: ZERO_BI,
        withdrawAllReward: false,
      });

      // 1000 DAI * 1 eth (2000 eth * 1.05) =
      const weiToLiquidate = BigNumber.from('476190476190476191');
      const leftOverWei = ONE_ETH_BI.sub(weiToLiquidate);

      await expectProtocolBalance(
        core,
        core.hhUser1,
        borrowAccountNumber,
        core.marketIds.weth,
        ZERO_BI.sub(leftOverWei),
      );
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser2,
        defaultAccountNumber,
        core.marketIds.weth,
        parseEther('.5').sub(weiToLiquidate),
      );
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
    });

    it('should work normally if called from local operator of solid account for full liquidation', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      await core.dolomiteMargin.connect(core.hhUser2).setOperators([{ operator: core.hhUser3.address, trusted: true }]);
      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('916'));
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('1.1'),
        core,
      );
      await liquidatorProxy.connect(core.hhUser3).liquidate({
        solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
        liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: zapParams.minOutputAmountWei,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        expirationTimestamp: ZERO_BI,
        withdrawAllReward: false,
      });

      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, parseEther('38.2'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, parseEther('.1'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, parseEther('0'));
      await expectProtocolBalance(core, core.hhUser5, defaultAccountNumber, core.marketIds.dai, parseEther('4.58'));
      await expectWalletBalance(core.testEcosystem!.testExchangeWrapper.address, core.tokens.dai, parseEther('957.22'));
    });

    it('should work normally with expiry', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      const setExpiryArgTypes =
        'tuple(tuple(address owner, uint256 number) account, uint256 marketId, uint32 timeDelta, bool forceUpdate)[] setExpiryArgs';
      await core.expiry.connect(dolomiteMarginImpersonator).callFunction(
        core.hhUser2.address,
        { owner: core.hhUser1.address, number: borrowAccountNumber },
        defaultAbiCoder.encode(
          ['uint8', setExpiryArgTypes],
          [
            0,
            [
              {
                account: { owner: core.hhUser1.address, number: borrowAccountNumber },
                marketId: core.marketIds.weth,
                timeDelta: 1000,
                forceUpdate: true,
              },
            ],
          ],
        ),
      );

      const expiry = await core.expiry.getExpiry(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
        core.marketIds.weth,
      );
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('1.1'),
        core,
      );
      await setNextBlockTimestamp(expiry);
      await liquidatorProxy.connect(core.hhUser2).liquidate({
        solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
        liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: zapParams.minOutputAmountWei,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        expirationTimestamp: expiry,
        withdrawAllReward: false,
      });
      const daiAmount = BigNumber.from('500000000000000000000');
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, parseEther('0'));
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, daiAmount.sub(1));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, parseEther('.1'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, ZERO_BI.sub(1));
      await expectWalletBalance(core.testEcosystem!.testExchangeWrapper.address, core.tokens.dai, parseEther('500').sub(1));
    });

    it('should fail if attempting to partially liquidate when not whitelisted', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('900'));
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('.6'),
        core,
      );
      await liquidatorProxy.connect(core.governance).ownerSetIsPartialLiquidator(core.hhUser2.address, false);
      await expectThrow(liquidatorProxy.connect(core.hhUser2).liquidate(
        {
          solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
          liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: MAX_UINT_256_BI,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          expirationTimestamp: ZERO_BI,
          withdrawAllReward: false,
        }),
        'BaseLiquidatorProxy: Invalid partial liquidator'
      );
    });

    it('should fail if inputAmountWei is not MAX_UINT_256_BI for isolation mode assets', async () => {
      const zapParams = await getUnwrapZapParams(
        core.marketIds.dGmEth,
        ONE_ETH_BI,
        core.marketIds.weth,
        ONE_BI,
        core.gmxV2Ecosystem.live.gmEth.unwrapper,
        core,
      );
      await core.liquidatorAssetRegistry.connect(core.governance).ownerAddLiquidatorToAssetWhitelist(
        core.marketIds.dGmEth,
        liquidatorProxy.address
      );
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).liquidate({
          solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
          liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          expirationTimestamp: ZERO_BI,
          withdrawAllReward: false,
        }),
        'LiquidatorProxyV6: Invalid amount for IsolationMode',
      );
      const wrapParams = await getWrapZapParams(
        core.marketIds.weth,
        ONE_ETH_BI,
        core.marketIds.dGmEth,
        ONE_BI,
        core.gmxV2Ecosystem.live.gmEth.wrapper as any,
        core,
      );
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).liquidate({
          solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
          liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
          marketIdsPath: wrapParams.marketIdsPath,
          inputAmountWei: wrapParams.inputAmountWei,
          minOutputAmountWei: wrapParams.minOutputAmountWei,
          tradersPath: wrapParams.tradersPath,
          makerAccounts: wrapParams.makerAccounts,
          expirationTimestamp: ZERO_BI,
          withdrawAllReward: false,
        }),
        'LiquidatorProxyV6: Invalid amount for IsolationMode',
      );
    });

    it('should fail if owed market id same as held market id', async () => {
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.dai,
        parseEther('1.01'),
        core,
      );
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).liquidate({
          solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
          liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          expirationTimestamp: ZERO_BI,
          withdrawAllReward: false,
        }),
        `LiquidatorProxyLib: Owed market equals held market <${core.marketIds.dai.toString()}>`,
      );
    });

    it('should fail if owed market id is positive', async () => {
      await setupWETHBalance(core, core.hhUser1, parseEther('1'), core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, parseEther('1'));

      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('1'),
        core,
      );
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).liquidate({
          solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
          liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          expirationTimestamp: ZERO_BI,
          withdrawAllReward: false,
        }),
        `LiquidatorProxyLib: Owed market cannot be positive <${core.marketIds.weth.toString()}>`,
      );
    });

    it('should fail if held market id is negative', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.usdt,
          ONE_BI,
          BalanceCheckFlag.None,
        );

      const zapParams = await getSimpleZapParams(
        core.marketIds.usdt,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('1'),
        core,
      );
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).liquidate({
          solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
          liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          expirationTimestamp: ZERO_BI,
          withdrawAllReward: false,
        }),
        `LiquidatorProxyLib: Held market cannot be negative <${core.marketIds.usdt.toString()}>`,
      );
    });

    it('should fail if expiry overflows', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('1'),
        core,
      );
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).liquidate({
          solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
          liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          expirationTimestamp: MAX_UINT_256_BI,
          withdrawAllReward: false,
        }),
        `LiquidatorProxyLib: Expiration timestamp overflows <${MAX_UINT_256_BI.toString()}>`,
      );
    });

    it('should fail if expiry is less than timestamp', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('1'),
        core,
      );
      const futureTimestamp = (await ethers.provider.getBlock('latest')).timestamp + 1000;

      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).liquidate({
          solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
          liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          expirationTimestamp: futureTimestamp,
          withdrawAllReward: false,
        }),
        `LiquidatorProxyLib: Borrow not yet expired <${futureTimestamp.toString()}>`,
      );
    });

    it('should fail if held asset is not whitelisted for liquidation', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      await core.liquidatorAssetRegistry
        .connect(core.governance)
        .ownerAddLiquidatorToAssetWhitelist(core.marketIds.dai, core.liquidatorProxyV1.address);
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('1'),
        core,
      );
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).liquidate({
          solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
          liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          expirationTimestamp: ZERO_BI,
          withdrawAllReward: false,
        }),
        `HasLiquidatorRegistry: Asset not whitelisted <${core.marketIds.dai.toString()}>`,
      );
    });

    it('should fail if owed asset is not whitelisted for liquidation', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      await core.liquidatorAssetRegistry
        .connect(core.governance)
        .ownerAddLiquidatorToAssetWhitelist(core.marketIds.weth, core.liquidatorProxyV1.address);
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('1'),
        core,
      );
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).liquidate({
          solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
          liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          expirationTimestamp: ZERO_BI,
          withdrawAllReward: false,
        }),
        `HasLiquidatorRegistry: Asset not whitelisted <${core.marketIds.weth.toString()}>`,
      );
    });

    it('should fail if msg.sender is not solid account or local operator', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('1'),
        core,
      );
      await expectThrow(
        liquidatorProxy.connect(core.hhUser3).liquidate({
          solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
          liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          expirationTimestamp: ZERO_BI,
          withdrawAllReward: false,
        }),
        `LiquidatorProxyLib: Sender not operator <${core.hhUser3.address.toLowerCase()}>`,
      );
    });

    it('should fail if expiry does not match', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );

      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('1'),
        core,
      );
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).liquidate({
          solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
          liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          expirationTimestamp: ONE_BI,
          withdrawAllReward: false,
        }),
        'LiquidatorProxyLib: Expiration timestamp mismatch <0, 1>',
      );
    });

    it('should fail if reentered', async () => {
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('1.1'),
        core,
      );
      const transaction = await liquidatorProxy.connect(core.hhUser2).populateTransaction.liquidate({
        solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
        liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: zapParams.minOutputAmountWei,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        expirationTimestamp: ZERO_BI,
        withdrawAllReward: false,
      });
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuardUpgradeable: Reentrant call',
      );
    });
  });

  describe('#liquidateViaProxyWithStrictInputMarket', () => {
    it('should work if the sender is a global operator and whitelisted for the asset', async () => {
    });

    it('should fail if the sender is not a global operator', async () => {
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('1.1'),
        core,
      );
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).liquidateViaProxyWithStrictInputMarket({
          solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
          liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
          marketIdsPath: [],
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          expirationTimestamp: ZERO_BI,
          withdrawAllReward: false,
        }),
        `OnlyDolomiteMargin: Caller is not a global operator <${core.hhUser2.addressLower}>`,
      );
    });

    it('should fail if the market IDs is an invalid length', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(core.hhUser2.address, true);
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('1.1'),
        core,
      );
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).liquidateViaProxyWithStrictInputMarket({
          solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
          liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
          marketIdsPath: [],
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          expirationTimestamp: ZERO_BI,
          withdrawAllReward: false,
        }),
        'GenericTraderProxyBaseLiquidator: Invalid market path length',
      );
    });

    it('should fail if the sender is not whitelisted for the input asset', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(core.hhUser2.address, true);
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('1.1'),
        core,
      );
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).liquidateViaProxyWithStrictInputMarket({
          solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
          liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          expirationTimestamp: ZERO_BI,
          withdrawAllReward: false,
        }),
        `HasLiquidatorRegistry: Asset has nothing whitelisted <${core.marketIds.dai}>`,
      );
    });

    it('should fail if the sender is not whitelisted for the output asset', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(core.hhUser2.address, true);
      await core.liquidatorAssetRegistry
        .connect(core.governance)
        .ownerAddLiquidatorToAssetWhitelist(core.marketIds.dai, core.hhUser2.address);
      await core.liquidatorAssetRegistry
        .connect(core.governance)
        .ownerAddLiquidatorToAssetWhitelist(core.marketIds.weth, core.hhUser3.address);
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('1.1'),
        core,
      );
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).liquidateViaProxyWithStrictInputMarket({
          solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
          liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          expirationTimestamp: ZERO_BI,
          withdrawAllReward: false,
        }),
        `HasLiquidatorRegistry: Asset not whitelisted <${core.marketIds.weth}>`,
      );
    });

    it('should fail if reentered', async () => {
      const zapParams = await getSimpleZapParams(
        core.marketIds.dai,
        MAX_UINT_256_BI,
        core.marketIds.weth,
        parseEther('1.1'),
        core,
      );
      const transaction = await liquidatorProxy
        .connect(core.hhUser2)
        .populateTransaction.liquidateViaProxyWithStrictInputMarket({
          solidAccount: { owner: core.hhUser2.address, number: defaultAccountNumber },
          liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
          marketIdsPath: zapParams.marketIdsPath,
          inputAmountWei: zapParams.inputAmountWei,
          minOutputAmountWei: zapParams.minOutputAmountWei,
          tradersPath: zapParams.tradersPath,
          makerAccounts: zapParams.makerAccounts,
          expirationTimestamp: ZERO_BI,
          withdrawAllReward: false,
        });
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuardUpgradeable: Reentrant call',
      );
    });
  });

  describe('#ownerSetDolomiteRake', () => {
    it('should work normally', async () => {
      expect(await liquidatorProxy.dolomiteRake()).to.equal(parseEther('.1'));
      const res = await liquidatorProxy.connect(core.governance).ownerSetDolomiteRake({ value: parseEther('.2') });
      await expectEvent(liquidatorProxy, res, 'DolomiteRakeSet', {
        dolomiteRake: { value: parseEther('.2') },
      });
      expect(await liquidatorProxy.dolomiteRake()).to.equal(parseEther('.2'));
    });

    it('should fail if dolomite rake is invalid', async () => {
      await expectThrow(
        liquidatorProxy.connect(core.governance).ownerSetDolomiteRake({ value: parseEther('1') }),
        'BaseLiquidatorProxy: Invalid dolomite rake',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).ownerSetDolomiteRake({ value: parseEther('.2') }),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#ownerSetIsPartialLiquidator', () => {
    it('should work normally', async () => {
      expect(await liquidatorProxy.whitelistedPartialLiquidators(core.hhUser2.address)).to.equal(true);
      const res = await liquidatorProxy
        .connect(core.governance)
        .ownerSetIsPartialLiquidator(core.hhUser2.address, false);
      await expectEvent(liquidatorProxy, res, 'PartialLiquidatorSet', {
        partialLiquidator: core.hhUser2.address,
        isPartialLiquidator: false,
      });
      expect(await liquidatorProxy.whitelistedPartialLiquidators(core.hhUser2.address)).to.equal(false);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).ownerSetIsPartialLiquidator(core.hhUser3.address, true),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#ownerSetMarketToPartialLiquidationSupported', () => {
    it('should work normally', async () => {
      expect(await liquidatorProxy.marketToPartialLiquidationSupported(core.marketIds.dai)).to.equal(true);
      const marketIds = [core.marketIds.dai, core.marketIds.usdc];
      const isSupported = [false, true];
      const res = await liquidatorProxy
        .connect(core.governance)
        .ownerSetMarketToPartialLiquidationSupported(marketIds, isSupported);
      await expectEvent(liquidatorProxy, res, 'MarketToPartialLiquidationSupportedSet', {
        marketIds,
        isSupported,
      });
      expect(await liquidatorProxy.marketToPartialLiquidationSupported(core.marketIds.dai)).to.equal(false);
      expect(await liquidatorProxy.marketToPartialLiquidationSupported(core.marketIds.usdc)).to.equal(true);
    });

    it('should fail if market IDs length does not match', async () => {
      await expectThrow(
        liquidatorProxy
          .connect(core.governance)
          .ownerSetMarketToPartialLiquidationSupported([core.marketIds.dai], [true, false]),
        'BaseLiquidatorProxy: Invalid market IDs length',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        liquidatorProxy
          .connect(core.hhUser2)
          .ownerSetMarketToPartialLiquidationSupported([core.marketIds.dai], [true]),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#ownerSetPartialLiquidationThreshold', () => {
    it('should work normally', async () => {
      expect(await liquidatorProxy.partialLiquidationThreshold()).to.equal(parseEther('.95'));

      const threshold = parseEther('.96');
      const res = await liquidatorProxy.connect(core.governance).ownerSetPartialLiquidationThreshold(threshold);
      await expectEvent(liquidatorProxy, res, 'PartialLiquidationThresholdSet', {
        partialLiquidationThreshold: threshold,
      });
      expect(await liquidatorProxy.partialLiquidationThreshold()).to.equal(threshold);
    });

    it('should fail if partial liquidation threshold is invalid', async () => {
      await expectThrow(
        liquidatorProxy.connect(core.governance).ownerSetPartialLiquidationThreshold(parseEther('1')),
        'BaseLiquidatorProxy: Invalid partial threshold',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).ownerSetPartialLiquidationThreshold(parseEther('.96')),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser2.addressLower}>`,
      );
    });
  });

  describe('#isCollateralized', () => {
    it('should return true if collateralized', async () => {
      expect(
        await liquidatorProxy.isCollateralized(parseEther('110'), parseEther('100'), { value: parseEther('0.1') }),
      ).to.equal(true);
    });

    it('should return false if not collateralized', async () => {
      expect(
        await liquidatorProxy.isCollateralized(parseEther('110'), parseEther('100'), { value: parseEther('0.11') }),
      ).to.equal(false);
    });
  });

  describe('#getAccountValues', () => {
    it('should work normally', async () => {
      await setupDAIBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, amountWei);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );
      const values = await liquidatorProxy.getAccountValues(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
        [core.marketIds.dai, core.marketIds.weth],
        [core.marketIds.dai],
        [core.marketIds.weth],
        false,
        { value: parseEther('0') },
      );
      expect(values[0].value).to.eq(amountWei.mul(ONE_ETH_BI));
      expect(values[1].value).to.eq(ONE_ETH_BI.mul(parseEther('500')));
    });

    it('should work normally with adjustment for margin premiums', async () => {
      const arbAmount = parseEther('200');
      await setupARBBalance(core, core.hhUser1, arbAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.arb, arbAmount);
      await core.dolomiteMargin
        .connect(core.governance)
        .ownerSetMarginPremium(core.marketIds.arb, { value: parseEther('0.01') });
      await core.dolomiteMargin
        .connect(core.governance)
        .ownerSetMarginPremium(core.marketIds.weth, { value: parseEther('0.02') });
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('1'),
          BalanceCheckFlag.None,
        );
      const values = await liquidatorProxy.getAccountValues(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
        [core.marketIds.arb, core.marketIds.weth],
        [core.marketIds.arb],
        [core.marketIds.weth],
        true,
        { value: parseEther('0') },
      );
      expect(values[0].value).to.eq(arbAmount.mul(parseEther('5')).mul(ONE_ETH_BI).div(parseEther('1.01')));
      expect(values[1].value).to.eq(ONE_ETH_BI.mul(parseEther('500')).mul(parseEther('1.02')).div(ONE_ETH_BI));
    });
  });

  describe('#binarySearch', () => {
    it('should work normally', async () => {
      expect(
        (
          await liquidatorProxy.binarySearch(
            [core.marketIds.weth, core.marketIds.dai, core.marketIds.arb],
            0,
            3,
            core.marketIds.weth,
          )
        ).marketId,
      ).to.equal(core.marketIds.weth);
      expect(
        (
          await liquidatorProxy.binarySearch(
            [core.marketIds.weth, core.marketIds.dai, core.marketIds.arb],
            0,
            3,
            core.marketIds.dai,
          )
        ).marketId,
      ).to.equal(core.marketIds.dai);
      expect(
        (
          await liquidatorProxy.binarySearch(
            [core.marketIds.weth, core.marketIds.dai, core.marketIds.arb],
            0,
            3,
            core.marketIds.arb,
          )
        ).marketId,
      ).to.equal(core.marketIds.arb);
    });

    it('should fail if no markets are provided', async () => {
      await expectThrow(liquidatorProxy.binarySearch([], 0, 0, 0), 'BaseLiquidatorProxy: Market not found');
    });

    it('should fail if market id not found', async () => {
      await expectThrow(
        liquidatorProxy.binarySearch([core.marketIds.dai], 0, 1, core.marketIds.usdc),
        'BaseLiquidatorProxy: Market not found',
      );
      await expectThrow(
        liquidatorProxy.binarySearch(
          [core.marketIds.dai, core.marketIds.weth, core.marketIds.arb],
          0,
          3,
          core.marketIds.usdc,
        ),
        'BaseLiquidatorProxy: Market not found',
      );
    });
  });

  describe('#otherAccountId', () => {
    it('should return the correct account id', async () => {
      expect(await liquidatorProxy.otherAccountId()).to.equal(2);
    });
  });
});
