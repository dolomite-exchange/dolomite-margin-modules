import { parseEther } from 'ethers/lib/utils';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { encodeSetSupplyCapWithMagic } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeInsertChronicleOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkBorrowCap, checkInterestSetter, checkSupplyCap } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Increase the supply & borrow cap for BERA
 * - Update the interest setter to optimize for lowering utilization to 60%
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    await encodeSetSupplyCapWithMagic(core, core.marketIds.beraEth, 20_000),
    ...await encodeInsertChronicleOracleV3(core, core.tokens.ohm),
    ...await encodeAddMarket(
      core,
      core.tokens.ohm,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction16L84U70OInterestSetter,
      TargetCollateralization._133,
      TargetLiquidationPenalty._15,
      parseEther(`${100_000}`),
      parseEther(`${70_000}`),
      false,
    )
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
      await checkSupplyCap(core, core.marketIds.beraEth, parseEther(`${20_000}`));
      await checkSupplyCap(core, core.marketIds.ohm, parseEther(`${100_000}`));
      await checkBorrowCap(core, core.marketIds.ohm, parseEther(`${70_000}`));
      await checkInterestSetter(
        core,
        core.marketIds.ohm,
        core.interestSetters.linearStepFunction16L84U70OInterestSetter,
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
