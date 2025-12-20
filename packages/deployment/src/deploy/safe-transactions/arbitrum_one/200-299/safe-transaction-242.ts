import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,

} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys new AsyncIsolationModeWrapperTraderImpl library
 * - Deploys a new wrapper trader for each GM token
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const wrapperTraderLibAddress = await deployContractAndSave(
    'AsyncIsolationModeWrapperTraderImpl',
    [],
    'AsyncIsolationModeWrapperTraderImplV3',
  );
  const wrapperImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeWrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeWrapperTraderImplementationV5',
    {
      ...core.gmxV2Ecosystem.live.gmxV2VaultLibraryMap,
      AsyncIsolationModeWrapperTraderImpl: wrapperTraderLibAddress,
    },
  );

  const wrappers = [
    core.gmxV2Ecosystem.live.gmArbUsd.wrapperProxy,
    core.gmxV2Ecosystem.live.gmBtcUsd.wrapperProxy,
    core.gmxV2Ecosystem.live.gmEthUsd.wrapperProxy,
    core.gmxV2Ecosystem.live.gmLinkUsd.wrapperProxy,
  ];

  const transactions: EncodedTransaction[] = [];

  for (let i = 0; i < wrappers.length; i += 1) {
    const wrapper = wrappers[i];

    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { wrapper },
        'wrapper',
        'upgradeTo',
        [wrapperImplementationAddress],
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
    invariants: async () => {
      await Promise.all(
        wrappers.map(async (wrapper, i) => {
          assertHardhatInvariant(
            await wrapper.implementation() === wrapperImplementationAddress,
            `Invalid unwrapper implementation at index [${i}]`,
          );
        }),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
