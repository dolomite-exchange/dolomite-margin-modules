import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';

// @todo Update these values
const REGULAR_AIRDROP_AMOUNT = parseEther('1000');
const REGULAR_AIRDROP_MERKLE_ROOT = '0x0000000000000000000000000000000000000000000000000000000000000000';

const OPTION_AIRDROP_AMOUNT = parseEther('1000');
const OPTION_AIRDROP_MERKLE_ROOT = '0x0000000000000000000000000000000000000000000000000000000000000000';

const VESTING_CLAIMS_AMOUNT = parseEther('1000');
const VESTING_CLAIMS_MERKLE_ROOT = '0x0000000000000000000000000000000000000000000000000000000000000000';

const STRATEGIC_VESTING_CLAIMS_AMOUNT = parseEther('1000');
const STRATEGIC_VESTING_CLAIMS_MERKLE_ROOT = '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * This script encodes the following transactions:
 * - Transfers DOLO and sets merkle root for option airdrop, regular airdrop, and both vesting claims contracts
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];

  // Regular airdrop
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolo: core.tokenomics.dolo },
      'dolo',
      'transfer',
      [core.tokenomics.regularAirdrop.address, REGULAR_AIRDROP_AMOUNT],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { regularAirdrop: core.tokenomics.regularAirdrop },
      'regularAirdrop',
      'ownerSetMerkleRoot',
      [REGULAR_AIRDROP_MERKLE_ROOT],
    ),
  );

  // Option airdrop
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolo: core.tokenomics.dolo },
      'dolo',
      'transfer',
      [core.tokenomics.optionAirdrop.address, OPTION_AIRDROP_AMOUNT],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { optionAirdrop: core.tokenomics.optionAirdrop },
      'optionAirdrop',
      'ownerSetMerkleRoot',
      [OPTION_AIRDROP_MERKLE_ROOT],
    ),
  );

  // Vesting claims
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolo: core.tokenomics.dolo },
      'dolo',
      'transfer',
      [core.tokenomics.vestingClaims.address, VESTING_CLAIMS_AMOUNT],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { vestingClaims: core.tokenomics.vestingClaims },
      'vestingClaims',
      'ownerSetMerkleRoot',
      [VESTING_CLAIMS_MERKLE_ROOT],
    ),
  );

  // Strategic vesting claims
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolo: core.tokenomics.dolo },
      'dolo',
      'transfer',
      [core.tokenomics.strategicVesting.address, STRATEGIC_VESTING_CLAIMS_AMOUNT],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { strategicVesting: core.tokenomics.strategicVesting },
      'strategicVesting',
      'ownerSetMerkleRoot',
      [STRATEGIC_VESTING_CLAIMS_MERKLE_ROOT],
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
        await core.tokenomics.dolo.balanceOf(core.tokenomics.regularAirdrop.address) === REGULAR_AIRDROP_AMOUNT,
        'Regular airdrop balance is incorrect'
      );
      assertHardhatInvariant(
        await core.tokenomics.dolo.balanceOf(core.tokenomics.optionAirdrop.address) === OPTION_AIRDROP_AMOUNT,
        'Option airdrop balance is incorrect'
      );
      assertHardhatInvariant(
        await core.tokenomics.dolo.balanceOf(core.tokenomics.vestingClaims.address) === VESTING_CLAIMS_AMOUNT,
        'Vesting claims balance is incorrect'
      );
      assertHardhatInvariant(
        await core.tokenomics.dolo.balanceOf(core.tokenomics.strategicVesting.address) === STRATEGIC_VESTING_CLAIMS_AMOUNT,
        'Strategic vesting claims balance is incorrect'
      );

      assertHardhatInvariant(
        await core.tokenomics.regularAirdrop.merkleRoot() === REGULAR_AIRDROP_MERKLE_ROOT,
        'Regular airdrop merkle root is incorrect'
      );
      assertHardhatInvariant(
        await core.tokenomics.optionAirdrop.merkleRoot() === OPTION_AIRDROP_MERKLE_ROOT,
        'Option airdrop merkle root is incorrect'
      );
      assertHardhatInvariant(
        await core.tokenomics.vestingClaims.merkleRoot() === VESTING_CLAIMS_MERKLE_ROOT,
        'Vesting claims merkle root is incorrect'
      );
      assertHardhatInvariant(
        await core.tokenomics.strategicVesting.merkleRoot() === STRATEGIC_VESTING_CLAIMS_MERKLE_ROOT,
        'Strategic vesting claims merkle root is incorrect'
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
