import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { getRamsesCLPriceOracleV3ConstructorParams } from '@dolomite-exchange/modules-oracles/src/oracles-constructors';
import { expect } from 'chai';
import { IsolationModeTraderProxy } from 'packages/base/src/types';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { GmxV2IsolationModeVaultFactory } from 'packages/gmx-v2/src/types';
import {
  deployContractAndSave,

} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import ModuleDeployments from '../../../deployments.json';

/**
 * This script encodes the following transactions:
 * - Deploys a new GMX V2 library
 * - Deploys a new GMX V2 token vault & unwrapper
 * - Hooks up the token vault and unwrapper to the unwrapper proxy + factory
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const factories: GmxV2IsolationModeVaultFactory[] = [
    core.gmxV2Ecosystem.live.gmArbUsd.factory,
    core.gmxV2Ecosystem.live.gmBtcUsd.factory,
    core.gmxV2Ecosystem.live.gmEthUsd.factory,
    core.gmxV2Ecosystem.live.gmLinkUsd.factory,
    core.gmxV2Ecosystem.live.gmUniUsd.factory,
    core.gmxV2Ecosystem.live.gmBtc.factory,
    core.gmxV2Ecosystem.live.gmEth.factory,
  ];
  const unwrappers: IsolationModeTraderProxy[] = [
    core.gmxV2Ecosystem.live.gmArbUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmBtcUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmEthUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmLinkUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmUniUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmBtc.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmEth.unwrapperProxy,
  ];

  const libraryAddress = await deployContractAndSave(
    'GmxV2Library',
    [],
    'GmxV2LibraryV6',
  );

  const unwrapperAddress = await deployContractAndSave(
    'GmxV2IsolationModeUnwrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeUnwrapperTraderImplementationV7',
    { ...core.libraries.unwrapperTraderImpl, GmxV2Library: libraryAddress }
  );

  const vaultAddress = await deployContractAndSave(
    'GmxV2IsolationModeTokenVaultV1',
    [core.tokens.weth.address, core.config.networkNumber],
    'GmxV2IsolationModeTokenVaultImplementationV15',
    { ...core.libraries.tokenVaultActionsImpl, GmxV2Library: libraryAddress }
  );

  const transactions: EncodedTransaction[] = [];
  for (let i = 0; i < factories.length; i++) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { factory: factories[i] },
        'factory',
        'ownerSetUserVaultImplementation',
        [vaultAddress],
      ),
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { unwrapper: unwrappers[i] },
        'unwrapper',
        'upgradeTo',
        [unwrapperAddress],
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
    skipTimeDelay: true,
    invariants: async () => {
      for (let i = 0; i < factories.length; i++) {
        expect(await factories[i].userVaultImplementation()).to.eq(vaultAddress);
        expect(await unwrappers[i].implementation()).to.eq(unwrapperAddress);
      }
    },
  };
}

doDryRunAndCheckDeployment(main);
