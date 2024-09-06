import Deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets token pair to be WETH for dpt-rsETH (SEP 2024)
 * - Sets token pair to be WETH for dpt-ezETH (SEP 2024)
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  console.log(
    '\tPT-rsETH (SEP-2024) price:',
    (await core.dolomiteMargin.getMarketPrice(core.marketIds.dPtRsEthSep2024)).value.toString(),
  );
  console.log(
    '\tPT-ezETH (SEP-2024) price:',
    (await core.dolomiteMargin.getMarketPrice(core.marketIds.dPtEzEthSep2024)).value.toString(),
  );

  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: core.pendleEcosystem.ezEthSep2024.dPtEzEthSep2024.address,
          decimals: await core.pendleEcosystem.ezEthSep2024.dPtEzEthSep2024.decimals(),
          oracleInfos: [
            {
              oracle: Deployments.PendlePtEzETHSep2024PriceOracleV2[network].address,
              tokenPair: core.tokens.weth.address,
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
          token: core.pendleEcosystem.rsEthSep2024.dPtRsEthSep2024.address,
          decimals: await core.pendleEcosystem.rsEthSep2024.dPtRsEthSep2024.decimals(),
          oracleInfos: [
            {
              oracle: Deployments.PendlePtRsETHSep2024PriceOracleV2[network].address,
              tokenPair: core.tokens.weth.address,
              weight: 100,
            },
          ],
        },
      ],
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
      console.log(
        '\tPT-rsETH (SEP-2024) price:',
        (await core.dolomiteMargin.getMarketPrice(core.marketIds.dPtRsEthSep2024)).value.toString(),
      );
      console.log(
        '\tPT-ezETH (SEP-2024) price:',
        (await core.dolomiteMargin.getMarketPrice(core.marketIds.dPtEzEthSep2024)).value.toString(),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
