import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { GMX_V2_EXECUTION_FEE } from '@dolomite-exchange/modules-gmx-v2/src/gmx-v2-constructors';
import { GmxV2IsolationModeVaultFactory } from '@dolomite-exchange/modules-gmx-v2/src/types';
import { BigNumber } from 'ethers';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Updates the execution fee for gmUNI-USD
 * - Updates the wrapper and unwrapper on the registry for gmUNI-USD
 * - Updates the allowable collateral / debt for gm assets
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const factories: GmxV2IsolationModeVaultFactory[] = [
    core.gmxEcosystemV2.live.gmArbUsd.factory,
    core.gmxEcosystemV2.live.gmBtcUsd.factory,
    core.gmxEcosystemV2.live.gmEthUsd.factory,
    core.gmxEcosystemV2.live.gmLinkUsd.factory,
    core.gmxEcosystemV2.live.gmUniUsd.factory,
    core.gmxEcosystemV2.live.gmBtc.factory,
    core.gmxEcosystemV2.live.gmEth.factory,
  ];
  const longMarketIds = await Promise.all(factories.map((f) => f.LONG_TOKEN_MARKET_ID()));
  const stablecoins = core.marketIds.stablecoins;
  const usdcIndex = stablecoins.findIndex((m) => BigNumber.from(m).eq(core.marketIds.nativeUsdc));
  const firstValue = stablecoins[0];
  stablecoins[0] = stablecoins[usdcIndex];
  stablecoins[usdcIndex] = firstValue;

  const registry = core.gmxEcosystemV2.live.registry;

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: core.gmxEcosystemV2.live.gmUniUsd.factory },
      'factory',
      'ownerSetExecutionFee',
      [GMX_V2_EXECUTION_FEE],
    ),
    await prettyPrintEncodedDataWithTypeSafety(core, { registry }, 'registry', 'ownerSetUnwrapperByToken', [
      core.gmxEcosystemV2.live.gmUniUsd.factory.address,
      core.gmxEcosystemV2.live.gmUniUsd.unwrapper.address,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { registry }, 'registry', 'ownerSetWrapperByToken', [
      core.gmxEcosystemV2.live.gmUniUsd.factory.address,
      core.gmxEcosystemV2.live.gmUniUsd.wrapper.address,
    ]),
  );

  for (let i = 0; i < factories.length; i++) {
    const factory = factories[i];
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(core, { factory }, 'factory', 'ownerSetAllowableCollateralMarketIds', [
        [longMarketIds[i], ...stablecoins],
      ]),
      await prettyPrintEncodedDataWithTypeSafety(core, { factory }, 'factory', 'ownerSetAllowableDebtMarketIds', [
        [longMarketIds[i], ...stablecoins],
      ]),
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
      const uniFactory = core.gmxEcosystemV2.live.gmUniUsd.factory;
      assertHardhatInvariant(
        await registry.getUnwrapperByToken(uniFactory.address) === core.gmxEcosystemV2.live.gmUniUsd.unwrapper.address,
        'Invalid unwrapper',
      );
      assertHardhatInvariant(
        await registry.getWrapperByToken(uniFactory.address) === core.gmxEcosystemV2.live.gmUniUsd.wrapper.address,
        'Invalid wrapper',
      );
      assertHardhatInvariant(
        GMX_V2_EXECUTION_FEE.eq(await uniFactory.executionFee()),
        'Invalid wrapper',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
