import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getBerachainRewardsRegistryConstructorParams } from 'packages/berachain/src/berachain-constructors';
import {
  BerachainRewardsRegistry__factory,
  InfraredBGTMetaVault__factory,
  POLLiquidatorProxyV1__factory,
} from 'packages/berachain/src/types';
import { deployContractAndSave } from 'packages/deployment/src/utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

const POL_FEE_PERCENTAGE = parseEther('0.0005');

/**
 * This script encodes the following transactions:
 * - Sets up POL ecosystem
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const infraredMetaVaultImplementationAddress = await deployContractAndSave(
    'InfraredBGTMetaVault',
    [],
    'InfraredBGTMetaVaultImplementationV1',
  );
  const infraredMetaVaultImplementation = InfraredBGTMetaVault__factory.connect(
    infraredMetaVaultImplementationAddress,
    core.governance,
  );

  // Deploy POL liquidator proxy
  const polLiquidatorImplementationAddress = await deployContractAndSave(
    'POLLiquidatorProxyV1',
    [core.liquidatorProxyV6.address, core.dolomiteMargin.address],
    'POLLiquidatorProxyImplementationV1',
  );
  const polLiquidatorImplementation = POLLiquidatorProxyV1__factory.connect(
    polLiquidatorImplementationAddress,
    core.governance,
  );

  const data = await polLiquidatorImplementation.populateTransaction.initialize();
  const polLiquidatorProxyAddress = await deployContractAndSave(
    'UpgradeableProxy',
    [polLiquidatorImplementationAddress, core.dolomiteMargin.address, data.data!],
    'POLLiquidatorProxy',
  );
  const polLiquidatorProxy = POLLiquidatorProxyV1__factory.connect(polLiquidatorProxyAddress, core.governance);

  // Deploy BerachainRewardsRegistry
  const registryImplementationAddress = await deployContractAndSave(
    'BerachainRewardsRegistry',
    [],
    'BerachainRewardsRegistryImplementationV1',
  );
  const registryImplementation = BerachainRewardsRegistry__factory.connect(
    registryImplementationAddress,
    core.governance,
  );

  const registryAddress = await deployContractAndSave(
    'RegistryProxy',
    await getBerachainRewardsRegistryConstructorParams(
      registryImplementation,
      infraredMetaVaultImplementation,
      polLiquidatorProxy,
      core,
    ),
    'BerachainRewardsRegistryProxy',
  );
  const berachainRewardsRegistry = BerachainRewardsRegistry__factory.connect(registryAddress, core.governance);

  // Deploy POL isolation mode token vault, wrapper and unwrapper
  const tokenVaultImplementationAddress = await deployContractAndSave(
    'POLIsolationModeTokenVaultV1',
    [],
    'POLIsolationModeTokenVaultImplementationV1',
    core.libraries.tokenVaultActionsImpl,
  );

  const unwrapperImplementationAddress = await deployContractAndSave(
    'POLIsolationModeUnwrapperTraderV2',
    [berachainRewardsRegistry.address, core.dolomiteMargin.address],
    'POLIsolationModeUnwrapperTraderImplementationV2',
  );

  const wrapperImplementationAddress = await deployContractAndSave(
    'POLIsolationModeWrapperTraderV2',
    [berachainRewardsRegistry.address, core.dolomiteMargin.address],
    'POLIsolationModeWrapperTraderImplementationV2',
  );

  const transactions: EncodedTransaction[] = [
    // set pol tokenVault/unwrapper/wrapper
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { berachainRewardsRegistry },
      'berachainRewardsRegistry',
      'ownerSetPolTokenVault',
      [tokenVaultImplementationAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { berachainRewardsRegistry },
      'berachainRewardsRegistry',
      'ownerSetPolUnwrapperTrader',
      [unwrapperImplementationAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { berachainRewardsRegistry },
      'berachainRewardsRegistry',
      'ownerSetPolWrapperTrader',
      [wrapperImplementationAddress],
    ),
    // set pol fee agent and fee percentage
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { berachainRewardsRegistry },
      'berachainRewardsRegistry',
      'ownerSetPolFeeAgent',
      [core.gnosisSafeAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { berachainRewardsRegistry },
      'berachainRewardsRegistry',
      'ownerSetPolFeePercentage',
      [POL_FEE_PERCENTAGE],
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
        (await berachainRewardsRegistry.metaVaultImplementation()) === infraredMetaVaultImplementationAddress,
        'Invalid meta vault implementation address',
      );
      assertHardhatInvariant(
        (await berachainRewardsRegistry.polLiquidator()) === polLiquidatorProxyAddress,
        'Invalid POL liquidator proxy address',
      );
      assertHardhatInvariant(
        (await berachainRewardsRegistry.polTokenVault()) === tokenVaultImplementationAddress,
        'Invalid POL token vault address',
      );
      assertHardhatInvariant(
        (await berachainRewardsRegistry.polUnwrapperTrader()) === unwrapperImplementationAddress,
        'Invalid POL unwrapper trader address',
      );
      assertHardhatInvariant(
        (await berachainRewardsRegistry.polWrapperTrader()) === wrapperImplementationAddress,
        'Invalid POL wrapper trader address',
      );
      assertHardhatInvariant(
        (await berachainRewardsRegistry.polFeeAgent()) === core.gnosisSafeAddress,
        'Invalid POL fee agent address',
      );
      assertHardhatInvariant(
        (await berachainRewardsRegistry.polFeePercentage(0)).eq(POL_FEE_PERCENTAGE),
        'Invalid POL fee percentage',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
