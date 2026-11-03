import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { CappedEEthExchangeRatePriceOracle__factory } from 'packages/oracles/src/types';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeInsertOracle } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';

const MAX_GROWTH_PER_YEAR = parseEther('.0875');
const SNAPSHOT_TIMESTAMP = 1789681767; // from block 26_000_000
const SNAPSHOT_RATIO = BigNumber.from('1103886226680548462');

/**
 * This script deploys CappedEEthExchangeRatePriceOracle and sets it as the weETH oracle in OracleAggregatorV2.
 */
async function main(): Promise<DryRunOutput<Network.Ethereum>> {
  const network = await getAndCheckSpecificNetwork(Network.Ethereum);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(false, network),
  });

  const eEthExchangeRatePriceOracleAddress = await deployContractAndSave(
    'CappedEEthExchangeRatePriceOracle',
    [
      core.tokens.weEth.address,
      { snapshotRatio: SNAPSHOT_RATIO, snapshotTimestamp: SNAPSHOT_TIMESTAMP, maxGrowthPerYear: MAX_GROWTH_PER_YEAR },
      core.dolomiteMargin.address
    ],
    'CappedEEthExchangeRatePriceOracleV1',
  );
  const eEthExchangeRatePriceOracle = CappedEEthExchangeRatePriceOracle__factory.connect(
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
