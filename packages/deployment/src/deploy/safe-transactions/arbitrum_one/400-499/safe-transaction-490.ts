import { parseEther } from 'ethers/lib/utils';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../../../base/src/utils/constructors/dolomite';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import {
  encodeSetLiquidationPenalty,
  encodeSetSupplyCapWithMagic,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeInsertChainlinkOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import {
  checkIsCollateralOnly,
  checkLiquidationPenalty,
  checkMarketId,
  checkMinCollateralization,
  checkSupplyCap,
  printPriceForVisualCheck,
} from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Increases the sGMX supply cap to 225k
 * - Increases the sGMX liquidation penalty to 9%
 * - Lists AAVE, USDS, and sUSDS
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await encodeSetSupplyCapWithMagic(core, core.marketIds.dGmx, 225_000),
    await encodeSetLiquidationPenalty(core, core.marketIds.dGmx, TargetLiquidationPenalty._9),
    ...(await encodeInsertChainlinkOracleV3(core, core.tokens.aave)),
    ...(await encodeInsertChainlinkOracleV3(core, core.tokens.usds)),
    ...(await encodeInsertChainlinkOracleV3(core, core.tokens.sUsds)),
    ...(await encodeAddMarket(
      core,
      core.tokens.aave,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._133,
      TargetLiquidationPenalty._12,
      parseEther(`${10_000}`),
      ZERO_BI,
      true,
    )),
    ...(await encodeAddMarket(
      core,
      core.tokens.usds,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction12L88U90OInterestSetter,
      TargetCollateralization._120,
      TargetLiquidationPenalty._6,
      parseEther(`${10_000_000}`),
      ZERO_BI,
      false,
    )),
    ...(await encodeAddMarket(
      core,
      core.tokens.sUsds,
      core.oracleAggregatorV2,
      core.interestSetters.alwaysZeroInterestSetter,
      TargetCollateralization._125,
      TargetLiquidationPenalty._7,
      parseEther(`${15_000_000}`),
      ZERO_BI,
      true,
    )),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {
      await checkSupplyCap(core, core.marketIds.dGmx, parseEther(`${225_000}`));
      await checkLiquidationPenalty(core, core.marketIds.dGmx, TargetLiquidationPenalty._9);

      await checkMarketId(core, core.marketIds.aave, core.tokens.aave);
      await checkMarketId(core, core.marketIds.usds, core.tokens.usds);
      await checkMarketId(core, core.marketIds.sUsds, core.tokens.sUsds);

      await checkSupplyCap(core, core.marketIds.aave, parseEther(`${10_000}`));
      await checkSupplyCap(core, core.marketIds.usds, parseEther(`${10_000_000}`));
      await checkSupplyCap(core, core.marketIds.sUsds, parseEther(`${15_000_000}`));

      await checkMinCollateralization(core, core.marketIds.aave, TargetCollateralization._133);
      await checkMinCollateralization(core, core.marketIds.usds, TargetCollateralization._120);
      await checkMinCollateralization(core, core.marketIds.sUsds, TargetCollateralization._125);

      await checkLiquidationPenalty(core, core.marketIds.aave, TargetLiquidationPenalty._12);
      await checkLiquidationPenalty(core, core.marketIds.usds, TargetLiquidationPenalty._6);
      await checkLiquidationPenalty(core, core.marketIds.sUsds, TargetLiquidationPenalty._7);

      await checkIsCollateralOnly(core, core.marketIds.aave, true);
      await checkIsCollateralOnly(core, core.marketIds.usds, false);
      await checkIsCollateralOnly(core, core.marketIds.sUsds, true);

      await printPriceForVisualCheck(core, core.tokens.aave);
      await printPriceForVisualCheck(core, core.tokens.usds);
      await printPriceForVisualCheck(core, core.tokens.sUsds);
    },
  };
}

doDryRunAndCheckDeployment(main);
