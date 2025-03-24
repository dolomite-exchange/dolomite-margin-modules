import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  DolomiteAccountRiskOverrideSetter,
  DolomiteAccountRiskOverrideSetter__factory,
} from '../../src/types';
import { createContractWithAbi, depositIntoDolomiteMargin } from '../../src/utils/dolomite-utils';
import { Network, ONE_ETH_BI, ZERO_BI } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import {
  setupCoreProtocol,
  setupHONEYBalance,
  setupRsEthBalance,
  setupSolvBtcBalance,
  setupWBTCBalance,
  setupWETHBalance
} from '../utils/setup';
import { CoreProtocolBerachain } from '../utils/core-protocols/core-protocol-berachain';
import { expectThrow } from '../utils/assertions';
import { defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src';

const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from(123);
const singleCollateralRiskStruct = 'tuple(uint256[] debtMarketIds,tuple(uint256 value) marginRatioOverride,tuple(uint256 value) liquidationRewardOverride)[] riskStruct';

const usdcOneDollar = BigNumber.from('1000000000000000000000000000000');
const wbtcHundredThousand = BigNumber.from('1000000000000000000000000000000000');

const usdcAmount = BigNumber.from('100000000');
const wbtcAmount = BigNumber.from('100000000');

enum Category {
  NONE,
  BERA,
  BTC,
  ETH,
  STABLE,
}

enum RiskFeature {
  NONE,
  BORROW_ONLY,
  SINGLE_COLLATERAL_WITH_STRICT_DEBT,
}

enum CategoryMask {
  BERA = 0x000F,
  BTC = 0x00F0,
  ETH = 0x0F00,
  STABLE = 0xF000,
}

describe('DolomiteAccountRiskOverrideSetter', () => {
  let snapshotId: string;
  let core: CoreProtocolBerachain;
  let riskOverrideSetter: DolomiteAccountRiskOverrideSetter;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Berachain,
      blockNumber: 1_130_000,
    });

    riskOverrideSetter = await createContractWithAbi<DolomiteAccountRiskOverrideSetter>(
      DolomiteAccountRiskOverrideSetter__factory.abi,
      DolomiteAccountRiskOverrideSetter__factory.bytecode,
      [core.dolomiteMargin.address],
    );

    await riskOverrideSetter.connect(core.governance).ownerSetCategoriesByMarketIds(
      [core.marketIds.usdt, core.marketIds.usdc, core.marketIds.honey],
      [Category.STABLE, Category.STABLE, Category.STABLE]
    );
    await riskOverrideSetter.connect(core.governance).ownerSetCategoryParam(
      Category.STABLE,
      { value: parseEther('.03') },
      { value: parseEther('.001') }
    );

    await riskOverrideSetter.connect(core.governance).ownerSetCategoriesByMarketIds(
      [core.marketIds.weth, core.marketIds.rsEth, core.marketIds.weEth],
      [Category.ETH, Category.ETH, Category.ETH]
    );
    await riskOverrideSetter.connect(core.governance).ownerSetCategoryParam(
      Category.ETH,
      { value: parseEther('.05') },
      { value: parseEther('.001') }
    );

    await riskOverrideSetter.connect(core.governance).ownerSetCategoriesByMarketIds(
      [core.marketIds.wbtc, core.marketIds.eBtc],
      [Category.BTC, Category.BTC]
    );
    await riskOverrideSetter.connect(core.governance).ownerSetCategoryParam(
      Category.BTC,
      { value: parseEther('.1') },
      { value: parseEther('.001') }
    );

    await core.dolomiteMargin.ownerSetDefaultAccountRiskOverride(riskOverrideSetter.address);
    expect(await core.dolomiteMargin.getDefaultAccountRiskOverrideSetter()).to.eq(riskOverrideSetter.address);
    await riskOverrideSetter.connect(core.governance).ownerActivateDefaultAccountCheck();

    const riskStruct = {
      debtMarketIds: [core.marketIds.nect],
      marginRatioOverride: { value: parseEther('.5') },
      liquidationRewardOverride: { value: parseEther('.01') },
    };
    const extraData = defaultAbiCoder.encode(
      [singleCollateralRiskStruct],
      [[riskStruct]],
    );
    await riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
      core.marketIds.solvBtc,
      RiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT,
      extraData,
    );

    await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.honey.address, parseEther('1'));
    await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(
      core.marketIds.honey,
      core.testEcosystem!.testPriceOracle.address
    );
    await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.usdc.address, usdcOneDollar);
    await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(
      core.marketIds.usdc,
      core.testEcosystem!.testPriceOracle.address
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await riskOverrideSetter.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });
  });

  describe('#integration', () => {
    it('should work normally with stable collateral and random debt', async () => {
      const amount = parseEther('1000');
      await setupHONEYBalance(core, core.hhUser1, amount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.honey, amount);

      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('1000'));
      await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(
        core.marketIds.weth,
        core.testEcosystem!.testPriceOracle.address
      );

      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.weth,
        parseEther('.70'),
        BalanceCheckFlag.None
      );
    });

    it('should work normally with stable collateral and stable debt', async () => {
      const amount = parseEther('1000');
      await setupHONEYBalance(core, core.hhUser1, amount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.honey, amount);

      // require margin = x * .03 + x = 1000
      // x = 970.873...
      await core.borrowPositionProxyV2.connect(core.hhUser1).callStatic.transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        BigNumber.from('970000000'), // 970 usdc
        BalanceCheckFlag.None
      );

      await expectThrow(
        core.borrowPositionProxyV2.connect(core.hhUser1).callStatic.transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.usdc,
          BigNumber.from('971000000'), // 971 usdc
          BalanceCheckFlag.None
        ),
        `OperationImpl: Undercollateralized account <${core.hhUser1.address.toLowerCase()}, ${borrowAccountNumber.toString()}>`
      );
    });

    it('should work normally with eth category', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetMaxSupplyWei(core.marketIds.rsEth, 0);
      await setupWETHBalance(core, core.hhUser1, ONE_ETH_BI, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, ONE_ETH_BI);
      await setupRsEthBalance(core, core.hhUser1, ONE_ETH_BI, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.rsEth, ONE_ETH_BI);

      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weth.address, parseEther('1000'));
      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weEth.address, parseEther('1000'));
      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.rsEth.address, parseEther('1000'));
      await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(
        core.marketIds.weth,
        core.testEcosystem!.testPriceOracle.address
      );
      await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(
        core.marketIds.weEth,
        core.testEcosystem!.testPriceOracle.address
      );
      await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(
        core.marketIds.rsEth,
        core.testEcosystem!.testPriceOracle.address
      );

      // require margin = x * .05 + x = 2000
      // x = 1.90476 weEth
      await core.borrowPositionProxyV2.connect(core.hhUser1).callStatic.transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.weEth,
        parseEther('1.9047'),
        BalanceCheckFlag.None
      );

      await expectThrow(
        core.borrowPositionProxyV2.connect(core.hhUser1).callStatic.transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weEth,
          parseEther('1.9048'),
          BalanceCheckFlag.None
        ),
        `OperationImpl: Undercollateralized account <${core.hhUser1.address.toLowerCase()}, ${borrowAccountNumber.toString()}>`
      );
    });

    it('should work normally with btc category', async () => {
      await setupWBTCBalance(core, core.hhUser1, wbtcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbtc, wbtcAmount);

      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.wbtc.address, wbtcHundredThousand);
      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.eBtc.address, wbtcHundredThousand);
      await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(
        core.marketIds.wbtc,
        core.testEcosystem!.testPriceOracle.address
      );
      await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(
        core.marketIds.eBtc,
        core.testEcosystem!.testPriceOracle.address
      );

      // require margin = x * .1 + x = 1 BTC
      // x = 0.90909 eBTC
      await core.borrowPositionProxyV2.connect(core.hhUser1).callStatic.transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.eBtc,
        BigNumber.from('90900000'), // 0.9090 eBTC
        BalanceCheckFlag.None
      );

      await expectThrow(
        core.borrowPositionProxyV2.connect(core.hhUser1).callStatic.transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.eBtc,
        BigNumber.from('90910000'), // 0.9091 eBTC
          BalanceCheckFlag.None
        ),
        `OperationImpl: Undercollateralized account <${core.hhUser1.address.toLowerCase()}, ${borrowAccountNumber.toString()}>`
      );
    });

    it('should work normally with solvBtc risk feature', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetMaxSupplyWei(core.marketIds.solvBtc, 0);
      await core.dolomiteMargin.connect(core.governance).ownerSetMaxBorrowWei(core.marketIds.nect, 0);
      await core.dolomiteMargin.connect(core.governance).ownerSetMaxSupplyWei(core.marketIds.nect, 0);
      await core.dolomiteMargin.connect(core.governance).ownerSetIsClosing(core.marketIds.nect, false);
      await setupSolvBtcBalance(core, core.hhUser1, ONE_ETH_BI, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.solvBtc, ONE_ETH_BI);

      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.solvBtc.address, parseEther('100000'));
      await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(
        core.marketIds.solvBtc,
        core.testEcosystem!.testPriceOracle.address
      );
      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.nect.address, ONE_ETH_BI);
      await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(
        core.marketIds.nect,
        core.testEcosystem!.testPriceOracle.address
      );

      // require margin = .5x + x = 100,000
      // x = 66,666.66
      await core.borrowPositionProxyV2.connect(core.hhUser1).callStatic.transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.nect,
        parseEther('66666.6'),
        BalanceCheckFlag.None
      );

      await expectThrow(
        core.borrowPositionProxyV2.connect(core.hhUser1).callStatic.transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.nect,
          parseEther('66666.7'),
          BalanceCheckFlag.None
        ),
        `OperationImpl: Undercollateralized account <${core.hhUser1.address.toLowerCase()}, ${borrowAccountNumber.toString()}>`
      );

      await expectThrow(
        core.borrowPositionProxyV2.connect(core.hhUser1).callStatic.transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.usdc,
          usdcAmount,
          BalanceCheckFlag.None
        ),
        'AccountRiskOverrideSetter: Could not find risk param'
      );
    });
  });
});
