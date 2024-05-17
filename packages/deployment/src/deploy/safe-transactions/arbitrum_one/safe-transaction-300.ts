import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Updates the jUSDC allowable debt / collateral tokens
 * - Changes back the altcoins interest rate models to be less aggressive than they are currently
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const altCoins = [
    core.marketIds.wbtc,
    core.marketIds.uni,
    core.marketIds.pendle,
    core.marketIds.wstEth,
    core.marketIds.grail,
    core.marketIds.link,
    core.marketIds.rEth,
  ];

  const transactions: EncodedTransaction[] = [];
  for (let i = 0; i < altCoins.length; i++) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomite: core.dolomiteMargin },
        'dolomite',
        'ownerSetInterestSetter',
        [altCoins[i], core.interestSetters.linearStepFunction8L92UInterestSetter.address],
      ),
    );
  }

  const expectedCollateralMarketIds = [core.marketIds.djUsdcV2, ...core.marketIds.stablecoins];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: core.jonesEcosystem.live.jUSDCV2IsolationModeFactory },
      'factory',
      'ownerSetAllowableDebtMarketIds',
      [core.marketIds.stablecoins],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: core.jonesEcosystem.live.jUSDCV2IsolationModeFactory },
      'factory',
      'ownerSetAllowableCollateralMarketIds',
      [expectedCollateralMarketIds],
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
      const factory = core.jonesEcosystem.live.jUSDCV2IsolationModeFactory;

      const debtMarketIds = await factory.allowableDebtMarketIds();
      expect(debtMarketIds.length).to.eq(core.marketIds.stablecoins.length);
      expect(debtMarketIds.every(m => !!core.marketIds.stablecoins.find(n => m.eq(n)))).to.be.true;

      const collateralMarketIds = await factory.allowableCollateralMarketIds();
      expect(collateralMarketIds.length).to.eq(expectedCollateralMarketIds.length);
      expect(collateralMarketIds.every(m => !!expectedCollateralMarketIds.find(n => m.eq(n)))).to.be.true;

      for (let i = 0; i < altCoins.length; i++) {
        expect(await core.dolomiteMargin.getMarketInterestSetter(altCoins[i]))
          .to
          .eq(core.interestSetters.linearStepFunction8L92UInterestSetter.address);
      }
    },
  };
}

doDryRunAndCheckDeployment(main);
