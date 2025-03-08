import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { ADDRESS_ZERO, Network } from 'packages/base/src/utils/no-deps-constants';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Removes the funky selector as instant on the factories
 * - Allows ownerSetUserVaultImplementation to be called instantly on the factory
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const factories = [
    core.gmxV2Ecosystem.live.gmArbUsd.factory,
    core.gmxV2Ecosystem.live.gmBtcUsd.factory,
    core.gmxV2Ecosystem.live.gmEthUsd.factory,
    core.gmxV2Ecosystem.live.gmLinkUsd.factory,
  ];

  const transactions: EncodedTransaction[] = [];

  for (let i = 0; i < factories.length; i += 1) {
    const factory = factories[i];
    const ownerSetUserVaultImplementationSelector = '0x72dcf679';
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { multisig: core.delayedMultiSig },
        'multisig',
        'setSelector',
        [factory.address, '0xC6427474', false],
      ),

      // Set the right selector
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { multisig: core.delayedMultiSig },
        'multisig',
        'setSelector',
        [ADDRESS_ZERO, ownerSetUserVaultImplementationSelector, true],
      ),
    );
  }

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
  };
}

doDryRunAndCheckDeployment(main);
