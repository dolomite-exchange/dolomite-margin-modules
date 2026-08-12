import {
  LowerPercentage,
  OptimalUtilizationRate,
  TargetCollateralization,
  TargetLiquidationPenalty,
  UpperPercentage,
} from 'packages/base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { encodeInsertChainlinkOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { encodeSetModularInterestSetterParams } from '../../../../utils/encoding/interest-setter-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Lists WETH
 */
async function main(): Promise<DryRunOutput<Network.Sepolia>> {
  const network = await getAndCheckSpecificNetwork(Network.Sepolia);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    ...await encodeInsertChainlinkOracleV3(
      core,
      core.tokens.weth,
    ),
    await encodeSetModularInterestSetterParams(
      core,
      core.tokens.weth,
      LowerPercentage._4,
      UpperPercentage._30,
      OptimalUtilizationRate._50,
    ),
    ...await encodeAddMarket(
      core,
      core.marketIds.weth,
      core.tokens.weth,
      core.oracleAggregatorV2,
      core.interestSetters.modularInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseEther(`${1_000_000}`),
      parseEther(`${100_000}`),
      false,
    ),
  );
  return {
    core,
    upload: {
      transactions,
      chainId: core.network,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    scriptName: getScriptName(__filename),
    invariants: async () => {},
  };
}

doDryRunAndCheckDeployment(main);
