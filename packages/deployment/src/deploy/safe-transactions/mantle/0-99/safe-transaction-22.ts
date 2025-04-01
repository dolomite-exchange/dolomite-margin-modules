import { RegistryProxy__factory } from '@dolomite-exchange/modules-base/src/types';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import { encodeSetupDolomite4626Token } from '../../../../utils/encoding/dolomite-4626-token-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Upgrades each existing 4626 dToken to the new implementation
 * - Gives appropriate DolomiteOwnerV2 roles to each 4626 contract
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [];

  for (let i = 0; i < core.dolomiteTokens.all.length; i += 1) {
    // Upgrade the implementations
    const dToken = core.dolomiteTokens.all[i];
    const proxy = RegistryProxy__factory.connect(dToken.address, core.hhUser1);
    if ('depositFromPayable' in dToken) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          { proxy },
          'proxy',
          'upgradeTo',
          [core.implementationContracts.dolomiteERC4626WithPayableImplementation.address],
        ),
      );
    } else {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          { proxy },
          'proxy',
          'upgradeTo',
          [core.implementationContracts.dolomiteERC4626Implementation.address],
        ),
      );
    }

    transactions.push(...(await encodeSetupDolomite4626Token(core, dToken)));
  }

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
