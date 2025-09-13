import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,

} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Upgrades the async unwrapper contract for all async assets (GMX V2)
 * - Allows the GMX V2 single sided unwrappers and wrappers to be instantly upgraded
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const unwrapperLibAddress = await deployContractAndSave(
    'AsyncIsolationModeUnwrapperTraderImpl',
    [],
    'AsyncIsolationModeUnwrapperTraderImplV3',
  );
  const gmxV2UnwrapperTraderImplAddress = await deployContractAndSave(
    'GmxV2IsolationModeUnwrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeUnwrapperTraderImplementationV6',
    { ...core.gmxV2Ecosystem.live.gmxV2VaultLibraryMap, AsyncIsolationModeUnwrapperTraderImpl: unwrapperLibAddress },
  );

  const unwrapperProxies = [
    core.gmxV2Ecosystem.live.gmArbUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmBtcUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmEthUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmLinkUsd.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmBtc.unwrapperProxy,
    core.gmxV2Ecosystem.live.gmEth.unwrapperProxy,
  ];

  const transactions: EncodedTransaction[] = [];
  for (let i = 0; i < unwrapperProxies.length; i++) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { proxy: unwrapperProxies[i] },
        'proxy',
        'upgradeTo',
        [gmxV2UnwrapperTraderImplAddress],
      ),
    );
  }

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { multisig: core.delayedMultiSig },
      'multisig',
      'setSelector',
      [core.gmxV2Ecosystem.live.gmBtc.unwrapperProxy.address, '0x3659cfe6', true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { multisig: core.delayedMultiSig },
      'multisig',
      'setSelector',
      [core.gmxV2Ecosystem.live.gmEth.unwrapperProxy.address, '0x3659cfe6', true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { multisig: core.delayedMultiSig },
      'multisig',
      'setSelector',
      [core.gmxV2Ecosystem.live.gmBtc.wrapperProxy.address, '0x3659cfe6', true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { multisig: core.delayedMultiSig },
      'multisig',
      'setSelector',
      [core.gmxV2Ecosystem.live.gmEth.wrapperProxy.address, '0x3659cfe6', true],
    ),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    skipTimeDelay: true,
    invariants: async () => {
      for (let i = 0; i < unwrapperProxies.length; i++) {
        expect(await unwrapperProxies[i].implementation()).to.eq(gmxV2UnwrapperTraderImplAddress);
      }
    },
  };
}

doDryRunAndCheckDeployment(main);
