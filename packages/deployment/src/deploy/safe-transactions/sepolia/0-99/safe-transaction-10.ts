import { parseUnits } from 'ethers/lib/utils';
import {
  LowerPercentage,
  OptimalUtilizationRate,
  TargetCollateralization,
  TargetLiquidationPenalty,
  UpperPercentage,
} from 'packages/base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { IDolomitePriceOracle__factory } from '../../../../../../base/src/types';
import { parseUsdc } from '../../../../../../base/src/utils/math-utils';
import { IERC20__factory } from '../../../../../../gamma/src/types';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import { encodeSetGlobalOperator } from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeSetModularInterestSetterParams } from '../../../../utils/encoding/interest-setter-encoder-utils';
import { encodeInsertOracle } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkMarket, printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Lists qRWA market
 */
async function main(): Promise<DryRunOutput<Network.Sepolia>> {
  const network = await getAndCheckSpecificNetwork(Network.Sepolia);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const marketId = 3;
  const qRwaToken = IERC20__factory.connect('0x8af353be0FefF7bb19414682e168882291beeE8f', core.hhUser1);
  const rwaOracle = IDolomitePriceOracle__factory.connect('0x1866Ecc1b00A1208D3c79E16E74aC689229Ae38d', core.hhUser1);

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await encodeSetGlobalOperator(core, '0xF93d242c07d4bcd2d45BbAed6eCe539De00E4606', true), // WLFI qRWA router
    await encodeSetGlobalOperator(core, '0x38407a2FF08CDCa0A655C801337F84573Df3056f', true), // WLFI qRWA migrator
    ...(await encodeInsertOracle(core, qRwaToken, rwaOracle, undefined)),
    ...(await encodeAddMarket(
      core,
      marketId,
      qRwaToken,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseUsdc(`${1_000_000}`),
      ZERO_BI,
      true,
    )),
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
    invariants: async () => {
      await checkMarket(core, marketId, qRwaToken);
      await printPriceForVisualCheck(core, qRwaToken);
    },
  };
}

doDryRunAndCheckDeployment(main);
