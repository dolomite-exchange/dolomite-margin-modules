import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { TargetCollateralization, TargetLiquidationPenalty } from 'packages/base/src/utils/constructors/dolomite';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { prettyPrintEncodeAddMarket, prettyPrintEncodeInsertChainlinkOracleV3 } from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Adds oETH as a market on Dolomite
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions = [];
  transactions.push(
    ...(await prettyPrintEncodeInsertChainlinkOracleV3(core, core.tokens.woEth)),
    ...(await prettyPrintEncodeAddMarket(
      core,
      core.tokens.woEth,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction14L86U90OInterestSetter,
      TargetCollateralization._125,
      TargetLiquidationPenalty._6,
      parseEther(`${100}`),
      parseEther(`${80}`),
      true,
    )),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant(
        await core.dolomiteMargin.getMarketTokenAddress(core.marketIds.woEth) === core.tokens.woEth.address,
        'Invalid woETH address or market ID',
      );
      const ethPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.weth);
      const woEthPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.woEth);
      console.log('ETH price', ethPrice.value.toString());
      console.log('WOETH price', woEthPrice.value.toString());
    },
  };
}

doDryRunAndCheckDeployment(main);
