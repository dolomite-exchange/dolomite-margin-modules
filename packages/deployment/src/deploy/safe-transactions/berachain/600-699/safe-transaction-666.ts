import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { TargetCollateralization, TargetLiquidationPenalty } from 'packages/base/src/utils/constructors/dolomite';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';
import { PendlePtPriceOracleV2__factory, PendleRegistry__factory } from 'packages/pendle/src/types';
import { getPendleRegistryConstructorParams } from 'packages/pendle/src/pendle-constructors';
import { encodeAddMarket } from 'packages/deployment/src/utils/encoding/add-market-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Deploy PT Registry for pt-iBGT
 * - Deploys PT Oracle for pt-iBGT
 * - Sets oracle on oracle aggregator
 * - Lists market
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const ptIBgtToken = core.pendleEcosystem!.iBgtDec2025.ptIBgtToken;

  const registryImplementationAddress = await deployContractAndSave(
    'PendleRegistry',
    [],
    'PendleRegistryImplementationV1',
  );
  const registryImplementation = PendleRegistry__factory.connect(registryImplementationAddress, core.hhUser1);
  const registryAddress = await deployContractAndSave(
    'RegistryProxy',
    await getPendleRegistryConstructorParams(
      registryImplementation,
      core,
      core.pendleEcosystem!.iBgtDec2025.iBgtMarket,
      core.pendleEcosystem!.iBgtDec2025.ptOracle,
      core.pendleEcosystem!.syIBgtToken,
    ),
    'PendlePtIBgtDec2025RegistryProxy',
  );
  const registry = PendleRegistry__factory.connect(registryAddress, core.hhUser1);

  const oracleAddress = await deployContractAndSave(
    'PendlePtPriceOracleV2',
    [ptIBgtToken.address, registry.address, core.dolomiteMargin.address],
    'PendlePtIBgtDec2025PriceOracleV2',
  );
  const oracle = PendlePtPriceOracleV2__factory.connect(oracleAddress, core.hhUser1);

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregatorV2: core.oracleAggregatorV2 },
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: ptIBgtToken.address,
          decimals: 18,
          oracleInfos: [
            { oracle: oracle.address, tokenPair: core.tokens.iBgt.address, weight: 100 }
          ]
        },
      ],
    ),
    ...(await encodeAddMarket(
      core,
      ptIBgtToken,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._125,
      TargetLiquidationPenalty._7,
      /* maxSupplyWei */ parseEther(`${750_000}`),
      /* maxBorrowWei */ ZERO_BI,
      /* isCollateralOnly */ true,
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
      await printPriceForVisualCheck(core, ptIBgtToken);
    },
  };
}

doDryRunAndCheckDeployment(main);
