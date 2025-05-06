import { expect } from 'chai';
import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ONE_BI, ONE_ETH_BI } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { KODIAK_POOL_DOLO_WBERA_MAP } from 'packages/base/src/utils/constants';
import { formatEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { PancakeV3PriceOracle__factory } from 'packages/oracles/src/types';

/**
 * This script encodes the following transactions:
 * - Deploy KodiakPriceOracleV3 for DOLO/WBERA
 * - Add to oracle aggregator
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const doloWberaOracleAddress = await deployContractAndSave(
    'PancakeV3PriceOracle',
    [
      core.tokenomics.dolo.address,
      KODIAK_POOL_DOLO_WBERA_MAP[network],
      core.dolomiteRegistry.address,
      core.dolomiteMargin.address
    ],
    'DoloWberaKodiakPriceOracleV3',
  );
  const oracle = PancakeV3PriceOracle__factory.connect(doloWberaOracleAddress, core.governance);

  const transactions: EncodedTransaction[] = [];

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregatorV2: core.oracleAggregatorV2 },
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: core.tokenomics.dolo.address,
          decimals: 18,
          oracleInfos: [
            {
              oracle: doloWberaOracleAddress,
              tokenPair: core.tokens.wbera.address,
              weight: 100,
            },
          ],
        },
      ],
    ),
  );

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
        await oracle.TOKEN() === core.tokenomics.dolo.address,
        'Token is not DOLO',
      );
      assertHardhatInvariant(
        (await oracle.TOKEN_DECIMALS_FACTOR()).eq(ONE_ETH_BI),
        'Token decimals are not 18',
      );
      assertHardhatInvariant(
        (await oracle.DOLOMITE_MARGIN()) === core.dolomiteMargin.address,
        'DOLOMITE_MARGIN is not set',
      );
      assertHardhatInvariant(
        (await oracle.PAIR()) === KODIAK_POOL_DOLO_WBERA_MAP[network],
        'PAIR is not set',
      );
      assertHardhatInvariant(
        (await oracle.observationInterval()) === 900,
        'observationInterval is not 15 minutes',
      );
      console.log(formatEther((await core.oracleAggregatorV2.getPrice(core.tokenomics.dolo.address)).value));
    },
  };
}

doDryRunAndCheckDeployment(main);
