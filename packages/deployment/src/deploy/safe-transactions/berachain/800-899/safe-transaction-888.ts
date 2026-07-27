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
import { encodeInsertChronicleOracleV3, encodeInsertRedstoneOracleV3, encodeInsertTwapOracle } from '../../../../utils/encoding/oracle-encoder-utils';
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
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.wbera)), // @follow-up @Corey this is BTC not WBTC from Redstone.
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.usdc)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.honey)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.wbtc)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.usdt)),
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.stone)), // @follow-up Supply cap is 1 wei. Not sure if you want this one
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.ylStEth)), // @follow-up Supply cap is 1 wei. Not sure if you want this one
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.pumpBtc)), // @follow-up Supply cap is 1 wei. Not sure if you want this one
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.rsEth)), // @follow-up Supply cap is 1 wei. Not sure if you want this one
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
      await printPriceForVisualCheck(core, core.tokens.wbera);
      await printPriceForVisualCheck(core, core.tokens.usdc);
      await printPriceForVisualCheck(core, core.tokens.honey);
      await printPriceForVisualCheck(core, core.tokens.wbtc);
      await printPriceForVisualCheck(core, core.tokens.usdt);
      await printPriceForVisualCheck(core, core.tokens.stone);
      await printPriceForVisualCheck(core, core.tokens.ylStEth);
      await printPriceForVisualCheck(core, core.tokens.pumpBtc);
      await printPriceForVisualCheck(core, core.tokens.rsEth);
    },
  };
}

doDryRunAndCheckDeployment(main);
