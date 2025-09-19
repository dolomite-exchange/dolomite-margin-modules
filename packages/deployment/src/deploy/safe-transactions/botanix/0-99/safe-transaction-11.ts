import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { BYTES_EMPTY, BYTES_ZERO, Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber, impersonate } from '../../../../../../base/test/utils';
import { expectThrow } from '../../../../../../base/test/utils/assertions';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import {
  encodeSetBorrowCapWithMagic,
  encodeSetSupplyCapWithMagic,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

const OLD_OWNER = '0xD0Ead284Aa5136E95CEc0C1b0bFC928c17D66dF7';

/**
 * This script encodes the following transactions:
 * - Removes the old owner from the owner timelock
 */
async function main(): Promise<DryRunOutput<Network.Botanix>> {
  const network = await getAndCheckSpecificNetwork(Network.Botanix);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [
    await encodeSetSupplyCapWithMagic(core, core.marketIds.usdc, 10_000_000),
    await encodeSetBorrowCapWithMagic(core, core.marketIds.usdc, 1_000_000),
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
    },
  };
}

doDryRunAndCheckDeployment(main);
