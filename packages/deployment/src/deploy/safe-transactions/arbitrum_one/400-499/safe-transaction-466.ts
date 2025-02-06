import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { TargetCollateralization, TargetLiquidationPenalty } from 'packages/base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import {
  encodeInsertChainlinkOracleV3,
  encodeInsertRedstoneOracleV3,
} from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Adds tBTC, ETH+ and eUSD as markets
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    ...(await encodeInsertChainlinkOracleV3(core, core.tokens.tbtc)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.ethPlus)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.eUsd)),
    ...(await encodeAddMarket(
      core,
      core.tokens.tbtc,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction7L93U90OInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty._6,
      parseEther(`${100}`),
      parseEther(`${80}`),
      false,
    )),
    ...(await encodeAddMarket(
      core,
      core.tokens.eUsd,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction8L92U90OInterestSetter,
      TargetCollateralization._125,
      TargetLiquidationPenalty._6,
      parseEther(`${1_000_000}`),
      parseEther(`${800_000}`),
      true,
    )),
    ...(await encodeAddMarket(
      core,
      core.tokens.ethPlus,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction6L94U90OInterestSetter,
      TargetCollateralization._125,
      TargetLiquidationPenalty._7,
      parseEther(`${500}`),
      parseEther(`${400}`),
      true,
    )),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketIdByTokenAddress(core.tokens.tbtc.address)).eq(core.marketIds.tbtc),
        'Invalid tbtc market ID',
      );
      console.log('\ttbtc price: ', (await core.dolomiteMargin.getMarketPrice(core.marketIds.tbtc)).value.toString());

      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketIdByTokenAddress(core.tokens.eUsd.address)).eq(core.marketIds.eUsd),
        'Invalid eUsd market ID',
      );
      console.log('\teUsd price: ', (await core.dolomiteMargin.getMarketPrice(core.marketIds.eUsd)).value.toString());

      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketIdByTokenAddress(core.tokens.ethPlus.address)).eq(core.marketIds.ethPlus),
        'Invalid ethPlus market ID',
      );
      console.log(
        '\tethPlus price: ',
        (await core.dolomiteMargin.getMarketPrice(core.marketIds.ethPlus)).value.toString(),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
