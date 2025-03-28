import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { TargetCollateralization, TargetLiquidationPenalty } from 'packages/base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { parseBtc } from 'packages/base/src/utils/math-utils';
import { Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { encodeInsertChainlinkOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - List the uniBTC asset
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    ...(await encodeInsertChainlinkOracleV3(core, core.tokens.uniBtc)),
    ...(await encodeAddMarket(
      core,
      core.tokens.uniBtc,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._133,
      TargetLiquidationPenalty._9,
      parseBtc('5'),
      ZERO_BI,
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
        (await core.dolomiteMargin.getMarketMaxWei(core.marketIds.uniBtc)).value.eq(parseBtc('5')),
        'Invalid uniBTC supply cap',
      );

      console.log('uniBTC price: ', (await core.dolomiteMargin.getMarketPrice(core.marketIds.uniBtc)).value.toString());
      console.log('WBTC price: ', (await core.dolomiteMargin.getMarketPrice(core.marketIds.wbtc)).value.toString());
    },
  };
}

doDryRunAndCheckDeployment(main);
