import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { ADDRESS_ZERO, Network } from 'packages/base/src/utils/no-deps-constants';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import ModuleDeployments from '../../../deployments.json';

/**
 * This script encodes the following transactions:
 * - Raise the supply cap of PT-eETH to 4,000
 * - Set the oracle for djUSDC (V2) to the oracle aggregator
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetMaxWei',
      [core.marketIds.dPtWeEthJun2024, parseEther('4000')],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregatorV2: core.oracleAggregatorV2 },
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: core.jonesEcosystem.live.jUSDCV2IsolationModeFactory.address,
          decimals: await core.jonesEcosystem.live.jUSDCV2IsolationModeFactory.decimals(),
          oracleInfos: [
            {
              oracle: ModuleDeployments.JonesUSDCV2WithChainlinkAutomationPriceOracleV2[network].address,
              tokenPair: ADDRESS_ZERO,
              weight: 100,
            },
          ],
        },
      ],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetPriceOracle',
      [core.marketIds.djUsdcV2, core.oracleAggregatorV2.address],
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
      expect((await core.dolomiteMargin.getMarketMaxWei(core.marketIds.dPtWeEthJun2024)).value)
        .to
        .eq(parseEther('4000'));

      expect(await core.dolomiteMargin.getMarketPriceOracle(core.marketIds.djUsdcV2))
        .to
        .eq(core.oracleAggregatorV2.address);

      console.log('\tjUSDC V2', (await core.dolomiteMargin.getMarketPrice(core.marketIds.djUsdcV2)).value.toString());
    },
  };
}

doDryRunAndCheckDeployment(main);
