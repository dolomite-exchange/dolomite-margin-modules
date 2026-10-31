import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  LowerPercentage,
  OptimalUtilizationRate,
  TargetCollateralization,
  TargetLiquidationPenalty,
  UpperPercentage,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { parseUsdc } from '../../../../../../base/src/utils/math-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { encodeSetModularInterestSetterParams } from '../../../../utils/encoding/interest-setter-encoder-utils';
import { encodeInsertChainlinkOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkMarket, checkPrice } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - List USDG stablecoin
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    ...(await encodeInsertChainlinkOracleV3(core, core.tokens.usdg)),
    await encodeSetModularInterestSetterParams(
      core,
      core.tokens.usdg,
      LowerPercentage._8,
      UpperPercentage._50,
      OptimalUtilizationRate._91,
    ),
    ...(await encodeAddMarket(
      core,
      core.marketIds.usdg,
      core.tokens.usdg,
      core.oracleAggregatorV2,
      core.interestSetters.modularInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty._5_5,
      parseUsdc(`${5_000_000}`),
      0,
      false,
      0,
    )),
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
      await checkPrice(core, core.tokens.usdg);
      await checkMarket(core, core.marketIds.usdg, core.tokens.usdg);
    },
  };
}

doDryRunAndCheckDeployment(main);
