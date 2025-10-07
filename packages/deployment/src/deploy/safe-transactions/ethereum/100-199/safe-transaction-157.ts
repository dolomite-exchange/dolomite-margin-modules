import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { IAlgebraV3Pool__factory, TWAPPriceOracleV2__factory } from 'packages/oracles/src/types';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import {
  encodeSetSingleCollateralWithStrictDebtByMarketId,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeInsertTwapOracle } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  checkInterestSetter,
  checkMarket,
  checkSupplyCap,
  printPriceForVisualCheck,
} from '../../../../utils/invariant-utils';
import { getTWAPPriceOracleV2ConstructorParams } from '@dolomite-exchange/modules-oracles/src/oracles-constructors';

/**
 * This script encodes the following transactions:
 * - Lists the DOLO market
 */
async function main(): Promise<DryRunOutput<Network.Ethereum>> {
  const network = await getAndCheckSpecificNetwork(Network.Ethereum);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(false, network),
  });

  const algebraPool = IAlgebraV3Pool__factory.connect('0x003896387666c5c11458eeb3f927b72a11b19783', core.hhUser1);
  const twapOracleAddress = await deployContractAndSave(
    'PancakeV3PriceOracle',
    getTWAPPriceOracleV2ConstructorParams(core, core.tokens.dolo, algebraPool),
    'DOLOPriceOracle',
  );
  const twapOracle = TWAPPriceOracleV2__factory.connect(twapOracleAddress, core.hhUser1);

  const transactions: EncodedTransaction[] = [
    ...await encodeInsertTwapOracle(
      core,
      core.tokens.dolo,
      twapOracle,
      core.tokens.usdc,
    ),
    ...await encodeAddMarket(
      core,
      core.tokens.dolo,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseEther(`${20_000_000}`),
      ZERO_BI,
      true,
    ),
    await encodeSetSingleCollateralWithStrictDebtByMarketId(
      core,
      core.marketIds.dolo,
      [
        {
          liquidationRewardOverride: TargetLiquidationPenalty._15,
          debtMarketIds: core.marketIds.stablecoins,
          marginRatioOverride: TargetCollateralization._166,
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
      await printPriceForVisualCheck(core, core.tokens.dolo);
      await checkMarket(core, core.marketIds.dolo, core.tokens.dolo);
      await checkInterestSetter(core, core.marketIds.dolo, core.interestSetters.alwaysZeroInterestSetter);
      await checkSupplyCap(core, core.marketIds.dolo, parseEther(`${20_000_000}`));
    },
  };
}

doDryRunAndCheckDeployment(main);
