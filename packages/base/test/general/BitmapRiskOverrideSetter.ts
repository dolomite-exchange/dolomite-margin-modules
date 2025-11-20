import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import hre from 'hardhat';
import {
  BitmapRiskOverrideSetter,
  BitmapRiskOverrideSetter__factory,
  RegistryProxy,
  RegistryProxy__factory,
} from '../../src/types';
import { AccountRiskOverrideRiskFeature, getRegistryProxyConstructorParams } from '../../src/utils/constructors/dolomite';
import { createContractWithAbi, depositIntoDolomiteMargin } from '../../src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from '../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../utils';
import {
  setupCoreProtocol,
  setupHONEYBalance,
  setupUSDCBalance,
  setupWBERABalance,
  setupWBTCBalance,
  setupWETHBalance,
} from '../utils/setup';
import { CoreProtocolBerachain } from '../utils/core-protocols/core-protocol-berachain';
import { expectEvent, expectThrow } from '../utils/assertions';
import { parseEther } from 'ethers/lib/utils';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';

const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from(123);

const usdcAmount = BigNumber.from('100000000');
const wberaAmount = parseEther('100');
const honeyAmount = parseEther('100');
const wbtcAmount = BigNumber.from('100000000');

enum Category {
  NONE,
  BERA,
  BTC,
  ETH,
  STABLE,
}

