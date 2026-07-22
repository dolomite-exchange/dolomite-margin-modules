import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ONE_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumber } from 'ethers';
import { TargetCollateralization, TargetLiquidationPenalty } from 'packages/base/src/utils/constructors/dolomite';
import { getTWAPPriceOracleV2ConstructorParams } from 'packages/oracles/src/oracles-constructors';
import { IAlgebraV3Pool__factory, TWAPPriceOracleV2__factory } from 'packages/oracles/src/types';
import { CHRONICLE_PRICE_SCRIBES_MAP } from '../../../../../../base/src/utils/constants';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetInterestSetter,
  encodeSetIsCollateralOnly,
  encodeSetSingleCollateralWithStrictDebtByMarketId,
  encodeSetSupplyCap,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeInsertChronicleOracleV3, encodeInsertTwapOracle } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Switch to Redstone for WBERA, USDC.e, HONEY, WBTC, USDT, STONE, ylstETH, pumpBTC, rsETH 
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  // @follow-up Redstone just has a BTC oracle not a WBTC one
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });


  const transactions: EncodedTransaction[] = [
    await encodeSetIsCollateralOnly(core, marketIds.henlo, true),
    await encodeSetSupplyCap(core, marketIds.henlo, ONE_BI),
    ...(await encodeInsertTwapOracle(core, core.tokens.henlo, henloOracle, core.tokens.wbera)),

    ...(await encodeInsertTwapOracle(core, core.tokens.iBera, iBeraOracle, core.tokens.wbera)),

    ...(await encodeInsertTwapOracle(core, core.tokens.iBgt, iBgtOracle, core.tokens.wbera)),

    ...(await encodeInsertTwapOracle(core, core.tokens.diBgt, iBgtOracle, core.tokens.wbera)),
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
      await printPriceForVisualCheck(core, core.tokens.henlo);
      await printPriceForVisualCheck(core, core.tokens.iBera);
      await printPriceForVisualCheck(core, core.tokens.iBgt);
      await printPriceForVisualCheck(core, core.tokens.diBgt);
    },
  };
}

doDryRunAndCheckDeployment(main);
