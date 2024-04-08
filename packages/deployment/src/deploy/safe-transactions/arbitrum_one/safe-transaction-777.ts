import { IERC20 } from '@dolomite-exchange/modules-base/src/types';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getPendlePtIsolationModeUnwrapperTraderV3ConstructorParams,
  getPendlePtIsolationModeWrapperTraderV3ConstructorParams
} from '@dolomite-exchange/modules-pendle/src/pendle-constructors';
import { IPendleRegistry, PendlePtIsolationModeVaultFactory } from '@dolomite-exchange/modules-pendle/src/types';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';
import Deployments from '../../deployments.json';

interface Factory {
  pendleRegistry: IPendleRegistry;
  factory: PendlePtIsolationModeVaultFactory;
  underlyingToken: IERC20;
  oldWrapper: string;
  oldUnwrapper: string;
  newWrapper: string | undefined;
  newUnwrapper: string | undefined;
  rename: string;
  newVersion: 'V3' | 'V5';
}

/**
 * This script encodes the following transactions:
 * - Deploys PendleV3Router unwrapper and wrapper for the following markets:
 *      rEthJun2025
 *      wstEthJun2024
 *      wstEthJun2025
 *      eEthApr2024
 *      ezEthJun2024
 * - Disables the old wrapper and unwrappers for those markets
 * - Enables the new wrapper and unwrappers for those markets
 * - Update pendle router
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions = [];
  const factories: Factory[] = [
    {
      pendleRegistry: core.pendleEcosystem.rEthJun2025.pendleRegistry,
      factory: core.pendleEcosystem.rEthJun2025.dPtREthJun2025,
      underlyingToken: core.tokens.rEth,
      oldWrapper: Deployments.PendlePtREthJun2025IsolationModeWrapperTraderV4[network].address,
      oldUnwrapper: Deployments.PendlePtREthJun2025IsolationModeUnwrapperTraderV4[network].address,
      newWrapper: undefined,
      newUnwrapper: undefined,
      rename: 'REthJun2025',
      newVersion: 'V5',
    },
    {
      pendleRegistry: core.pendleEcosystem.wstEthJun2024.pendleRegistry,
      factory: core.pendleEcosystem.wstEthJun2024.dPtWstEthJun2024,
      underlyingToken: core.tokens.wstEth,
      oldWrapper: Deployments.PendlePtWstEthJun2024IsolationModeWrapperTraderV4[network].address,
      oldUnwrapper: Deployments.PendlePtWstEthJun2024IsolationModeUnwrapperTraderV4[network].address,
      newWrapper: undefined,
      newUnwrapper: undefined,
      rename: 'WstEthJun2024',
      newVersion: 'V5',
    },
    {
      pendleRegistry: core.pendleEcosystem.wstEthJun2025.pendleRegistry,
      factory: core.pendleEcosystem.wstEthJun2025.dPtWstEthJun2025,
      underlyingToken: core.tokens.wstEth,
      oldWrapper: Deployments.PendlePtWstEthJun2025IsolationModeWrapperTraderV4[network].address,
      oldUnwrapper: Deployments.PendlePtWstEthJun2025IsolationModeUnwrapperTraderV4[network].address,
      newWrapper: undefined,
      newUnwrapper: undefined,
      rename: 'WstEthJun2025',
      newVersion: 'V5',
    },
    {
      pendleRegistry: core.pendleEcosystem.weEthApr2024.pendleRegistry,
      factory: core.pendleEcosystem.weEthApr2024.dPtWeEthApr2024,
      underlyingToken: core.tokens.weEth,
      oldWrapper: Deployments.PendlePtWeETHApr2024IsolationModeWrapperTraderV2[network].address,
      oldUnwrapper: Deployments.PendlePtWeETHApr2024IsolationModeUnwrapperTraderV2[network].address,
      newWrapper: undefined,
      newUnwrapper: undefined,
      rename: 'WeETHApr2024',
      newVersion: 'V3',
    },
    {
      pendleRegistry: core.pendleEcosystem.ezEthJun2024.pendleRegistry,
      factory: core.pendleEcosystem.ezEthJun2024.dPtEzEthJun2024,
      underlyingToken: core.tokens.ezEth,
      oldWrapper: Deployments.PendlePtEzETHJun2024IsolationModeWrapperTraderV2[network].address,
      oldUnwrapper: Deployments.PendlePtEzETHJun2024IsolationModeUnwrapperTraderV2[network].address,
      newWrapper: undefined,
      newUnwrapper: undefined,
      rename: 'EzETHJun2024',
      newVersion: 'V3',
    },
  ];

  for (let i = 0; i < factories.length; i++) {
    factories[i].newUnwrapper = await deployContractAndSave(
      'PendlePtIsolationModeUnwrapperTraderV3',
      getPendlePtIsolationModeUnwrapperTraderV3ConstructorParams(
        core,
        factories[i].pendleRegistry,
        factories[i].underlyingToken,
        factories[i].factory
      ),
      `PendlePt${factories[i].rename}IsolationModeUnwrapperTrader${factories[i].newVersion}`,
    );

    factories[i].newWrapper = await deployContractAndSave(
      'PendlePtIsolationModeWrapperTraderV3',
      getPendlePtIsolationModeWrapperTraderV3ConstructorParams(
        core,
        factories[i].pendleRegistry,
        factories[i].underlyingToken,
        factories[i].factory
      ),
      `PendlePt${factories[i].rename}IsolationModeWrapperTrader${factories[i].newVersion}`,
    );
  }

  for (let i = 0; i < factories.length; i++) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { factory: factories[i].factory },
        'factory',
        'ownerSetIsTokenConverterTrusted',
        [factories[i].oldWrapper, false],
      ),
    );
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { factory: factories[i].factory },
        'factory',
        'ownerSetIsTokenConverterTrusted',
        [factories[i].oldUnwrapper, false],
      ),
    );
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { factory: factories[i].factory },
        'factory',
        'ownerSetIsTokenConverterTrusted',
        [factories[i].newWrapper!, true],
      ),
    );
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { factory: factories[i].factory },
        'factory',
        'ownerSetIsTokenConverterTrusted',
        [factories[i].newUnwrapper!, true],
      ),
    );
  }

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    invariants: async () => {
      for (let i = 0; i < factories.length; i++) {
        assertHardhatInvariant(
          await factories[i].factory.isTokenConverterTrusted(factories[i].newWrapper!),
          'New wrapper is not trusted'
        );
        assertHardhatInvariant(
          await factories[i].factory.isTokenConverterTrusted(factories[i].newUnwrapper!),
          'New unwrapper is not trusted'
        );
        assertHardhatInvariant(
          !(await factories[i].factory.isTokenConverterTrusted(factories[i].oldWrapper)),
          'Old wrapper is trusted'
        );
        assertHardhatInvariant(
          !(await factories[i].factory.isTokenConverterTrusted(factories[i].oldUnwrapper)),
          'Old unwrapper is trusted'
        );
      }
    },
  };
}

doDryRunAndCheckDeployment(main);
