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

} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import { encodeAddIsolationModeMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys PT-GLP (SEP 2024)
 * - Deploys PT-weETH (JUN 2024)
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });
  let incrementor = 0;
  const numMarkets = await core.dolomiteMargin.getNumMarkets();

  const transactions = [];
  const ptGlpMarketId = numMarkets.add(incrementor++);
  const pteEthMarketId = numMarkets.add(incrementor++);
  const glpPendleSystem = await deployPendlePtSystem(
    core,
    'GLPSep2024',
    core.pendleEcosystem.glpSep2024.glpMarket,
    core.pendleEcosystem.glpSep2024.ptOracle,
    core.pendleEcosystem.glpSep2024.ptGlpToken,
    core.pendleEcosystem.syGlpSep2024Token,
    core.tokens.sGlp,
  );
  const weEthPendleSystem = await deployPendlePtSystem(
    core,
    'WeETHJun2024',
    core.pendleEcosystem.weEthJun2024.weEthMarket,
    core.pendleEcosystem.weEthJun2024.ptOracle,
    core.pendleEcosystem.weEthJun2024.ptWeEthToken,
    core.pendleEcosystem.syWeEthToken,
    core.tokens.weEth,
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
              tokenPair: await core.tokens.eEth.address,
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
          token: glpPendleSystem.factory.address,
          decimals: await glpPendleSystem.factory.decimals(),
          oracleInfos: [
            {
              oracle: glpPendleSystem.oracle.address,
              tokenPair: await core.tokens.sGlp.address,
              weight: 100,
            },
          ],
        },
      ],
    ),
    ...await encodeAddIsolationModeMarket(
      core,
      glpPendleSystem.factory,
      core.oracleAggregatorV2,
      glpPendleSystem.unwrapper,
      glpPendleSystem.wrapper,
      ptGlpMarketId,
      TargetCollateralization._120,
      TargetLiquidationPenalty._6,
      parseEther('1500000'),
    ),
    ...await encodeAddIsolationModeMarket(
      core,
      weEthPendleSystem.factory,
      core.oracleAggregatorV2,
      weEthPendleSystem.unwrapper,
      weEthPendleSystem.wrapper,
      pteEthMarketId,
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
        await core.dolomiteMargin.getMarketTokenAddress(ptGlpMarketId) === glpPendleSystem.factory.address,
        'Invalid PT-GLP market ID',
      );
      console.log(
        '\tsGLP price:',
        (await core.dolomiteMargin.getMarketPrice(core.marketIds.sGlp)).value.toString(),
      );
      console.log(
        '\tPT-GLP (SEP-25-2024) price:',
        (await core.dolomiteMargin.getMarketPrice(ptGlpMarketId)).value.toString(),
      );

      assertHardhatInvariant(
        await core.dolomiteMargin.getMarketTokenAddress(pteEthMarketId) === weEthPendleSystem.factory.address,
        'Invalid PT-weETH market ID',
      );
      console.log(
        '\tPT-weETH (JUN-26-2024) price:',
        (await core.dolomiteMargin.getMarketPrice(pteEthMarketId)).value.toString(),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
