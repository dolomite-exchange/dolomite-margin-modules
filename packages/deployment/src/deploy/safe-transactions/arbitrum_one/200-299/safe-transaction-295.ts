import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { JonesUSDCIsolationModeTokenVaultV1__factory } from '@dolomite-exchange/modules-jones/src/types';
import { expect } from 'chai';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Updates the Jones Whitelist Controller to be V2 instead of V1
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.jonesEcosystem.live.jonesUSDCV2Registry },
      'registry',
      'ownerSetWhitelistController',
      [core.jonesEcosystem.whitelistControllerV2.address],
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
      expect(await core.jonesEcosystem.live.jonesUSDCV2Registry.whitelistController())
        .to
        .eq(core.jonesEcosystem.whitelistControllerV2.address);

      const tokenVault = JonesUSDCIsolationModeTokenVaultV1__factory.connect(
        '0x7a4cbd82b1568587422e086fed3cb386d1b18edc',
        core.hhUser1,
      );
      expect(await tokenVault.isExternalRedemptionPaused()).to.be.false;
    },
  };
}

doDryRunAndCheckDeployment(main);
