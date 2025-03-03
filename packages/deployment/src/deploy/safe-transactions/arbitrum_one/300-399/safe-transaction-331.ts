import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { ADDRESS_ZERO, Network } from 'packages/base/src/utils/no-deps-constants';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Set initial restricted accounts on the Account Registry
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });
  const selectorTransaction = await core.dolomiteAccountRegistry.populateTransaction.ownerSetRestrictedAccount(
    ADDRESS_ZERO,
    false,
  );

  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(core, { multisig: core.delayedMultiSig }, 'multisig', 'setSelector', [
      ADDRESS_ZERO,
      selectorTransaction.data!.substring(0, 10),
      true,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.dolomiteAccountRegistry },
      'registry',
      'ownerSetRestrictedAccount',
      [core.liquidityMiningEcosystem.oARB.oArbVesterProxy.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.dolomiteAccountRegistry },
      'registry',
      'ownerSetRestrictedAccount',
      [core.liquidityMiningEcosystem.goARB.goArbVesterProxy.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.dolomiteAccountRegistry },
      'registry',
      'ownerSetRestrictedAccount',
      ['0xb77a493A4950cAd1b049E222d62BCE14fF423c6F', true], // USDC.e/ETH pool
    ),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant(
        await core.dolomiteAccountRegistry.isRestrictedAccount(
          core.liquidityMiningEcosystem.oARB.oArbVesterProxy.address,
        ),
        'Must be restricted',
      );
      assertHardhatInvariant(
        await core.dolomiteAccountRegistry.isRestrictedAccount(
          core.liquidityMiningEcosystem.goARB.goArbVesterProxy.address,
        ),
        'Must be restricted',
      );
      assertHardhatInvariant(
        await core.dolomiteAccountRegistry.isRestrictedAccount('0xb77a493A4950cAd1b049E222d62BCE14fF423c6F'),
        'Must be restricted',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
