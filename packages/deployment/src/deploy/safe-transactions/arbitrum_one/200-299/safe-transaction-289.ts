import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import ModuleDeployments from '../../../deployments.json';

/**
 * This script encodes the following transactions:
 * - Sets the unwrapper and wrappers for gmBTC and gmETH on the GMX V2 Registry
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.gmxV2Ecosystem.live.registry },
      'registry',
      'ownerSetUnwrapperByToken',
      [
        core.gmxV2Ecosystem.live.gmBtc.factory.address,
        ModuleDeployments.GmxV2SingleSidedBTCAsyncIsolationModeUnwrapperTraderProxyV2[network].address,
      ],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.gmxV2Ecosystem.live.registry },
      'registry',
      'ownerSetWrapperByToken',
      [
        core.gmxV2Ecosystem.live.gmBtc.factory.address,
        ModuleDeployments.GmxV2SingleSidedBTCAsyncIsolationModeWrapperTraderProxyV2[network].address,
      ],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.gmxV2Ecosystem.live.registry },
      'registry',
      'ownerSetUnwrapperByToken',
      [
        core.gmxV2Ecosystem.live.gmEth.factory.address,
        ModuleDeployments.GmxV2SingleSidedETHAsyncIsolationModeUnwrapperTraderProxyV2[network].address,
      ],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.gmxV2Ecosystem.live.registry },
      'registry',
      'ownerSetWrapperByToken',
      [
        core.gmxV2Ecosystem.live.gmEth.factory.address,
        ModuleDeployments.GmxV2SingleSidedETHAsyncIsolationModeWrapperTraderProxyV2[network].address,
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
      const gmxV2Ecosystem = core.gmxV2Ecosystem.live;

      expect(await gmxV2Ecosystem.registry.getUnwrapperByToken(gmxV2Ecosystem.gmBtc.factory.address))
        .to.eq(ModuleDeployments.GmxV2SingleSidedBTCAsyncIsolationModeUnwrapperTraderProxyV2[network].address);
      expect(await gmxV2Ecosystem.registry.getWrapperByToken(gmxV2Ecosystem.gmBtc.factory.address))
        .to.eq(ModuleDeployments.GmxV2SingleSidedBTCAsyncIsolationModeWrapperTraderProxyV2[network].address);

      expect(await gmxV2Ecosystem.registry.getUnwrapperByToken(gmxV2Ecosystem.gmEth.factory.address))
        .to.eq(ModuleDeployments.GmxV2SingleSidedETHAsyncIsolationModeUnwrapperTraderProxyV2[network].address);
      expect(await gmxV2Ecosystem.registry.getWrapperByToken(gmxV2Ecosystem.gmEth.factory.address))
        .to.eq(ModuleDeployments.GmxV2SingleSidedETHAsyncIsolationModeWrapperTraderProxyV2[network].address);
    },
  };
}

doDryRunAndCheckDeployment(main);
