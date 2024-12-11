import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import { parseEther } from 'ethers/lib/utils';
import {
  getLiquidationPremiumForTargetLiquidationPenalty,
  getMarginPremiumForTargetCollateralization,
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';

const LIQUIDATOR_ADDRESS = '0x1fF6B8E1192eB0369006Bbad76dA9068B68961B2';

/**
 * This script encodes the following transactions:
 * - Update the handler address on the GLV registry
 * - Increase the supply cap for PENDLE
 * - Decrease the margin premium and liquidation spread for PENDLE
 * - Change the interest setter for PENDLE
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const pendleMarketId = core.marketIds.pendle;

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.glvEcosystem.live.registry },
      'registry',
      'ownerSetIsHandler',
      [LIQUIDATOR_ADDRESS, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetMaxWei',
      [pendleMarketId, parseEther(`${2_000_000}`)],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetInterestSetter',
      [pendleMarketId, core.interestSetters.linearStepFunction15L135U80OInterestSetter.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetMarginPremium',
      [pendleMarketId, { value: getMarginPremiumForTargetCollateralization(TargetCollateralization._133) }],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetSpreadPremium',
      [pendleMarketId, { value: getLiquidationPremiumForTargetLiquidationPenalty(TargetLiquidationPenalty._9) }],
    ),
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
      assertHardhatInvariant(
        await core.glvEcosystem.live.registry.isHandler(LIQUIDATOR_ADDRESS),
        'Invalid handler status',
      );
      assertHardhatInvariant(
        await core.dolomiteMargin.getMarketInterestSetter(pendleMarketId) ===
        core.interestSetters.linearStepFunction15L135U80OInterestSetter.address,
        'Invalid interest setter',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketMaxWei(pendleMarketId)).value.eq(parseEther(`${2_000_000}`)),
        'Invalid max wei',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketMarginPremium(pendleMarketId)).value.eq(
          getMarginPremiumForTargetCollateralization(TargetCollateralization._133)),
        'Invalid margin premium',
      );
      assertHardhatInvariant(
        (await core.dolomiteMargin.getMarketSpreadPremium(pendleMarketId)).value.eq(
          getLiquidationPremiumForTargetLiquidationPenalty(TargetLiquidationPenalty._9)),
        'Invalid liquidation spread premium',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
