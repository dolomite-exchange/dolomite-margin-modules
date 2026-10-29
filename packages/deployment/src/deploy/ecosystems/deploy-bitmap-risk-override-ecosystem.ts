import { BitmapRiskOverrideSetter__factory } from '@dolomite-exchange/modules-base/src/types';
import {
  AccountRiskOverrideCategory,
  AccountRiskOverrideRiskFeature,
  getRegistryProxyConstructorParams,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAnyNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { DolomiteNetwork, ONE_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { deployContractAndSave, getMaxDeploymentVersionNameByDeploymentKey } from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../utils/encoding/base-encoder-utils';
import getScriptName from '../../utils/get-script-name';

async function main<T extends DolomiteNetwork>(): Promise<DryRunOutput<T>> {
  const network = (await getAnyNetwork()) as T;
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const implementationAddress = await deployContractAndSave(
    'BitmapRiskOverrideSetter',
    [core.dolomiteMargin.address],
    getMaxDeploymentVersionNameByDeploymentKey('BitmapRiskOverrideSetterImplementation', 1),
  );
  const implementation = BitmapRiskOverrideSetter__factory.connect(implementationAddress, core.hhUser1);

  const initializationCalldata = await implementation.populateTransaction.initialize();
  const proxyAddress = await deployContractAndSave(
    'RegistryProxy',
    getRegistryProxyConstructorParams(implementationAddress, initializationCalldata.data!, core.dolomiteMargin),
    'BitmapRiskOverrideSetterProxy',
  );
  const bitmapRiskOverrideSetter = BitmapRiskOverrideSetter__factory.connect(proxyAddress, core.hhUser1);

  console.log('BitmapRiskOverrideSetter:', bitmapRiskOverrideSetter.address);

  const riskOverrideSetter = core.dolomiteAccountRiskOverrideSetter;
  const numMarkets = (await core.dolomiteMargin.getNumMarkets()).toNumber();

  const borrowOnlyMarketIds: number[] = [];
  const singleCollateralStrictDebtMarketIds: number[] = [];
  const marketIdsByCategory: Partial<Record<number, number[]>> = {
    [AccountRiskOverrideCategory.BERA]: [],
    [AccountRiskOverrideCategory.BTC]: [],
    [AccountRiskOverrideCategory.ETH]: [],
    [AccountRiskOverrideCategory.STABLE]: [],
  };

  const transactions: EncodedTransaction[] = [];

  for (let marketId = 0; marketId < numMarkets; marketId++) {
    const riskFeature = await riskOverrideSetter.getRiskFeatureByMarketId(marketId);
    if (riskFeature === AccountRiskOverrideRiskFeature.BORROW_ONLY) {
      borrowOnlyMarketIds.push(marketId);
    } else if (riskFeature === AccountRiskOverrideRiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT) {
      singleCollateralStrictDebtMarketIds.push(marketId);
    }

    const category = await riskOverrideSetter.getCategoryByMarketId(marketId);
    if (category !== AccountRiskOverrideCategory.NONE) {
      marketIdsByCategory[category]!.push(marketId);
    }
  }

  transactions.push(await prettyPrintEncodedDataWithTypeSafety(
    core,
    { bitmapRiskOverrideSetter },
    'bitmapRiskOverrideSetter',
    'ownerSetBorrowOnlyBitmap',
    [getBitmap(borrowOnlyMarketIds)],
  ));

  for (const marketId of singleCollateralStrictDebtMarketIds) {
    const params = await riskOverrideSetter.getRiskFeatureForSingleCollateralByMarketId(marketId);
    transactions.push(await prettyPrintEncodedDataWithTypeSafety(
      core,
      { bitmapRiskOverrideSetter },
      'bitmapRiskOverrideSetter',
      'ownerSetSingleCollateralStrictDebt',
      [
        marketId,
        params.map(param => ({
          debtBitmap: getBitmap(param.debtMarketIds),
          marginRatioOverride: param.marginRatioOverride,
          liquidationRewardOverride: param.liquidationRewardOverride,
        }))
      ],
    ));
  }

  for (const [categoryKey, marketIds] of Object.entries(marketIdsByCategory)) {
    const params = await riskOverrideSetter.getCategoryParamByCategory(categoryKey);
    transactions.push(await prettyPrintEncodedDataWithTypeSafety(
      core,
      { bitmapRiskOverrideSetter },
      'bitmapRiskOverrideSetter',
      'ownerSetCategoryStruct',
      [
        categoryKey,
        getBitmap(marketIds!),
        params.marginRatioOverride,
        params.liquidationRewardOverride,
      ],
    ));
  }
  transactions.push(await prettyPrintEncodedDataWithTypeSafety(
    core,
    { bitmapRiskOverrideSetter },
    'bitmapRiskOverrideSetter',
    'ownerSetActiveCategories',
    [Object.keys(marketIdsByCategory)],
  ));

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {
      expect(await bitmapRiskOverrideSetter.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);

      for (const marketId of singleCollateralStrictDebtMarketIds) {
        const expected = await riskOverrideSetter.getRiskFeatureForSingleCollateralByMarketId(marketId);
        const actual = await bitmapRiskOverrideSetter.getSingleCollateralStrictDebtSettings(marketId);
        expect(actual.length).to.eq(expected.length);

        for (let i = 0; i < expected.length; i++) {
          expect(actual[i].debtBitmap).to.eq(getBitmap(expected[i].debtMarketIds));
          expect(actual[i].marginRatioOverride.value).to.eq(expected[i].marginRatioOverride.value);
          expect(actual[i].liquidationRewardOverride.value).to.eq(expected[i].liquidationRewardOverride.value);
        }
      }

      const categoryKeys = Object.keys(marketIdsByCategory).map(Number);
      expect(await bitmapRiskOverrideSetter.getActiveCategories()).to.deep.eq(categoryKeys);
      for (const category of categoryKeys) {
        const expected = await riskOverrideSetter.getCategoryParamByCategory(category);
        const actual = await bitmapRiskOverrideSetter.getCategory(category);

        expect(actual.category).to.eq(category);
        expect(actual.bitmap).to.eq(getBitmap(marketIdsByCategory[category]!));
        expect(actual.marginRatioOverride.value).to.eq(expected.marginRatioOverride.value);
        expect(actual.liquidationRewardOverride.value).to.eq(expected.liquidationRewardOverride.value);
      }
    },
  };
}

function getBitmap(marketIds: BigNumberish[]): BigNumber {
  return marketIds.reduce<BigNumber>(
    (bitmap, marketId) => bitmap.or(ONE_BI.shl(BigNumber.from(marketId).toNumber())),
    ZERO_BI,
  );
}

doDryRunAndCheckDeployment(main);
