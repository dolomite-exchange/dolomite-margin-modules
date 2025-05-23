import { expect } from 'chai';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Set the treasury from the registry to the Foundation (for easier claims)
 * - Upgrade the veDOLO implementation to have better event handling
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const veDoloAddress = await deployContractAndSave('VotingEscrow', [], 'VotingEscrowImplementationV3');
  const feeCalculatorAddress = await deployContractAndSave(
    'VeFeeCalculator',
    [core.dolomiteMargin.address],
    'VeFeeCalculatorV2',
  );

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteRegistry', 'ownerSetTreasury', [
      core.gnosisSafeAddress,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core.tokenomics, 'veDoloProxy', 'upgradeTo', [veDoloAddress]),
    await prettyPrintEncodedDataWithTypeSafety(core, core.tokenomics, 'veDolo', 'setFeeCalculator', [
      feeCalculatorAddress,
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
      expect(await core.dolomiteRegistry.treasury()).to.eq(core.gnosisSafeAddress);
      expect(await core.tokenomics.veDoloProxy.implementation()).to.eq(veDoloAddress);
      expect(await core.tokenomics.veDolo.feeCalculator()).to.eq(feeCalculatorAddress);
    },
  };
}

doDryRunAndCheckDeployment(main);
