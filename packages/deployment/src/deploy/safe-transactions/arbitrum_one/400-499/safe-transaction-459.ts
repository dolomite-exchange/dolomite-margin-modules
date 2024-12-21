import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  deployDolomiteErc4626Token,
  deployDolomiteErc4626WithPayableToken,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

const OLD_WETH_ADDRESS = '0x1FE20a7d3C71705421af8F2AC36e2850a6449E06';

/**
 * This script encodes the following transactions:
 * - Deploys the 4626 dToken vault for WETH
 * - Deprecates the old 4626 dToken vault for WETH
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const dWethToken = await deployDolomiteErc4626WithPayableToken(core, 'Weth', core.marketIds.weth);

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      OLD_WETH_ADDRESS,
      false,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      dWethToken.address,
      true,
    ]),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {
      const isGlobalOperator = (o: string) => core.dolomiteMargin.getIsGlobalOperator(o);

      assertHardhatInvariant(!await isGlobalOperator(OLD_WETH_ADDRESS), 'old dWethToken is a global operator');
      assertHardhatInvariant(await isGlobalOperator(dWethToken.address), 'dWethToken is not a global operator');
    },
  };
}

doDryRunAndCheckDeployment(main);
