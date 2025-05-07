import { expect } from 'chai';
import { formatEther, parseEther } from 'ethers/lib/utils';
import { CHAINSIGHT_KEYS_MAP, DOLOMITE_DAO_GNOSIS_SAFE_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber, setEtherBalance } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import {
  encodeSetSingleCollateralWithStrictDebtByMarketId,
  encodeSetSupplyCapWithMagic,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { deployBerachainPOLSystem, deployContractAndSave } from 'packages/deployment/src/utils/deploy-utils';
import { getBerachainRewardsRegistryConstructorParams, getInfraredBGTIsolationModeVaultFactoryConstructorParams } from 'packages/berachain/src/berachain-constructors';
import { BerachainRewardsRegistry__factory, InfraredBGTIsolationModeTokenVaultV1__factory, InfraredBGTIsolationModeVaultFactory__factory, InfraredBGTMetaVault__factory, POLIsolationModeTokenVaultV1__factory, POLLiquidatorProxyV1__factory } from 'packages/berachain/src/types';
import { SimpleIsolationModeUnwrapperTraderV2__factory, SimpleIsolationModeWrapperTraderV2__factory } from 'packages/base/src/types';
import { encodeAddIsolationModeMarket, encodeAddPOLIsolationModeMarket } from 'packages/deployment/src/utils/encoding/add-market-encoder-utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { encodeInsertChainsightOracleV3 } from 'packages/deployment/src/utils/encoding/oracle-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Deploys pol-rUsd POL Isolation Mode Ecosystem
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });
  const polRUsdMarketId = await core.dolomiteMargin.getNumMarkets();

  const transactions: EncodedTransaction[] = [];

  const polRUsdSystem = await deployBerachainPOLSystem(
    core,
    core.berachainRewardsEcosystem.live.registry,
    core.dolomiteTokens.rUsd,
    'pol-rUsd',
    core.berachainRewardsEcosystem.live.tokenVaultImplementation,
    core.berachainRewardsEcosystem.live.unwrapperImplementation,
    core.berachainRewardsEcosystem.live.wrapperImplementation,
  );

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregatorV2: core.oracleAggregatorV2 },
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: polRUsdSystem.factory.address,
          decimals: 18,
          oracleInfos: [
            {
              oracle: polRUsdSystem.oracle.address,
              tokenPair: ADDRESS_ZERO,
              weight: 100,
            },
          ],
        },
      ],
    ),
  );

  transactions.push(
    ...(await encodeAddPOLIsolationModeMarket(
      core,
      polRUsdSystem.factory,
      core.oracleAggregatorV2,
      polRUsdSystem.unwrapper as any,
      polRUsdSystem.wrapper,
      polRUsdMarketId,
      TargetCollateralization._120, // @follow-up adjust
      TargetLiquidationPenalty._6, // adjust
      parseEther(`${2_000}`), // adjust
    ))
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
      // assertHardhatInvariant(
      //   (await core.dolomiteMargin.getMarketTokenAddress(iBgtMarketId)) === ibgtFactory.address,
      //   'Invalid iBgt market ID',
      // );
      // assertHardhatInvariant(
      //   (await registry.iBgtIsolationModeVaultFactory()) === ibgtFactory.address,
      //   'Invalid iBgt isolation mode vault factory',
      // );
    },
  };
}

doDryRunAndCheckDeployment(main);
