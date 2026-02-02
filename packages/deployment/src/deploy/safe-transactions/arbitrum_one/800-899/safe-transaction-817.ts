import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { encodeAddIsolationModeMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { parseEther } from 'ethers/lib/utils';
import { encodeInsertChainlinkOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import { CHAINLINK_PRICE_AGGREGATORS_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';
import { deploySimpleIsolationModeSystem } from '../../../../utils/deploy-utils';

/**
 * This script encodes the following transactions:
 * - Lists savUSD
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const { factory, unwrapper, wrapper } = await deploySimpleIsolationModeSystem(
    core,
    'SavUSD',
    core.tokens.savUsd,
    core.marketIds.stablecoins,
    core.marketIds.stablecoins,
  );

  const transactions: EncodedTransaction[] = [
    ...await encodeInsertChainlinkOracleV3(
      core,
      core.tokens.savUsd,
      false,
      null,
      CHAINLINK_PRICE_AGGREGATORS_MAP[core.network][core.tokens.nativeUsdc.address]!.aggregatorAddress,
    ),
    ...await encodeAddIsolationModeMarket(
      core,
      factory,
      core.oracleAggregatorV2,
      unwrapper,
      wrapper,
      core.marketIds.savUsd,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseEther(`${10_000_000}`),
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
      await printPriceForVisualCheck(core, core.tokens.savUsd);
    },
  };
}

doDryRunAndCheckDeployment(main);
