import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '../../../../../../base/src/utils/no-deps-constants';
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

  const investorAllocations = await import('../../../ecosystems/helpers/airdrop/investor-allocations.json');
  const mappings = await import('../../../ecosystems/helpers/airdrop/airdrop-mappings.json');

  const addressToRegularInvestorAmountMap = investorAllocations.regularInvestors.reduce((acc, current) => {
    acc[current.address.toLowerCase()] = parseEther(current.amount);
    return acc;
  }, {} as Record<string, BigNumber>);
  investorAllocations.strategicInvestors.forEach((investor) => {
    const address = investor.address.toLowerCase();
    if (!addressToRegularInvestorAmountMap[address]) {
      addressToRegularInvestorAmountMap[address] = ZERO_BI;
    }
    addressToRegularInvestorAmountMap[address] = addressToRegularInvestorAmountMap[address].add(
      parseEther(investor.amount),
    );
  }, {} as Record<string, BigNumber>);

  const addressToAdvisorMap = investorAllocations.advisors.reduce((acc, current) => {
    acc[current.address.toLowerCase()] = parseEther(current.amount);
    return acc;
  }, {} as Record<string, BigNumber>);

  const addressToStrategicInvestorMap = investorAllocations.strategicInvestors.reduce((acc, current) => {
    acc[current.address.toLowerCase()] = parseEther(current.amount);
    return acc;
  }, {} as Record<string, BigNumber>);

  const fullDoloUsers = mappings.fullDolo.map((f) => f.address);

  const advisorVesting = core.tokenomicsAirdrop.advisorVesting;
  const optionAirdrop = core.tokenomicsAirdrop.optionAirdrop;
  const regularAirdrop = core.tokenomicsAirdrop.regularAirdrop;
  const regularInvestorVesting = core.tokenomicsAirdrop.regularInvestorVesting;
  const strategicVesting = core.tokenomicsAirdrop.strategicVesting;

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { optionAirdrop },
      'optionAirdrop',
      'ownerSetAddressRemapping',
      [
        mappings.optionAirdropRemappings.map((r) => r.userAddress),
        mappings.optionAirdropRemappings.map((r) => r.remappedUserAddress),
      ],
      { skipWrappingCalldataInSubmitTransaction: true },
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { regularAirdrop },
      'regularAirdrop',
      'ownerSetAddressRemapping',
      [
        mappings.regularAirdropRemappings.map((r) => r.userAddress),
        mappings.regularAirdropRemappings.map((r) => r.remappedUserAddress),
      ],
      { skipWrappingCalldataInSubmitTransaction: true },
    ),

    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { regularAirdrop },
      'regularAirdrop',
      'ownerSetUserToFullDolo',
      [fullDoloUsers, fullDoloUsers.map(() => true)],
      { skipWrappingCalldataInSubmitTransaction: true },
    ),

    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { regularInvestorVesting },
      'regularInvestorVesting',
      'ownerSetAllocatedAmounts',
      [
        Object.entries(addressToRegularInvestorAmountMap).map(([address]) => address),
        Object.entries(addressToRegularInvestorAmountMap).map(([, amount]) => amount),
      ],
    ),

    await prettyPrintEncodedDataWithTypeSafety(core, { advisorVesting }, 'advisorVesting', 'ownerSetAllocatedAmounts', [
      Object.entries(addressToAdvisorMap).map(([address]) => address),
      Object.entries(addressToAdvisorMap).map(([, amount]) => amount),
    ]),

    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { strategicVesting },
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
    invariants: async () => {
      console.log(
        'Advisor Total DOLO:',
        Object.values(addressToAdvisorMap).reduce((a, b) => a.add(b), ZERO_BI),
      );
      console.log(
        'Regular Investor Total DOLO:',
        Object.values(addressToRegularInvestorAmountMap).reduce((a, b) => a.add(b), ZERO_BI),
      );
      console.log(
        'Strategic Investor Total DOLO:',
        Object.values(addressToStrategicInvestorMap).reduce((a, b) => a.add(b), ZERO_BI),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
