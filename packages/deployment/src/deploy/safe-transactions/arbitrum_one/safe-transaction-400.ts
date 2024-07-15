import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';
import { GMX_EXCHANGE_ROUTER_MAP, GMX_READER_MAP } from 'packages/base/src/utils/constants';

/**
 * This script encodes the following transactions:
 * - Sets the new Exchange Router and Reader address on the GMX V2 Registry
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.gmxEcosystemV2.live.registry },
      'registry',
      'ownerSetGmxExchangeRouter',
      [
        GMX_EXCHANGE_ROUTER_MAP[network],
      ],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.gmxEcosystemV2.live.registry },
      'registry',
      'ownerSetGmxReader',
      [
        GMX_READER_MAP[network],
      ],
    ),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    skipTimeDelay: true,
    invariants: async () => {
      const gmxV2Ecosystem = core.gmxEcosystemV2.live;

      expect(await gmxV2Ecosystem.registry.gmxExchangeRouter())
        .to.eq(GMX_EXCHANGE_ROUTER_MAP[network]);
      expect(await gmxV2Ecosystem.registry.gmxReader())
        .to.eq(GMX_READER_MAP[network]);
    },
  };
}

doDryRunAndCheckDeployment(main);
