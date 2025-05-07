import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  DolomiteAccountRiskOverrideSetter,
  DolomiteAccountRiskOverrideSetter__factory,
  RegistryProxy,
  RegistryProxy__factory,
} from '../../src/types';
import { getRegistryProxyConstructorParams } from '../../src/utils/constructors/dolomite';
import { createContractWithAbi, depositIntoDolomiteMargin } from '../../src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import {
  setupCoreProtocol,
  setupHONEYBalance,
  setupWBERABalance,
  setupWBTCBalance,
  setupWETHBalance,
} from '../utils/setup';
import { CoreProtocolBerachain } from '../utils/core-protocols/core-protocol-berachain';
import { expectEvent, expectThrow } from '../utils/assertions';
import { defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';

const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from(123);
const singleCollateralRiskStruct = 'tuple(uint256[] debtMarketIds,tuple(uint256 value) marginRatioOverride,tuple(uint256 value) liquidationRewardOverride)[] riskStruct';

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

    const riskOverrideSetterImplementation = await createContractWithAbi<DolomiteAccountRiskOverrideSetter>(
      DolomiteAccountRiskOverrideSetter__factory.abi,
      DolomiteAccountRiskOverrideSetter__factory.bytecode,
      [core.dolomiteMargin.address],
    );
    const calldata = (await riskOverrideSetterImplementation.populateTransaction.initialize()).data!;
    const proxy = await createContractWithAbi<RegistryProxy>(
      RegistryProxy__factory.abi,
      RegistryProxy__factory.bytecode,
      getRegistryProxyConstructorParams(riskOverrideSetterImplementation.address, calldata, core.dolomiteMargin),
    );
    riskOverrideSetter = DolomiteAccountRiskOverrideSetter__factory.connect(proxy.address, core.hhUser1);

    await core.dolomiteMargin.ownerSetDefaultAccountRiskOverride(riskOverrideSetter.address);
    expect(await core.dolomiteMargin.getDefaultAccountRiskOverrideSetter()).to.eq(riskOverrideSetter.address);

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

  describe('#intialize', () => {
    it('should fail if called again', async () => {
      await expectThrow(
        riskOverrideSetter.connect(core.governance).initialize(),
        'Initializable: contract is already initialized'
      );
    });
  });

  describe('#ownerSetCategoriesByMarketIds', () => {
    it('should work normally', async () => {
      const marketIds = [core.marketIds.wbera, core.marketIds.wbtc, core.marketIds.weth];
      const categories = [Category.BERA, Category.BTC, Category.ETH];

      const res = await riskOverrideSetter.connect(core.governance).ownerSetCategoriesByMarketIds(
        marketIds,
        categories,
      );

      for (let i = 0; i < marketIds.length; i++) {
        await expectEvent(riskOverrideSetter, res, 'CategorySet', {
          marketId: marketIds[i],
          category: categories[i],
        });
        expect(await riskOverrideSetter.getCategoryByMarketId(marketIds[i])).to.eq(categories[i]);
      }
    });

    it('should fail if arrays have different lengths', async () => {
      const marketIds = [core.marketIds.wbera, core.marketIds.wbtc];
      const categories = [Category.BERA];

      await expectThrow(
        riskOverrideSetter.connect(core.governance).ownerSetCategoriesByMarketIds(marketIds, categories),
        'AccountRiskOverrideSetter: Invalid market IDs length',
      );
      await expectThrow(
        riskOverrideSetter.connect(core.governance).ownerSetCategoriesByMarketIds([], []),
        'AccountRiskOverrideSetter: Invalid market IDs length',
      );
    });

    it('should fail if not called by owner', async () => {
      const marketIds = [core.marketIds.wbera];
      const categories = [Category.BERA];

      await expectThrow(
        riskOverrideSetter.connect(core.hhUser1).ownerSetCategoriesByMarketIds(marketIds, categories),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetCategoryByMarketId', () => {
    it('should work normally', async () => {
      const res = await riskOverrideSetter.connect(core.governance).ownerSetCategoryByMarketId(
        core.marketIds.wbera,
        Category.BERA,
      );
      await expectEvent(riskOverrideSetter, res, 'CategorySet', {
        marketId: core.marketIds.wbera,
        category: Category.BERA,
      });
      expect(await riskOverrideSetter.getCategoryByMarketId(core.marketIds.wbera)).to.eq(Category.BERA);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        riskOverrideSetter.connect(core.hhUser1).ownerSetCategoryByMarketId(core.marketIds.wbera, Category.BERA),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetCategoryParam', () => {
    it('should work normally', async () => {
      const marginRatio = { value: parseEther('.5') };
      const liquidationReward = { value: parseEther('.5') };

      const res = await riskOverrideSetter.connect(core.governance).ownerSetCategoryParam(
        Category.BERA,
        marginRatio,
        liquidationReward,
      );
      await expectEvent(riskOverrideSetter, res, 'CategoryParamSet', {
        category: Category.BERA,
        marginRatioOverride: marginRatio,
        liquidationRewardOverride: liquidationReward,
      });

      const categoryStruct = await riskOverrideSetter.getCategoryParamByCategory(Category.BERA);
      expect(categoryStruct.category).to.eq(Category.BERA);
      expect(categoryStruct.marginRatioOverride.value).to.eq(marginRatio.value);
      expect(categoryStruct.liquidationRewardOverride.value).to.eq(liquidationReward.value);
    });

    it('should fail if not called by owner', async () => {
      const marginRatio = { value: parseEther('.5') };
      const liquidationReward = { value: parseEther('.5') };

      await expectThrow(
        riskOverrideSetter.connect(core.hhUser1).ownerSetCategoryParam(
          Category.BERA,
          marginRatio,
          liquidationReward,
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetRiskFeatureByMarketId', () => {
    it('should work normally', async () => {
      const riskStruct1 = {
        debtMarketIds: [core.marketIds.usdc, core.marketIds.honey],
        marginRatioOverride: { value: parseEther('.5') },
        liquidationRewardOverride: { value: parseEther('.5') },
      };
      const extraData = defaultAbiCoder.encode(
        [singleCollateralRiskStruct],
        [
          [riskStruct1],
        ],
      );
      const res = await riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
        core.marketIds.wbera,
        RiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT,
        extraData,
      );
      await expectEvent(riskOverrideSetter, res, 'RiskFeatureSet', {
        marketId: core.marketIds.wbera,
        riskFeature: RiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT,
        extraData: extraData,
      });
      expect(
        await riskOverrideSetter.getRiskFeatureByMarketId(core.marketIds.wbera),
      ).to.eq(RiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT);
    });

    it('should work with multiple risk structs', async () => {
      const riskStruct1 = {
        debtMarketIds: [core.marketIds.usdc, core.marketIds.honey],
        marginRatioOverride: { value: parseEther('.5') },
        liquidationRewardOverride: { value: parseEther('.5') },
      };
      const riskStruct2 = {
        debtMarketIds: [core.marketIds.usde, core.marketIds.usda],
        marginRatioOverride: { value: parseEther('.3') },
        liquidationRewardOverride: { value: parseEther('.3') },
      };
      const extraData = defaultAbiCoder.encode(
        [singleCollateralRiskStruct],
        [
          [riskStruct1, riskStruct2],
        ],
      );
      const res = await riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
        core.marketIds.wbera,
        RiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT,
        extraData,
      );
      await expectEvent(riskOverrideSetter, res, 'RiskFeatureSet', {
        marketId: core.marketIds.wbera,
        riskFeature: RiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT,
        extraData: extraData,
      });
      expect(
        await riskOverrideSetter.getRiskFeatureByMarketId(core.marketIds.wbera),
      ).to.eq(RiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT);
      const structs = await riskOverrideSetter.getRiskFeatureForSingleCollateralByMarketId(core.marketIds.wbera);
      expect(structs.length).to.eq(2);
      expect(structs[0].debtMarketIds[0]).to.eq(core.marketIds.usdc);
      expect(structs[0].debtMarketIds[1]).to.eq(core.marketIds.honey);
      expect(structs[0].marginRatioOverride.value).to.eq(parseEther('.5'));
      expect(structs[0].liquidationRewardOverride.value).to.eq(parseEther('.5'));

      expect(structs[1].debtMarketIds[0]).to.eq(core.marketIds.usde);
      expect(structs[1].debtMarketIds[1]).to.eq(core.marketIds.usda);
      expect(structs[1].marginRatioOverride.value).to.eq(parseEther('.3'));
      expect(structs[1].liquidationRewardOverride.value).to.eq(parseEther('.3'));
    });

    it('should work normally with borrow only', async () => {
      const res = await riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
        core.marketIds.usdc,
        RiskFeature.BORROW_ONLY,
        BYTES_EMPTY,
      );
      await expectEvent(riskOverrideSetter, res, 'RiskFeatureSet', {
        marketId: core.marketIds.usdc,
        riskFeature: RiskFeature.BORROW_ONLY,
        extraData: BYTES_EMPTY,
      });
      expect(await riskOverrideSetter.getRiskFeatureByMarketId(core.marketIds.usdc)).to.eq(RiskFeature.BORROW_ONLY);
    });

    it('should fail if array is empty', async () => {
      const extraData = defaultAbiCoder.encode(
        [singleCollateralRiskStruct],
        [[]],
      );
      await expectThrow(
        riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
          core.marketIds.wbera,
          RiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT,
          extraData,
        ),
        'AccountRiskOverrideSetter: Invalid risk riskStructs',
      );
    });

    it('should fail if debt market ids array is empty', async () => {
      const riskStruct = {
        debtMarketIds: [],
        marginRatioOverride: { value: parseEther('.5') },
        liquidationRewardOverride: { value: parseEther('.5') },
      };
      const extraData = defaultAbiCoder.encode(
        [singleCollateralRiskStruct],
        [[riskStruct]],
      );
      await expectThrow(
        riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
          core.marketIds.wbera,
          RiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT,
          extraData,
        ),
        'AccountRiskOverrideSetter: Invalid debt market IDs',
      );
    });

    it('should fail if margin ratio is 0', async () => {
      const riskStruct = {
        debtMarketIds: [core.marketIds.usdc],
        marginRatioOverride: { value: ZERO_BI },
        liquidationRewardOverride: { value: parseEther('.5') },
      };
      const extraData = defaultAbiCoder.encode(
        [singleCollateralRiskStruct],
        [[riskStruct]],
      );
      await expectThrow(
        riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
          core.marketIds.wbera,
          RiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT,
          extraData,
        ),
        'AccountRiskOverrideSetter: Invalid margin ratio',
      );
    });

    it('should fail if liquidation reward is 0', async () => {
      const riskStruct = {
        debtMarketIds: [core.marketIds.usdc],
        marginRatioOverride: { value: parseEther('.5') },
        liquidationRewardOverride: { value: ZERO_BI },
      };
      const extraData = defaultAbiCoder.encode(
        [singleCollateralRiskStruct],
        [[riskStruct]],
      );
      await expectThrow(
        riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
          core.marketIds.wbera,
          RiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT,
          extraData,
        ),
        'AccountRiskOverrideSetter: Invalid liquidation reward',
      );
    });

    it('should fail if margin ratio is too high', async () => {
      const riskStruct = {
        debtMarketIds: [core.marketIds.usdc],
        marginRatioOverride: { value: parseEther('10') }, // Very high margin ratio
        liquidationRewardOverride: { value: parseEther('.5') },
      };
      const extraData = defaultAbiCoder.encode(
        [singleCollateralRiskStruct],
        [[riskStruct]],
      );
      await expectThrow(
        riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
          core.marketIds.wbera,
          RiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT,
          extraData,
        ),
        'AccountRiskOverrideSetter: Margin ratio too high',
      );
    });

    it('should fail if liquidation reward is too high', async () => {
      const riskStruct = {
        debtMarketIds: [core.marketIds.usdc],
        marginRatioOverride: { value: parseEther('.5') },
        liquidationRewardOverride: { value: parseEther('10') }, // Very high liquidation reward
      };
      const extraData = defaultAbiCoder.encode(
        [singleCollateralRiskStruct],
        [[riskStruct]],
      );
      await expectThrow(
        riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
          core.marketIds.wbera,
          RiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT,
          extraData,
        ),
        'AccountRiskOverrideSetter: Liquidation reward too high',
      );
    });

    it('should fail if debt market IDs are not in ascending order', async () => {
      const riskStruct = {
        debtMarketIds: [core.marketIds.honey, core.marketIds.usdc], // HONEY > USDC, not in ascending order
        marginRatioOverride: { value: parseEther('.5') },
        liquidationRewardOverride: { value: parseEther('.1') },
      };
      const extraData = defaultAbiCoder.encode(
        [singleCollateralRiskStruct],
        [[riskStruct]],
      );
      await expectThrow(
        riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
          core.marketIds.wbera,
          RiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT,
          extraData,
        ),
        'AccountRiskOverrideSetter: Markets must be in asc order',
      );
    });

    it('should fail if duplicate debt market IDs are provided', async () => {
      const riskStruct = {
        debtMarketIds: [core.marketIds.usdc, core.marketIds.usdc],
        marginRatioOverride: { value: parseEther('.5') },
        liquidationRewardOverride: { value: parseEther('.1') },
      };
      const extraData = defaultAbiCoder.encode(
        [singleCollateralRiskStruct],
        [[riskStruct]],
      );
      await expectThrow(
        riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
          core.marketIds.wbera,
          RiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT,
          extraData,
        ),
        'AccountRiskOverrideSetter: Markets must be in asc order',
      );
    });

    it('should fail if debt market IDs overlap between risk structs', async () => {
      const riskStruct1 = {
        debtMarketIds: [core.marketIds.usdc, core.marketIds.honey],
        marginRatioOverride: { value: parseEther('.5') },
        liquidationRewardOverride: { value: parseEther('.1') },
      };
      const riskStruct2 = {
        debtMarketIds: [core.marketIds.weth, core.marketIds.honey], // HONEY overlaps with riskStruct1
        marginRatioOverride: { value: parseEther('.5') },
        liquidationRewardOverride: { value: parseEther('.1') },
      };
      const extraData = defaultAbiCoder.encode(
        [singleCollateralRiskStruct],
        [[riskStruct1, riskStruct2]],
      );
      await expectThrow(
        riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
          core.marketIds.wbera,
          RiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT,
          extraData,
        ),
        'AccountRiskOverrideSetter: Found duplicate debt market ID',
      );
    });

    it('should fail if extra data is provided for BORROW_ONLY risk feature', async () => {
      const extraData = defaultAbiCoder.encode(
        [singleCollateralRiskStruct],
        [[{
          debtMarketIds: [core.marketIds.usdc],
          marginRatioOverride: { value: parseEther('.5') },
          liquidationRewardOverride: { value: parseEther('.1') },
        }]],
      );
      await expectThrow(
        riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
          core.marketIds.wbera,
          RiskFeature.BORROW_ONLY,
          extraData,
        ),
        `AccountRiskOverrideSetter: Invalid data for risk feature <${RiskFeature.BORROW_ONLY.toString()}>`,
      );
    });

    it('should fail if extra data is provided for NONE risk feature', async () => {
      const extraData = defaultAbiCoder.encode(
        [singleCollateralRiskStruct],
        [[{
          debtMarketIds: [core.marketIds.usdc],
          marginRatioOverride: { value: parseEther('.5') },
          liquidationRewardOverride: { value: parseEther('.1') },
        }]],
      );
      await expectThrow(
        riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
          core.marketIds.wbera,
          RiskFeature.NONE,
          extraData,
        ),
        `AccountRiskOverrideSetter: Invalid data for risk feature <${RiskFeature.NONE.toString()}>`,
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        riskOverrideSetter.connect(core.hhUser1).ownerSetRiskFeatureByMarketId(
          core.marketIds.wbera,
          RiskFeature.NONE,
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#getRiskFeatureForSingleCollateralByMarketId', () => {
    it('should fail if risk feature is borrow only', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
        core.marketIds.usdc,
        RiskFeature.BORROW_ONLY,
        BYTES_EMPTY,
      );

      await expectThrow(
        riskOverrideSetter.getRiskFeatureForSingleCollateralByMarketId(core.marketIds.usdc),
        `AccountRiskOverrideSetter: Invalid risk feature <${RiskFeature.BORROW_ONLY.toString()}>`,
      );
    });
  });

  describe('#getAccountRiskOverride', () => {
    it('should work normally with borrow only', async () => {
      // setup USDC to be "borrow_only"
      await riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
        core.marketIds.usdc,
        RiskFeature.BORROW_ONLY,
        BYTES_EMPTY,
      );

      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcAmount,
        BalanceCheckFlag.None,
      );

      const accountRiskOverride = await riskOverrideSetter.getAccountRiskOverride(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
      );
      expect(accountRiskOverride[0].value).to.eq(ZERO_BI);
      expect(accountRiskOverride[1].value).to.eq(ZERO_BI);
    });

    it('it should work normally with single collateral', async () => {
      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);

      const riskStruct = {
        debtMarketIds: [core.marketIds.usdc, core.marketIds.honey],
        marginRatioOverride: { value: parseEther('.1') },
        liquidationRewardOverride: { value: parseEther('.05') },
      };
      const extraData = defaultAbiCoder.encode(
        [singleCollateralRiskStruct],
        [[riskStruct]],
      );
      await riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
        core.marketIds.wbera,
        RiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT,
        extraData,
      );
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcAmount,
        BalanceCheckFlag.None,
      );
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.honey,
        honeyAmount,
        BalanceCheckFlag.None,
      );

      const accountRiskOverride = await riskOverrideSetter.getAccountRiskOverride(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
      );
      expect(accountRiskOverride[0].value).to.eq(parseEther('.1'));
      expect(accountRiskOverride[1].value).to.eq(parseEther('.05'));
    });

    it('it should work normally with no category', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryByMarketId(
        core.marketIds.wbera,
        Category.BERA,
      );
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryByMarketId(
        core.marketIds.honey,
        Category.STABLE,
      );
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryParam(
        Category.BERA,
        { value: parseEther('.1') },
        { value: parseEther('.05') },
      );
      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.honey,
        honeyAmount,
        BalanceCheckFlag.None,
      );

      const accountRiskOverride = await riskOverrideSetter.getAccountRiskOverride(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
      );
      expect(accountRiskOverride[0].value).to.eq(ZERO_BI);
      expect(accountRiskOverride[1].value).to.eq(ZERO_BI);
    });

    it('it should work normally with bera category', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryByMarketId(
        core.marketIds.wbera,
        Category.BERA,
      );
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryByMarketId(
        core.marketIds.honey,
        Category.BERA,
      );
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryParam(
        Category.BERA,
        { value: parseEther('.1') },
        { value: parseEther('.05') },
      );
      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.honey,
        honeyAmount,
        BalanceCheckFlag.None,
      );

      const accountRiskOverride = await riskOverrideSetter.getAccountRiskOverride(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
      );
      expect(accountRiskOverride[0].value).to.eq(parseEther('.1'));
      expect(accountRiskOverride[1].value).to.eq(parseEther('.05'));
    });

    it('it should work normally with btc category', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryByMarketId(
        core.marketIds.wbtc,
        Category.BTC,
      );
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryByMarketId(
        core.marketIds.lbtc,
        Category.BTC,
      );
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryParam(
        Category.BTC,
        { value: parseEther('.1') },
        { value: parseEther('.05') },
      );
      await setupWBTCBalance(core, core.hhUser1, wbtcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbtc, wbtcAmount);
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.lbtc,
        ONE_BI,
        BalanceCheckFlag.None,
      );

      const accountRiskOverride = await riskOverrideSetter.getAccountRiskOverride(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
      );
      expect(accountRiskOverride[0].value).to.eq(parseEther('.1'));
      expect(accountRiskOverride[1].value).to.eq(parseEther('.05'));
    });

    it('it should work normally with eth category', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryByMarketId(
        core.marketIds.weth,
        Category.ETH,
      );
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryByMarketId(
        core.marketIds.weEth,
        Category.ETH,
      );
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryParam(
        Category.ETH,
        { value: parseEther('.1') },
        { value: parseEther('.05') },
      );

      await setupWETHBalance(core, core.hhUser1, ONE_ETH_BI, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, ONE_ETH_BI);
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.weEth,
        ONE_BI,
        BalanceCheckFlag.None,
      );
      const accountRiskOverride = await riskOverrideSetter.getAccountRiskOverride(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
      );
      expect(accountRiskOverride[0].value).to.eq(parseEther('.1'));
      expect(accountRiskOverride[1].value).to.eq(parseEther('.05'));
    });

    it('it should work normally with stable category', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryByMarketId(
        core.marketIds.usdc,
        Category.STABLE,
      );
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryByMarketId(
        core.marketIds.honey,
        Category.STABLE,
      );
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryParam(
        Category.STABLE,
        { value: parseEther('.95') },
        { value: parseEther('.05') },
      );

      await setupHONEYBalance(core, core.hhUser1, honeyAmount.mul(100), core.dolomiteMargin);
      await depositIntoDolomiteMargin(
        core,
        core.hhUser1,
        borrowAccountNumber,
        core.marketIds.honey,
        honeyAmount.mul(100),
      );
      await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcAmount,
        BalanceCheckFlag.None,
      );

      const accountRiskOverride = await riskOverrideSetter.getAccountRiskOverride(
        { owner: core.hhUser1.address, number: borrowAccountNumber },
      );
      expect(accountRiskOverride[0].value).to.eq(parseEther('.95'));
      expect(accountRiskOverride[1].value).to.eq(parseEther('.05'));
    });

    it('should return 0 if dolomite owner is passed through', async () => {
      const accountRiskOverride = await riskOverrideSetter.getAccountRiskOverride(
        { owner: core.governance.address, number: ZERO_BI }
      );
      expect(accountRiskOverride[0].value).to.eq(ZERO_BI);
      expect(accountRiskOverride[1].value).to.eq(ZERO_BI);
    });

    it('should return 0 if zero address is passed through', async () => {
      const accountRiskOverride = await riskOverrideSetter.getAccountRiskOverride(
        { owner: ZERO_ADDRESS, number: ZERO_BI }
      );
      expect(accountRiskOverride[0].value).to.eq(ZERO_BI);
      expect(accountRiskOverride[1].value).to.eq(ZERO_BI);
    });

    it('should fail if user is using borrow only as collateral', async () => {
      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);
      await riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
        core.marketIds.wbera,
        RiskFeature.BORROW_ONLY,
        BYTES_EMPTY,
      );
      await expectThrow(
        core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.usdc,
          usdcAmount,
          BalanceCheckFlag.None,
        ),
        `AccountRiskOverrideSetter: Market is borrow only <${core.marketIds.wbera.toString()}>`,
      );
    });

    it('should fail if user has multiple collaterals in single collateral risk struct', async () => {
      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);
      await setupHONEYBalance(core, core.hhUser1, honeyAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.honey, honeyAmount);

      const riskStruct = {
        debtMarketIds: [core.marketIds.usdc, core.marketIds.honey],
        marginRatioOverride: { value: parseEther('.5') },
        liquidationRewardOverride: { value: parseEther('.5') },
      };
      const extraData = defaultAbiCoder.encode(
        [singleCollateralRiskStruct],
        [[riskStruct]],
      );
      await riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
        core.marketIds.wbera,
        RiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT,
        extraData,
      );
      await expectThrow(
        core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.usdc,
          usdcAmount,
          BalanceCheckFlag.None,
        ),
        `AccountRiskOverrideSetter: Market is borrow only <${core.marketIds.honey.toString()}>`,
      );
    });

    it('should fail if user is borrowing single collateral asset', async () => {
      const riskStruct = {
        debtMarketIds: [core.marketIds.usdc, core.marketIds.honey],
        marginRatioOverride: { value: parseEther('.5') },
        liquidationRewardOverride: { value: parseEther('.5') },
      };
      const extraData = defaultAbiCoder.encode(
        [singleCollateralRiskStruct],
        [[riskStruct]],
      );
      await riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
        core.marketIds.wbera,
        RiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT,
        extraData,
      );
      await expectThrow(
        core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.wbera,
          ONE_ETH_BI,
          BalanceCheckFlag.None,
        ),
        `AccountRiskOverrideSetter: Market is collateral only <${core.marketIds.wbera.toString()}>`,
      );
    });

    it('should fail if user has extra token in single collateral risk struct', async () => {
      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.wbera, wberaAmount);
      await setupHONEYBalance(core, core.hhUser1, honeyAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.honey, honeyAmount);

      const riskStruct = {
        debtMarketIds: [core.marketIds.usdc],
        marginRatioOverride: { value: parseEther('.5') },
        liquidationRewardOverride: { value: parseEther('.5') },
      };
      const extraData = defaultAbiCoder.encode(
        [singleCollateralRiskStruct],
        [[riskStruct]],
      );
      await riskOverrideSetter.connect(core.governance).ownerSetRiskFeatureByMarketId(
        core.marketIds.wbera,
        RiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT,
        extraData,
      );
      await expectThrow(
        core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.usdc,
          usdcAmount,
          BalanceCheckFlag.None,
        ),
        'AccountRiskOverrideSetter: Could not find risk param',
      );
    });

    it('should fail if invalid account number', async () => {
      await setupWBERABalance(core, core.hhUser1, wberaAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, ONE_BI, core.marketIds.wbera, wberaAmount);
      await expectThrow(
        core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
          ONE_BI,
          defaultAccountNumber,
          core.marketIds.usdc,
          usdcAmount,
          BalanceCheckFlag.None,
        ),
        `AccountRiskOverrideSetter: Invalid account for debt <${core.hhUser1.address.toLowerCase()}, ${ONE_BI.toString()}>`,
      );
    });
  });

  describe('#getCategoryParamByMarketId', () => {
    it('should work when the market ID is valid', async () => {
      const marketIds = [core.marketIds.wbera, core.marketIds.wbtc, core.marketIds.weth];
      const categories = [Category.BERA, Category.BTC, Category.ETH];

      await riskOverrideSetter.connect(core.governance).ownerSetCategoriesByMarketIds(marketIds, categories);
      await riskOverrideSetter.connect(core.governance)
        .ownerSetCategoryParam(Category.BERA, { value: parseEther('.1') }, { value: parseEther('.05') });

      const categoryStruct = await riskOverrideSetter.getCategoryParamByMarketId(core.marketIds.wbera);
      expect(categoryStruct.category).to.eq(Category.BERA);
      expect(categoryStruct.marginRatioOverride.value).to.eq(parseEther('.1'));
      expect(categoryStruct.liquidationRewardOverride.value).to.eq(parseEther('.05'));
    });

    it('should fail when the market ID is has no category', async () => {
      const marketIds = [core.marketIds.wbera, core.marketIds.wbtc, core.marketIds.weth];
      const categories = [Category.BERA, Category.BTC, Category.ETH];

      await riskOverrideSetter.connect(core.governance).ownerSetCategoriesByMarketIds(marketIds, categories);
      await riskOverrideSetter.connect(core.governance)
        .ownerSetCategoryParam(Category.BERA, { value: parseEther('.1') }, { value: parseEther('.05') });

      await expectThrow(
        riskOverrideSetter.getCategoryParamByMarketId(core.marketIds.lbtc),
        `AccountRiskOverrideSetter: No category found <${core.marketIds.lbtc.toString()}>`,
      );
    });
  });

  describe('#getRiskFeatureParamByMarketId', () => {
    it('should work when the market ID is valid', async () => {
      await riskOverrideSetter.connect(core.governance)
        .ownerSetRiskFeatureByMarketId(core.marketIds.wbera, RiskFeature.BORROW_ONLY, BYTES_EMPTY);

      const riskFeatureStruct = await riskOverrideSetter.getRiskFeatureParamByMarketId(core.marketIds.wbera);
      expect(riskFeatureStruct.riskFeature).to.eq(RiskFeature.BORROW_ONLY);
      expect(riskFeatureStruct.extraData).to.eq(BYTES_EMPTY);
    });

    it('should return default when the market ID is has no risk feature', async () => {
      const result = await riskOverrideSetter.getRiskFeatureParamByMarketId(core.marketIds.lbtc);
      expect(result.riskFeature).to.eq(RiskFeature.NONE);
      expect(result.extraData).to.eq(BYTES_EMPTY);
    });
  });

  describe('#getCategoryMaskByMarketIds', () => {
    it('should work normally for one token in bera category', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryByMarketId(
        core.marketIds.wbera,
        Category.BERA,
      );
      expect(await riskOverrideSetter.getCategoryMaskByMarketIds([core.marketIds.wbera])).to.eq(CategoryMask.BERA);
    });

    it('should work normally for two tokens in btc category', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryByMarketId(
        core.marketIds.wbtc,
        Category.BTC,
      );
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryByMarketId(
        core.marketIds.eBtc,
        Category.BTC,
      );
      expect(await riskOverrideSetter.getCategoryMaskByMarketIds([
        core.marketIds.wbtc, core.marketIds.eBtc,
      ])).to.eq(CategoryMask.BTC);
    });

    it('should work normally for two tokens in eth category', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryByMarketId(
        core.marketIds.weth,
        Category.ETH,
      );
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryByMarketId(
        core.marketIds.rsEth,
        Category.ETH,
      );
      expect(await riskOverrideSetter.getCategoryMaskByMarketIds([
        core.marketIds.weth, core.marketIds.rsEth,
      ])).to.eq(CategoryMask.ETH);
    });

    it('should work normally for one token in stable category', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryByMarketId(
        core.marketIds.usdc,
        Category.STABLE,
      );
      expect(await riskOverrideSetter.getCategoryMaskByMarketIds([
        core.marketIds.usdc,
      ])).to.eq(CategoryMask.STABLE);
    });

    it('should return none if there is a token not in any category', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryByMarketId(
        core.marketIds.wbera,
        Category.BERA,
      );
      expect(await riskOverrideSetter.getCategoryMaskByMarketIds([
        core.marketIds.wbera, core.marketIds.usdc,
      ])).to.eq(0);
    });

    it('should return none if tokens are in different categories', async () => {
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryByMarketId(
        core.marketIds.wbera,
        Category.BERA,
      );
      await riskOverrideSetter.connect(core.governance).ownerSetCategoryByMarketId(
        core.marketIds.usdc,
        Category.STABLE,
      );
      expect(await riskOverrideSetter.getCategoryMaskByMarketIds([
        core.marketIds.wbera, core.marketIds.usdc,
      ])).to.eq(0);
    });

    it('should fail if no markets are provided', async () => {
      await expectThrow(
        riskOverrideSetter.getCategoryMaskByMarketIds([]),
        'AccountRiskOverrideSetter: Invalid market IDs length',
      );
    });
  });
});
