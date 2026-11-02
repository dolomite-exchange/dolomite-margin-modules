import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import {
  BitmapRiskOverrideSetter,
  BitmapRiskOverrideSetter__factory,
  RegistryProxy,
  RegistryProxy__factory,
} from '../../src/types';
import { getRegistryProxyConstructorParams } from '../../src/utils/constructors/dolomite';
import { createContractWithAbi, depositIntoDolomiteMargin } from '../../src/utils/dolomite-utils';
import { Network, ONE_BI, ZERO_BI } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectEvent, expectThrow } from '../utils/assertions';
import { CoreProtocolBerachain } from '../utils/core-protocols/core-protocol-berachain';
import {
  setupCoreProtocol,
  setupWBERABalance,
  setupWETHBalance,
} from '../utils/setup';

const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from(123);

const usdcAmount = BigNumber.from('100000000');
const wberaAmount = parseEther('100');

const marginRatio = { value: parseEther('.1') };
const liquidationReward = { value: parseEther('.05') };

enum Category {
  NONE,
  BERA,
  BTC,
  ETH,
  STABLE,
}

function getBitmap(marketIds: BigNumberish[]): BigNumber {
  return marketIds.reduce<BigNumber>(
    (bitmap, marketId) => bitmap.or(ONE_BI.shl(BigNumber.from(marketId).toNumber())),
    ZERO_BI,
  );
}

