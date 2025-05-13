import { parseEther } from 'ethers/lib/utils';
import { getTWAPPriceOracleV2ConstructorParams } from 'packages/oracles/src/oracles-constructors';
import { IAlgebraV3Pool__factory, PancakeV3PriceOracle__factory } from 'packages/oracles/src/types';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import {
  encodeSetIsBorrowOnly,
  encodeSetSingleCollateralWithStrictDebtByMarketId,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeInsertTwapOracle } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  checkAccountRiskOverrideIsBorrowOnly,
  checkIsCollateralOnly,
  checkSupplyCap,
  printPriceForVisualCheck,
} from '../../../../utils/invariant-utils';
import { encodeSimpleBoycoListing } from '../utils';

/**
 * This script encodes the following transactions:
 * - Adds the deUSD market
 * - Adds the sdeUSD market
 * - Opens up borrowing SolvBTC and xSolvBTC
 * - Removes SolvBTC as borrowable from other BTC LSTs
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const transactions: EncodedTransaction[] = [
    ...(await encodeSimpleBoycoListing(core, core.tokens.deUsd, parseEther('1'))),
    ...(await encodeSimpleBoycoListing(core, core.tokens.sdeUsd, parseEther('1'))),
    await encodeSetIsBorrowOnly(core, core.marketIds.deUsd, true),
    await encodeSetIsBorrowOnly(core, core.marketIds.sdeUsd, true),
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
      await checkIsCollateralOnly(core, core.marketIds.deUsd, true);
      await checkIsCollateralOnly(core, core.marketIds.sdeUsd, true);
      await checkAccountRiskOverrideIsBorrowOnly(core, core.marketIds.deUsd);
      await checkAccountRiskOverrideIsBorrowOnly(core, core.marketIds.sdeUsd);
    },
  };
}

doDryRunAndCheckDeployment(main);
