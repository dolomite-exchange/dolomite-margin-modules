import { BigNumber } from 'ethers';
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
 * - Set initial addresses and amounts for vesting contracts
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const remappings = await import('../../../ecosystems/helpers/airdrop/airdrop-mappings.json');
  const investorAllocations = await import('../../../ecosystems/helpers/airdrop/investor-allocations.json');

  const remappingData = remappings.remappings2;

  const addressToStrategicInvestorMap = investorAllocations.strategicInvestors2.reduce((acc, current) => {
    acc[current.address.toLowerCase()] = parseEther(current.amount);
    return acc;
  }, {} as Record<string, BigNumber>);

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.tokenomicsAirdrop,
      'regularAirdrop',
      'ownerSetAddressRemapping',
      [remappingData.map((r) => r.oldUserAddress), remappingData.map((r) => r.newUserAddress)],
      { skipWrappingCalldataInSubmitTransaction: true },
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.tokenomicsAirdrop,
      'optionAirdrop',
      'ownerSetAddressRemapping',
      [remappingData.map((r) => r.oldUserAddress), remappingData.map((r) => r.newUserAddress)],
      { skipWrappingCalldataInSubmitTransaction: true },
    ),

    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.tokenomicsAirdrop,
      'regularInvestorVesting',
      'ownerSetAllocatedAmounts',
      [
        Object.entries(addressToStrategicInvestorMap).map(([address]) => address),
        Object.entries(addressToStrategicInvestorMap).map(([, amount]) => amount),
      ],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.tokenomicsAirdrop,
      'strategicVesting',
      'ownerSetAllocatedAmounts',
      [
        Object.entries(addressToStrategicInvestorMap).map(([address]) => address),
        Object.entries(addressToStrategicInvestorMap).map(([, amount]) => amount),
      ],
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
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);
