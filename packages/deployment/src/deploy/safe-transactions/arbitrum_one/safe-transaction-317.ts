import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { GMX_V2_EXECUTION_FEE } from '@dolomite-exchange/modules-gmx-v2/src/gmx-v2-constructors';
import { GmxV2IsolationModeVaultFactory } from '@dolomite-exchange/modules-gmx-v2/src/types';
import { BigNumber } from 'ethers';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { ADDRESS_ZERO, Network } from 'packages/base/src/utils/no-deps-constants';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Updates the allowable collateral for gm assets
 * - Allows instant changing of allowable collateral/debt for all isolation mode assets
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
  const factoryMarketIds = await Promise.all(factories.map((f) => f.marketId()));
  const longMarketIds = await Promise.all(factories.map((f) => f.LONG_TOKEN_MARKET_ID()));
  const stablecoins = core.marketIds.stablecoins;
  const usdcIndex = stablecoins.findIndex((m) => BigNumber.from(m).eq(core.marketIds.nativeUsdc));
  const firstValue = stablecoins[0];
  stablecoins[0] = stablecoins[usdcIndex];
  stablecoins[usdcIndex] = firstValue;

  const registry = core.gmxEcosystemV2.live.registry;

  const transactions: EncodedTransaction[] = [];
  for (let i = 0; i < factories.length; i++) {
    const factory = factories[i];
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(core, { factory }, 'factory', 'ownerSetAllowableCollateralMarketIds', [
        [longMarketIds[i], ...stablecoins, factoryMarketIds[i]],
      ]),
    );
  }

  const methodId1 = await factories[0].populateTransaction.ownerSetAllowableCollateralMarketIds([]);
  const methodId2 = await factories[0].populateTransaction.ownerSetAllowableDebtMarketIds([]);
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(core, { multisig: core.delayedMultiSig }, 'multisig', 'setSelector', [
      ADDRESS_ZERO,
      methodId1.data!.substring(0, 10),
      true,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { multisig: core.delayedMultiSig }, 'multisig', 'setSelector', [
      ADDRESS_ZERO,
      methodId2.data!.substring(0, 10),
      true,
    ]),
  );

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
        (await registry.getUnwrapperByToken(uniFactory.address)) ===
          core.gmxEcosystemV2.live.gmUniUsd.unwrapper.address,
        'Invalid unwrapper',
      );
      assertHardhatInvariant(
        (await registry.getWrapperByToken(uniFactory.address)) === core.gmxEcosystemV2.live.gmUniUsd.wrapper.address,
        'Invalid wrapper',
      );
      assertHardhatInvariant(GMX_V2_EXECUTION_FEE.eq(await uniFactory.executionFee()), 'Invalid wrapper');
    },
  };
}

doDryRunAndCheckDeployment(main);
