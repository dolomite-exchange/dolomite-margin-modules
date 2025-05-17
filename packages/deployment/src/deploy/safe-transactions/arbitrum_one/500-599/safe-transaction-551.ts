import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { ethers } from 'ethers';
import { FinalSettlementViaInternalSwapProxy__factory } from '../../../../../../base/src/types';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import {
  encodeGrantBypassTimelockAndExecutorRolesIfNecessary,
  encodeGrantRoleIfNecessary,
} from '../../../../utils/encoding/dolomite-owner-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import ModulesDeployment from '../../../deployments.json';

const GRAI_EXECUTOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('GRAI_EXECUTOR_ROLE'));
const GRAI_EXECUTOR = '0x53D93b9CD019311CABF031e52CDaEED795f9A825';

/**
 * This script encodes the following transactions:
 * - Execute final settlement against chunked positions
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const finalSettlement = FinalSettlementViaInternalSwapProxy__factory.connect(
    ModulesDeployment.FinalSettlementViaInternalSwapProxyV1[network].address,
    core.hhUser1,
  );

  const transactions: EncodedTransaction[] = [
    ...(await encodeGrantRoleIfNecessary(core, GRAI_EXECUTOR_ROLE, { address: GRAI_EXECUTOR })),
    await prettyPrintEncodedDataWithTypeSafety(core, { owner: core.ownerAdapterV2 }, 'owner', 'ownerAddRoleAddresses', [
      GRAI_EXECUTOR_ROLE,
      [finalSettlement.address],
    ]),
    ...(await encodeGrantBypassTimelockAndExecutorRolesIfNecessary(core, { address: GRAI_EXECUTOR })),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);
