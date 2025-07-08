import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { parseEther } from 'ethers/lib/utils';

/**
 * This script encodes the following transactions:
 * - Deploy and set up new VeVester implementation
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.tokens,
      'dolo',
      'approve',
      [
        core.tokenomics.veExternalVester.address,
        parseEther(`${50_000_000}`),
      ],
    ),
    await prettyPrintEncodedDataWithTypeSafety(core, core.tokenomics, 'veExternalVester', 'ownerDepositRewardToken', [
      parseEther(`${50_000_000}`),
    ]),
  ];

  return {
    core,
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: core.network,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    scriptName: getScriptName(__filename),
    invariants: async () => {
      expect(await core.tokens.dolo.balanceOf(core.tokenomics.veExternalVester.address))
        .to
        .be
        .gt(parseEther(`${50_000_000}`));
      expect(await core.tokens.dolo.allowance(core.governanceAddress, core.tokenomics.veExternalVester.address))
        .to
        .eq(ZERO_BI);
      expect(await core.tokenomics.veExternalVester.pushedTokens()).to.be.gt(parseEther(`${50_000_000}`));
    },
  };
}

doDryRunAndCheckDeployment(main);
