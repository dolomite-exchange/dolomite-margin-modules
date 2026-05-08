import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { LiquidatorProxyV1, LiquidatorProxyV1__factory } from 'packages/base/src/types';
import {
  createContractWithAbi,
  depositIntoDolomiteMargin,
} from 'packages/base/src/utils/dolomite-utils';
import { MAX_UINT_256_BI, Network, ONE_ETH_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectEvent, expectProtocolBalance, expectThrow } from '../utils/assertions';
import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { createAndUpgradeDolomiteRegistry } from '../utils/dolomite';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupDAIBalance,
  setupWBTCBalance,
} from '../utils/setup';

const amountWei = parseEther('1000');
const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from('123');

describe('LiquidatorProxyV1', () => {

  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let liquidatorProxy: LiquidatorProxyV1;

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

    liquidatorProxy = await createContractWithAbi<LiquidatorProxyV1>(
      LiquidatorProxyV1__factory.abi,
      LiquidatorProxyV1__factory.bytecode,
      [core.config.network, core.liquidatorAssetRegistry.address, core.dolomiteRegistry.address, core.dolomiteMargin.address]
    );

    await core.dolomiteRegistry.connect(core.governance).ownerSetFeeAgent(core.hhUser5.address);
    await core.dolomiteRegistry.connect(core.governance).ownerSetPartialLiquidationThreshold({ value: parseEther('.95')});
    await core.dolomiteRegistry.connect(core.governance).ownerSetDolomiteRake({ value: parseEther('.1')});
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(liquidatorProxy.address, true);
    await liquidatorProxy.connect(core.governance).ownerSetWhitelistedLiquidator(core.hhUser2.address, true);

    await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('500'));
    await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.dai.address, parseEther('1'));
    await core.testEcosystem?.testPriceOracle.setPrice(
      core.tokens.usdc.address,
      BigNumber.from('1000000000000000000000000000000'),
    );
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
    await core.liquidatorAssetRegistry
      .connect(core.governance)
      .ownerAddLiquidatorToAssetWhitelist(core.marketIds.dArb, liquidatorProxy.address);

    // deposit wbtc so account is very well collateralized
    const wbtcAmount = BigNumber.from('1000000000');
    await setupWBTCBalance(core, core.hhUser2, wbtcAmount, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser2, 0, core.marketIds.wbtc, wbtcAmount);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await liquidatorProxy.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
      expect(await liquidatorProxy.DOLOMITE_REGISTRY()).to.equal(core.dolomiteRegistry.address);
      expect(await liquidatorProxy.LIQUIDATOR_ASSET_REGISTRY()).to.equal(core.liquidatorAssetRegistry.address);
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
      await liquidatorProxy.connect(core.hhUser2).liquidate(
        { owner: core.hhUser2.address, number: defaultAccountNumber },
        { owner: core.hhUser1.address, number: borrowAccountNumber },
        [core.marketIds.dai],
        [core.marketIds.weth],
        [MAX_UINT_256_BI]
      );

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
      await expectProtocolBalance(
        core,
        core.hhUser1,
        borrowAccountNumber,
        core.marketIds.weth,
        ZERO_BI.sub(parseEther('.5')),
      );
      await expectProtocolBalance(
        core,
        core.hhUser1,
        borrowAccountNumber,
        core.marketIds.dai,
        parseEther('527.5').add(1),
      );
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, ZERO_BI.sub(parseEther('.5')));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, parseEther('470.25'));
      await expectProtocolBalance(
        core,
        core.hhUser5,
        defaultAccountNumber,
        core.marketIds.dai,
        parseEther('2.25').add(1),
      );
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
      await liquidatorProxy.connect(core.hhUser2).liquidate(
        { owner: core.hhUser2.address, number: defaultAccountNumber },
        { owner: core.hhUser1.address, number: borrowAccountNumber },
        [core.marketIds.dai],
        [core.marketIds.weth],
        [parseEther('.4')]
      );

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
       */
      await expectProtocolBalance(
        core,
        core.hhUser1,
        borrowAccountNumber,
        core.marketIds.weth,
        ZERO_BI.sub(parseEther('.6')),
      );
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, parseEther('622'));
      await expectProtocolBalance(
        core,
        core.hhUser2,
        defaultAccountNumber,
        core.marketIds.weth,
        ZERO_BI.sub(parseEther('.4')).add(1)
      );
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, parseEther('376.2'));
      await expectProtocolBalance(core, core.hhUser5, defaultAccountNumber, core.marketIds.dai, parseEther('1.8'));
    });

    // tslint:disable-next-line:max-line-length
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
      await liquidatorProxy.connect(core.hhUser2).liquidate(
        { owner: core.hhUser2.address, number: defaultAccountNumber },
        { owner: core.hhUser1.address, number: borrowAccountNumber },
        [core.marketIds.dai],
        [core.marketIds.weth],
        [parseEther('.6')]
      );

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
      await expectProtocolBalance(
        core,
        core.hhUser1,
        borrowAccountNumber,
        core.marketIds.weth,
        ZERO_BI.sub(parseEther('.5')),
      );
      await expectProtocolBalance(
        core,
        core.hhUser1,
        borrowAccountNumber,
        core.marketIds.dai,
        parseEther('527.5').add(1),
      );
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, ZERO_BI.sub(parseEther('.5')));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, parseEther('470.25'));
      await expectProtocolBalance(
        core,
        core.hhUser5,
        defaultAccountNumber,
        core.marketIds.dai,
        parseEther('2.25').add(1),
      );
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
      await liquidatorProxy.connect(core.hhUser2).liquidate(
        { owner: core.hhUser2.address, number: defaultAccountNumber },
        { owner: core.hhUser1.address, number: borrowAccountNumber },
        [core.marketIds.dai],
        [core.marketIds.weth],
        [MAX_UINT_256_BI]
      );

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
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, ZERO_BI.sub(ONE_ETH_BI));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, parseEther('957.22'));
      await expectProtocolBalance(core, core.hhUser5, defaultAccountNumber, core.marketIds.dai, parseEther('4.58'));
    });

    it('should work normally with partial liquidation and no rake', async () => {
      await core.dolomiteRegistry.connect(core.governance).ownerSetDolomiteRake({ value: ZERO_BI });
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
      await liquidatorProxy.connect(core.hhUser2).liquidate(
        { owner: core.hhUser2.address, number: defaultAccountNumber },
        { owner: core.hhUser1.address, number: borrowAccountNumber },
        [core.marketIds.dai],
        [core.marketIds.weth],
        [MAX_UINT_256_BI]
      );

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
      await expectProtocolBalance(
        core,
        core.hhUser1,
        borrowAccountNumber,
        core.marketIds.weth,
        ZERO_BI.sub(parseEther('.5')),
      );
      await expectProtocolBalance(
        core,
        core.hhUser1,
        borrowAccountNumber,
        core.marketIds.dai,
        parseEther('527.5').add(1),
      );
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, ZERO_BI.sub(parseEther('.5')));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, parseEther('472.5'));
      await expectProtocolBalance(core, core.hhUser5, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
    });

    it('should work normally with 20% rake with partial liquidation', async () => {
      await core.dolomiteRegistry.connect(core.governance).ownerSetDolomiteRake({ value: parseEther('.2') });
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
      await liquidatorProxy.connect(core.hhUser2).liquidate(
        { owner: core.hhUser2.address, number: defaultAccountNumber },
        { owner: core.hhUser1.address, number: borrowAccountNumber },
        [core.marketIds.dai],
        [core.marketIds.weth],
        [MAX_UINT_256_BI]
      );

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
      await expectProtocolBalance(
        core,
        core.hhUser1,
        borrowAccountNumber,
        core.marketIds.weth,
        ZERO_BI.sub(parseEther('.5')),
      );
      await expectProtocolBalance(
        core,
        core.hhUser1,
        borrowAccountNumber,
        core.marketIds.dai,
        parseEther('527.5').add(1),
      );
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, ZERO_BI.sub(parseEther('.5')));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, parseEther('468'));
      await expectProtocolBalance(core, core.hhUser5, defaultAccountNumber, core.marketIds.dai, parseEther('4.5'));
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
      await liquidatorProxy.connect(core.hhUser2).liquidate(
        { owner: core.hhUser2.address, number: defaultAccountNumber },
        { owner: core.hhUser1.address, number: borrowAccountNumber },
        [core.marketIds.dai],
        [core.marketIds.weth],
        [MAX_UINT_256_BI]
      );

      /*
       * held = 1000 DAI
       * owed = 1 WETH
       * heldPrice = $1
       * owedPrice = $2000
       * owedPriceAdj = 2000 + .05(2000) = $2100
       *
       * partialOwed = 1000 DAI / $2100 = .4761904762 WETH
       * .4761904762 WETH * 2000 = 952.3809
       *
       * After liquidation action:
       *     liquid account dai = 0
       *     liquid account weth = 1 WETH - .476190472
       *     dolomite rake = (1000 - 952.3809) * .1 = 
       *     solid account dai = 1000 - (22.5 * .2) = 468
       *     solid account weth = -.5
       *     dolomite rake account dai = 2.25 * 2 = 4.5
       *
       * After trade action where solid account swaps 472.5 dai for .6 weth:
       *     solid account dai = 0
       *     solid account weth = .6
       */
      const weiToLiquidate = BigNumber.from('476190476190476191');
      const leftOverWei = ONE_ETH_BI.sub(weiToLiquidate);
      const heldWeiNoReward = weiToLiquidate.mul(2000);
      const dolomiteRake = amountWei.sub(heldWeiNoReward).div(10);

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
        ZERO_BI.sub(weiToLiquidate),
      );
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, amountWei.sub(dolomiteRake));
      await expectProtocolBalance(core, core.hhUser5, defaultAccountNumber, core.marketIds.dai, dolomiteRake);
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
      await liquidatorProxy.connect(core.governance).ownerSetWhitelistedLiquidator(core.hhUser3.address, true);
      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('916'));

      await liquidatorProxy.connect(core.hhUser3).liquidate(
        { owner: core.hhUser2.address, number: defaultAccountNumber },
        { owner: core.hhUser1.address, number: borrowAccountNumber },
        [core.marketIds.dai],
        [core.marketIds.weth],
        [MAX_UINT_256_BI]
      );
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
      await liquidatorProxy.connect(core.governance).ownerSetWhitelistedLiquidator(core.hhUser2.address, false);
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).liquidate(
          { owner: core.hhUser2.address, number: defaultAccountNumber },
          { owner: core.hhUser1.address, number: borrowAccountNumber },
          [core.marketIds.dai],
          [core.marketIds.weth],
          [MAX_UINT_256_BI]
        ),
        'LiquidatorProxyV1: Msg.sender is not whitelisted',
      );
    });

    it('should fail for isolation mode assets', async () => {
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
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).liquidate(
          { owner: core.hhUser2.address, number: defaultAccountNumber },
          { owner: core.hhUser1.address, number: borrowAccountNumber },
          [core.marketIds.dArb],
          [core.marketIds.weth],
          [MAX_UINT_256_BI]
        ),
        'LiquidatorProxyV1: Cannot liquidate iso mode',
      );
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).liquidate(
          { owner: core.hhUser2.address, number: defaultAccountNumber },
          { owner: core.hhUser1.address, number: borrowAccountNumber },
          [core.marketIds.dfsGlp],
          [core.marketIds.weth],
          [MAX_UINT_256_BI]
        ),
        'LiquidatorProxyV1: Cannot liquidate iso mode',
      );
    });

    it('should fail if owed market id same as held market id', async () => {
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

      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).liquidate(
          { owner: core.hhUser2.address, number: defaultAccountNumber },
          { owner: core.hhUser1.address, number: borrowAccountNumber },
          [core.marketIds.dai],
          [core.marketIds.dai],
          [MAX_UINT_256_BI]
        ),
        'LiquidatorProxyV1: Cannot liquidate same market'
      );
    });

    it('should fail if invalid market balances', async () => {
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

      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).liquidate(
          { owner: core.hhUser2.address, number: defaultAccountNumber },
          { owner: core.hhUser1.address, number: borrowAccountNumber },
          [core.marketIds.dai],
          [core.marketIds.usdc],
          [MAX_UINT_256_BI]
        ),
        'LiquidatorProxyV1: Invalid market balances',
      );
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).liquidate(
          { owner: core.hhUser2.address, number: defaultAccountNumber },
          { owner: core.hhUser1.address, number: borrowAccountNumber },
          [core.marketIds.usdc],
          [core.marketIds.weth],
          [MAX_UINT_256_BI]
        ),
        'LiquidatorProxyV1: Invalid market balances',
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

      await liquidatorProxy.connect(core.governance).ownerSetWhitelistedLiquidator(core.hhUser3.address, true);
      await expectThrow(
        liquidatorProxy.connect(core.hhUser3).liquidate(
          { owner: core.hhUser2.address, number: defaultAccountNumber },
          { owner: core.hhUser1.address, number: borrowAccountNumber },
          [core.marketIds.dai],
          [core.marketIds.weth],
          [MAX_UINT_256_BI]
        ),
        'LiquidatorProxyV1: Invalid solid account'
      );
    });

    it('should fail if invalid array lengths', async () => {
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).liquidate(
          { owner: core.hhUser2.address, number: defaultAccountNumber },
          { owner: core.hhUser1.address, number: borrowAccountNumber },
          [core.marketIds.dai],
          [core.marketIds.weth, core.marketIds.usdc],
          [MAX_UINT_256_BI]
        ),
        'LiquidatorProxyV1: Invalid market arrays'
      );
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).liquidate(
          { owner: core.hhUser2.address, number: defaultAccountNumber },
          { owner: core.hhUser1.address, number: borrowAccountNumber },
          [core.marketIds.dai],
          [core.marketIds.weth],
          [MAX_UINT_256_BI, MAX_UINT_256_BI]
        ),
        'LiquidatorProxyV1: Invalid market arrays'
      );
    });
  });

  describe('#ownerSetWhitelistedLiquidator', () => {
    it('should work normally', async () => {
      expect(await liquidatorProxy.isWhitelistedLiquidator(core.hhUser2.address)).to.equal(true);
      const res = await liquidatorProxy
        .connect(core.governance)
        .ownerSetWhitelistedLiquidator(core.hhUser2.address, false);
      await expectEvent(liquidatorProxy, res, 'WhitelistedLiquidatorSet', {
        liquidator: core.hhUser2.address,
        isWhitelisted: false,
      });
      expect(await liquidatorProxy.isWhitelistedLiquidator(core.hhUser2.address)).to.equal(false);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        liquidatorProxy.connect(core.hhUser2).ownerSetWhitelistedLiquidator(core.hhUser3.address, true),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser2.addressLower}>`,
      );
    });
  });
});
