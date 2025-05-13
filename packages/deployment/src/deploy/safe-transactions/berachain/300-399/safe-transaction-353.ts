import { expect } from 'chai';
import { BigNumber } from 'ethers';
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
import Deployments from '../../../deployments.json';

const BOYCO_PARTNER_AIRDROP_MERKLE_ROOT = '0xfa190eb9ac3a57cb05f956b654054780cc80bbbbab2e5316c962797e95624075';
const DOLO_AMOUNT = BigNumber.from('5592674851887171961327208');

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

  const boycoAirdropAddress = Deployments.VeTokenClaimImplementationV1[network].address;
  const boycoAirdropImplementation = VeTokenClaim__factory.connect(boycoAirdropAddress, core.hhUser1);
  const boycoAirdropInitCalldata = await boycoAirdropImplementation.populateTransaction.initialize();
  const boycoAirdropProxyAddress = await deployContractAndSave(
    'UpgradeableProxy',
    getUpgradeableProxyConstructorParams(boycoAirdropAddress, boycoAirdropInitCalldata, core.dolomiteMargin),
    'BoycoPartnerClaimProxy',
  );
  const boycoPartnerAirdrop = VeTokenClaim__factory.connect(boycoAirdropProxyAddress, core.hhUser1);

  const boycoAirdrop = VeTokenClaim__factory.connect(Deployments.VeTokenClaimProxy[network].address, core.hhUser1);

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'dolomiteMargin', 'ownerSetGlobalOperator', [
      boycoPartnerAirdrop.address,
      true,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { boycoPartnerAirdrop },
      'boycoPartnerAirdrop',
      'ownerSetHandler',
      [core.gnosisSafeAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { boycoPartnerAirdrop },
      'boycoPartnerAirdrop',
      'ownerSetMerkleRoot',
      [BOYCO_PARTNER_AIRDROP_MERKLE_ROOT],
    ),

    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { boycoAirdrop },
      'boycoAirdrop',
      'ownerWithdrawRewardToken',
      [core.tokenomics.dolo.address, core.gnosisSafeAddress],
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
      await checkIsGlobalOperator(core, boycoPartnerAirdrop, true);
      expect(await boycoPartnerAirdrop.handler()).to.eq(core.gnosisSafe.address);
      expect(await boycoPartnerAirdrop.merkleRoot()).to.eq(BOYCO_PARTNER_AIRDROP_MERKLE_ROOT);
    },
  };
}

doDryRunAndCheckDeployment(main);
