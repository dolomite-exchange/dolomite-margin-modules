import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { getTWAPPriceOracleV2ConstructorParams } from 'packages/oracles/src/oracles-constructors';
import { IAlgebraV3Pool__factory, PancakeV3PriceOracle__factory } from 'packages/oracles/src/types';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { encodeInsertRedstoneOracleV3, encodeInsertTwapOracles } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { checkMarket, printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Deploy the new IsolationModeTokenVaultV1ActionsImpl for the Routers
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const beraKdkTokenPool = IAlgebraV3Pool__factory.connect('0x7b23ed09b60fb5481802a5e33601203cb029976a', core.hhUser1);
  const kdkBeraOracleAddress = await deployContractAndSave(
    'PancakeV3PriceOracle',
    getTWAPPriceOracleV2ConstructorParams(core, core.tokens.kdk, beraKdkTokenPool),
    'KdkBeraTWAPPriceOracleV3',
  );
  const kdkBeraOracle = PancakeV3PriceOracle__factory.connect(kdkBeraOracleAddress, core.hhUser1);

  const usdtKdkTokenPool = IAlgebraV3Pool__factory.connect('0x7cdd3096e66db59e83e6df262dcea7a6c5134107', core.hhUser1);
  const kdkUsdtOracleAddress = await deployContractAndSave(
    'PancakeV3PriceOracle',
    getTWAPPriceOracleV2ConstructorParams(core, core.tokens.kdk, usdtKdkTokenPool),
    'KdkUsdtTWAPPriceOracleV3',
  );
  const kdkUsdtOracle = PancakeV3PriceOracle__factory.connect(kdkUsdtOracleAddress, core.hhUser1);

  const transactions: EncodedTransaction[] = [
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.ir)),
    ...(await encodeInsertTwapOracles(
      core,
      core.tokens.kdk,
      [kdkBeraOracle, kdkUsdtOracle],
      [core.tokens.wbera, core.tokens.usdt],
    )),
    ...(await encodeAddMarket(
      core,
      core.tokens.ir,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._166,
      TargetLiquidationPenalty._15,
      parseEther(`${690_000}`),
      0,
      true,
    )),
    ...(await encodeAddMarket(
      core,
      core.tokens.kdk,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._166,
      TargetLiquidationPenalty._15,
      parseEther(`${420_000}`),
      0,
      true,
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
      await printPriceForVisualCheck(core, core.tokens.ir);
      await checkMarket(core, core.marketIds.ir, core.tokens.ir);

      await printPriceForVisualCheck(core, core.tokens.kdk);
      await checkMarket(core, core.marketIds.kdk, core.tokens.kdk);
    },
  };
}

doDryRunAndCheckDeployment(main);
