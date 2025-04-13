import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkIsGlobalOperator } from '../../../../utils/invariant-utils';
import { expect } from 'chai';

/**
 * This script encodes the following transactions:
 * - Unset the token converter and global operator
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });
  const gmPendleUsd = core.gmxV2Ecosystem.live.gmPendleUsd;

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetGlobalOperator',
      [core.gnosisSafeAddress, false],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      gmPendleUsd,
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [core.gnosisSafeAddress, false],
    ),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {
      await checkIsGlobalOperator(core, core.gnosisSafeAddress, false);
      expect(await gmPendleUsd.factory.isTokenConverterTrusted(core.gnosisSafeAddress)).to.be.false;
    },
  };
}

doDryRunAndCheckDeployment(main);
