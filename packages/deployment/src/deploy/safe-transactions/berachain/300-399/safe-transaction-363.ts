import { parseEther } from 'ethers/lib/utils';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeSetIsBorrowOnly } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkAccountRiskOverrideIsBorrowOnly, checkIsCollateralOnly } from '../../../../utils/invariant-utils';
import { encodeSimpleBoycoListing } from '../utils';

/**
 * This script encodes the following transactions:
 * - Adds the deUSD market
 * - Adds the sdeUSD market
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    ...(await encodeSimpleBoycoListing(core, core.tokens.deUsd, parseEther('1'))),
    ...(await encodeSimpleBoycoListing(core, core.tokens.sdeUsd, parseEther('1'))),
    await encodeSetIsBorrowOnly(core, core.marketIds.deUsd, true),
    await encodeSetIsBorrowOnly(core, core.marketIds.sdeUsd, true),
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
      await checkIsCollateralOnly(core, core.marketIds.deUsd, true);
      await checkIsCollateralOnly(core, core.marketIds.sdeUsd, true);
      await checkAccountRiskOverrideIsBorrowOnly(core, core.marketIds.deUsd);
      await checkAccountRiskOverrideIsBorrowOnly(core, core.marketIds.sdeUsd);
    },
  };
}

doDryRunAndCheckDeployment(main);
