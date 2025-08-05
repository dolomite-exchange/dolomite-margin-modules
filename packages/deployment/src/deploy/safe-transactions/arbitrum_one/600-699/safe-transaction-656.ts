import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import {
  encodeSetInterestSetter, encodeSetIsCollateralOnly,
  encodeSetSupplyCap, encodeSetSupplyCapWithMagic,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets up the ownership properties for the Dolomite ERC20 tokens
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const implementationAddress = await deployContractAndSave(
    'JonesUSDCIsolationModeTokenVaultV3',
    [],
    'JonesUSDCV2IsolationModeTokenVaultV7',
    core.libraries.tokenVaultActionsImpl,
  );

  const marketIds = core.marketIds;
  const interestSetters = core.interestSetters;
  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.jonesEcosystem.live,
      'jUSDCV2IsolationModeFactory',
      'ownerSetUserVaultImplementation',
      [implementationAddress],
    ),
    await encodeSetSupplyCap(core, core.marketIds.djUsdcV2, ONE_BI),
    await encodeSetSupplyCap(core, core.marketIds.woEth, ONE_BI),
    await encodeSetSupplyCap(core, core.marketIds.mim, ONE_BI),
    await encodeSetSupplyCap(core, core.marketIds.wusdm, ONE_BI),

    await encodeSetSupplyCapWithMagic(core, marketIds.jones, 50_000),
    await encodeSetSupplyCapWithMagic(core, marketIds.premia, 50_000),
    await encodeSetSupplyCapWithMagic(core, marketIds.radiant, 250_000),
    await encodeSetSupplyCapWithMagic(core, marketIds.xai, 250_000),

    await encodeSetIsCollateralOnly(core, core.marketIds.ezEth, true),
    await encodeSetIsCollateralOnly(core, core.marketIds.magic, true),
    await encodeSetIsCollateralOnly(core, core.marketIds.mim, true),
    await encodeSetIsCollateralOnly(core, core.marketIds.radiant, true),
    await encodeSetIsCollateralOnly(core, core.marketIds.rsEth, true),
    await encodeSetIsCollateralOnly(core, core.marketIds.wusdm, true),
    await encodeSetIsCollateralOnly(core, core.marketIds.xai, true),

    await encodeSetInterestSetter(core, marketIds.wbtc, interestSetters.linearStepFunction6L94U90OInterestSetter),
    await encodeSetInterestSetter(core, marketIds.gmx, interestSetters.linearStepFunction10L90U90OInterestSetter),
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