describe('BitmapRiskOverrideSetter', () => {

  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let riskOverrideSetter: BitmapRiskOverrideSetter;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Berachain,
      blockNumber: 27_780_000,
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

    await core.dolomiteMargin.connect(core.governance).ownerSetDefaultAccountRiskOverride(riskOverrideSetter.address);

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

  describe('#initialize', () => {
    it('should fail if called again', async () => {
      await expectThrow(
        riskOverrideSetter.connect(core.governance).initialize(),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#ownerSetBorrowOnlyBitmap', () => {
    it('should work normally', async () => {
      const bitmap = getBitmap([core.marketIds.usdc, core.marketIds.honey]);
      const res = await riskOverrideSetter.connect(core.governance).ownerSetBorrowOnlyBitmap(bitmap);
      await expectEvent(riskOverrideSetter, res, 'BorrowOnlyBitmapSet', { bitmap });

      expect(await riskOverrideSetter.getBorrowOnlyBitmap()).to.eq(bitmap);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        riskOverrideSetter.connect(core.hhUser1).ownerSetBorrowOnlyBitmap(getBitmap([core.marketIds.usdc])),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetSingleCollateralStrictDebt', () => {
    it('should work normally', async () => {
      const riskStruct = {
        debtBitmap: getBitmap([core.marketIds.usdc, core.marketIds.honey]),
        marginRatioOverride: marginRatio,
        liquidationRewardOverride: liquidationReward,
      };
      const res = await riskOverrideSetter.connect(core.governance).ownerSetSingleCollateralStrictDebt(
        core.marketIds.wbera, [riskStruct],
      );
      await expectEvent(riskOverrideSetter, res, 'SingleCollateralStrictDebtSet', {
        collateralMarketId: core.marketIds.wbera,
      });
      const expectedEvent = riskOverrideSetter.interface.encodeEventLog('SingleCollateralStrictDebtSet', [
        core.marketIds.wbera, [riskStruct],
      ]);
      const receipt = await res.wait();
      expect(receipt.events?.find(event => event.event === 'SingleCollateralStrictDebtSet')?.data)
        .to.eq(expectedEvent.data);

      expect(await riskOverrideSetter.getSingleCollateralStrictDebtBitmap()).to.eq(getBitmap([core.marketIds.wbera]));
      const result = await riskOverrideSetter.getSingleCollateralStrictDebtSettings(core.marketIds.wbera);
      expect(result).to.have.lengthOf(1);
      expect(result[0].debtBitmap).to.eq(riskStruct.debtBitmap);
      expect(result[0].marginRatioOverride.value).to.eq(marginRatio.value);
      expect(result[0].liquidationRewardOverride.value).to.eq(liquidationReward.value);
    });

    it('should store and emit multiple settings in order', async () => {
      const settings = [
        {
          debtBitmap: getBitmap([core.marketIds.usdc]),
          marginRatioOverride: marginRatio,
          liquidationRewardOverride: liquidationReward,
        },
        {
          debtBitmap: getBitmap([core.marketIds.honey]),
          marginRatioOverride: { value: parseEther('.2') },
          liquidationRewardOverride: { value: parseEther('.03') },
        },
      ];
      const res = await riskOverrideSetter.connect(core.governance).ownerSetSingleCollateralStrictDebt(
        core.marketIds.wbera, settings,
      );
      await expectEvent(riskOverrideSetter, res, 'SingleCollateralStrictDebtSet', {
        collateralMarketId: core.marketIds.wbera,
      });
      const expectedEvent = riskOverrideSetter.interface.encodeEventLog('SingleCollateralStrictDebtSet', [
        core.marketIds.wbera, settings,
      ]);
      const receipt = await res.wait();
      expect(receipt.events?.find(event => event.event === 'SingleCollateralStrictDebtSet')?.data)
        .to.eq(expectedEvent.data);

      const result = await riskOverrideSetter.getSingleCollateralStrictDebtSettings(core.marketIds.wbera);
      expect(result).to.have.lengthOf(settings.length);
      for (let i = 0; i < settings.length; ++i) {
        expect(result[i].debtBitmap).to.eq(settings[i].debtBitmap);
        expect(result[i].marginRatioOverride.value).to.eq(settings[i].marginRatioOverride.value);
        expect(result[i].liquidationRewardOverride.value).to.eq(settings[i].liquidationRewardOverride.value);
      }
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        riskOverrideSetter.connect(core.hhUser1).ownerSetSingleCollateralStrictDebt(
          core.marketIds.wbera,
          [{
            debtBitmap: getBitmap([core.marketIds.usdc]),
            marginRatioOverride: marginRatio,
            liquidationRewardOverride: liquidationReward,
          }]
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetDebtMarketWithStrictCollateral', () => {
    it('should work normally', async () => {
      const collateralBitmap = getBitmap([core.marketIds.wbera, core.marketIds.wbtc]);
      const res = await riskOverrideSetter.connect(core.governance).ownerSetDebtMarketWithStrictCollateral(
        core.marketIds.usdc, collateralBitmap,
      );
      await expectEvent(riskOverrideSetter, res, 'DebtMarketWithStrictCollateralSet', {
        collateralBitmap,
        debtMarketId: core.marketIds.usdc,
      });

      expect(await riskOverrideSetter.getDebtMarketIdToStrictCollateralBitmap(core.marketIds.usdc))
        .to.eq(collateralBitmap);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        riskOverrideSetter.connect(core.hhUser1).ownerSetDebtMarketWithStrictCollateral(
          core.marketIds.usdc, getBitmap([core.marketIds.wbera]),
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerRemoveSingleCollateralStrictDebt', () => {
    it('should work normally', async () => {
      const riskStruct = {
        debtBitmap: getBitmap([core.marketIds.usdc]),
        marginRatioOverride: marginRatio,
        liquidationRewardOverride: liquidationReward,
      };
      await riskOverrideSetter.connect(core.governance).ownerSetSingleCollateralStrictDebt(
        core.marketIds.wbtc, [riskStruct],
      );
      expect(await riskOverrideSetter.getSingleCollateralStrictDebtBitmap()).to.eq(getBitmap([core.marketIds.wbtc]));

      await riskOverrideSetter.connect(core.governance).ownerRemoveSingleCollateralStrictDebt(core.marketIds.wbtc);
      expect(await riskOverrideSetter.getSingleCollateralStrictDebtBitmap()).to.eq(ZERO_BI);
      await expectThrow(riskOverrideSetter.getSingleCollateralStrictDebtSettings(core.marketIds.wbtc));
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        riskOverrideSetter.connect(core.hhUser1).ownerRemoveSingleCollateralStrictDebt(core.marketIds.wbera),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerRemoveDebtMarketWithStrictCollateral', () => {
    it('should work normally', async () => {
      const collateralBitmap = getBitmap([core.marketIds.wbera, core.marketIds.wbtc]);
      await riskOverrideSetter.connect(core.governance).ownerSetDebtMarketWithStrictCollateral(
        core.marketIds.usdc, collateralBitmap,
      );
      expect(await riskOverrideSetter.getDebtWithStrictCollateralBitmap()).to.eq(getBitmap([core.marketIds.usdc]));
      expect(await riskOverrideSetter.getDebtMarketIdToStrictCollateralBitmap(core.marketIds.usdc))
        .to.eq(collateralBitmap);

      await riskOverrideSetter.connect(core.governance).ownerRemoveDebtMarketWithStrictCollateral(core.marketIds.usdc);
      expect(await riskOverrideSetter.getDebtWithStrictCollateralBitmap()).to.eq(ZERO_BI);
      expect(await riskOverrideSetter.getDebtMarketIdToStrictCollateralBitmap(core.marketIds.usdc)).to.eq(ZERO_BI);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        riskOverrideSetter.connect(core.hhUser1).ownerRemoveDebtMarketWithStrictCollateral(core.marketIds.usdc),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetCategoryStruct', () => {
    it('should work normally', async () => {
      const bitmap = getBitmap([core.marketIds.wbera, core.marketIds.honey]);
      const res = await riskOverrideSetter.connect(core.governance).ownerSetCategoryStruct(
        Category.BERA, bitmap, marginRatio, liquidationReward,
      );
      await expectEvent(riskOverrideSetter, res, 'CategorySet', {
        bitmap,
        category: Category.BERA,
        marginRatioOverride: marginRatio,
        liquidationRewardOverride: liquidationReward,
      });

      const categoryStruct = await riskOverrideSetter.getCategory(Category.BERA);
      expect(categoryStruct.category).to.eq(Category.BERA);
      expect(categoryStruct.bitmap).to.eq(bitmap);
      expect(categoryStruct.marginRatioOverride.value).to.eq(marginRatio.value);
      expect(categoryStruct.liquidationRewardOverride.value).to.eq(liquidationReward.value);
      expect(await riskOverrideSetter.getActiveCategories()).to.deep.eq([]);
    });

    it('should update an existing category', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryStruct(
        Category.BERA, getBitmap([core.marketIds.wbera]), marginRatio, liquidationReward,
      );
      const bitmap = getBitmap([core.marketIds.wbera, core.marketIds.honey]);
      const updatedMarginRatio = { value: parseEther('.2') };
      const updatedLiquidationReward = { value: parseEther('.03') };
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryStruct(
        Category.BERA, bitmap, updatedMarginRatio, updatedLiquidationReward,
      );

      const result = await riskOverrideSetter.getCategory(Category.BERA);
      expect(result.category).to.eq(Category.BERA);
      expect(result.bitmap).to.eq(bitmap);
      expect(result.marginRatioOverride.value).to.eq(updatedMarginRatio.value);
      expect(result.liquidationRewardOverride.value).to.eq(updatedLiquidationReward.value);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        riskOverrideSetter.connect(core.hhUser1).ownerSetCategoryStruct(
          Category.BERA, getBitmap([core.marketIds.wbera]), marginRatio, liquidationReward,
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetActiveCategories', () => {
    it('should work normally', async () => {
      const categories = [Category.STABLE, Category.BTC, Category.ETH, Category.BERA];
      const res = await riskOverrideSetter.connect(core.governance).ownerSetActiveCategories(categories);
      await expectEvent(riskOverrideSetter, res, 'ActiveCategoriesSet', { categories });
      expect(await riskOverrideSetter.getActiveCategories()).to.deep.eq(categories);
    });

    it('should replace the active categories', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetActiveCategories([Category.BERA, Category.BTC]);
      await riskOverrideSetter.connect(core.governance).ownerSetActiveCategories([Category.STABLE]);
      expect(await riskOverrideSetter.getActiveCategories()).to.deep.eq([Category.STABLE]);
    });

    it('should clear the active categories', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetActiveCategories([Category.BERA]);
      const res = await riskOverrideSetter.connect(core.governance).ownerSetActiveCategories([]);
      await expectEvent(riskOverrideSetter, res, 'ActiveCategoriesSet', { categories: [] });
      expect(await riskOverrideSetter.getActiveCategories()).to.deep.eq([]);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        riskOverrideSetter.connect(core.hhUser1).ownerSetActiveCategories([Category.BERA]),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#getAccountRiskOverride', () => {
    it('should return 0 if the account has no balances', async () => {
      const result = await riskOverrideSetter.getAccountRiskOverride(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
      );
      expect(result[0].value).to.eq(ZERO_BI);
      expect(result[1].value).to.eq(ZERO_BI);
    });

    it('should return 0 if the account has no debt', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryStruct(
        Category.BERA, getBitmap([core.marketIds.wbera]), marginRatio, liquidationReward,
      );
      await riskOverrideSetter.connect(core.governance).ownerSetActiveCategories([Category.BERA]);
      await riskOverrideSetter.connect(core.governance).ownerSetBorrowOnlyBitmap(getBitmap([core.marketIds.honey]));

      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);

      const result = await riskOverrideSetter.getAccountRiskOverride(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
      );
      expect(result[0].value).to.eq(ZERO_BI);
      expect(result[1].value).to.eq(ZERO_BI);
    });

    it('should work normally with borrow only', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetBorrowOnlyBitmap(getBitmap([core.marketIds.usdc]));
      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        BigNumber.from('100000'),
        BalanceCheckFlag.None,
      );

      const accountRiskOverride = await riskOverrideSetter.getAccountRiskOverride(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
      );
      expect(accountRiskOverride[0].value).to.eq(ZERO_BI);
      expect(accountRiskOverride[1].value).to.eq(ZERO_BI);
    });

    it('should fail if user is using borrow only as collateral', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetBorrowOnlyBitmap(getBitmap([core.marketIds.wbera]));
      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);
      await expectThrow(
        core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.usdc,
          usdcAmount,
          BalanceCheckFlag.None,
        ),
        'BitmapRiskOverrideSetter: Using borrow only collateral'
      );
    });

    it('should match a later setting with single collateral and multiple allowed debts', async () => {
      const riskStruct = {
        debtBitmap: getBitmap([core.marketIds.usdc, core.marketIds.honey]),
        marginRatioOverride: marginRatio,
        liquidationRewardOverride: liquidationReward,
      };
      await riskOverrideSetter.connect(core.governance).ownerSetSingleCollateralStrictDebt(
        core.marketIds.wbera, [
          {
            debtBitmap: getBitmap([core.marketIds.weth]),
            marginRatioOverride: { value: parseEther('.2') },
            liquidationRewardOverride: { value: parseEther('.03') },
          },
          riskStruct,
        ],
      );
      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        BigNumber.from('100000'),
        BalanceCheckFlag.None,
      );
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.honey,
        parseEther('.1'),
        BalanceCheckFlag.None,
      );

      const accountRiskOverride = await riskOverrideSetter.getAccountRiskOverride(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
      );
      expect(accountRiskOverride[0].value).to.eq(marginRatio.value);
      expect(accountRiskOverride[1].value).to.eq(liquidationReward.value);
    });

    it('should fail if user has multiple single collaterals', async () => {
      const riskStruct = {
        debtBitmap: getBitmap([core.marketIds.usdc, core.marketIds.honey]),
        marginRatioOverride: marginRatio,
        liquidationRewardOverride: liquidationReward,
      };
      await riskOverrideSetter.connect(core.governance).ownerSetSingleCollateralStrictDebt(
        core.marketIds.wbera, [riskStruct],
      );
      await riskOverrideSetter.connect(core.governance).ownerSetSingleCollateralStrictDebt(
        core.marketIds.weth, [riskStruct],
      );
      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await setupWETHBalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, wberaAmount);
      await expectThrow(
        core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.usdc,
          usdcAmount,
          BalanceCheckFlag.None,
        ),
        'BitmapRiskOverrideSetter: Multiple strict markets'
      );
    });

    it('should fail if user has single collateral + other collateral', async () => {
      const riskStruct = {
        debtBitmap: getBitmap([core.marketIds.usdc, core.marketIds.honey]),
        marginRatioOverride: marginRatio,
        liquidationRewardOverride: liquidationReward,
      };
      await riskOverrideSetter.connect(core.governance).ownerSetSingleCollateralStrictDebt(
        core.marketIds.wbera, [riskStruct],
      );
      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await setupWETHBalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, wberaAmount);
      await expectThrow(
        core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.usdc,
          usdcAmount,
          BalanceCheckFlag.None,
        ),
        'BitmapRiskOverrideSetter: Can only have single collateral'
      );
    });

    it('should work normally with no matching category', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryStruct(
        Category.BERA, getBitmap([core.marketIds.wbera]), marginRatio, liquidationReward,
      );
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryStruct(
        Category.STABLE, getBitmap([core.marketIds.honey]), marginRatio, liquidationReward,
      );
      await riskOverrideSetter.connect(core.governance).ownerSetActiveCategories([Category.BERA, Category.STABLE]);
      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        BigNumber.from('100000'),
        BalanceCheckFlag.None,
      );

      const accountRiskOverride = await riskOverrideSetter.getAccountRiskOverride(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
      );
      expect(accountRiskOverride[0].value).to.eq(ZERO_BI);
      expect(accountRiskOverride[1].value).to.eq(ZERO_BI);
    });

    it('should work normally with category', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryStruct(
        Category.BERA,
        getBitmap([core.marketIds.wbera, core.marketIds.honey]),
        { value: parseEther('.1') },
        { value: parseEther('.05') },
      );
      await riskOverrideSetter.connect(core.governance).ownerSetActiveCategories([Category.BERA]);
      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.honey,
        parseEther('.1'),
        BalanceCheckFlag.None,
      );

      const accountRiskOverride = await riskOverrideSetter.getAccountRiskOverride(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
      );
      expect(accountRiskOverride[0].value).to.eq(parseEther('.1'));
      expect(accountRiskOverride[1].value).to.eq(parseEther('.05'));
    });

    it('should return 0 if dolomite owner is passed through', async () => {
      const accountRiskOverride = await riskOverrideSetter.getAccountRiskOverride(
        { owner: core.governance.address, number: ZERO_BI },
      );
      expect(accountRiskOverride[0].value).to.eq(ZERO_BI);
      expect(accountRiskOverride[1].value).to.eq(ZERO_BI);
    });

    it('should return 0 if zero address is passed through', async () => {
      const accountRiskOverride = await riskOverrideSetter.getAccountRiskOverride(
        { owner: ZERO_ADDRESS, number: ZERO_BI },
      );
      expect(accountRiskOverride[0].value).to.eq(ZERO_BI);
      expect(accountRiskOverride[1].value).to.eq(ZERO_BI);
    });

    it('should fail if user borrows a market outside the allowed debt bitmap', async () => {
      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);
      await riskOverrideSetter.connect(core.governance).ownerSetSingleCollateralStrictDebt(core.marketIds.wbera, [{
        debtBitmap: getBitmap([core.marketIds.honey]),
        marginRatioOverride: marginRatio,
        liquidationRewardOverride: liquidationReward,
      }]);

      await expectThrow(
        core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.usdc,
          usdcAmount,
          BalanceCheckFlag.None,
        ),
        'BitmapRiskOverrideSetter: Invalid single collateral',
      );
    });

    it('should work normally with a debt market with strict collateral', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetDebtMarketWithStrictCollateral(
        core.marketIds.usdc, getBitmap([core.marketIds.wbera]),
      );
      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        BigNumber.from('100000'),
        BalanceCheckFlag.None,
      );

      const accountRiskOverride = await riskOverrideSetter.getAccountRiskOverride(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
      );
      expect(accountRiskOverride[0].value).to.eq(ZERO_BI);
      expect(accountRiskOverride[1].value).to.eq(ZERO_BI);
    });

    it('should fail if user borrows with collateral outside the allowed bitmap', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetDebtMarketWithStrictCollateral(
        core.marketIds.usdc, getBitmap([core.marketIds.wbtc]),
      );
      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);

      await expectThrow(
        core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.usdc,
          usdcAmount,
          BalanceCheckFlag.None,
        ),
        `BitmapRiskOverrideSetter: Invalid collateral markets <${core.marketIds.usdc.toString()}>`,
      );
    });
  });

  describe('#getActiveCategories', () => {
    it('should return an empty array by default', async () => {
      expect(await riskOverrideSetter.getActiveCategories()).to.deep.eq([]);
    });
  });

  describe('#getSingleCollateralStrictDebtBitmap', () => {
    it('should return 0 by default', async () => {
      expect(await riskOverrideSetter.getSingleCollateralStrictDebtBitmap()).to.eq(ZERO_BI);
    });
  });

  describe('#isMarketSingleCollateralStrictDebt', () => {
    const settings = [{
      debtBitmap: getBitmap([2]),
      marginRatioOverride: marginRatio,
      liquidationRewardOverride: liquidationReward,
    }];

    it('should return false by default', async () => {
      expect(await riskOverrideSetter.isMarketSingleCollateralStrictDebt(core.marketIds.wbera)).to.eq(false);
    });

    it('should clear only the removed market', async () => {
      for (const marketId of [core.marketIds.wbera, core.marketIds.wbtc]) {
        await riskOverrideSetter.connect(core.governance).ownerSetSingleCollateralStrictDebt(marketId, settings);
      }
      await riskOverrideSetter.connect(core.governance).ownerRemoveSingleCollateralStrictDebt(core.marketIds.wbera);

      expect(await riskOverrideSetter.isMarketSingleCollateralStrictDebt(core.marketIds.wbera)).to.eq(false);
      expect(await riskOverrideSetter.isMarketSingleCollateralStrictDebt(core.marketIds.wbtc)).to.eq(true);

      await riskOverrideSetter.connect(core.governance).ownerRemoveSingleCollateralStrictDebt(core.marketIds.wbtc);
      expect(await riskOverrideSetter.isMarketSingleCollateralStrictDebt(core.marketIds.wbtc)).to.eq(false);
    });

    it('should return true when configured with empty settings', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetSingleCollateralStrictDebt(core.marketIds.wbera, []);

      expect(await riskOverrideSetter.isMarketSingleCollateralStrictDebt(core.marketIds.wbera)).to.eq(true);
    });

    it('should support the lowest and highest market IDs in the bitmap', async () => {
      for (const marketId of [0, 255]) {
        await riskOverrideSetter.connect(core.governance).ownerSetSingleCollateralStrictDebt(marketId, settings);
      }

      expect(await riskOverrideSetter.isMarketSingleCollateralStrictDebt(0)).to.eq(true);
      expect(await riskOverrideSetter.isMarketSingleCollateralStrictDebt(255)).to.eq(true);
      expect(await riskOverrideSetter.isMarketSingleCollateralStrictDebt(1)).to.eq(false);
      expect(await riskOverrideSetter.isMarketSingleCollateralStrictDebt(254)).to.eq(false);
    });
  });

  describe('#isMarketStrictCollateral', () => {
    it('should return false by default', async () => {
      expect(await riskOverrideSetter.isMarketStrictCollateral(core.marketIds.usdc)).to.eq(false);
    });

    it('should return true only for configured debt markets', async () => {
      const marketIds = [core.marketIds.usdc, core.marketIds.honey];
      for (const marketId of marketIds) {
        await riskOverrideSetter.connect(core.governance).ownerSetDebtMarketWithStrictCollateral(
          marketId, getBitmap([core.marketIds.wbera]),
        );
      }

      for (const marketId of marketIds) {
        expect(await riskOverrideSetter.isMarketStrictCollateral(marketId)).to.eq(true);
        expect(await riskOverrideSetter.isMarketSingleCollateralStrictDebt(marketId)).to.eq(false);
      }
      expect(await riskOverrideSetter.isMarketStrictCollateral(core.marketIds.wbera)).to.eq(false);
    });

    it('should return true when configured with an empty collateral bitmap', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetDebtMarketWithStrictCollateral(
        core.marketIds.usdc, ZERO_BI,
      );

      expect(await riskOverrideSetter.isMarketStrictCollateral(core.marketIds.usdc)).to.eq(true);
    });

    it('should support the lowest and highest market IDs in the bitmap', async () => {
      for (const marketId of [0, 255]) {
        await riskOverrideSetter.connect(core.governance).ownerSetDebtMarketWithStrictCollateral(
          marketId, getBitmap([2]),
        );
      }

      expect(await riskOverrideSetter.isMarketStrictCollateral(0)).to.eq(true);
      expect(await riskOverrideSetter.isMarketStrictCollateral(255)).to.eq(true);
      expect(await riskOverrideSetter.isMarketStrictCollateral(1)).to.eq(false);
      expect(await riskOverrideSetter.isMarketStrictCollateral(254)).to.eq(false);
    });
  });

  describe('#getSingleCollateralStrictDebtSettings', () => {
    it('should revert for an unconfigured market', async () => {
      await expectThrow(riskOverrideSetter.getSingleCollateralStrictDebtSettings(core.marketIds.wbera));
    });
  });

  describe('#getCategory', () => {
    it('should return default values for an unconfigured category', async () => {
      const result = await riskOverrideSetter.getCategory(Category.BERA);
      expect(result.category).to.eq(Category.NONE);
      expect(result.bitmap).to.eq(ZERO_BI);
      expect(result.marginRatioOverride.value).to.eq(ZERO_BI);
      expect(result.liquidationRewardOverride.value).to.eq(ZERO_BI);
    });
  });

  describe('#getCategoryByMarketId', () => {
    it('should return NONE when there are no active categories', async () => {
      expect(await riskOverrideSetter.getCategoryByMarketId(core.marketIds.wbera)).to.eq(Category.NONE);
    });

    it('should return the matching active category for each market', async () => {
      const categories = [Category.BERA, Category.BTC, Category.ETH, Category.STABLE];
      const marketIdsByCategory = [
        [core.marketIds.wbera],
        [core.marketIds.wbtc],
        [core.marketIds.weth],
        [core.marketIds.usdc, core.marketIds.honey],
      ];
      for (let i = 0; i < categories.length; ++i) {
        await riskOverrideSetter.connect(core.governance).ownerSetCategoryStruct(
          categories[i], getBitmap(marketIdsByCategory[i]), marginRatio, liquidationReward,
        );
      }
      await riskOverrideSetter.connect(core.governance).ownerSetActiveCategories(categories);

      for (let i = 0; i < categories.length; ++i) {
        for (const marketId of marketIdsByCategory[i]) {
          expect(await riskOverrideSetter.getCategoryByMarketId(marketId)).to.eq(categories[i]);
        }
      }
    });

    it('should return NONE when no active category contains the market', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryStruct(
        Category.BERA, getBitmap([core.marketIds.wbera]), marginRatio, liquidationReward,
      );
      await riskOverrideSetter.connect(core.governance).ownerSetActiveCategories([Category.BERA]);

      expect(await riskOverrideSetter.getCategoryByMarketId(core.marketIds.usdc)).to.eq(Category.NONE);
    });

    it('should ignore a matching inactive category', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryStruct(
        Category.BERA, getBitmap([core.marketIds.wbera]), marginRatio, liquidationReward,
      );
      await riskOverrideSetter.connect(core.governance).ownerSetActiveCategories([Category.BERA]);
      expect(await riskOverrideSetter.getCategoryByMarketId(core.marketIds.wbera)).to.eq(Category.BERA);

      await riskOverrideSetter.connect(core.governance).ownerSetActiveCategories([Category.BTC]);
      expect(await riskOverrideSetter.getCategoryByMarketId(core.marketIds.wbera)).to.eq(Category.NONE);
    });

    it('should skip active categories with empty bitmaps', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryStruct(
        Category.BERA, ZERO_BI, marginRatio, liquidationReward,
      );
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryStruct(
        Category.STABLE, getBitmap([core.marketIds.usdc]), marginRatio, liquidationReward,
      );
      await riskOverrideSetter.connect(core.governance).ownerSetActiveCategories([
        Category.BERA, Category.BTC, Category.STABLE,
      ]);

      expect(await riskOverrideSetter.getCategoryByMarketId(core.marketIds.usdc)).to.eq(Category.STABLE);
      expect(await riskOverrideSetter.getCategoryByMarketId(core.marketIds.wbera)).to.eq(Category.NONE);
    });

    it('should reflect updates to the category bitmap', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryStruct(
        Category.STABLE, getBitmap([core.marketIds.usdc]), marginRatio, liquidationReward,
      );
      await riskOverrideSetter.connect(core.governance).ownerSetActiveCategories([Category.STABLE]);
      expect(await riskOverrideSetter.getCategoryByMarketId(core.marketIds.usdc)).to.eq(Category.STABLE);

      await riskOverrideSetter.connect(core.governance).ownerSetCategoryStruct(
        Category.STABLE, getBitmap([core.marketIds.honey]), marginRatio, liquidationReward,
      );
      expect(await riskOverrideSetter.getCategoryByMarketId(core.marketIds.usdc)).to.eq(Category.NONE);
      expect(await riskOverrideSetter.getCategoryByMarketId(core.marketIds.honey)).to.eq(Category.STABLE);
    });

    it('should support the lowest and highest market IDs in the bitmap', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryStruct(
        Category.BERA, getBitmap([0, 255]), marginRatio, liquidationReward,
      );
      await riskOverrideSetter.connect(core.governance).ownerSetActiveCategories([Category.BERA]);

      expect(await riskOverrideSetter.getCategoryByMarketId(0)).to.eq(Category.BERA);
      expect(await riskOverrideSetter.getCategoryByMarketId(255)).to.eq(Category.BERA);
      expect(await riskOverrideSetter.getCategoryByMarketId(1)).to.eq(Category.NONE);
      expect(await riskOverrideSetter.getCategoryByMarketId(254)).to.eq(Category.NONE);
    });
  });
});
