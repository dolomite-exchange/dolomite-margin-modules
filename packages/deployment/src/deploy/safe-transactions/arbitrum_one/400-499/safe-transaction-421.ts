import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { BigNumber, BigNumberish } from 'ethers';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Updates the interest rate kink to be 10% APR for stables and 6% for yield-bearing stables
 * - Enables WBTC and ETH collateral/debt for all gm assets
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [];
  const stablecoinMarketIds = core.marketIds.stablecoinsWithUnifiedInterestRateModels;
  for (const stablecoinMarketId of stablecoinMarketIds) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteMargin: core.dolomiteMargin },
        'dolomiteMargin',
        'ownerSetInterestSetter',
        [stablecoinMarketId, core.interestSetters.linearStepFunction10L90U90OInterestSetter.address],
      ),
    );
  }

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetInterestSetter',
      [core.marketIds.wusdm, core.interestSetters.linearStepFunction6L94U90OInterestSetter.address],
    ),
  );

  for (const gmMarket of core.gmxV2Ecosystem.live.allGmMarkets) {
    // Assign these to a new array, so it's not read-only
    const collateralMarketIds = [...(await gmMarket.factory.allowableCollateralMarketIds())];
    const debtMarketIds = [...(await gmMarket.factory.allowableDebtMarketIds())];

    const collateralDirty = addMarketsToListIfNecessary(collateralMarketIds, [
      core.marketIds.wbtc,
      core.marketIds.weth,
    ]);
    if (collateralDirty) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(core, gmMarket, 'factory', 'ownerSetAllowableCollateralMarketIds', [
          collateralMarketIds,
        ]),
      );
    }

    const debtDirty = addMarketsToListIfNecessary(debtMarketIds, [core.marketIds.wbtc, core.marketIds.weth]);
    if (debtDirty) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(core, gmMarket, 'factory', 'ownerSetAllowableDebtMarketIds', [
          debtMarketIds,
        ]),
      );
    }
  }

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {
      const getInterestSetter = (o: BigNumberish) => core.dolomiteMargin.getMarketInterestSetter(o);

      for (const stablecoinMarketId of stablecoinMarketIds) {
        assertHardhatInvariant(
          core.interestSetters.linearStepFunction10L90U90OInterestSetter.address ===
            (await getInterestSetter(stablecoinMarketId)),
          `Invalid interest setter for ${stablecoinMarketId}`,
        );
      }

      assertHardhatInvariant(
        core.interestSetters.linearStepFunction6L94U90OInterestSetter.address ===
          (await getInterestSetter(core.marketIds.wusdm)),
        `Invalid interest setter for ${core.marketIds.wusdm}`,
      );

      for (const gmMarket of core.gmxV2Ecosystem.live.allGmMarkets) {
        const collateralMarketIds = await gmMarket.factory.allowableCollateralMarketIds();
        const debtMarketIds = await gmMarket.factory.allowableDebtMarketIds();

        assertHardhatInvariant(
          collateralMarketIds.some((m) => m.eq(core.marketIds.weth)),
          `Missing WETH collateral for ${gmMarket.factory.address}`,
        );
        assertHardhatInvariant(
          collateralMarketIds.some((m) => m.eq(core.marketIds.wbtc)),
          `Missing WBTC collateral for ${gmMarket.factory.address}`,
        );

        assertHardhatInvariant(
          debtMarketIds.some((m) => m.eq(core.marketIds.weth)),
          `Missing WETH collateral for ${gmMarket.factory.address}`,
        );
        assertHardhatInvariant(
          debtMarketIds.some((m) => m.eq(core.marketIds.wbtc)),
          `Missing WBTC collateral for ${gmMarket.factory.address}`,
        );
      }
    },
  };
}

function addMarketsToListIfNecessary(list: BigNumber[], marketIds: BigNumberish[]): boolean {
  let dirty = false;
  marketIds.forEach((marketId) => {
    if (!list.some((value) => value.eq(marketId))) {
      list.push(BigNumber.from(marketId));
      dirty = true;
    }
  });

  return dirty;
}

doDryRunAndCheckDeployment(main);
