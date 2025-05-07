import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ZERO_BI } from '../../../../../../base/src/utils/no-deps-constants';
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

  const optionAirdrop = core.tokenomicsAirdrop.optionAirdrop;
  const regularAirdrop = core.tokenomicsAirdrop.regularAirdrop;

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { optionAirdrop },
      'optionAirdrop',
      'ownerSetAddressRemapping',
      [
        mappings.optionAirdropRemappings.map((r) => r.userAddress),
        mappings.optionAirdropRemappings.map(() => ADDRESS_ZERO),
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
        mappings.regularAirdropRemappings.map(() => ADDRESS_ZERO), // Unset old ones
      ],
      { skipWrappingCalldataInSubmitTransaction: true },
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { regularAirdrop },
      'regularAirdrop',
      'ownerSetAddressRemapping',
      [
        mappings.regularAirdropRemappings.map((r) => r.remappedUserAddress),
        mappings.regularAirdropRemappings.map((r) => r.userAddress),
      ],
      { skipWrappingCalldataInSubmitTransaction: true },
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { optionAirdrop },
      'optionAirdrop',
      'ownerSetAddressRemapping',
      [
        mappings.optionAirdropRemappings.map((r) => r.remappedUserAddress),
        mappings.optionAirdropRemappings.map((r) => r.userAddress),
      ],
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
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);
