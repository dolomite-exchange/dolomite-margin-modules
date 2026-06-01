import { parseUnits } from 'ethers/lib/utils';
import {
  LowerPercentage,
  OptimalUtilizationRate,
  TargetCollateralization,
  TargetLiquidationPenalty,
  UpperPercentage,
} from 'packages/base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { parseUsdc } from '../../../../../../base/src/utils/math-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import { encodeSetModularInterestSetterParams } from '../../../../utils/encoding/interest-setter-encoder-utils';
import { encodeInsertOracle } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkMarket, printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Lists USDC
 */
async function main(): Promise<DryRunOutput<Network.Sepolia>> {
  const network = await getAndCheckSpecificNetwork(Network.Sepolia);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(core, core, 'constantPriceOracle', 'ownerSetTokenPrice', [
      core.tokens.usdc.address,
      parseUnits(`${1.0}`, 30),
    ]),
    ...(await encodeInsertOracle(core, core.tokens.usdc, core.constantPriceOracle, undefined)),
    await encodeSetModularInterestSetterParams(
      core,
      core.tokens.usdc,
      LowerPercentage._6,
      UpperPercentage._30,
      OptimalUtilizationRate._90,
    ),
    ...(await encodeAddMarket(
      core,
      core.marketIds.usdc,
      core.tokens.usdc,
      core.oracleAggregatorV2,
      core.interestSetters.modularInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseUsdc(`${1_000_000}`),
      parseUsdc(`${100_000}`),
      false,
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
      await checkMarket(core, core.marketIds.usdc, core.tokens.usdc);
      await printPriceForVisualCheck(core, core.tokens.usdc);
    },
  };
}

doDryRunAndCheckDeployment(main);
