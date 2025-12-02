import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { parseEther } from 'ethers/lib/utils';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import {
  getPendlePtPriceOracleV2ConstructorParams,
  getPendleRegistryConstructorParams,
} from '@dolomite-exchange/modules-pendle/src/pendle-constructors';
import { PendlePtPriceOracleV2__factory, PendleRegistry__factory } from '@dolomite-exchange/modules-pendle/src/types';
import {
  encodeSetSingleCollateralWithStrictDebtByMarketId,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeInsertOracle } from '../../../../utils/encoding/oracle-encoder-utils';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Reclaim DOLO from airdrop contracts
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.tokenomicsAirdrop,
      'optionAirdrop',
      'ownerWithdrawRewardToken',
      [core.tokens.dolo.address, core.gnosisSafeAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.tokenomicsAirdrop,
      'regularAirdrop',
      'ownerWithdrawRewardToken',
      [core.tokens.dolo.address, core.gnosisSafeAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.tokenomicsAirdrop,
      'boycoAirdrop',
      'ownerWithdrawRewardToken',
      [core.tokens.dolo.address, core.gnosisSafeAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.tokenomicsAirdrop,
      'boycoPartnerAirdrop',
      'ownerWithdrawRewardToken',
      [core.tokens.dolo.address, core.gnosisSafeAddress],
    ),
  ];

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
    },
  };
}

doDryRunAndCheckDeployment(main);
