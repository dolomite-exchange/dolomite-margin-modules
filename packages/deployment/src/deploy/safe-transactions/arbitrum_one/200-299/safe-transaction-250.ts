import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import {
  EncodedTransaction,
  prettyPrintEncodeAddMarket,
  prettyPrintEncodeInsertChainlinkOracleV3,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Adds the XAI Chainlink price oracle to the Oracle Aggregator
 * - Lists XAI
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [
    ...await prettyPrintEncodeInsertChainlinkOracleV3(
      core,
      core.tokens.xai,
      false,
    ),
    ...await prettyPrintEncodeAddMarket(
      core,
      core.tokens.xai,
      core.oracleAggregatorV2,
      core.interestSetters.linearStepFunction14L86U90OInterestSetter,
      TargetCollateralization._150,
      TargetLiquidationPenalty._15,
      parseEther('400000'),
      ZERO_BI,
      false,
    ),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    invariants: async () => {
      const maxWei = await core.dolomiteMargin.getMarketMaxWei(core.marketIds.xai);
      assertHardhatInvariant(
        maxWei.value.eq(parseEther('400000')),
        'Invalid max wei',
      );

      // NOTE: the price is time sensitive
      const price = await core.dolomiteMargin.getMarketPrice(core.marketIds.xai);
      console.log(`\tXAI price: ${price.value.toString()}`);
      assertHardhatInvariant(
        price.value.gt(parseEther('1')) && price.value.lt(parseEther('1.1')),
        'Invalid price',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
