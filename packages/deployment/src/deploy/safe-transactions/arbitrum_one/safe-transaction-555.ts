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
  prettyPrintEncodeAddIsolationModeMarket,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys PT-weETH (SEP 2024)
 * - Deploys PT-ezETH (SEP 2024)
 * - Deploys PT-rsETH (SEP 2024)
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });
  let incrementor = 0;
  const numMarkets = await core.dolomiteMargin.getNumMarkets();

  const transactions = [];
  const pteEthMarketId = numMarkets.add(incrementor++);
  const ptezEthMarketId = numMarkets.add(incrementor++);
  const ptrsEthMarketId = numMarkets.add(incrementor++);
  const weEthPendleSystem = await deployPendlePtSystem(
    core,
    'WeETHSep2024',
    core.pendleEcosystem.weEthSep2024.weEthMarket,
    core.pendleEcosystem.weEthSep2024.ptOracle,
    core.pendleEcosystem.weEthSep2024.ptWeEthToken,
    core.pendleEcosystem.syWeEthToken,
    core.tokens.weEth,
  );
  const ezEthPendleSystem = await deployPendlePtSystem(
    core,
    'EzETHSep2024',
    core.pendleEcosystem.ezEthSep2024.ezEthMarket,
    core.pendleEcosystem.ezEthSep2024.ptOracle,
    core.pendleEcosystem.ezEthSep2024.ptEzEthToken,
    core.pendleEcosystem.syEzEthToken,
    core.tokens.ezEth,
  );
  const rsEthPendleSystem = await deployPendlePtSystem(
    core,
    'RsETHSep2024',
    core.pendleEcosystem.rsEthSep2024.rsEthMarket,
    core.pendleEcosystem.rsEthSep2024.ptOracle,
    core.pendleEcosystem.rsEthSep2024.ptRsEthToken,
    core.pendleEcosystem.syRsEthToken,
    core.tokens.rsEth,
  );

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: weEthPendleSystem.factory.address,
          decimals: await weEthPendleSystem.factory.decimals(),
          oracleInfos: [
            {
              oracle: weEthPendleSystem.oracle.address,
              tokenPair: core.tokens.eEth.address,
              weight: 100,
            },
          ],
        },
      ],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: ezEthPendleSystem.factory.address,
          decimals: await ezEthPendleSystem.factory.decimals(),
          oracleInfos: [
            {
              oracle: ezEthPendleSystem.oracle.address,
              tokenPair: core.tokens.ezEth.address,
              weight: 100,
            },
          ],
        },
      ],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: rsEthPendleSystem.factory.address,
          decimals: await rsEthPendleSystem.factory.decimals(),
          oracleInfos: [
            {
              oracle: rsEthPendleSystem.oracle.address,
              tokenPair: core.tokens.rsEth.address,
              weight: 100,
            },
          ],
        },
      ],
    ),
    ...await prettyPrintEncodeAddIsolationModeMarket(
      core,
      weEthPendleSystem.factory,
      core.oracleAggregatorV2,
      weEthPendleSystem.unwrapper,
      weEthPendleSystem.wrapper,
      pteEthMarketId,
      // @follow-up @Corey, I'm not sure what to put for these values
      TargetCollateralization._120,
      TargetLiquidationPenalty._6,
      parseEther('750'),
    ),
    ...await prettyPrintEncodeAddIsolationModeMarket(
      core,
      ezEthPendleSystem.factory,
      core.oracleAggregatorV2,
      ezEthPendleSystem.unwrapper,
      ezEthPendleSystem.wrapper,
      ptezEthMarketId,
      // @follow-up @Corey, I'm not sure what to put for these values
      TargetCollateralization._120,
      TargetLiquidationPenalty._6,
      parseEther('1500000'),
    ),
    ...await prettyPrintEncodeAddIsolationModeMarket(
      core,
      rsEthPendleSystem.factory,
      core.oracleAggregatorV2,
      rsEthPendleSystem.unwrapper,
      rsEthPendleSystem.wrapper,
      ptrsEthMarketId,
      // @follow-up @Corey, I'm not sure what to put for these values
      TargetCollateralization._120,
      TargetLiquidationPenalty._6,
      parseEther('750'),
    ),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant(
        await core.dolomiteMargin.getMarketTokenAddress(pteEthMarketId) === weEthPendleSystem.factory.address,
        'Invalid PT-weETH market ID',
      );
      console.log(
        '\tPT-weETH (SEP-2024) price:',
        (await core.dolomiteMargin.getMarketPrice(pteEthMarketId)).value.toString(),
      );

      assertHardhatInvariant(
        await core.dolomiteMargin.getMarketTokenAddress(ptezEthMarketId) === ezEthPendleSystem.factory.address,
        'Invalid PT-ezETH market ID',
      );
      console.log(
        '\tezEth price:',
        (await core.dolomiteMargin.getMarketPrice(core.marketIds.ezEth)).value.toString(),
      );
      console.log(
        '\tPT-ezETH (SEP-2024) price:',
        (await core.dolomiteMargin.getMarketPrice(ptezEthMarketId)).value.toString(),
      );

      assertHardhatInvariant(
        await core.dolomiteMargin.getMarketTokenAddress(ptrsEthMarketId) === rsEthPendleSystem.factory.address,
        'Invalid PT-rsETH market ID',
      );
      console.log(
        '\trsEth price:',
        (await core.dolomiteMargin.getMarketPrice(core.marketIds.rsEth)).value.toString(),
      );
      console.log(
        '\tPT-rsETH (SEP-2024) price:',
        (await core.dolomiteMargin.getMarketPrice(ptrsEthMarketId)).value.toString(),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
