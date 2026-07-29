import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { IAdminPauseMarket__factory } from 'packages/admin/src/types';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Adjust caps for some assets
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const tokenInfos = [
    await core.oracleAggregatorV2.getTokenInfo(core.tokens.wbtc.address),
    await core.oracleAggregatorV2.getTokenInfo(core.tokens.lbtc.address),
    await core.oracleAggregatorV2.getTokenInfo(core.tokens.eBtc.address),
  ];
  for (let i = 0; i < tokenInfos.length; i += 1) {
    const tokenInfo = tokenInfos[i];
    for (const oracleInfo of tokenInfo.oracleInfos) {
      if (oracleInfo.tokenPair !== ADDRESS_ZERO) {
        tokenInfos.push(await core.oracleAggregatorV2.getTokenInfo(oracleInfo.tokenPair));
      }
    }
  }
  const berachainOracleAggregatorAddress = await deployContractAndSave('OracleAggregatorV2Berachain', [
    tokenInfos,
    core.dolomiteMargin.address,
    125_000,
  ]);

  const pauseMarket = IAdminPauseMarket__factory.connect('0x53E18f7483356caC74B1365ebF3F2f71f499A0dD', core.hhUser1);
  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { pauseMarket },
      'pauseMarket',
      'unpauseMarket',
      [core.marketIds.wbtc, berachainOracleAggregatorAddress],
      { skipWrappingCalldataInSubmitTransaction: true },
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { pauseMarket },
      'pauseMarket',
      'unpauseMarket',
      [core.marketIds.lbtc, berachainOracleAggregatorAddress],
      { skipWrappingCalldataInSubmitTransaction: true },
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { pauseMarket },
      'pauseMarket',
      'unpauseMarket',
      [core.marketIds.eBtc, berachainOracleAggregatorAddress],
      { skipWrappingCalldataInSubmitTransaction: true },
    ),
  ];

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
      expect(await core.dolomiteMargin.getMarketPriceOracle(core.marketIds.wbtc)).to.eq(
        berachainOracleAggregatorAddress,
      );
      expect(await core.dolomiteMargin.getMarketPriceOracle(core.marketIds.lbtc)).to.eq(
        berachainOracleAggregatorAddress,
      );
      expect(await core.dolomiteMargin.getMarketPriceOracle(core.marketIds.eBtc)).to.eq(
        berachainOracleAggregatorAddress,
      );

      await printPriceForVisualCheck(core, core.tokens.wbtc);
      await printPriceForVisualCheck(core, core.tokens.lbtc);
      await printPriceForVisualCheck(core, core.tokens.eBtc);
    },
  };
}

doDryRunAndCheckDeployment(main);
