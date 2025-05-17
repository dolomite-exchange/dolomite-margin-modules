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

  const balanceBefore1 = await core.tokenomics.dolo.balanceOf(core.tokenomicsAirdrop.regularInvestorVesting.address);
  const balanceBefore2 = await core.tokenomics.dolo.balanceOf(core.gnosisSafeAddress);
  const amount = parseEther(`${640_000}`);
  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.tokenomicsAirdrop,
      'regularInvestorVesting',
      'ownerSetAllocatedAmounts',
      [['0xe11Eb0BC4B34DEa57DcB0b74019Ba05b28B6f91c'], [amount]],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.tokenomics,
      'dolo',
      'transfer',
      [core.tokenomicsAirdrop.regularInvestorVesting.address, amount],
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
      expect(balanceBefore1.add(amount)).to.eq(
        await core.tokenomics.dolo.balanceOf(core.tokenomicsAirdrop.regularInvestorVesting.address),
      );
      expect(balanceBefore2.sub(amount)).to.eq(await core.tokenomics.dolo.balanceOf(core.gnosisSafeAddress));
    },
  };
}

doDryRunAndCheckDeployment(main);
