import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Updates the jUSDC token vault
 * - Updates the PT-ezETH supply cap to 2,000
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const jonesTokenVaultAddress = await deployContractAndSave(
    'JonesUSDCIsolationModeTokenVaultV1',
    [],
    'JonesUSDCV2IsolationModeTokenVaultV2',
    core.libraries.tokenVaultActionsImpl,
  );

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: core.jonesEcosystem.live.jUSDCV2IsolationModeFactory },
      'factory',
      'ownerSetUserVaultImplementation',
      [jonesTokenVaultAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetMaxWei',
      [core.marketIds.dPtEzEthJun2024, parseEther(`${2_000}`)],
    ),
  )
  ;

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    skipTimeDelay: true,
    invariants: async () => {
      expect(await core.jonesEcosystem.live.jUSDCV2IsolationModeFactory.userVaultImplementation())
        .to
        .eq(jonesTokenVaultAddress);
      expect((await core.dolomiteMargin.getMarketMaxWei(core.marketIds.dPtEzEthJun2024)).value)
        .to
        .eq(parseEther('2000'));
    },
  };
}

doDryRunAndCheckDeployment(main);