describe('RiskOverride Gas Comparisons (Berachain)', () => {
  let snapshotId: string;
  let core: CoreProtocolBerachain;
  let riskOverrideSetter: BitmapRiskOverrideSetter;

  before(async () => {
    hre.tracer.gasCost = true;
    hre.tracer.enabled = false;
    core = await setupCoreProtocol({
      network: Network.Berachain,
      blockNumber: 13_317_000,
    });

    const riskOverrideSetterImplementation = await createContractWithAbi<BitmapRiskOverrideSetter>(
      BitmapRiskOverrideSetter__factory.abi,
      BitmapRiskOverrideSetter__factory.bytecode,
      [core.dolomiteMargin.address],
    );

    const calldata = (await riskOverrideSetterImplementation.populateTransaction.initialize()).data!;
    const proxy = await createContractWithAbi<RegistryProxy>(
      RegistryProxy__factory.abi,
      RegistryProxy__factory.bytecode,
      getRegistryProxyConstructorParams(riskOverrideSetterImplementation.address, calldata, core.dolomiteMargin),
    );
    riskOverrideSetter = BitmapRiskOverrideSetter__factory.connect(proxy.address, core.hhUser1);

    await setupCurrentRiskParameters(riskOverrideSetter, core);


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

  describe('#getAccountRiskOverride', () => {
    it.only('legacy: should work normally to supply eth and borrow usdc', async () => {
      await setupWETHBalance(core, core.hhUser1, ONE_ETH_BI, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, ONE_ETH_BI);

      hre.tracer.enabled = true;
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcAmount,
        BalanceCheckFlag.None,
        { gasLimit: 5_000_000 }
      ); // 34765
      hre.tracer.enabled = false;
    });

    it.only('should work normally to supply eth and borrow usdc', async () => {
      await core.dolomiteMargin.ownerSetDefaultAccountRiskOverride(riskOverrideSetter.address);

      await setupWETHBalance(core, core.hhUser1, ONE_ETH_BI, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, ONE_ETH_BI);

      hre.tracer.enabled = true;
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcAmount,
        BalanceCheckFlag.None,
        { gasLimit: 5_000_000 }
      ); // 57210
      hre.tracer.enabled = false;
    });

    it('legacy: should work to supply srUsd and borrow rUsd', async () => {
      const srUsdWhale = await impersonate('0xe280a6F5434292ef7Ea0a84f7096A0050e18C8D1', true);
      await core.tokens.srUsd.connect(srUsdWhale).transfer(core.hhUser1.address, parseEther('100'));
      await core.tokens.srUsd.connect(core.hhUser1).approve(core.dolomiteMargin.address, parseEther('100'));
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.srUsd, parseEther('100'));

      hre.tracer.enabled = true;
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.rUsd,
        parseEther('50'),
        BalanceCheckFlag.None,
        { gasLimit: 5_000_000 }
      ); // 1022245
      hre.tracer.enabled = false;
    });

    it('should work to supply srUsd and borrow rUsd', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetDefaultAccountRiskOverride(riskOverrideSetter.address);

      const srUsdWhale = await impersonate('0xe280a6F5434292ef7Ea0a84f7096A0050e18C8D1', true);
      await core.tokens.srUsd.connect(srUsdWhale).transfer(core.hhUser1.address, parseEther('100'));
      await core.tokens.srUsd.connect(core.hhUser1).approve(core.dolomiteMargin.address, parseEther('100'));
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.srUsd, parseEther('100'));

      hre.tracer.enabled = true;
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.rUsd,
        parseEther('50'),
        BalanceCheckFlag.None,
        { gasLimit: 5_000_000 }
      ); // 58958
      hre.tracer.enabled = false;
    });

    it('legacy: should work to supply srUsd and borrow usdc', async () => {
      const srUsdWhale = await impersonate('0xe280a6F5434292ef7Ea0a84f7096A0050e18C8D1', true);
      await core.tokens.srUsd.connect(srUsdWhale).transfer(core.hhUser1.address, parseEther('100'));
      await core.tokens.srUsd.connect(core.hhUser1).approve(core.dolomiteMargin.address, parseEther('100'));
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.srUsd, parseEther('100'));

      hre.tracer.enabled = true;
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        50_000_000,
        BalanceCheckFlag.None,
        { gasLimit: 5_000_000 }
      ); // 94198
      hre.tracer.enabled = false;
    });

    it('should work to supply srUsd and borrow usdc', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetDefaultAccountRiskOverride(riskOverrideSetter.address);

      const srUsdWhale = await impersonate('0xe280a6F5434292ef7Ea0a84f7096A0050e18C8D1', true);
      await core.tokens.srUsd.connect(srUsdWhale).transfer(core.hhUser1.address, parseEther('100'));
      await core.tokens.srUsd.connect(core.hhUser1).approve(core.dolomiteMargin.address, parseEther('100'));
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.srUsd, parseEther('100'));

      hre.tracer.enabled = true;
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        50_000_000,
        BalanceCheckFlag.None,
        { gasLimit: 5_000_000 }
      ); // 58722
    });

    it('legacy: should work to supply USDC and borrow honey and usdt', async () => {
      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.usdc, usdcAmount);

      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.honey,
        ONE_BI,
        BalanceCheckFlag.None,
        { gasLimit: 5_000_000 }
      );
      hre.tracer.enabled = true;
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdt,
        ONE_BI,
        BalanceCheckFlag.None,
        { gasLimit: 5_000_000 }
      ); // 46649
      hre.tracer.enabled = false;
    });

    it('should work to supply USDC and borrow honey and usdt', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetDefaultAccountRiskOverride(riskOverrideSetter.address);
      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.usdc, usdcAmount);

      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.honey,
        ONE_BI,
        BalanceCheckFlag.None,
        { gasLimit: 5_000_000 }
      );
      hre.tracer.enabled = true;
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdt,
        ONE_BI,
        BalanceCheckFlag.None,
        { gasLimit: 5_000_000 }
      ); // 67445
      hre.tracer.enabled = false;
    });

    it('should fail if user has borrow only as collateral', async () => {
      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.usdc, usdcAmount);

      const borrowOnlyBitmap = createBitmap([core.marketIds.usdc]);
      await riskOverrideSetter.connect(core.governance).ownerSetBorrowOnlyBitmap(borrowOnlyBitmap);

      await expectThrow(
        core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.wbera,
          ONE_ETH_BI,
          BalanceCheckFlag.None
        ),
        'BitmapRiskOverrideSetter: Using borrow only collateral',
      );
    });

    it('legacy: should fail if user has borrow only as collateral', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetDefaultAccountRiskOverride(core.dolomiteAccountRiskOverrideSetter.address);
      await core.dolomiteAccountRiskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
        core.marketIds.usdc,
        AccountRiskOverrideRiskFeature.BORROW_ONLY,
        BYTES_EMPTY,
      );

      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.usdc, usdcAmount);

      await expectThrow(
        core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.wbera,
          ONE_ETH_BI,
          BalanceCheckFlag.None
        ),
        'AccountRiskOverrideSetter: Market is borrow only <2>',
      );
    });
  });
});

// Helper function to create bitmap from market IDs
function createBitmap(marketIds: BigNumberish[]): BigNumber {
  let bitmap = ZERO_BI;

  for (const id of marketIds) {
    const pos = BigNumber.from(id).toNumber();
    bitmap = bitmap.or(ONE_BI.shl(pos));
  }

  return bitmap;
}

