import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets the GMXExchangeRouter on the gmxV2 registry to the new address
 * - Sets the GMXReader on the gmxV2 registry to the new address
 * 
 * - Updates the GMX V2 wrappers/unwrappers to adjust for the new deposit/withdraw callbacks
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  core.gmxV2Ecosystem.live.registry
  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.gmxV2Ecosystem.live.registry },
      'registry',
      'ownerSetGmxExchangeRouter',
      [core.gmxV2Ecosystem.gmxExchangeRouterV2.address],
    )
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.gmxV2Ecosystem.live.registry },
      'registry',
      'ownerSetGmxReader',
      [core.gmxV2Ecosystem.gmxReaderV2.address],
    )
  );

  const unwrapperProxies = [
    core.gmxV2Ecosystem.live.gmAaveUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmArbUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmBtc.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmBtcUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmDogeUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmEth.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmEthUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmGmxUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmLinkUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmSolUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmUniUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmWstEthUsd.unwrapperProxy,
  ];
  const wrapperProxies = [
    core.gmxV2Ecosystem.live.gmAaveUsd.wrapperProxy,
    core.gmxV2Ecosystem.live.gmArbUsd.wrapperProxy,
    core.gmxV2Ecosystem.live.gmBtc.wrapperProxy,
    core.gmxV2Ecosystem.live.gmBtcUsd.wrapperProxy,
    core.gmxV2Ecosystem.live.gmDogeUsd.wrapperProxy,
    core.gmxV2Ecosystem.live.gmEth.wrapperProxy,
    core.gmxV2Ecosystem.live.gmEthUsd.wrapperProxy,
    core.gmxV2Ecosystem.live.gmGmxUsd.wrapperProxy,
    core.gmxV2Ecosystem.live.gmLinkUsd.wrapperProxy,
    core.gmxV2Ecosystem.live.gmSolUsd.wrapperProxy,
    core.gmxV2Ecosystem.live.gmUniUsd.wrapperProxy,
    core.gmxV2Ecosystem.live.gmWstEthUsd.wrapperProxy,
  ];

  const unwrappers = [
    core.gmxV2Ecosystem.live.gmAaveUsd.unwrapper,
    core.gmxV2Ecosystem.live.gmArbUsd.unwrapper,
    core.gmxV2Ecosystem.live.gmBtc.unwrapper,
    core.gmxV2Ecosystem.live.gmBtcUsd.unwrapper,
    core.gmxV2Ecosystem.live.gmDogeUsd.unwrapper,
    core.gmxV2Ecosystem.live.gmEth.unwrapper,
    core.gmxV2Ecosystem.live.gmEthUsd.unwrapper,
    core.gmxV2Ecosystem.live.gmGmxUsd.unwrapper,
    core.gmxV2Ecosystem.live.gmLinkUsd.unwrapper,
    core.gmxV2Ecosystem.live.gmSolUsd.unwrapper,
    core.gmxV2Ecosystem.live.gmUniUsd.unwrapper,
    core.gmxV2Ecosystem.live.gmWstEthUsd.unwrapper,
  ];
  const wrappers = [
    core.gmxV2Ecosystem.live.gmAaveUsd.wrapper,
    core.gmxV2Ecosystem.live.gmArbUsd.wrapper,
    core.gmxV2Ecosystem.live.gmBtc.wrapper,
    core.gmxV2Ecosystem.live.gmBtcUsd.wrapper,
    core.gmxV2Ecosystem.live.gmDogeUsd.wrapper,
    core.gmxV2Ecosystem.live.gmEth.wrapper,
    core.gmxV2Ecosystem.live.gmEthUsd.wrapper,
    core.gmxV2Ecosystem.live.gmGmxUsd.wrapper,
    core.gmxV2Ecosystem.live.gmLinkUsd.wrapper,
    core.gmxV2Ecosystem.live.gmSolUsd.wrapper,
    core.gmxV2Ecosystem.live.gmUniUsd.wrapper,
    core.gmxV2Ecosystem.live.gmWstEthUsd.wrapper,
  ];

  const unwrapperImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeUnwrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeUnwrapperTraderImplementationV12',
    { ...core.libraries.unwrapperTraderImpl, ...core.gmxV2Ecosystem.live.gmxV2LibraryMap },
  );
  const wrapperImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeWrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeWrapperTraderImplementationV11',
    { ...core.libraries.wrapperTraderImpl, ...core.gmxV2Ecosystem.live.gmxV2LibraryMap },
  );

  for (let i = 0; i < unwrapperProxies.length; i++) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { unwrapperProxy: unwrapperProxies[i] },
        'unwrapperProxy',
        'upgradeTo',
        [unwrapperImplementationAddress],
      ),
    );
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { wrapperProxy: wrapperProxies[i] },
        'wrapperProxy',
        'upgradeTo',
        [wrapperImplementationAddress],
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
      assertHardhatInvariant(
        (await core.gmxV2Ecosystem.live.registry.gmxExchangeRouter()) === core.gmxV2Ecosystem.gmxExchangeRouterV2.address,
        'Invalid gmx exchange router'
      );
      assertHardhatInvariant(
        (await core.gmxV2Ecosystem.live.registry.gmxReader()) === core.gmxV2Ecosystem.gmxReaderV2.address,
        'Invalid gmx reader'
      );
      for (let i = 0; i < unwrappers.length; i++) {
        assertHardhatInvariant(
          (await unwrapperProxies[i].implementation()) === unwrapperImplementationAddress,
          `Invalid unwrapper implementation for ${unwrappers[i].address}`
        );
        assertHardhatInvariant(
          (await wrapperProxies[i].implementation()) === wrapperImplementationAddress,
          `Invalid wrapper implementation for ${wrappers[i].address}`
        );
      }
    },
  };
}

doDryRunAndCheckDeployment(main);
