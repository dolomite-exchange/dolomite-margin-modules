import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { AccountRiskOverrideCategory } from '../../../../../../base/src/utils/constructors/dolomite';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetAccountRiskOverrideCategoryByMarketId, encodeSetEarningsRateOverride,
  encodeSetInterestSetter,
  encodeSetIsCollateralOnly,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  checkAccountRiskOverrideCategory,
  checkInterestSetter,
  checkIsCollateralOnly,
} from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Sets WBERA earnings rate override to 25%
 * - Update the interest rate models for stables
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await encodeSetEarningsRateOverride(core, core.marketIds.wbera, parseEther(`${0.25}`)),
  ];

  for (const marketId of core.marketIds.stablecoinsWithUnifiedInterestRateModels) {
    transactions.push(
      await encodeSetInterestSetter(core, marketId, core.interestSetters.linearStepFunction7L93U90OInterestSetter),
    );
  }

  return {
    core,
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: core.network,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    scriptName: getScriptName(__filename),
    invariants: async () => {
      const override = await core.dolomiteMargin.getMarketEarningsRateOverride(core.marketIds.wbera);
      expect(override.value).to.eq(parseEther(`${0.25}`));
    },
  };
}

doDryRunAndCheckDeployment(main);
