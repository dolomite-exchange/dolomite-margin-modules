import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { formatEther, parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import {
  deployGmxV2GmTokenSystem,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddGmxV2Market } from '../../../../utils/encoding/add-market-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys new single-sided gmARB
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const gmArbTokenSystem = await deployGmxV2GmTokenSystem(core, core.gmxV2Ecosystem.gmTokens.arb, 'SingleSidedARB');
  const gmArbMarketId = await core.dolomiteMargin.getNumMarkets();

  const transactions: EncodedTransaction[] = [
    ...(await encodeAddGmxV2Market(
      core,
      gmArbTokenSystem.factory,
      gmArbTokenSystem.unwrapper,
      gmArbTokenSystem.wrapper,
      core.gmxV2Ecosystem.live.registry,
      gmArbMarketId,
      TargetCollateralization._125, // @follow-up @Corey double check these values
      TargetLiquidationPenalty.Base,
      parseEther(`${1_000_000}`),
    )),
  ];

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
        (await core.dolomiteMargin.getMarketTokenAddress(gmArbMarketId)) === gmArbTokenSystem.factory.address,
        'Invalid factory',
      );
      const liquidators = await core.liquidatorAssetRegistry.getLiquidatorsForAsset(gmArbMarketId);
      assertHardhatInvariant(
        liquidators[0] === core.liquidatorProxyV6.address && liquidators[1] === core.freezableLiquidatorProxy.address,
        'Invalid whitelisted liquidators',
      );
      assertHardhatInvariant(
        (await gmArbTokenSystem.factory.isTokenConverterTrusted(gmArbTokenSystem.unwrapper.address)) &&
          (await gmArbTokenSystem.factory.isTokenConverterTrusted(gmArbTokenSystem.wrapper.address)),
        'Invalid token converters',
      );

      const price = await core.dolomiteMargin.getMarketPrice(gmArbMarketId);
      console.log(`\tOracle price for SingleSidedARB: $${formatEther(price.value)}`);
    },
  };
}

doDryRunAndCheckDeployment(main);
