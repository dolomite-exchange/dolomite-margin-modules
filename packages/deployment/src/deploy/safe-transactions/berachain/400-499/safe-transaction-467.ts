import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { MAX_UINT_256_BI, Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  getVeExternalVesterImplementationConstructorParams,
} from 'packages/tokenomics/src/tokenomics-constructors';

const NO_MARKET_ID = MAX_UINT_256_BI;

/**
 * This script encodes the following transactions:
 * - Deploy and set up new VeVester implementation
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const implementationAddress = await deployContractAndSave(
    'VeExternalVesterImplementationV1',
    getVeExternalVesterImplementationConstructorParams(
      core,
      core.tokenomics.dolo, // pairToken
      NO_MARKET_ID,
      core.tokens.usdc, // payment token
      core.marketIds.usdc,
      core.tokenomics.dolo, // rewardToken
      NO_MARKET_ID,
    ),
    'VeExternalVesterImplementationV2',
  );

  const transactions = [
    await prettyPrintEncodedDataWithTypeSafety(core, core.tokenomics, 'veExternalVesterProxy', 'upgradeTo', [
      implementationAddress,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.tokenomics,
      'veExternalVester',
      'ownerRegisterDistributor',
      [],
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
      expect(await core.tokenomics.veExternalVesterProxy.implementation()).to.eq(implementationAddress);
    },
  };
}

doDryRunAndCheckDeployment(main);
