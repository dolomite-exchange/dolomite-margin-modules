import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber, impersonate } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BYTES_ZERO, Network } from 'packages/base/src/utils/no-deps-constants';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

const ethRecipient = '0x1fF6B8E1192eB0369006Bbad76dA9068B68961B2';

/**
 * This script encodes the following transactions:
 * - Updates the GMX V2 wrappers/unwrappers to include functions for clearing keys
 * - Claims all ETH from the wrappers/unwrappers
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const unwrapperProxies = [
    core.gmxV2Ecosystem.live.gmArbUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmBtc.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmBtcUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmEth.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmEthUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmLinkUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmUniUsd.unwrapperProxy,
  ];
  const wrapperProxies = [
    core.gmxV2Ecosystem.live.gmArbUsd.wrapperProxy,
    core.gmxV2Ecosystem.live.gmBtc.wrapperProxy,
    core.gmxV2Ecosystem.live.gmBtcUsd.wrapperProxy,
    core.gmxV2Ecosystem.live.gmEth.wrapperProxy,
    core.gmxV2Ecosystem.live.gmEthUsd.wrapperProxy,
    core.gmxV2Ecosystem.live.gmLinkUsd.wrapperProxy,
    core.gmxV2Ecosystem.live.gmUniUsd.wrapperProxy,
  ];

  const unwrappers = [
    core.gmxV2Ecosystem.live.gmArbUsd.unwrapper,
    core.gmxV2Ecosystem.live.gmBtc.unwrapper,
    core.gmxV2Ecosystem.live.gmBtcUsd.unwrapper,
    core.gmxV2Ecosystem.live.gmEth.unwrapper,
    core.gmxV2Ecosystem.live.gmEthUsd.unwrapper,
    core.gmxV2Ecosystem.live.gmLinkUsd.unwrapper,
    core.gmxV2Ecosystem.live.gmUniUsd.unwrapper,
  ];
  const wrappers = [
    core.gmxV2Ecosystem.live.gmArbUsd.wrapper,
    core.gmxV2Ecosystem.live.gmBtc.wrapper,
    core.gmxV2Ecosystem.live.gmBtcUsd.wrapper,
    core.gmxV2Ecosystem.live.gmEth.wrapper,
    core.gmxV2Ecosystem.live.gmEthUsd.wrapper,
    core.gmxV2Ecosystem.live.gmLinkUsd.wrapper,
    core.gmxV2Ecosystem.live.gmUniUsd.wrapper,
  ];

  const unwrapperImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeUnwrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeUnwrapperTraderImplementationV8',
    { ...core.libraries.unwrapperTraderImpl, ...core.gmxV2Ecosystem.live.gmxV2LibraryMap },
  );
  const wrapperImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeWrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeWrapperTraderImplementationV7',
    { ...core.libraries.wrapperTraderImpl, ...core.gmxV2Ecosystem.live.gmxV2LibraryMap },
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

    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(core, { unwrapper: unwrappers[i] }, 'unwrapper', 'ownerWithdrawETH', [
        ethRecipient,
      ]),
    );
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(core, { wrapper: wrappers[i] }, 'wrapper', 'ownerWithdrawETH', [
        ethRecipient,
      ]),
    );
  }

  const balanceBefore = await ethers.provider.getBalance(ethRecipient);

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

      const balanceAfter = await ethers.provider.getBalance(ethRecipient);
      expect(balanceBefore.lt(balanceAfter));
    },
  };
}

doDryRunAndCheckDeployment(main);
