import { expect } from 'chai';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { deployDolomiteErc4626Token } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeSetupDolomite4626Token } from '../../../../utils/encoding/dolomite-4626-token-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Create and list dsrUSD
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const dsrUsd = await deployDolomiteErc4626Token(core, 'SrUsd', core.marketIds.srUsd);

  const transactions: EncodedTransaction[] = await encodeSetupDolomite4626Token(core, dsrUsd);

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
      expect(await core.dolomiteMargin.getIsGlobalOperator(dsrUsd.address)).to.be.true;
    },
  };
}

doDryRunAndCheckDeployment(main);
