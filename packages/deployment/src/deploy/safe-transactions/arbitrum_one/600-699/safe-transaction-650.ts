import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { RegistryProxy__factory } from '../../../../../../base/src/types';
import { ModuleDeployments } from '../../../../utils';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import { encodeSetGlobalOperator } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets the implementation for the ERC20 tokens
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const implementationAddress = await deployContractAndSave(
    'DolomiteERC20',
    [core.network],
    'DolomiteERC20ImplementationV4',
  );
  const payableImplementationAddress = await deployContractAndSave(
    'DolomiteERC20WithPayable',
    [core.tokens.payableToken.address, core.network],
    'DolomiteERC20WithPayableImplementationV4',
  );

  const usdcProxy = RegistryProxy__factory.connect(
    ModuleDeployments.DolomiteUsdcToken[core.network].address,
    core.hhUser1,
  );
  const wbtcProxy = RegistryProxy__factory.connect(
    ModuleDeployments.DolomiteWbtcToken[core.network].address,
    core.hhUser1,
  );
  const wethProxy = RegistryProxy__factory.connect(
    ModuleDeployments.DolomiteWethToken[core.network].address,
    core.hhUser1,
  );

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { usdcProxy },
      'usdcProxy',
      'upgradeTo',
      [implementationAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { wbtcProxy },
      'wbtcProxy',
      'upgradeTo',
      [implementationAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { wethProxy },
      'wethProxy',
      'upgradeTo',
      [payableImplementationAddress],
    ),
    await encodeSetGlobalOperator(core, wethProxy.address, false),
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
