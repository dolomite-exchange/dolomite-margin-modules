import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import ModuleDeployments from '../../../deployments.json';
import {
  encodeSetSupplyCap,
  encodeSetSupplyCapWithMagic,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeUpdateModularInterestSetterParams } from '../../../../utils/encoding/interest-setter-encoder-utils';
import {
  LowerPercentage,
  OptimalUtilizationRate,
  UpperPercentage,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';

/**
 * This script:
 * - deploys GLPIsolationModeTokenVaultV4 and GMXIsolationModeTokenVaultV2
 * - upgrades the GLP and GMX factories to use the new implementations
 * - sets the sGMX (dGMX market) max supply cap to one wei
 * - increases the GMX supply cap
 * - modifies the GMX interest rate curve
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const glpVaultImplementation = await deployContractAndSave(
    'GLPIsolationModeTokenVaultV4',
    [],
    'GLPIsolationModeTokenVaultV15',
    {
      ...core.libraries.tokenVaultActionsImpl,
      GLPActionsLib: ModuleDeployments.GLPActionsLibV2[network].address,
    },
  );
  const gmxVaultImplementation = await deployContractAndSave(
    'GMXIsolationModeTokenVaultV2',
    [],
    'GMXIsolationModeTokenVaultV13',
    core.libraries.tokenVaultActionsImpl,
  );

  const transactions: EncodedTransaction[] = [
    await encodeSetSupplyCap(core, core.marketIds.dGmx, ONE_BI),
    await encodeSetSupplyCapWithMagic(core, core.marketIds.gmx, 80_000),
    await encodeUpdateModularInterestSetterParams(core, core.marketIds.gmx, {
      lowerRate: LowerPercentage._10,
      upperRate: UpperPercentage._300,
      optimalUtilizationRate: OptimalUtilizationRate._50,
    }),
    await prettyPrintEncodedDataWithTypeSafety(core, core.gmxEcosystem.live, 'dGlp', 'setUserVaultImplementation', [
      glpVaultImplementation,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem.live,
      'dGmx',
      'ownerSetUserVaultImplementation',
      [gmxVaultImplementation],
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
      assertHardhatInvariant(
        (await core.gmxEcosystem.live.dGlp.userVaultImplementation()) === glpVaultImplementation,
        'Invalid GLP vault implementation',
      );
      assertHardhatInvariant(
        (await core.gmxEcosystem.live.dGmx.userVaultImplementation()) === gmxVaultImplementation,
        'Invalid GMX vault implementation',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
