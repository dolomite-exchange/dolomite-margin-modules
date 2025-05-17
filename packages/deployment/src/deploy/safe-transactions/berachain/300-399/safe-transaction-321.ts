import { expect } from 'chai';
import { VeTokenClaim__factory } from 'packages/tokenomics/src/types';
import { getUpgradeableProxyConstructorParams } from '../../../../../../base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkIsGlobalOperator } from '../../../../utils/invariant-utils';

const BOYCO_AIRDROP_MERKLE_ROOT = '0x6e4481e144dd353481c8a8557add530053c7a94bba20245eae1e3cf82f914f28';

/**
 * This script encodes the following transactions:
 * - Deploys the Boyco claim contract
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const boycoAirdropAddress = await deployContractAndSave(
    'VeTokenClaim',
    [
      core.tokenomics.dolo.address,
      core.tokenomics.veDolo.address,
      core.dolomiteRegistry.address,
      core.dolomiteMargin.address,
    ],
    'VeTokenClaimImplementationV1',
  );
  const boycoAirdropImplementation = VeTokenClaim__factory.connect(boycoAirdropAddress, core.hhUser1);
  const boycoAirdropInitCalldata = await boycoAirdropImplementation.populateTransaction.initialize();
  const boycoAirdropProxyAddress = await deployContractAndSave(
    'UpgradeableProxy',
    getUpgradeableProxyConstructorParams(boycoAirdropAddress, boycoAirdropInitCalldata, core.dolomiteMargin),
    'VeTokenClaimProxy',
  );
  const boycoAirdrop = VeTokenClaim__factory.connect(boycoAirdropProxyAddress, core.hhUser1);

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      boycoAirdrop.address,
      true,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { boycoAirdrop }, 'boycoAirdrop', 'ownerSetHandler', [
      core.gnosisSafeAddress,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { boycoAirdrop }, 'boycoAirdrop', 'ownerSetMerkleRoot', [
      BOYCO_AIRDROP_MERKLE_ROOT,
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
      await checkIsGlobalOperator(core, boycoAirdrop, true);
      expect(await boycoAirdrop.handler()).to.eq(core.gnosisSafe.address);
      expect(await boycoAirdrop.merkleRoot()).to.eq(BOYCO_AIRDROP_MERKLE_ROOT);
    },
  };
}

doDryRunAndCheckDeployment(main);
