import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Changes GMX to be borrowable
 * - Changes the GMX supply cap to 50k
 * - Changes the sGMX supply cap to 100k
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetIsClosing',
      [core.marketIds.gmx, false],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetMaxWei',
      [core.marketIds.gmx, parseEther(`${50_000}`)],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetMaxWei',
      [core.marketIds.dGmx, parseEther(`${100_000}`)],
    ),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant(
        !(await core.dolomiteMargin.getMarketIsClosing(core.marketIds.gmx)),
        'GMX must not be closing',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketMaxWei(core.marketIds.gmx)).value.eq(parseEther(`${50_000}`)),
        'Invalid GMX max wei',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketMaxWei(core.marketIds.dGmx)).value.eq(parseEther(`${100_000}`)),
        'Invalid sGMX max wei',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
