import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { ERC4626PriceOracle__factory } from 'packages/oracles/src/types';
import {
  AccountRiskOverrideCategory,
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { ModuleDeployments } from '../../../../utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import {
  encodeSetAccountRiskOverrideCategoryByMarketId,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeInsertOracle } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  checkAccountRiskOverrideCategory,
  checkIsCollateralOnly,
  checkMarket,
  checkSupplyCap,
} from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - List the sWBERA market
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const erc4626PriceOracle = ERC4626PriceOracle__factory.connect(
    ModuleDeployments.ERC4626PriceOracleV1[network].address,
    core.hhUser1,
  );

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { erc4626PriceOracle },
      'erc4626PriceOracle',
      'ownerInsertOrUpdateToken',
      [core.tokens.sWbera.address, true],
    ),
    ...(await encodeInsertOracle(core, core.tokens.sWbera, erc4626PriceOracle, core.tokens.wbera)),
    ...(await encodeAddMarket(
      core,
      core.tokens.sWbera,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._142,
      TargetLiquidationPenalty._15,
      parseEther(`${5_000_000}`),
      ZERO_BI,
      true,
    )),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, core.marketIds.sWbera, AccountRiskOverrideCategory.BERA),
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
      await checkMarket(core, core.marketIds.sWbera, core.tokens.sWbera);
      await checkSupplyCap(core, core.marketIds.sWbera, parseEther(`${5_000_000}`));
      await checkIsCollateralOnly(core, core.marketIds.sWbera, true);
      await checkAccountRiskOverrideCategory(core, core.marketIds.sWbera, AccountRiskOverrideCategory.BERA);
    },
  };
}

doDryRunAndCheckDeployment(main);
