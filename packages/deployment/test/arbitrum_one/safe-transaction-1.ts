import hardhat from 'hardhat';
import { createContractWithAbi, getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../src/utils/dry-run-utils';
import getScriptName from '../../src/utils/get-script-name';
import { DolomiteOwner, DolomiteOwner__factory } from 'packages/base/src/types';
import { prettyPrintEncodedDataWithTypeSafety } from '../../src/utils/deploy-utils';

const GOVERNANCE_ADDRESS = '0x52d7BcB650c591f6E8da90f797A1d0Bfd8fD05F9';

/**
 * This script encodes the following transactions:
 * - Switch owner of Dolomite Margin to be the DolomiteOwner contract
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  if (hardhat.network.name !== 'hardhat') {
    throw new Error('This script should only be run on hardhat network');
  }

  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });
  (core as any).ownerAdapter = (await createContractWithAbi<DolomiteOwner>(
    DolomiteOwner__factory.abi,
    DolomiteOwner__factory.bytecode,
    [GOVERNANCE_ADDRESS]
  )).connect(core.governance);

  await core.dolomiteMargin.transferOwnership(core.ownerAdapter.address);
  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetMaxWei',
      [core.marketIds.dplvGlp, 2],
    ),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketMaxWei(core.marketIds.dplvGlp)).value.eq(2),
        'Invalid GRAIL max wei',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.owner()) === core.ownerAdapter.address,
        'Invalid owner address',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
