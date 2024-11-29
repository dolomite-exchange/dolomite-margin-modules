import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from 'packages/base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployPendlePtSystem,
  EncodedTransaction,
  prettyPrintEncodeAddIsolationModeMarket,
  prettyPrintEncodeAddMarket,
  prettyPrintEncodeInsertPendlePtOracle,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Adds the USDe markets
 * - Sets up the ptUSDe ecosystem
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });
  let incrementor = 0;
  const numMarkets = await core.dolomiteMargin.getNumMarkets();

  const transactions: EncodedTransaction[] = [];
  const usdeMarketId = numMarkets.add(incrementor++);
  const ptUsdeMarketId = numMarkets.add(incrementor++);

  const usdeSystem = await deployPendlePtSystem(
    core,
    'USDeJul2024',
    core.pendleEcosystem.usdeJul2024.usdeMarket,
    core.pendleEcosystem.usdeJul2024.ptOracle,
    core.pendleEcosystem.usdeJul2024.ptUSDeToken,
    core.pendleEcosystem.usdeJul2024.syUsdeToken,
    core.tokens.usde,
  );

  transactions.push(
    ...(await prettyPrintEncodeAddMarket(
      core,
      core.tokens.usde,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction16L84U90OInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseEther(`${15_000_000}`),
      parseEther(`${10_000_000}`),
      false,
    )),
    await prettyPrintEncodeInsertPendlePtOracle(core, usdeSystem, core.tokens.usde),
    ...(await prettyPrintEncodeAddIsolationModeMarket(
      core,
      usdeSystem.factory,
      core.oracleAggregatorV2,
      usdeSystem.unwrapper,
      usdeSystem.wrapper,
      ptUsdeMarketId,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseEther(`${15_000_000}`),
    )),
  );
  return {
    core,
    upload: {
      transactions,
      chainId: core.network,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    scriptName: getScriptName(__filename),
    invariants: async () => {
      assertHardhatInvariant((await core.dolomiteMargin.getNumMarkets()).eq(8), 'Invalid number of markets');

      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.usde)) === core.tokens.usde.address,
        'Invalid USDe market ID',
      );
      assertHardhatInvariant(BigNumber.from(core.marketIds.usde).eq(usdeMarketId), 'Invalid USDe market ID');
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketPriceOracle(core.marketIds.usde)) === core.oracleAggregatorV2.address,
        'Invalid oracle for USDe',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketInterestSetter(core.marketIds.usde)) ===
          core.interestSetters.linearStepFunction16L84U90OInterestSetter.address,
        'Invalid interest setter USDe',
      );

      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(ptUsdeMarketId)) === usdeSystem.factory.address,
        'Invalid PT-USDe market ID',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketPriceOracle(ptUsdeMarketId)) === core.oracleAggregatorV2.address,
        'Invalid oracle for PT-USDe',
      );
      assertHardhatInvariant(
        await usdeSystem.factory.isTokenConverterTrusted(usdeSystem.unwrapper.address),
        'Unwrapper not trusted',
      );
      assertHardhatInvariant(
        await usdeSystem.factory.isTokenConverterTrusted(usdeSystem.wrapper.address),
        'Wrapper not trusted',
      );
      console.log('\tPrice for USDe', (await core.dolomiteMargin.getMarketPrice(core.marketIds.usde)).value.toString());
    },
  };
}

doDryRunAndCheckDeployment(main);
