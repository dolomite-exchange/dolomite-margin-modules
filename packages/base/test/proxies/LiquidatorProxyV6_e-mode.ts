import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { TestLiquidatorProxyV6, TestLiquidatorProxyV6__factory } from 'packages/base/src/types';
import {
  createContractWithAbi,
  createContractWithLibrary,
  createContractWithName,
  depositIntoDolomiteMargin,
} from 'packages/base/src/utils/dolomite-utils';
import { MAX_UINT_256_BI, Network, ONE_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectProtocolBalance, expectWalletBalance } from '../utils/assertions';
import { createAndUpgradeDolomiteRegistry } from '../utils/dolomite';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupHONEYBalance,
  setupUSDCBalance,
} from '../utils/setup';
import {
  getSimpleZapParams,
} from '../utils/zap-utils';
import { UpgradeableProxy__factory } from '@dolomite-exchange/modules-liquidity-mining/src/types';
import { CoreProtocolBerachain } from '../utils/core-protocols/core-protocol-berachain';

const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from('123');

const usdcOneDollar = BigNumber.from('1000000000000000000000000000000'); // $1

const usdcAmount = BigNumber.from('1000000000'); // $1000
const honeyAmount = parseEther('900');

describe('LiquidatorProxyV6_e-mode', () => {

  let snapshotId: string;
  let core: CoreProtocolBerachain;
  let liquidatorProxy: TestLiquidatorProxyV6;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Berachain,
      blockNumber: 15_305_000,
    });

    await createAndUpgradeDolomiteRegistry(core);
    await disableInterestAccrual(core, core.marketIds.honey);
    await disableInterestAccrual(core, core.marketIds.usdc);

    await core.dolomiteRegistry.connect(core.governance).ownerSetFeeAgent(core.hhUser5.address);

    const liquidatorProxyLib = await createContractWithName('LiquidatorProxyLib', []);
    const genericTraderLib = await createContractWithName('GenericTraderProxyV2Lib', []);
    const liquidatorProxyImplementation = await createContractWithLibrary(
      'TestLiquidatorProxyV6',
      { GenericTraderProxyV2Lib: genericTraderLib.address, LiquidatorProxyLib: liquidatorProxyLib.address },
      [
        Network.Berachain,
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

    await setupHONEYBalance(core, core.hhUser2, parseEther('1000'), core.dolomiteMargin);
    await core.tokens.honey
      .connect(core.hhUser2)
      .transfer(core.testEcosystem!.testExchangeWrapper.address, parseEther('1000'));

    await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.usdc.address, usdcOneDollar);
    await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.honey.address, parseEther('1'));
    await core.dolomiteMargin
      .connect(core.governance)
      .ownerSetPriceOracle(core.marketIds.honey, core.testEcosystem!.testPriceOracle.address);
    await core.dolomiteMargin
      .connect(core.governance)
      .ownerSetPriceOracle(core.marketIds.usdc, core.testEcosystem!.testPriceOracle.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#liquidate', () => {
    it('should work normally to partially liquidate if user is in e-mode', async () => {
      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.usdc, usdcAmount);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.honey,
          honeyAmount,
          BalanceCheckFlag.None,
        );

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.honey.address, parseEther('1.05'));
      const zapParams = await getSimpleZapParams(
        core.marketIds.usdc,
        MAX_UINT_256_BI,
        core.marketIds.honey,
        parseEther('460'),
        core,
      );
      await liquidatorProxy.connect(core.hhUser2).liquidate({
        solidAccount: { owner: core.hhUser2.address, number: borrowAccountNumber },
        liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: MAX_UINT_256_BI,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        expirationTimestamp: ZERO_BI,
        withdrawAllReward: false,
      }, { gasLimit: 50000000 });

      /*
       * collateral ratio = 111.11%
       * health factor = ratio / 111% = .95

       * 1000 / x = 1.0555555555
       * owedPriceForFullLiquidation = 947.368 / 900 = $1.0526315789
       *
       * held = 1000 USDC
       * owed = 900 HONEY
       * heldPrice = $1
       * owedPrice = $1.05
       * owedPriceAdj = 1.05 + .04(1.05) = $1.092
       *
       * After liquidation action:
       *     liquid account usdc = 1000 - (450 * 1.092) = 508.6
       *     liquid account honey = -450
       *     rake amount = (450 * 1.092 - 450 * 1.05) * .1 = 1.89
       *     solid account usdc = 491.4 - 1.89 = 489.51
       *     solid account weth = -1
       *     dolomite rake account dai = 1.89
       *
       * After trade action where solid account swaps 489.51 usdc for 460 honey
       *     solid account usdc = 0
       *     solid account honey = 10
       */
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.usdc, BigNumber.from('508600000'));
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.honey, ZERO_BI.sub(parseEther('450')).sub(1));
      await expectProtocolBalance(core, core.hhUser2, borrowAccountNumber, core.marketIds.usdc, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser2, borrowAccountNumber, core.marketIds.honey, parseEther('10'));
      await expectProtocolBalance(core, core.hhUser5, defaultAccountNumber, core.marketIds.usdc, BigNumber.from('1890000'));
      await expectWalletBalance(core.testEcosystem!.testExchangeWrapper.address, core.tokens.usdc, BigNumber.from('489510000'));
    });

    it('should work normally to fully liquidate if user is in e-mode and below partial threshold', async () => {
      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.usdc, usdcAmount);
      await core.borrowPositionProxyV2
        .connect(core.hhUser1)
        .transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.honey,
          honeyAmount,
          BalanceCheckFlag.None,
        );

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.honey.address, parseEther('1.06'));
      const zapParams = await getSimpleZapParams(
        core.marketIds.usdc,
        MAX_UINT_256_BI,
        core.marketIds.honey,
        parseEther('920'),
        core,
      );
      await liquidatorProxy.connect(core.hhUser2).liquidate({
        solidAccount: { owner: core.hhUser2.address, number: borrowAccountNumber },
        liquidAccount: { owner: core.hhUser1.address, number: borrowAccountNumber },
        marketIdsPath: zapParams.marketIdsPath,
        inputAmountWei: zapParams.inputAmountWei,
        minOutputAmountWei: MAX_UINT_256_BI,
        tradersPath: zapParams.tradersPath,
        makerAccounts: zapParams.makerAccounts,
        expirationTimestamp: ZERO_BI,
        withdrawAllReward: false,
      }, { gasLimit: 50000000 });

      /*
       * collateral ratio = 111.11%
       * health factor = ratio / 111% = .95

       * 1000 / x = 1.0555555555
       * owedPriceForFullLiquidation = 947.368 / 900 = $1.0526315789
       *
       * held = 1000 USDC
       * owed = 900 HONEY
       * heldPrice = $1
       * owedPrice = $1.06
       * owedPriceAdj = 1.06 + .04(1.06) = $1.1024
       *
       * After liquidation action:
       *     liquid account usdc = 1000 - (900 * 1.1024) = 7.84
       *     liquid account honey = 0
       *     rake amount = (900 * 1.1024 - 900 * 1.06) * .1 = 3.816
       *     solid account usdc = 992.16 - 3.816 = 988.344
       *     solid account weth = -900
       *     dolomite rake account dai = 3.816
       *
       * After trade action where solid account swaps 992.16 usdc for 920 honey
       *     solid account usdc = 0
       *     solid account honey = 20
       */
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.usdc, BigNumber.from('7840000'));
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.honey, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser2, borrowAccountNumber, core.marketIds.usdc, ONE_BI);
      await expectProtocolBalance(core, core.hhUser2, borrowAccountNumber, core.marketIds.honey, parseEther('20').sub(1));
      await expectProtocolBalance(core, core.hhUser5, defaultAccountNumber, core.marketIds.usdc, BigNumber.from('3816000'));
      await expectWalletBalance(core.testEcosystem!.testExchangeWrapper.address, core.tokens.usdc, BigNumber.from('988344000').add(1));
    });
  });
});
