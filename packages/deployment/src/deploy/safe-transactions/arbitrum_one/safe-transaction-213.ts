import { IsolationModeFreezableLiquidatorProxy__factory } from '@dolomite-exchange/modules-base/src/types';
import {
  getIsolationModeFreezableLiquidatorProxyConstructorParams,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { GMXIsolationModeVaultFactory__factory } from '@dolomite-exchange/modules-glp/src/types';
import {
  getGmxV2IsolationModeTokenVaultConstructorParams
} from '@dolomite-exchange/modules-gmx-v2/src/gmx-v2-constructors';
import { GmxV2IsolationModeTokenVaultV1__factory } from '@dolomite-exchange/modules-gmx-v2/src/types';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';
import Deployments from '../../deployments.json';

/**
 * This script encodes the following transactions:
 * - Deploys new unwrapper / wrapper contracts for PT-wstETH (Jun 2024)
 * - Deploys new unwrapper / wrapper contracts for PT-wstETH (Jun 2025)
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const gmxV2LibraryAddress = await deployContractAndSave(
    'GmxV2Library',
    [],
    'GmxV2LibraryV2',
  );
  const gmxV2Libraries = { GmxV2Library: gmxV2LibraryAddress };

  const gmxV2TokenVaultAddress = await deployContractAndSave(
    'GmxV2IsolationModeTokenVaultV1',
    getGmxV2IsolationModeTokenVaultConstructorParams(core),
    'GmxV2IsolationModeTokenVaultV3',
    { ...core.tokenVaultActionsLibraries, ...gmxV2Libraries },
  );
  const gmxV2TokenVault = GmxV2IsolationModeTokenVaultV1__factory.connect(gmxV2TokenVaultAddress, core.hhUser1);

  const freezableLiquidatorProxyAddress = await deployContractAndSave(
    'IsolationModeFreezableLiquidatorProxy',
    getIsolationModeFreezableLiquidatorProxyConstructorParams(core),
    'IsolationModeFreezableLiquidatorProxyV2',
  );
  const freezableLiquidatorProxy = IsolationModeFreezableLiquidatorProxy__factory.connect(
    freezableLiquidatorProxyAddress,
    core.hhUser1,
  );

  const oldFreezableLiquidatorProxyAddress = Deployments.IsolationModeFreezableLiquidatorProxyV1[network].address;
  const arbFactory = GMXIsolationModeVaultFactory__factory.connect(
    Deployments.GmxV2ARBIsolationModeVaultFactory[network].address,
    core.hhUser1,
  );
  const btcFactory = GMXIsolationModeVaultFactory__factory.connect(
    Deployments.GmxV2BTCIsolationModeVaultFactory[network].address,
    core.hhUser1,
  );
  const ethFactory = GMXIsolationModeVaultFactory__factory.connect(
    Deployments.GmxV2ETHIsolationModeVaultFactory[network].address,
    core.hhUser1,
  );
  const linkFactory = GMXIsolationModeVaultFactory__factory.connect(
    Deployments.GmxV2LINKIsolationModeVaultFactory[network].address,
    core.hhUser1,
  );

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [oldFreezableLiquidatorProxyAddress, false],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [freezableLiquidatorProxy.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: arbFactory },
      'factory',
      'ownerSetUserVaultImplementation',
      [gmxV2TokenVault.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: btcFactory },
      'factory',
      'ownerSetUserVaultImplementation',
      [gmxV2TokenVault.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: ethFactory },
      'factory',
      'ownerSetUserVaultImplementation',
      [gmxV2TokenVault.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: linkFactory },
      'factory',
      'ownerSetUserVaultImplementation',
      [gmxV2TokenVault.address],
    ),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(oldFreezableLiquidatorProxyAddress),
        'oldFreezableLiquidatorProxyAddress must not be global operator',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(freezableLiquidatorProxy.address),
        'freezableLiquidatorProxy must be global operator',
      );
      assertHardhatInvariant(
        await arbFactory.userVaultImplementation() === gmxV2TokenVault.address,
        'Invalid arb token vault',
      );
      assertHardhatInvariant(
        await btcFactory.userVaultImplementation() === gmxV2TokenVault.address,
        'Invalid btc token vault',
      );
      assertHardhatInvariant(
        await ethFactory.userVaultImplementation() === gmxV2TokenVault.address,
        'Invalid eth token vault',
      );
      assertHardhatInvariant(
        await linkFactory.userVaultImplementation() === gmxV2TokenVault.address,
        'Invalid link token vault',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
