import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { IsolationModeVaultType } from '../../../isolation-mode/isolation-mode-helpers';
import { deployContractAndSave, getMaxDeploymentVersionNumberByDeploymentKey } from 'packages/deployment/src/utils/deploy-utils';
import { prettyPrintEncodedDataWithTypeSafety } from 'packages/deployment/src/utils/encoding/base-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Updates to GMX V2.2
 * - Updates to GLV V2.2
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const glvRegistryImplAddress = await deployContractAndSave(
    'GlvRegistry',
    [],
    'GlvRegistryImplementationV3',
  );

  const gmxTraderLibraryAddress = await deployContractAndSave(
    'GmxV2TraderLibrary',
    [],
    'GmxV2TraderLibraryV1',
  );
  const glvLibraryAddress = await deployContractAndSave(
    'GlvLibrary',
    [],
    'GlvLibraryV4',
  );
  const gmxV2TraderLibraryMap = { GmxV2TraderLibrary: gmxTraderLibraryAddress };

  const gmxV2WrapperImplAddress = await deployContractAndSave(
    'GmxV2IsolationModeWrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeWrapperTraderImplementationV13',
    { GmxV2TraderLibrary: gmxTraderLibraryAddress, ...core.libraries.wrapperTraderImpl },
  );
  const gmxV2UnwrapperImplAddress = await deployContractAndSave(
    'GmxV2IsolationModeUnwrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeUnwrapperTraderImplementationV14',
    { GmxV2TraderLibrary: gmxTraderLibraryAddress, ...core.libraries.unwrapperTraderImpl },
  );

  const glvWrapperImplAddress = await deployContractAndSave(
    'GlvIsolationModeWrapperTraderV2',
    [core.tokens.weth.address],
    'GlvIsolationModeWrapperTraderImplementationV5',
    { GlvLibrary: glvLibraryAddress, ...gmxV2TraderLibraryMap, ...core.libraries.wrapperTraderImpl },
  );
  const glvUnwrapperImplAddress = await deployContractAndSave(
    'GlvIsolationModeUnwrapperTraderV2',
    [core.tokens.weth.address],
    'GlvIsolationModeUnwrapperTraderImplementationV5',
    { GlvLibrary: glvLibraryAddress, ...gmxV2TraderLibraryMap, ...core.libraries.unwrapperTraderImpl },
  );

  const transactions: EncodedTransaction[] = [];

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(core, core.glvEcosystem.live.glvBtc, 'unwrapperProxy', 'upgradeTo', [
      glvUnwrapperImplAddress,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core.glvEcosystem.live.glvBtc, 'wrapperProxy', 'upgradeTo', [
      glvWrapperImplAddress,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core.glvEcosystem.live.glvEth, 'unwrapperProxy', 'upgradeTo', [
      glvUnwrapperImplAddress,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, core.glvEcosystem.live.glvEth, 'wrapperProxy', 'upgradeTo', [
      glvWrapperImplAddress,
    ]),
  );

  for (const gmMarket of core.gmxV2Ecosystem.live.allGmMarkets) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(core, gmMarket, 'unwrapperProxy', 'upgradeTo', [
        gmxV2UnwrapperImplAddress,
      ]),
      await prettyPrintEncodedDataWithTypeSafety(core, gmMarket, 'wrapperProxy', 'upgradeTo', [
        gmxV2WrapperImplAddress,
      ]),
    );
  }

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.glvEcosystem.live,
      'registry',
      'ownerSetGlvRouter',
      [core.glvEcosystem.glvRouter.address]
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxV2Ecosystem.live,
      'registry',
      'ownerSetGmxExchangeRouter',
      [core.gmxV2Ecosystem.gmxExchangeRouter.address]
    ),
  );

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.glvEcosystem.live,
      'registryProxy',
      'upgradeTo',
      [glvRegistryImplAddress],
    ),
  );

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
