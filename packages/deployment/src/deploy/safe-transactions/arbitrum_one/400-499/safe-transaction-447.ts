import { BigNumberish } from 'ethers';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  deployContractAndSave,

} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import ModuleDeployments from '../../../deployments.json';

/**
 * This script encodes the following transactions:
 * - Deploys the new GMX V2 registry with updated validation on the Handler
 * - Unsets the wrappers / unwrappers on the GMX V2 registry for the GLV tokens
 * - Sets the wrappers / unwrappers on the GLV registry for the GLV tokens
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const gmxRegistry = core.gmxV2Ecosystem.live.registry;
  const glvRegistry = core.glvEcosystem.live.registry;

  const glvBtc = core.tokens.dGlvBtc;
  const glvEth = core.tokens.dGlvEth;

  const gmxRegistryImplementationAddress = await deployContractAndSave(
    'GmxV2Registry',
    [],
    'GmxV2RegistryImplementationV3',
  );

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { gmxRegistryProxy: core.gmxV2Ecosystem.live.registryProxy },
      'gmxRegistryProxy',
      'upgradeTo',
      [gmxRegistryImplementationAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { gmxRegistry: gmxRegistry },
      'gmxRegistry',
      'ownerSetUnwrapperByToken',
      [glvBtc.address, ADDRESS_ZERO],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { gmxRegistry: gmxRegistry },
      'gmxRegistry',
      'ownerSetWrapperByToken',
      [glvBtc.address, ADDRESS_ZERO],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { gmxRegistry: gmxRegistry },
      'gmxRegistry',
      'ownerSetUnwrapperByToken',
      [glvEth.address, ADDRESS_ZERO],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { gmxRegistry: gmxRegistry },
      'gmxRegistry',
      'ownerSetWrapperByToken',
      [glvEth.address, ADDRESS_ZERO],
    ),

    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { glvRegistry: glvRegistry },
      'glvRegistry',
      'ownerSetUnwrapperByToken',
      [glvBtc.address, ModuleDeployments.GlvBTCV2AsyncIsolationModeUnwrapperTraderProxyV2[core.network].address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { glvRegistry: glvRegistry },
      'glvRegistry',
      'ownerSetWrapperByToken',
      [glvBtc.address, ModuleDeployments.GlvBTCV2AsyncIsolationModeWrapperTraderProxyV2[core.network].address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { glvRegistry: glvRegistry },
      'glvRegistry',
      'ownerSetUnwrapperByToken',
      [glvEth.address, ModuleDeployments.GlvETHAsyncIsolationModeUnwrapperTraderProxyV2[core.network].address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { glvRegistry: glvRegistry },
      'glvRegistry',
      'ownerSetWrapperByToken',
      [glvEth.address, ModuleDeployments.GlvETHAsyncIsolationModeWrapperTraderProxyV2[core.network].address],
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
    invariants: async () => {
      const getMaxWei = (o: BigNumberish) => core.dolomiteMargin.getMarketMaxWei(o).then((m) => m.value);

      assertHardhatInvariant(
        (await gmxRegistry.getUnwrapperByToken(glvBtc.address)) === ADDRESS_ZERO,
        'Invalid unwrapper on GMX registry for glvBTC',
      );
      assertHardhatInvariant(
        (await gmxRegistry.getWrapperByToken(glvBtc.address)) === ADDRESS_ZERO,
        'Invalid wrapper on GMX registry for glvBTC',
      );
      assertHardhatInvariant(
        (await gmxRegistry.getUnwrapperByToken(glvEth.address)) === ADDRESS_ZERO,
        'Invalid unwrapper on GMX registry for glvETH',
      );
      assertHardhatInvariant(
        (await gmxRegistry.getWrapperByToken(glvEth.address)) === ADDRESS_ZERO,
        'Invalid wrapper on GMX registry for glvETH',
      );

      assertHardhatInvariant(
        (await glvRegistry.getUnwrapperByToken(glvBtc.address)) ===
          ModuleDeployments.GlvBTCV2AsyncIsolationModeUnwrapperTraderProxyV2[core.network].address,
        'Invalid unwrapper on GLV registry for glvBTC',
      );
      assertHardhatInvariant(
        (await glvRegistry.getWrapperByToken(glvBtc.address)) ===
          ModuleDeployments.GlvBTCV2AsyncIsolationModeWrapperTraderProxyV2[core.network].address,
        'Invalid wrapper on GLV registry for glvBTC',
      );
      assertHardhatInvariant(
        (await glvRegistry.getUnwrapperByToken(glvEth.address)) ===
          ModuleDeployments.GlvETHAsyncIsolationModeUnwrapperTraderProxyV2[core.network].address,
        'Invalid unwrapper on GLV registry for glvETH',
      );
      assertHardhatInvariant(
        (await glvRegistry.getWrapperByToken(glvEth.address)) ===
          ModuleDeployments.GlvETHAsyncIsolationModeWrapperTraderProxyV2[core.network].address,
        'Invalid wrapper on GLV registry for glvETH',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
