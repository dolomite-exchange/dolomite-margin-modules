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
import { parseUsdc } from '../../../../../../base/src/utils/math-utils';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import {
  encodeSetAccountRiskOverrideCategoryByMarketId,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeInsertOracle, encodeInsertRedstoneOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  checkAccountRiskOverrideCategory, checkBorrowCap, checkIsCollateralOnly,
  checkMarket,
  checkSupplyCap,
  printPriceForVisualCheck,
} from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - List the BYUSD market
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const erc4626PriceOracleAddress = await deployContractAndSave(
    'ERC4626PriceOracle',
    [[core.tokens.oriBgt.address], core.dolomiteMargin.address],
    'ERC4626PriceOracleV1',
  );
  const erc4626PriceOracle = ERC4626PriceOracle__factory.connect(erc4626PriceOracleAddress, core.hhUser1);

  const transactions: EncodedTransaction[] = [
    ...(await encodeInsertRedstoneOracleV3(core, core.tokens.byusd)),
    ...(await encodeAddMarket(
      core,
      core.tokens.byusd,
      core.oracleAggregatorV2,
      core.interestSetters.modularInterestSetter,
      TargetCollateralization.Base,
      TargetLiquidationPenalty.Base,
      parseUsdc(`${40_000_000}`),
      parseUsdc(`${35_000_000}`),
      false,
    )),
    await encodeSetAccountRiskOverrideCategoryByMarketId(
      core,
      core.marketIds.byusd,
      AccountRiskOverrideCategory.STABLE,
    ),

    ...(await encodeInsertOracle(core, core.tokens.oriBgt, erc4626PriceOracle, core.tokens.iBgt)),
    ...(await encodeAddMarket(
      core,
      core.tokens.oriBgt,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._150,
      TargetLiquidationPenalty._15,
      parseEther(`${690_000}`),
      ZERO_BI,
      true,
    )),
    await encodeSetAccountRiskOverrideCategoryByMarketId(core, core.marketIds.oriBgt, AccountRiskOverrideCategory.BERA),
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
      await checkMarket(core, core.marketIds.byusd, core.tokens.byusd);
      await checkSupplyCap(core, core.marketIds.byusd, parseUsdc(`${40_000_000}`));
      await checkBorrowCap(core, core.marketIds.byusd, parseUsdc(`${35_000_000}`));
      await checkIsCollateralOnly(core, core.marketIds.byusd, false);
      await checkAccountRiskOverrideCategory(core, core.marketIds.byusd, AccountRiskOverrideCategory.STABLE);

      await checkMarket(core, core.marketIds.oriBgt, core.tokens.oriBgt);
      await checkSupplyCap(core, core.marketIds.oriBgt, parseEther(`${690_000}`));
      await checkIsCollateralOnly(core, core.marketIds.oriBgt, true);
      await checkAccountRiskOverrideCategory(core, core.marketIds.oriBgt, AccountRiskOverrideCategory.BERA);
    },
  };
}

doDryRunAndCheckDeployment(main);
