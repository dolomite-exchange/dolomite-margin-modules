import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getVeDoloVesterImplementationConstructorParams,
} from '@dolomite-exchange/modules-tokenomics/src/tokenomics-constructors';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Adjust sWBERA stuff
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const veExternalVesterImplementationAddress = await deployContractAndSave(
    'VeExternalVesterImplementationV1',
    getVeDoloVesterImplementationConstructorParams(core),
    'VeExternalVesterImplementationV7',
  );

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(core, core.tokenomics, 'veExternalVesterProxy', 'upgradeTo', [
      veExternalVesterImplementationAddress,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core.tokenomics, 'veExternalVester', 'ownerWithdrawRewardToken', [
      core.daoAddress!,
      parseEther(`${45_000_000}`),
      false,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core.tokenomics, 'veExternalVester', 'ownerSyncRewardToken', []),
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
      expect(await core.tokenomics.veExternalVesterProxy.implementation()).to.eq(veExternalVesterImplementationAddress);
      expect(await core.tokenomics.veExternalVester.pushedTokens()).to.eq(BigNumber.from('3397982098708630227437739'));
      expect(await core.tokenomics.veExternalVester.availableTokens()).to.eq(
        BigNumber.from('1547139876804616201650327'),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
