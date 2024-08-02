import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber, impersonate } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BYTES_ZERO, Network } from 'packages/base/src/utils/no-deps-constants';
import { deployContractAndSave, prettyPrintEncodedDataWithTypeSafety } from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

const ethRecipient = '0x1fF6B8E1192eB0369006Bbad76dA9068B68961B2';

/**
 * This script encodes the following transactions:
 * - Updates the GMX V2 wrappers/unwrappers to include use the updated method IDs for depositing / withdrawing
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const unwrapperProxies = [
    core.gmxEcosystemV2.live.gmArbUsd.unwrapperProxy,
    core.gmxEcosystemV2.live.gmBtc.unwrapperProxy,
    core.gmxEcosystemV2.live.gmBtcUsd.unwrapperProxy,
    core.gmxEcosystemV2.live.gmEth.unwrapperProxy,
    core.gmxEcosystemV2.live.gmEthUsd.unwrapperProxy,
    core.gmxEcosystemV2.live.gmLinkUsd.unwrapperProxy,
    core.gmxEcosystemV2.live.gmUniUsd.unwrapperProxy,
  ];
  const wrapperProxies = [
    core.gmxEcosystemV2.live.gmArbUsd.wrapperProxy,
    core.gmxEcosystemV2.live.gmBtc.wrapperProxy,
    core.gmxEcosystemV2.live.gmBtcUsd.wrapperProxy,
    core.gmxEcosystemV2.live.gmEth.wrapperProxy,
    core.gmxEcosystemV2.live.gmEthUsd.wrapperProxy,
    core.gmxEcosystemV2.live.gmLinkUsd.wrapperProxy,
    core.gmxEcosystemV2.live.gmUniUsd.wrapperProxy,
  ];

  const unwrappers = [
    core.gmxEcosystemV2.live.gmArbUsd.unwrapper,
    core.gmxEcosystemV2.live.gmBtc.unwrapper,
    core.gmxEcosystemV2.live.gmBtcUsd.unwrapper,
    core.gmxEcosystemV2.live.gmEth.unwrapper,
    core.gmxEcosystemV2.live.gmEthUsd.unwrapper,
    core.gmxEcosystemV2.live.gmLinkUsd.unwrapper,
    core.gmxEcosystemV2.live.gmUniUsd.unwrapper,
  ];
  const wrappers = [
    core.gmxEcosystemV2.live.gmArbUsd.wrapper,
    core.gmxEcosystemV2.live.gmBtc.wrapper,
    core.gmxEcosystemV2.live.gmBtcUsd.wrapper,
    core.gmxEcosystemV2.live.gmEth.wrapper,
    core.gmxEcosystemV2.live.gmEthUsd.wrapper,
    core.gmxEcosystemV2.live.gmLinkUsd.wrapper,
    core.gmxEcosystemV2.live.gmUniUsd.wrapper,
  ];

  const unwrapperImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeUnwrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeUnwrapperTraderImplementationV9',
    { ...core.libraries.unwrapperTraderImpl, ...core.gmxEcosystemV2.live.gmxV2LibraryMap },
  );
  const wrapperImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeWrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeWrapperTraderImplementationV8',
    { ...core.libraries.wrapperTraderImpl, ...core.gmxEcosystemV2.live.gmxV2LibraryMap },
  );

  const transactions = [];
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
      addExecuteImmediatelyTransactions: true,
      chainId: network,
    },
    invariants: async () => {
      const handler = await impersonate(ethRecipient);
      for (let i = 0; i < unwrappers.length; i++) {
        await unwrappers[i].connect(handler).emitWithdrawalExecuted(BYTES_ZERO);
        await wrappers[i].connect(handler).emitDepositCancelled(BYTES_ZERO);
      }
    },
  };
}

doDryRunAndCheckDeployment(main);
