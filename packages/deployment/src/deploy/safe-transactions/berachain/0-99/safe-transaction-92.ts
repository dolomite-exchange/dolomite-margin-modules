import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

// @follow-up Update addresses
const remappedAddresses = [
  {
    arbitrumAddress: '0x0000000000000000000000000000000000000000',
    berachainAddress: '0x1111111111111111111111111111111111111111',
  },
  {
    arbitrumAddress: '0x2222222222222222222222222222222222222222',
    berachainAddress: '0x3333333333333333333333333333333333333333',
  },
];

/**
 * This script encodes the following transactions:
 * - Sets the remapped addresses on airdrop and vesting claims contracts
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];
  const arbitrumAddresses = remappedAddresses.map((remappedAddress) => remappedAddress.arbitrumAddress);
  const berachainAddresses = remappedAddresses.map((remappedAddress) => remappedAddress.berachainAddress);

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { regularAirdrop: core.tokenomicsAirdrop.regularAirdrop },
      'regularAirdrop',
      'ownerSetAddressRemapping',
      [berachainAddresses, arbitrumAddresses],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { optionAirdrop: core.tokenomicsAirdrop.optionAirdrop },
      'optionAirdrop',
      'ownerSetAddressRemapping',
      [berachainAddresses, arbitrumAddresses],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { regularInvestorVesting: core.tokenomicsAirdrop.regularInvestorVesting },
      'regularInvestorVesting',
      'ownerSetAddressRemapping',
      [berachainAddresses, arbitrumAddresses],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { strategicVesting: core.tokenomicsAirdrop.strategicVesting },
      'strategicVesting',
      'ownerSetAddressRemapping',
      [berachainAddresses, arbitrumAddresses],
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
      for (const remappedAddress of remappedAddresses) {
        assertHardhatInvariant(
          (await core.tokenomicsAirdrop.regularAirdrop.addressRemapping(remappedAddress.berachainAddress)) ===
            remappedAddress.arbitrumAddress,
          'Regular airdrop address remapping is incorrect',
        );
        assertHardhatInvariant(
          (await core.tokenomicsAirdrop.optionAirdrop.addressRemapping(remappedAddress.berachainAddress)) ===
            remappedAddress.arbitrumAddress,
          'Option airdrop address remapping is incorrect',
        );
        assertHardhatInvariant(
          (await core.tokenomicsAirdrop.regularInvestorVesting.addressRemapping(remappedAddress.berachainAddress)) ===
            remappedAddress.arbitrumAddress,
          'Vesting claims address remapping is incorrect',
        );
        assertHardhatInvariant(
          (await core.tokenomicsAirdrop.strategicVesting.addressRemapping(remappedAddress.berachainAddress)) ===
            remappedAddress.arbitrumAddress,
          'Strategic vesting address remapping is incorrect',
        );
      }
    },
  };
}

doDryRunAndCheckDeployment(main);
