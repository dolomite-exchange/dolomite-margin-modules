import { IsolationModeTraderProxy } from 'packages/base/src/types';
import {
  CoreProtocolArbitrumOne,
} from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { LiveGmMarket } from 'packages/base/test/utils/ecosystem-utils/gmx';
import { GmxV2IsolationModeVaultFactory } from 'packages/gmx-v2/src/types';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../../utils/dry-run-utils';
import getScriptName from '../../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys the new GMX V2 Library
 * - Sets the new user vault implementation for each GM-Factory
 * - Sets the new unwrapper trader implementation each GM-Factory unwrapper
 * - Sets the new wrapper trader implementation each GM-Factory wrapper
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const gmxV2LibraryAddress = await deployContractAndSave('GmxV2Library', [], 'GmxV2LibraryV8');
  const userVaultImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeTokenVaultV1',
    [core.tokens.weth.address, network],
    'GmxV2IsolationModeTokenVaultImplementationV15',
    { GmxV2Library: gmxV2LibraryAddress, ...core.libraries.tokenVaultActionsImpl },
  );
  const unwrapperImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeUnwrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeUnwrapperTraderImplementationV11',
    { GmxV2Library: gmxV2LibraryAddress, ...core.libraries.unwrapperTraderImpl },
  );
  const wrapperImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeWrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeWrapperTraderImplementationV10',
    { GmxV2Library: gmxV2LibraryAddress, ...core.libraries.wrapperTraderImpl },
  );

  const liveMarkets: [LiveGmMarket, string][] = [
    [core.gmxV2Ecosystem.live.gmAaveUsd, 'gmAaveUsd'],
    [core.gmxV2Ecosystem.live.gmArbUsd, 'gmArbUsd'],
    [core.gmxV2Ecosystem.live.gmBtc, 'gmBtc'],
    [core.gmxV2Ecosystem.live.gmBtcUsd, 'gmBtcUsd'],
    [core.gmxV2Ecosystem.live.gmDogeUsd, 'gmDogeUsd'],
    [core.gmxV2Ecosystem.live.gmEth, 'gmEth'],
    [core.gmxV2Ecosystem.live.gmEthUsd, 'gmEthUsd'],
    [core.gmxV2Ecosystem.live.gmGmxUsd, 'gmGmxUsd'],
    [core.gmxV2Ecosystem.live.gmLinkUsd, 'gmLinkUsd'],
    [core.gmxV2Ecosystem.live.gmSolUsd, 'gmSolUsd'],
    [core.gmxV2Ecosystem.live.gmUniUsd, 'gmUniUsd'],
    [core.gmxV2Ecosystem.live.gmWstEthUsd, 'gmWstEthUsd'],
  ];

  const transactions: EncodedTransaction[] = [];
  for (const [liveMarket] of liveMarkets) {
    transactions.push(
      await encodeSetUserVaultImplementation(core, liveMarket.factory, userVaultImplementationAddress),
      await encodeSetUnwrapper(core, liveMarket.unwrapperProxy, unwrapperImplementationAddress),
      await encodeSetWrapper(core, liveMarket.wrapperProxy, wrapperImplementationAddress),
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
      for (const [liveMarket, label] of liveMarkets) {
        assertHardhatInvariant(
          (await liveMarket.factory.userVaultImplementation()) === userVaultImplementationAddress,
          `Invalid user vault implementation for ${label}`,
        );

        assertHardhatInvariant(
          (await liveMarket.unwrapperProxy.implementation()) === unwrapperImplementationAddress,
          `Invalid unwrapper implementation for ${label}`,
        );

        assertHardhatInvariant(
          (await liveMarket.wrapperProxy.implementation()) === wrapperImplementationAddress,
          `Invalid wrapper implementation for ${label}`,
        );
      }
    },
  };
}

async function encodeSetUserVaultImplementation(
  core: CoreProtocolArbitrumOne,
  factory: GmxV2IsolationModeVaultFactory,
  userVaultAddress: string,
): Promise<EncodedTransaction> {
  return prettyPrintEncodedDataWithTypeSafety(core, { factory }, 'factory', 'ownerSetUserVaultImplementation', [
    userVaultAddress,
  ]);
}

async function encodeSetUnwrapper(
  core: CoreProtocolArbitrumOne,
  unwrapper: IsolationModeTraderProxy,
  unwrapperAddress: string,
): Promise<EncodedTransaction> {
  return prettyPrintEncodedDataWithTypeSafety(core, { unwrapper }, 'unwrapper', 'upgradeTo', [unwrapperAddress]);
}

async function encodeSetWrapper(
  core: CoreProtocolArbitrumOne,
  wrapper: IsolationModeTraderProxy,
  wrapperAddress: string,
): Promise<EncodedTransaction> {
  return prettyPrintEncodedDataWithTypeSafety(core, { wrapper }, 'wrapper', 'upgradeTo', [wrapperAddress]);
}

doDryRunAndCheckDeployment(main);
