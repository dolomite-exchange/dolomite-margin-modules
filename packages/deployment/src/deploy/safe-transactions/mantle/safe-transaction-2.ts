import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import {
  EncodedTransaction,
  deployPendlePtSystem,
  prettyPrintEncodeAddIsolationModeMarket,
  prettyPrintEncodeAddMarket,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

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

  const usdeSystem = await deployPendlePtSystem(
    core,
    'USDeJul2024',
    core.pendleEcosystem.usdeJul2024.usdeMarket,
    core.pendleEcosystem.usdeJul2024.ptOracle,
    core.pendleEcosystem.usdeJul2024.ptUSDeToken,
    core.pendleEcosystem.syUsdeToken,
    core.tokens.usde
  );

  let transactions: EncodedTransaction[] = [];
  transactions.push(
    ...await prettyPrintEncodeAddMarket(
      core,
      core.tokens.usde,
      core.oracleAggregatorV2,
      // @follow-up @Corey, I'm not sure what to put for these values
      core.interestSetters.linearStepFunction14L86UInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      ZERO_BI,
      ZERO_BI,
      false,
    ),
  );
  const ptUSDeMarketId = (await core.dolomiteMargin.getNumMarkets()).add(1);
  const ptUSDeMaxSupplyWei = parseEther('1000');
  transactions = transactions.concat(
    await prettyPrintEncodeAddIsolationModeMarket(
      core,
      usdeSystem.factory,
      usdeSystem.oracle,
      usdeSystem.unwrapper,
      usdeSystem.wrapper,
      ptUSDeMarketId,
      // @follow-up @Corey, I'm not sure what to put for these values
      TargetCollateralization._120,
      TargetLiquidationPenalty._7,
      ptUSDeMaxSupplyWei,
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: usdeSystem.factory },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [usdeSystem.unwrapper.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: usdeSystem.factory },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [usdeSystem.wrapper.address, true],
    ),
  )
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
      assertHardhatInvariant(
        await core.dolomiteMargin.getMarketPriceOracle(core.marketIds.usde) === core.oracleAggregatorV2.address,
        'Invalid oracle for USDe',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getMarketInterestSetter(core.marketIds.usde)
        === core.interestSetters.linearStepFunction14L86UInterestSetter.address,
        'Invalid interest setter USDe',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getNumMarkets()).eq(8),
        'Invalid number of markets',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.usde)) === core.tokens.usde.address,
        'Invalid usde for market 6',
      );

      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(7)) === usdeSystem.factory.address,
        'Invalid ptUSDe for market 7',
      );

      assertHardhatInvariant(
        (await usdeSystem.factory.isTokenConverterTrusted(usdeSystem.unwrapper.address)),
        'Unwrapper not trusted',
      );

      assertHardhatInvariant(
        (await usdeSystem.factory.isTokenConverterTrusted(usdeSystem.wrapper.address)),
        'Wrapper not trusted',
      );

      console.log(
        '\t Price for usde',
        (await core.dolomiteMargin.getMarketPrice(core.marketIds.usde)).value.toString(),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
