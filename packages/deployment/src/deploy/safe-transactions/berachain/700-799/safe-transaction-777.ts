import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { getTWAPPriceOracleV2ConstructorParams } from 'packages/oracles/src/oracles-constructors';
import { IAlgebraV3Pool__factory, PancakeV3PriceOracleWithModifiers__factory } from 'packages/oracles/src/types';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeInsertTwapOracle } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Changes oracle providers for wgBERA
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const wgBeraIBgtTokenPair = IAlgebraV3Pool__factory.connect('0xb186949793248abf961ee8cff59c6a0dd314fbbc', core.hhUser1);
  const wgBeraOracleAddress = await deployContractAndSave(
    'PancakeV3PriceOracleWithModifiers',
    getTWAPPriceOracleV2ConstructorParams(core, core.tokens.wgBera, wgBeraIBgtTokenPair),
    'wgBERATWAPPriceOracleV3',
  );
  const wgBeraOracle = PancakeV3PriceOracleWithModifiers__factory.connect(wgBeraOracleAddress, core.hhUser1);


  const transactions: EncodedTransaction[] = [
    ...(await encodeInsertTwapOracle(core, core.tokens.wgBera, wgBeraOracle, core.tokens.iBgt)),
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
      await printPriceForVisualCheck(core, core.tokens.wgBera);
    },
  };
}

doDryRunAndCheckDeployment(main);
