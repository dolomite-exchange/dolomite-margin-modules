import { RegistryProxy__factory } from '@dolomite-exchange/modules-base/src/types';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import {
  encodeSetupDolomite4626Token,
  setupDolomiteOwnerV2,
} from '../../../../utils/encoding/dolomite-4626-token-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  getDolomiteErc4626ImplementationConstructorParams,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';

/**
 * This script encodes the following transactions:
 * - Deploys new 4626 dToken implementation contracts
 * - Upgrades each existing 4626 dToken to the new implementation
 * - Gives appropriate DolomiteOwnerV2 roles to each 4626 contract
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const erc4626Implementation = await deployContractAndSave(
    'DolomiteERC4626',
    await getDolomiteErc4626ImplementationConstructorParams(core),
    'DolomiteERC4626ImplementationV2',
  );
  const erc4626PayableImplementation = await deployContractAndSave(
    'DolomiteERC4626WithPayable',
    await getDolomiteErc4626ImplementationConstructorParams(core),
    'DolomiteERC4626WithPayableImplementationV2',
  );

  const transactions: EncodedTransaction[] = [
    ...await setupDolomiteOwnerV2(core),
  ];

  for (let i = 0; i < core.dolomiteTokens.all.length; i += 1) {
    // Upgrade the implementations
    const dToken = core.dolomiteTokens.all[i];
    const proxy = RegistryProxy__factory.connect(dToken.address, core.hhUser1);
    if ('depositFromPayable' in dToken) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(core, { proxy }, 'proxy', 'upgradeTo', [
          erc4626PayableImplementation,
        ]),
      );
    } else {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(core, { proxy }, 'proxy', 'upgradeTo', [erc4626Implementation]),
      );
    }

    transactions.push(...(await encodeSetupDolomite4626Token(core, dToken)));
  }

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);
