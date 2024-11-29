import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumberish } from 'ethers';
import { formatEther, parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import {
  deployGmxV2System,
  EncodedTransaction,
  GmxV2System,
  prettyPrintEncodeAddGmxV2Market,
  prettyPrintEncodeInsertChainlinkOracleV3,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Lists new GM assets (GMX, PENDLE, PEPE, WIF)
 * - Adds Chainlink oracle prices for PEPE and WIF
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const gmTokens = [
    core.gmxV2Ecosystem.gmTokens.gmx,
    core.gmxV2Ecosystem.gmTokens.pendleUsd,
    core.gmxV2Ecosystem.gmTokens.pepeUsd,
    core.gmxV2Ecosystem.gmTokens.wifUsd,
  ];
  const supplyCaps = [
    parseEther(`${800_000}`),
    parseEther(`${100_000}`),
    parseEther(`${800_000}`),
    parseEther(`${1_000_000}`),
  ];
  const gmNames = ['SingleSidedGMX', 'PENDLE', 'PEPE', 'WIF'];
  const collateralizations = [
    TargetCollateralization._125,
    TargetCollateralization._125,
    TargetCollateralization._125,
    TargetCollateralization._125,
  ];
  const penalties = [
    TargetLiquidationPenalty.Base,
    TargetLiquidationPenalty.Base,
    TargetLiquidationPenalty.Base,
    TargetLiquidationPenalty.Base,
  ];

  const systems: GmxV2System[] = [];
  for (let i = 0; i < gmTokens.length; i += 1) {
    systems.push(await deployGmxV2System(core, gmTokens[i], gmNames[i]));
  }

  const marketId = await core.dolomiteMargin.getNumMarkets();
  const gmMarketIds: BigNumberish[] = [];
  for (let i = 0; i < gmTokens.length; i++) {
    gmMarketIds.push(marketId.add(i));
  }

  const transactions: EncodedTransaction[] = [
    ...(await prettyPrintEncodeInsertChainlinkOracleV3(core, core.gmxV2Ecosystem.gmTokens.pepeUsd.indexToken)),
    ...(await prettyPrintEncodeInsertChainlinkOracleV3(core, core.gmxV2Ecosystem.gmTokens.wifUsd.indexToken)),
  ];

  for (let i = 0; i < systems.length; i++) {
    transactions.push(
      ...(await prettyPrintEncodeAddGmxV2Market(
        core,
        systems[i].factory,
        systems[i].unwrapper,
        systems[i].wrapper,
        core.gmxV2Ecosystem.live.registry,
        gmMarketIds[i],
        collateralizations[i],
        penalties[i],
        supplyCaps[i],
      )),
    );
  }

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {
      for (let i = 0; i < systems.length; i += 1) {
        assertHardhatInvariant(
          (await core.dolomiteMargin.getMarketTokenAddress(gmMarketIds[i])) === systems[i].factory.address,
          `Invalid factory at index ${i}`,
        );
        const liquidators = await core.liquidatorAssetRegistry.getLiquidatorsForAsset(gmMarketIds[i]);
        assertHardhatInvariant(
          liquidators[0] === core.liquidatorProxyV4.address && liquidators[1] === core.freezableLiquidatorProxy.address,
          'Invalid whitelisted liquidators',
        );
        assertHardhatInvariant(
          (await systems[i].factory.isTokenConverterTrusted(systems[i].unwrapper.address)) &&
            (await systems[i].factory.isTokenConverterTrusted(systems[i].wrapper.address)),
          'Invalid token converters',
        );

        const price = await core.dolomiteMargin.getMarketPrice(gmMarketIds[i]);
        console.log(`\tOracle price for ${gmNames[i]}: $${formatEther(price.value)}`);
      }
    },
  };
}

doDryRunAndCheckDeployment(main);
