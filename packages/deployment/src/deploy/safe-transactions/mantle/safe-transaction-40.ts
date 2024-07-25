import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployPendlePtSystem,
  EncodedTransaction,
  prettyPrintEncodeAddIsolationModeMarket,
  prettyPrintEncodeInsertPendlePtOracle,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys the ptUSDe Dec 2024 ecosystem
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });
  const marketId = await core.dolomiteMargin.getNumMarkets();

  const transactions: EncodedTransaction[] = [];

  const usdeSystem = await deployPendlePtSystem(
    core,
    'USDeDec2024',
    core.pendleEcosystem.usdeDec2024.usdeMarket,
    core.pendleEcosystem.usdeDec2024.ptOracle,
    core.pendleEcosystem.usdeDec2024.ptUSDeToken,
    core.pendleEcosystem.usdeDec2024.syUsdeToken,
    core.tokens.usde,
  );

  transactions.push(
    await prettyPrintEncodeInsertPendlePtOracle(core, usdeSystem, core.tokens.usde),
    ...(await prettyPrintEncodeAddIsolationModeMarket(
      core,
      usdeSystem.factory,
      core.oracleAggregatorV2,
      usdeSystem.unwrapper,
      usdeSystem.wrapper,
      marketId,
      TargetCollateralization.Base, // @follow-up Not sure what to make these
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
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketTokenAddress(marketId)) === usdeSystem.factory.address,
        'Invalid PT-USDe market ID',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketPriceOracle(marketId)) === core.oracleAggregatorV2.address,
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
      console.log(
        '\tPrice for ptUSDe Dec 2024: ',
        (await core.dolomiteMargin.getMarketPrice(marketId)).value.toString()
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
