import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { ADDRESS_ZERO, Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import {
  EncodedTransaction,
  prettyPrintEncodeAddMarket,
  prettyPrintEncodedDataWithTypeSafety,
  prettyPrintEncodeInsertChronicleOracleV3,
  prettyPrintEncodeInsertRedstoneOracleV3,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';
import { IERC20, IERC20Metadata__factory, TestPriceOracle__factory } from '@dolomite-exchange/modules-base/src/types';
import ModuleDeployments from '../../deployments.json';
import {
  CoreProtocolBerachain,
} from '@dolomite-exchange/modules-base/test/utils/core-protocols/core-protocol-berachain';
import { BigNumberish } from 'ethers';

/**
 * This script encodes the following transactions:
 * - Adds the SBTC and STONEBTC assets to Dolomite
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];

  transactions.push(
    ...await prettyPrintEncodeInsertChronicleOracleV3(
      core,
      core.tokens.sbtc,
    ),
    ...await prettyPrintEncodeInsertChronicleOracleV3(
      core,
      core.tokens.stoneBtc,
    ),
    ...await prettyPrintEncodeAddMarket(
      core,
      core.tokens.sbtc,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction8L92U90OInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      ZERO_BI,
      ZERO_BI,
      false,
    ),
    ...await prettyPrintEncodeAddMarket(
      core,
      core.tokens.stoneBtc,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction8L92U90OInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      ZERO_BI,
      ZERO_BI,
      false,
    ),
  );
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
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);
