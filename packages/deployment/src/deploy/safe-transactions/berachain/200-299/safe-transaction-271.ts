import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Update vesting for one investor
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const balanceBefore1 = await core.tokenomics.dolo.balanceOf(core.tokenomicsAirdrop.strategicVesting.address);
  const balanceBefore2 = await core.tokenomics.dolo.balanceOf(core.gnosisSafeAddress);
  const amount = parseEther(`${166_667}`);
  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.tokenomicsAirdrop,
      'strategicVesting',
      'ownerRevokeInvestor',
      ['0xe11Eb0BC4B34DEa57DcB0b74019Ba05b28B6f91c', core.gnosisSafeAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.tokenomicsAirdrop,
      'strategicVesting',
      'ownerSetAllocatedAmounts',
      [['0xf8dDAFa195177E7e7879e1C6f36808c504FF5321'], [amount]],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.tokenomics,
      'dolo',
      'transfer',
      [core.tokenomicsAirdrop.strategicVesting.address, amount],
      { skipWrappingCalldataInSubmitTransaction: true },
    ),
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
      expect(balanceBefore1).to.eq(
        await core.tokenomics.dolo.balanceOf(core.tokenomicsAirdrop.strategicVesting.address),
      );
      expect(balanceBefore2).to.eq(await core.tokenomics.dolo.balanceOf(core.gnosisSafeAddress));
    },
  };
}

doDryRunAndCheckDeployment(main);
