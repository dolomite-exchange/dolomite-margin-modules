import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { EEthExchangeRatePriceOracle__factory } from 'packages/oracles/src/types';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeInsertOracle } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script deploys EEthExchangeRatePriceOracle and sets it as the weETH oracle in OracleAggregatorV2.
 */
async function main(): Promise<DryRunOutput<Network.Ethereum>> {
  const network = await getAndCheckSpecificNetwork(Network.Ethereum);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(false, network),
  });

  const eEthExchangeRatePriceOracleAddress = await deployContractAndSave(
    'EEthExchangeRatePriceOracle',
    [core.tokens.weEth.address,core.dolomiteMargin.address],
    'EEthExchangeRatePriceOracleV1',
  );
  const eEthExchangeRatePriceOracle = EEthExchangeRatePriceOracle__factory.connect(
    eEthExchangeRatePriceOracleAddress,
    core.hhUser1,
  );

  const transactions: EncodedTransaction[] = [
    ...(await encodeInsertOracle(core, core.tokens.weEth, eEthExchangeRatePriceOracle, core.tokens.weth)),
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
      assertHardhatInvariant(
        (await eEthExchangeRatePriceOracle.WE_ETH()) === core.tokens.weEth.address,
        'Invalid WE_ETH address',
      );
      assertHardhatInvariant(
        (await eEthExchangeRatePriceOracle.DOLOMITE_MARGIN()) === core.dolomiteMargin.address,
        'Invalid DOLOMITE_MARGIN address',
      );

      await printPriceForVisualCheck(core, core.tokens.weEth);
    },
  };
}

doDryRunAndCheckDeployment(main);
