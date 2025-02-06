import { IERC20Metadata__factory } from '@dolomite-exchange/modules-base/src/types';
import { CHAINLINK_PRICE_AGGREGATORS_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { TokenInfo } from '@dolomite-exchange/modules-oracles/src';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network, ONE_BI } from 'packages/base/src/utils/no-deps-constants';
import {
  deployPendlePtSystem,

} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  prettyPrintEncodeAddIsolationModeMarket,
  prettyPrintEncodeAddMarket,
} from '../../../../utils/encoding/add-market-encoder-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys PT-ezETH JUN-26-2024
 * - Adds ezETH market to Dolomite
 * - Sets the corresponding oracles
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });
  let incrementor = 0;
  const numMarkets = await core.dolomiteMargin.getNumMarkets();

  const ezEthMarketId = numMarkets.add(incrementor++);
  const ptEzEthMarketId = numMarkets.add(incrementor++);
  const ezEthPendleSystem = await deployPendlePtSystem(
    core,
    'EzETHJun2024',
    core.pendleEcosystem.ezEthJun2024.ezEthMarket,
    core.pendleEcosystem.ezEthJun2024.ptOracle,
    core.pendleEcosystem.ezEthJun2024.ptEzEthToken,
    core.pendleEcosystem.syEzEthToken,
    core.tokens.ezEth,
  );

  const chainlinkAggregators = CHAINLINK_PRICE_AGGREGATORS_MAP[core.network];

  const transactions: EncodedTransaction[] = [
    // Oracle aggregator hasn't been set yet. Set it in the next 2 transactions
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteRegistryProxy',
      'upgradeTo',
      ['0xaa8eaC4DD4bFa64D77c3F946072d857A07C16f29'],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteRegistry',
      'ownerSetOracleAggregator',
      [core.oracleAggregatorV2.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem.weEthApr2024,
      'pendleRegistry',
      'ownerSetSyToken',
      [core.pendleEcosystem.syWeEthToken.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'chainlinkPriceOracleV3',
      'ownerInsertOrUpdateOracleToken',
      [
        core.tokens.ezEth.address,
        chainlinkAggregators[core.tokens.ezEth.address]!.aggregatorAddress,
        false,
      ],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: core.tokens.ezEth.address,
          decimals: await IERC20Metadata__factory.connect(core.tokens.ezEth.address, core.hhUser1).decimals(),
          oracleInfos: [
            {
              oracle: core.chainlinkPriceOracleV3.address,
              tokenPair: chainlinkAggregators[core.tokens.ezEth.address]!.tokenPairAddress,
              weight: 100,
            },
          ],
        } as TokenInfo,
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
              tokenPair: await core.tokens.ezEth.address,
              weight: 100,
            },
          ],
        } as TokenInfo,
      ],
    ),
    ...await prettyPrintEncodeAddMarket(
      core,
      core.tokens.ezEth,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      '1',
      '1',
      true,
    ),
    ...await prettyPrintEncodeAddIsolationModeMarket(
      core,
      ezEthPendleSystem.factory,
      core.oracleAggregatorV2,
      ezEthPendleSystem.unwrapper,
      ezEthPendleSystem.wrapper,
      ptEzEthMarketId,
      TargetCollateralization._120,
      TargetLiquidationPenalty._7,
      parseEther('1500'),
    ),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant(
        await core.pendleEcosystem.weEthApr2024.pendleRegistry.syToken() === core.pendleEcosystem.syWeEthToken.address,
        'Invalid syWeETH token',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getMarketTokenAddress(ezEthMarketId) === core.tokens.ezEth.address,
        'Invalid ezETH market ID',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketMaxWei(ezEthMarketId)).value.eq(ONE_BI),
        'Invalid ezETH supply cap',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getMarketIsClosing(ezEthMarketId),
        'ezETH should be closing',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getMarketTokenAddress(ptEzEthMarketId) === ezEthPendleSystem.factory.address,
        'Invalid PT-ezETH market ID',
      );
      console.log(
        '\tPT-ezETH (JUN-26-2024) price:',
        (await core.dolomiteMargin.getMarketPrice(ptEzEthMarketId)).value.toString(),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
