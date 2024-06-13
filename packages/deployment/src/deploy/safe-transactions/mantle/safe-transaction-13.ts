import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { parseWbtc } from '@dolomite-exchange/modules-base/src/utils/math-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import {
  EncodedTransaction,
  prettyPrintEncodeAddMarket,
  prettyPrintEncodedDataWithTypeSafety, prettyPrintEncodeInsertChronicleOracleV3,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Sets the interest setter on WETH
 * - Sets the price oracle on WETH
 * - Adds the USDC, DAI, LINK, and MATIC markets
 */
async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    ...await prettyPrintEncodeInsertChronicleOracleV3(
      core,
      core.tokens.usde,
    ),
    ...await prettyPrintEncodeInsertChronicleOracleV3(
      core,
      core.tokens.usdt,
    ),
    ...await prettyPrintEncodeInsertChronicleOracleV3(
      core,
      core.tokens.usdy,
    ),
    ...await prettyPrintEncodeInsertChronicleOracleV3(
      core,
      core.tokens.weth,
    ),
    ...await prettyPrintEncodeInsertChronicleOracleV3(
      core,
      core.tokens.wmnt,
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
    invariants: async () => {
      console.log(
        '\t Price for usde',
        (await core.oracleAggregatorV2.getPrice(core.tokens.usde.address)).value.toString(),
      );
      console.log(
        '\t Price for usdt',
        (await core.oracleAggregatorV2.getPrice(core.tokens.usdt.address)).value.toString(),
      );
      console.log(
        '\t Price for usdy',
        (await core.oracleAggregatorV2.getPrice(core.tokens.usdy.address)).value.toString(),
      );
      console.log(
        '\t Price for weth',
        (await core.oracleAggregatorV2.getPrice(core.tokens.weth.address)).value.toString(),
      );
      console.log(
        '\t Price for wmnt',
        (await core.oracleAggregatorV2.getPrice(core.tokens.wmnt.address)).value.toString(),
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
