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
  prettyPrintEncodeAddIsolationModeMarket, prettyPrintEncodedDataWithTypeSafety,
  prettyPrintEncodeInsertPendlePtOracle,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets up the PT-mETH ecosystem
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
  const ptMethMarketId = numMarkets.add(incrementor++);

  const methSystem = await deployPendlePtSystem(
    core,
    'mETHDec2024',
    core.pendleEcosystem.methDec2024.methMarket,
    core.pendleEcosystem.methDec2024.ptOracle,
    core.pendleEcosystem.methDec2024.ptMethToken,
    core.pendleEcosystem.methDec2024.syMethToken,
    core.tokens.meth,
  );

  transactions.push(
    await prettyPrintEncodeInsertPendlePtOracle(core, methSystem, core.tokens.weth),
    ...(await prettyPrintEncodeAddIsolationModeMarket(
      core,
      methSystem.factory,
      core.oracleAggregatorV2,
      methSystem.unwrapper,
      methSystem.wrapper,
      ptMethMarketId,
      TargetCollateralization._120,
      TargetLiquidationPenalty._6,
      parseEther(`${1_000}`),
    )),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetInterestSetter',
      [core.marketIds.meth, core.interestSetters.linearStepFunction8L92U90OInterestSetter.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetInterestSetter',
      [core.marketIds.meth, core.interestSetters.linearStepFunction12L88U90OInterestSetter.address],
    ),
  );
  return {
    core,
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
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
        (await core.dolomiteMargin.getMarketTokenAddress(ptMethMarketId)) === methSystem.factory.address,
        'Invalid PT-mETH market ID',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketPriceOracle(ptMethMarketId)) === core.oracleAggregatorV2.address,
        'Invalid oracle for PT-mETH',
      );
      assertHardhatInvariant(
        await methSystem.factory.isTokenConverterTrusted(methSystem.unwrapper.address),
        'Unwrapper not trusted',
      );
      assertHardhatInvariant(
        await methSystem.factory.isTokenConverterTrusted(methSystem.wrapper.address),
        'Wrapper not trusted',
      );
      console.log('\tPrice for PT-mETH', (await core.dolomiteMargin.getMarketPrice(ptMethMarketId)).value.toString());
    },
  };
}

doDryRunAndCheckDeployment(main);