async function setupCurrentRiskParameters(
  riskOverrideSetter: BitmapRiskOverrideSetter,
  core: CoreProtocolBerachain,
): Promise<void> {
  // Set up all categories as per latest Berachain safe transactions
  // BERA category: wbera, iBera, oriBgt, sWbera
  const beraBitmap = createBitmap([
    core.marketIds.wbera,
    core.marketIds.iBera,
    core.marketIds.diBgt,
    core.marketIds.oriBgt,
    core.marketIds.sWbera,
  ]);
  await riskOverrideSetter.connect(core.governance).ownerSetCategoryStruct(
    Category.BERA,
    beraBitmap,
    { value: parseEther('0.20') }, // TargetCollateralization._120
    { value: parseEther('0.07') }, // TargetLiquidationPenalty._7
  );

  // BTC category: eBtc, lbtc, wbtc
  const btcBitmap = createBitmap([
    core.marketIds.eBtc,
    core.marketIds.lbtc,
    core.marketIds.wbtc,
  ]);
  await riskOverrideSetter.connect(core.governance).ownerSetCategoryStruct(
    Category.BTC,
    btcBitmap,
    { value: parseEther('0.111111111111111111') }, // TargetCollateralization._111
    { value: parseEther('0.04') }, // TargetLiquidationPenalty._4
  );

  // ETH category: beraEth, stone, weth, weEth
  const ethBitmap = createBitmap([
    core.marketIds.beraEth,
    core.marketIds.stone,
    core.marketIds.weth,
    core.marketIds.weEth,
  ]);
  await riskOverrideSetter.connect(core.governance).ownerSetCategoryStruct(
    Category.ETH,
    ethBitmap,
    { value: parseEther('0.111111111111111111') }, // TargetCollateralization._111
    { value: parseEther('0.04') }, // TargetLiquidationPenalty._4
  );

  // STABLE category: honey, nect, sUsde, usdc, usde, usdt, rUsd, usda, byusd
  const stableBitmap = createBitmap([
    core.marketIds.honey,
    core.marketIds.nect,
    core.marketIds.sUsde,
    core.marketIds.usdc,
    core.marketIds.usde,
    core.marketIds.usdt,
    core.marketIds.rUsd,
    core.marketIds.usda,
    core.marketIds.byusd,
  ]);
  await riskOverrideSetter.connect(core.governance).ownerSetCategoryStruct(
    Category.STABLE,
    stableBitmap,
    { value: parseEther('0.111111111111111111') }, // TargetCollateralization._111
    { value: parseEther('0.04') }, // TargetLiquidationPenalty._4
  );

  // Set active categories
  await riskOverrideSetter.connect(core.governance).ownerSetActiveCategories([
    Category.BERA,
    Category.BTC,
    Category.ETH,
    Category.STABLE,
  ]);

  // Set borrow-only bitmap (assets that can only be borrowed, not used as collateral)
  // Based on safe transactions: 108, 110, 114, 147, 363, 389, 497
  const borrowOnlyBitmap = createBitmap([
    core.marketIds.rUsd,
    core.marketIds.nect,
    core.marketIds.usda,
    core.marketIds.ylFbtc,
    core.marketIds.ylPumpBtc,
    core.marketIds.ylStEth,
    core.marketIds.stBtc,
    core.marketIds.deUsd,
    core.marketIds.sdeUsd,
    core.marketIds.pumpBtc,
  ]);
  await riskOverrideSetter.connect(core.governance).ownerSetBorrowOnlyBitmap(borrowOnlyBitmap);

  // Set single collateral strict debt configurations
  // Based on latest safe transactions: 579 (most recent), 116, 110, 108, 143, 358
  // Stablecoins: honey, nect, sUsde, usdc, usde, usdt, rUsd, usda, byusd
  const stablecoins = [
    core.marketIds.honey,
    core.marketIds.nect,
    core.marketIds.sUsde,
    core.marketIds.usdc,
    core.marketIds.usde,
    core.marketIds.usdt,
    core.marketIds.rUsd,
    core.marketIds.usda,
    core.marketIds.byusd,
  ];
  const stablecoinsExcludingRUsd = stablecoins.filter((id) => !BigNumber.from(id).eq(core.marketIds.rUsd));

  // polRUsd: rUsd (105%, 2%) or other stables (109%, 4%)
  await riskOverrideSetter.connect(core.governance).ownerSetSingleCollateralStrictDebt(
    core.marketIds.polRUsd,
    {
      set: true,
      specificDebts: [
        {
          debtBitmap: createBitmap([core.marketIds.rUsd]),
          marginRatioOverride: { value: parseEther('0.052631578947368421') }, // TargetCollateralization._105
          liquidationRewardOverride: { value: parseEther('0.02') }, // TargetLiquidationPenalty._2
        },
        {
          debtBitmap: createBitmap(stablecoinsExcludingRUsd),
          marginRatioOverride: { value: parseEther('0.098901098901098901') }, // TargetCollateralization._109
          liquidationRewardOverride: { value: parseEther('0.04') }, // TargetLiquidationPenalty._4
        },
      ],
    },
  );

  // solvBtc: stablecoins (133%, 10%) or wbtc (111%, 5%)
  await riskOverrideSetter.connect(core.governance).ownerSetSingleCollateralStrictDebt(
    core.marketIds.solvBtc,
    {
      set: true,
      specificDebts: [
        {
          debtBitmap: createBitmap(stablecoins),
          marginRatioOverride: { value: parseEther('0.33') }, // TargetCollateralization._133
          liquidationRewardOverride: { value: parseEther('0.10') }, // TargetLiquidationPenalty._10
        },
        {
          debtBitmap: createBitmap([core.marketIds.wbtc]),
          marginRatioOverride: { value: parseEther('0.111111111111111111') }, // TargetCollateralization._111
          liquidationRewardOverride: { value: parseEther('0.05') }, // TargetLiquidationPenalty._5
        },
      ],
    },
  );

  // srUsd: other stables (109%, 4%) or rUsd (105%, 2%)
  await riskOverrideSetter.connect(core.governance).ownerSetSingleCollateralStrictDebt(
    core.marketIds.srUsd,
    {
      set: true,
      specificDebts: [
        {
          debtBitmap: createBitmap(stablecoinsExcludingRUsd),
          marginRatioOverride: { value: parseEther('0.098901098901098901') }, // TargetCollateralization._109
          liquidationRewardOverride: { value: parseEther('0.04') }, // TargetLiquidationPenalty._4
        },
        {
          debtBitmap: createBitmap([core.marketIds.rUsd]),
          marginRatioOverride: { value: parseEther('0.052631578947368421') }, // TargetCollateralization._105
          liquidationRewardOverride: { value: parseEther('0.02') }, // TargetLiquidationPenalty._2
        },
      ],
    },
  );

  // uniBtc: stablecoins (133%, 10%) or wbtc (111%, 5%)
  await riskOverrideSetter.connect(core.governance).ownerSetSingleCollateralStrictDebt(
    core.marketIds.uniBtc,
    {
      set: true,
      specificDebts: [
        {
          debtBitmap: createBitmap(stablecoins),
          marginRatioOverride: { value: parseEther('0.33') }, // TargetCollateralization._133
          liquidationRewardOverride: { value: parseEther('0.10') }, // TargetLiquidationPenalty._10
        },
        {
          debtBitmap: createBitmap([core.marketIds.wbtc]),
          marginRatioOverride: { value: parseEther('0.111111111111111111') }, // TargetCollateralization._111
          liquidationRewardOverride: { value: parseEther('0.05') }, // TargetLiquidationPenalty._5
        },
      ],
    },
  );

  // xSolvBtc: stablecoins (133%, 10%) or solvBtc+wbtc (111%, 5%)
  await riskOverrideSetter.connect(core.governance).ownerSetSingleCollateralStrictDebt(
    core.marketIds.xSolvBtc,
    {
      set: true,
      specificDebts: [
        {
          debtBitmap: createBitmap(stablecoins),
          marginRatioOverride: { value: parseEther('0.33') }, // TargetCollateralization._133
          liquidationRewardOverride: { value: parseEther('0.10') }, // TargetLiquidationPenalty._10
        },
        {
          debtBitmap: createBitmap([core.marketIds.solvBtc, core.marketIds.wbtc]),
          marginRatioOverride: { value: parseEther('0.111111111111111111') }, // TargetCollateralization._111
          liquidationRewardOverride: { value: parseEther('0.05') }, // TargetLiquidationPenalty._5
        },
      ],
    },
  );

  // sUsda: usda (105%, 2%)
  await riskOverrideSetter.connect(core.governance).ownerSetSingleCollateralStrictDebt(
    core.marketIds.sUsda,
    {
      set: true,
      specificDebts: [
        {
          debtBitmap: createBitmap([core.marketIds.usda]),
          marginRatioOverride: { value: parseEther('0.052631578947368421') }, // TargetCollateralization._105
          liquidationRewardOverride: { value: parseEther('0.02') }, // TargetLiquidationPenalty._2
        },
      ],
    },
  );

  // henlo: stablecoins (166%, 15%) or wbera (166%, 15%)
  await riskOverrideSetter.connect(core.governance).ownerSetSingleCollateralStrictDebt(
    core.marketIds.henlo,
    {
      set: true,
      specificDebts: [
        {
          debtBitmap: createBitmap(stablecoins),
          marginRatioOverride: { value: parseEther('0.66') }, // TargetCollateralization._166
          liquidationRewardOverride: { value: parseEther('0.15') }, // TargetLiquidationPenalty._15
        },
        {
          debtBitmap: createBitmap([core.marketIds.wbera]),
          marginRatioOverride: { value: parseEther('0.66') }, // TargetCollateralization._166
          liquidationRewardOverride: { value: parseEther('0.15') }, // TargetLiquidationPenalty._15
        },
      ],
    },
  );
}
