import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Enables claim on airdrop and vesting claims contracts
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { regularAirdrop: core.tokenomics.regularAirdrop },
      'regularAirdrop',
      'ownerSetClaimEnabled',
      [true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { optionAirdrop: core.tokenomics.optionAirdrop },
      'optionAirdrop',
      'ownerSetClaimEnabled',
      [true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { vestingClaims: core.tokenomics.vestingClaims },
      'vestingClaims',
      'ownerSetClaimEnabled',
      [true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { strategicVesting: core.tokenomics.strategicVesting },
      'strategicVesting',
      'ownerSetClaimEnabled',
      [true],
    ),
  );

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
      assertHardhatInvariant(
        await core.tokenomics.regularAirdrop.claimEnabled(),
        'Regular airdrop claim is not enabled',
      );
      assertHardhatInvariant(await core.tokenomics.optionAirdrop.claimEnabled(), 'Option airdrop claim is not enabled');
      assertHardhatInvariant(await core.tokenomics.vestingClaims.claimEnabled(), 'Vesting claims claim is not enabled');
      assertHardhatInvariant(
        await core.tokenomics.strategicVesting.claimEnabled(),
        'Strategic vesting claim is not enabled',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
