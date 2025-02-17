import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { USDMRouter__factory } from 'packages/mountain/src/types';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys the USDM --> wUSDM router and sets it as a global operator
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const routerAddress = await deployContractAndSave(
    'USDMRouter',
    [
      core.dolomiteMargin.address,
      core.tokens.usdm.address,
      core.tokens.wusdm.address
    ],
  );
  const router = USDMRouter__factory.connect(routerAddress, core.hhUser1);

  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [router.address, true],
    ),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(routerAddress),
        'Invalid global operator',
      );
      assertHardhatInvariant(
        await router.USDM() === core.tokens.usdm.address,
        'Invalid USDM',
      );
      assertHardhatInvariant(
        await router.W_USDM() === core.tokens.wusdm.address,
        'Invalid wUSDM',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
