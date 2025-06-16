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
import { expectProtocolBalance, expectThrow, expectWalletBalance } from '../utils/assertions';
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
      blockNumber: 221_500_000,
    });

    await createAndUpgradeDolomiteRegistry(core);
    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.dai);
    await disableInterestAccrual(core, core.marketIds.usdc);
    await disableInterestAccrual(core, core.marketIds.arb);

    const genericTraderLib = await createContractWithName('GenericTraderProxyV2Lib', []);
    const liquidatorProxyImplementation = await createContractWithLibrary(
      'TestLiquidatorProxyV6',
      { GenericTraderProxyV2Lib: genericTraderLib.address },
      [
        Network.ArbitrumOne,
        core.expiry.address,
        core.dolomiteMargin.address,
        core.dolomiteRegistry.address,
        core.liquidatorAssetRegistry.address,
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

    await setupWETHBalance(core, core.hhUser2, parseEther('5'), core.dolomiteMargin);
    await core.tokens.weth
      .connect(core.hhUser2)
      .transfer(core.testEcosystem!.testExchangeWrapper.address, parseEther('5'));
    await setupDAIBalance(core, core.hhUser2, parseEther('1000'), core.dolomiteMargin);
    await core.tokens.dai
      .connect(core.hhUser2)
      .transfer(core.testEcosystem!.testExchangeWrapper.address, parseEther('1000'));

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
       *     liquid account weth = 1 - 1 = 0
       *     solid account dai = 945
       *     solid account weth = -1
       *
       * After trade action where solid account swaps 945 dai for 1.1 weth:
       *     solid account dai = 0
       *     solid account weth = .1
       */
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, parseEther('0'));
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, parseEther('55'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, parseEther('.1'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, parseEther('0'));
    });

    it('should work normally with 2 trades', async () => {
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
        parseEther('900'),
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
       *     liquid account weth = 1 - 1 = 0
       *     solid account dai = 945
       *     solid account weth = -1
       *
       * After trade action where solid account swaps 945 dai for 1.1 weth:
       *     solid account dai = 0
       *     solid account weth = .1
       */
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, parseEther('0'));
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, parseEther('55'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, parseEther('.1'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, parseEther('45'));
    });

    it('should work normally with isolation mode', async () => {
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
       */
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.dArb, parseEther('7.4'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, parseEther('.1'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dArb, ZERO_BI);
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
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, parseEther('527.5'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, parseEther('.6'));
      // @follow-up @Corey, this is -1 I think because of rounding issues
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, -1);
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
        parseEther('1.1'),
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
       * After liquidation action:
       *     liquid account dai = 1000 - 945 = 55
       *     liquid account weth = 1 - 1 = 0
       *     solid account dai = 945
       *     solid account weth = -1
       *
       * After trade action where solid account swaps 945 dai for 1.1 weth:
       *     solid account dai = 0
       *     solid account weth = .1
       */
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, parseEther('0'));
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, parseEther('55'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
      await expectWalletBalance(core.hhUser2, core.tokens.weth, parseEther('.1'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, parseEther('0'));
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

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('900'));
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
       * owedPrice = $900
       * owedPriceAdj = 900 + .05(900) = $945
       *
       * After liquidation action:
       *     liquid account dai = 1000 - 945 = 55
       *     liquid account weth = 1 - 1 = 0
       *     solid account dai = 945
       *     solid account weth = -1
       *
       * After trade action where solid account swaps 945 dai for 1.1 weth:
       *     solid account dai = 0
       *     solid account weth = .1
       */
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, parseEther('0'));
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, parseEther('55'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, parseEther('5'));
      await expectWalletBalance(core.hhUser2, core.tokens.weth, parseEther('.1'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, parseEther('0'));
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

    it('should work normally if called from local operator of solid account', async () => {
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
      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('900'));
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

      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, parseEther('0'));
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, parseEther('55'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, parseEther('.1'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, parseEther('0'));
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
        parseEther('1'),
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
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, daiAmount);
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.weth, parseEther('0'));
      await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.dai, ZERO_BI);
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
        `BaseLiquidatorProxy: Owed market equals held market <${core.marketIds.dai.toString()}>`,
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
        `BaseLiquidatorProxy: Owed market cannot be positive <${core.marketIds.weth.toString()}>`,
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
        `BaseLiquidatorProxy: Held market cannot be negative <${core.marketIds.usdt.toString()}>`,
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
        `BaseLiquidatorProxy: Expiration timestamp overflows <${MAX_UINT_256_BI.toString()}>`,
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
        `BaseLiquidatorProxy: Borrow not yet expired <${futureTimestamp.toString()}>`,
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
        `BaseLiquidatorProxy: Sender not operator <${core.hhUser3.address.toLowerCase()}>`,
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
        'BaseLiquidatorProxy: Expiration timestamp mismatch <0, 1>',
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
        'ReentrancyGuard: reentrant call',
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
        'GenericTraderProxyBase: Invalid market path length',
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
        `HasLiquidatorRegistry: Asset has nothing whitelisted <${core.marketIds.weth}>`,
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
        'ReentrancyGuard: reentrant call',
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
