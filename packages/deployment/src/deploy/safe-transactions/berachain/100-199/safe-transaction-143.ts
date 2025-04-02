import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { expectWalletBalance } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import {
  AccountRiskOverrideCategory,
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import {
  encodeSetAccountRiskOverrideCategoryByMarketId,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Transfers wBERA to the gnosis safe
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [
    ...await encodeAddMarket(
      core,
      core.tokens.henlo,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._166,
      TargetLiquidationPenalty._15,
      parseEther(`${100}`),
      parseEther(`${80}`),
      true,
    ),
    ...await encodeAddMarket(
      core,
      core.tokens.iBera,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._150,
      TargetLiquidationPenalty._15,
      parseEther(`${100}`),
      parseEther(`${80}`),
      true,
    ),
    ...await encodeAddMarket(
      core,
      core.tokens.iBgt,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._150,
      TargetLiquidationPenalty._15,
      ONE_BI,
      ZERO_BI,
      true,
    ),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, core.marketIds.iBera, AccountRiskOverrideCategory.BERA),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    invariants: async () => {
      await expectWalletBalance(core.gnosisSafeAddress, core.tokens.wbera, balanceWei);
    },
  };
}

doDryRunAndCheckDeployment(main);
