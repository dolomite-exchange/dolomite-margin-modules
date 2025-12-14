import { getAndCheckSpecificNetwork } from '../../../../../../base/src/utils/dolomite-utils';
import { Network } from '../../../../../../base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '../../../../../../base/test/utils';
import { setupCoreProtocol } from '../../../../../../base/test/utils/setup';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { parseEther } from 'ethers/lib/utils';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import {
  getPendlePtPriceOracleV2ConstructorParams,
  getPendleRegistryConstructorParams,
} from '@dolomite-exchange/modules-pendle/src/pendle-constructors';
import { PendlePtPriceOracleV2__factory, PendleRegistry__factory } from '@dolomite-exchange/modules-pendle/src/types';
import {
  encodeSetSingleCollateralWithStrictDebtByMarketId,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeInsertOracle } from '../../../../utils/encoding/oracle-encoder-utils';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Lists iBGT on market
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const ptName = 'IBgtDec2025';
  const registryImplementationAddress = await deployContractAndSave(
    'PendleRegistry',
    [],
    'PendleRegistryImplementationV1',
  );
  const registryImplementation = PendleRegistry__factory.connect(registryImplementationAddress, core.governance);
  const pendle = core.pendleEcosystem.iBgtDec2025;
  const registryAddress = await deployContractAndSave(
    'RegistryProxy',
    await getPendleRegistryConstructorParams(
      registryImplementation,
      core,
      pendle.iBgtMarket,
      pendle.ptOracle,
      core.pendleEcosystem.syIBgtToken,
    ),
    `Pendle${ptName}RegistryProxy`,
  );

  const registry = PendleRegistry__factory.connect(registryAddress, core.governance);
  const oracleAddress = await deployContractAndSave(
    'PendlePtPriceOracleV2',
    getPendlePtPriceOracleV2ConstructorParams(core, pendle.ptIBgtToken, registry),
    `PendlePt${ptName}PriceOracleV2`,
  );
  const oracle = PendlePtPriceOracleV2__factory.connect(oracleAddress, core.governance);

  const transactions: EncodedTransaction[] = [
    ...await encodeInsertOracle(
      core,
      core.tokens.ptIBgt,
      oracle,
      core.tokens.iBgt,
    ),
    ...await encodeAddMarket(
      core,
      core.tokens.ptIBgt,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._150,
      TargetLiquidationPenalty._15,
      parseEther(`${690_000}`),
      0,
      true,
    ),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(
      core,
      core.marketIds.ptIBgt,
      [
        {
          marginRatioOverride: TargetCollateralization._133,
          liquidationRewardOverride: TargetLiquidationPenalty._10,
          debtMarketIds: [core.marketIds.wbera],
        },
      ],
    ),
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
      await printPriceForVisualCheck(core, core.tokens.ptIBgt);
    },
  };
}

doDryRunAndCheckDeployment(main);
