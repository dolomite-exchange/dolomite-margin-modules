import { IsolationModeFreezableLiquidatorProxy__factory } from '@dolomite-exchange/modules-base/src/types';
import {
  getIsolationModeFreezableLiquidatorProxyConstructorParams,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getGmxV2IsolationModeTokenVaultConstructorParams,
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

const LIQUIDATOR_ADDRESS = '0x1fF6B8E1192eB0369006Bbad76dA9068B68961B2';

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
    'GmxV2LibraryV3',
  );
  const gmxV2Libraries = { GmxV2Library: gmxV2LibraryAddress };

  const gmxV2TokenVaultAddress = await deployContractAndSave(
    'GmxV2IsolationModeTokenVaultV1',
    getGmxV2IsolationModeTokenVaultConstructorParams(core),
    'GmxV2IsolationModeTokenVaultV4',
    { ...core.tokenVaultActionsLibraries, ...gmxV2Libraries },
  );
  const gmxV2TokenVault = GmxV2IsolationModeTokenVaultV1__factory.connect(gmxV2TokenVaultAddress, core.hhUser1);

  const unwrapperImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeUnwrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeUnwrapperTraderImplementationV3',
    {
      ...gmxV2Libraries,
      AsyncIsolationModeUnwrapperTraderImpl: Deployments.AsyncIsolationModeUnwrapperTraderImplV1[network].address,
    },
  );

  const wrapperImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeWrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeWrapperTraderImplementationV3',
    {
      ...gmxV2Libraries,
      AsyncIsolationModeWrapperTraderImpl: Deployments.AsyncIsolationModeWrapperTraderImplV1[network].address,
    },
  );

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
  const factories = [
    core.gmxEcosystemV2.live.gmArb.factory,
    core.gmxEcosystemV2.live.gmBtc.factory,
    core.gmxEcosystemV2.live.gmEth.factory,
    core.gmxEcosystemV2.live.gmLink.factory,
  ];
  const unwrappers = [
    core.gmxEcosystemV2.live.gmArb.unwrapperProxy,
    core.gmxEcosystemV2.live.gmBtc.unwrapperProxy,
    core.gmxEcosystemV2.live.gmEth.unwrapperProxy,
    core.gmxEcosystemV2.live.gmLink.unwrapperProxy,
  ];
  const wrappers = [
    core.gmxEcosystemV2.live.gmArb.wrapperProxy,
    core.gmxEcosystemV2.live.gmBtc.wrapperProxy,
    core.gmxEcosystemV2.live.gmEth.wrapperProxy,
    core.gmxEcosystemV2.live.gmLink.wrapperProxy,
  ];
  const marketIds = await Promise.all(factories.map(f => core.dolomiteMargin.getMarketIdByTokenAddress(f.address)));

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
      { registry: core.gmxEcosystemV2.live.registry },
      'registry',
      'ownerSetGmxDepositVault',
      [core.gmxEcosystemV2.gmxDepositVault.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.gmxEcosystemV2.live.registry },
      'registry',
      'ownerSetGmxWithdrawalVault',
      [core.gmxEcosystemV2.gmxWithdrawalVault.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.gmxEcosystemV2.live.registry },
      'registry',
      'ownerSetIsHandler',
      [LIQUIDATOR_ADDRESS, true],
    ),
    ...await Promise.all(
      marketIds.reduce<Promise<EncodedTransaction>[]>((acc, marketId, i) => {
        return acc.concat(
          prettyPrintEncodedDataWithTypeSafety(
            core,
            { registry: core.liquidatorAssetRegistry },
            'registry',
            'ownerRemoveLiquidatorFromAssetWhitelist',
            [marketId, oldFreezableLiquidatorProxyAddress],
          ),
          prettyPrintEncodedDataWithTypeSafety(
            core,
            { registry: core.liquidatorAssetRegistry },
            'registry',
            'ownerAddLiquidatorToAssetWhitelist',
            [marketId, freezableLiquidatorProxyAddress],
          ),
          prettyPrintEncodedDataWithTypeSafety(
            core,
            { registry: core.gmxEcosystemV2.live.registry },
            'registry',
            'ownerSetUnwrapperByToken',
            [factories[i].address, unwrappers[i].address],
          ),
          prettyPrintEncodedDataWithTypeSafety(
            core,
            { registry: core.gmxEcosystemV2.live.registry },
            'registry',
            'ownerSetWrapperByToken',
            [factories[i].address, wrappers[i].address],
          ),
          prettyPrintEncodedDataWithTypeSafety(
            core,
            { unwrapperProxy: unwrappers[i] },
            'unwrapperProxy',
            'upgradeTo',
            [unwrapperImplementationAddress],
          ),
          prettyPrintEncodedDataWithTypeSafety(
            core,
            { wrapperProxy: wrappers[i] },
            'wrapperProxy',
            'upgradeTo',
            [wrapperImplementationAddress],
          ),
        );
      }, []),
    ),
    ...await Promise.all(
      factories.map(factory => {
        return prettyPrintEncodedDataWithTypeSafety(
          core,
          { factory },
          'factory',
          'ownerSetUserVaultImplementation',
          [gmxV2TokenVault.address],
        );
      }),
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
        !(await core.dolomiteMargin.getIsGlobalOperator(oldFreezableLiquidatorProxyAddress)),
        'oldFreezableLiquidatorProxyAddress must not be global operator',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(freezableLiquidatorProxy.address),
        'freezableLiquidatorProxy must be global operator',
      );
      assertHardhatInvariant(
        await core.gmxEcosystemV2.live.registry.gmxDepositVault() === core.gmxEcosystemV2.gmxDepositVault.address,
        'gmxDepositVault is invalid',
      );
      assertHardhatInvariant(
        await core.gmxEcosystemV2.live.registry.gmxWithdrawalVault() === core.gmxEcosystemV2.gmxWithdrawalVault.address,
        'gmxWithdrawalVault is invalid',
      );
      assertHardhatInvariant(
        await core.gmxEcosystemV2.live.registry.isHandler(LIQUIDATOR_ADDRESS),
        'liquidator must be set as a handler',
      );
      await Promise.all(
        factories.map(async (factory, i) => {
          assertHardhatInvariant(
            await factory.userVaultImplementation() === gmxV2TokenVault.address,
            `Invalid token vault for ${factory.address} at index [${i}]`,
          );
          assertHardhatInvariant(
            await core.liquidatorAssetRegistry.isAssetWhitelistedForLiquidation(
              marketIds[i],
              freezableLiquidatorProxy.address,
            ),
            'New liquidator asset registry must be added to liquidation whitelist',
          );
          assertHardhatInvariant(
            !await core.liquidatorAssetRegistry.isAssetWhitelistedForLiquidation(
              marketIds[i],
              oldFreezableLiquidatorProxyAddress,
            ),
            'Old liquidator asset registry must be added to liquidation whitelist',
          );
          assertHardhatInvariant(
            await core.gmxEcosystemV2.live.registry.getUnwrapperByToken(factory.address) === unwrappers[i].address,
            `Unwrapper not set on registry at index ${i}`,
          );
          assertHardhatInvariant(
            await core.gmxEcosystemV2.live.registry.getWrapperByToken(factory.address) === wrappers[i].address,
            `Wrapper not set on registry at index ${i}`,
          );
          assertHardhatInvariant(
            await unwrappers[i].implementation() === unwrapperImplementationAddress,
            `Invalid unwrapper at index [${i}]`,
          );
          assertHardhatInvariant(
            await wrappers[i].implementation() === wrapperImplementationAddress,
            `Invalid wrapper at index [${i}]`,
          );
          assertHardhatInvariant(
            await factory.userVaultImplementation() === gmxV2TokenVaultAddress,
            `Invalid token vault at index [${i}]`,
          );
        }),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
