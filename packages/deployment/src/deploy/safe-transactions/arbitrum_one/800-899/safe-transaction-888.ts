import { DolomiteOwnerV3__factory } from '@dolomite-exchange/modules-admin/src/types';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { BYTES_ZERO, Network, ONE_DAY_SECONDS } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import DolomiteOwnerTransitionArbitrum from './dolomite-owner-transition-arbitrum.json';

const SECONDS_TIME_LOCKED = ONE_DAY_SECONDS;
const SECONDS_FORCE_REVOKE_VETO_TIME_LOCKED = ONE_DAY_SECONDS * 30;
const SECONDS_VALID = ONE_DAY_SECONDS * 3;

/**
 * This script encodes the following transactions:
 * - Collects all addresses ever granted a role in the DolomiteOwnerV2 event JSON
 * - Saves their current roles to dolomite-owner-v2-roles.json
 * - Deploys the Owner V3 contract
 * - Submits caller registrations from the Arbitrum owner transition JSON
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const dolomiteOwnerV3Address = await deployContractAndSave('DolomiteOwnerV3', [
    core.gnosisSafe.address,
    SECONDS_TIME_LOCKED,
    SECONDS_FORCE_REVOKE_VETO_TIME_LOCKED,
    SECONDS_VALID,
  ]);
  const dolomiteOwnerV3 = DolomiteOwnerV3__factory.connect(dolomiteOwnerV3Address, core.hhUser1);

  const transactions: EncodedTransaction[] = [];
  for (const [address, info] of Object.entries(DolomiteOwnerTransitionArbitrum)) {
    if (info['computed-roles'].length === 0 && !info.bypassTimelock && !info.executor) {
      continue;
    }

    const computedRoles = info['computed-roles'].map(role => {
      return {
        role: BYTES_ZERO,
        destination: role.address,
        selector: role.signature
      };
    });

    const outerTransaction = await dolomiteOwnerV3.populateTransaction.ownerRegisterCaller(
      address,
      computedRoles,
      info.bypassTimelock,
      info.executor
    );
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteOwnerV3 },
        'dolomiteOwnerV3',
        'submitTransaction',
        [dolomiteOwnerV3.address, outerTransaction.data!]
      ),
    );
  }

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
      expect(await dolomiteOwnerV3.getDefaultAdmin()).to.eq(core.gnosisSafe.address);
      expect(await dolomiteOwnerV3.secondsTimeLocked()).to.eq(SECONDS_TIME_LOCKED);
      expect(await dolomiteOwnerV3.secondsForceRevokeVetoTimeLocked()).to.eq(SECONDS_FORCE_REVOKE_VETO_TIME_LOCKED);
      expect(await dolomiteOwnerV3.secondsValid()).to.eq(SECONDS_VALID);
    },
  };
}

doDryRunAndCheckDeployment(main);
