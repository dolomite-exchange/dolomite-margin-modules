import { IERC20, IERC20__factory, IERC20Metadata__factory } from '@dolomite-exchange/modules-base/src/types';
import {
  AggregatorInfo,
  CHAINLINK_PRICE_AGGREGATORS_MAP,
  REDSTONE_PRICE_AGGREGATORS_MAP,
} from '@dolomite-exchange/modules-base/src/utils/constants';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { SignerWithAddressWithSafety } from '@dolomite-exchange/modules-base/src/utils/SignerWithAddressWithSafety';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getChainlinkPriceOracleV3ConstructorParams,
  getOracleAggregatorV2ConstructorParams,
  getRedstonePriceOracleV3ConstructorParams,
  getTWAPPriceOracleV2ConstructorParams,
} from '@dolomite-exchange/modules-oracles/src/oracles-constructors';
import {
  ChainlinkPriceOracleV3__factory,
  IAlgebraV3Pool,
  IChainlinkAggregator,
  IChainlinkAggregator__factory,
  OracleAggregatorV2__factory,
  RedstonePriceOracleV3__factory,
} from '@dolomite-exchange/modules-oracles/src/types';
import { getPendlePtPriceOracleV2ConstructorParams } from '@dolomite-exchange/modules-pendle/src/pendle-constructors';
import { IPendlePtIsolationModeVaultFactory__factory } from '@dolomite-exchange/modules-pendle/src/types';
import { BigNumber } from 'ethers';
import { formatUnits } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { ADDRESS_ZERO, Network, ONE_ETH_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';
import * as Deployments from '../../deployments.json';

function getChainlinkOracleData(
  tokenToAggregatorInfoMap: Record<string, AggregatorInfo | undefined>,
  signer: SignerWithAddressWithSafety,
): [IERC20[], IChainlinkAggregator[], IERC20[], boolean[]] {
  const tokens = Object.keys(tokenToAggregatorInfoMap)
    .map(t => IERC20__factory.connect(t, signer));
  const aggregators = tokens.map(t =>
    IChainlinkAggregator__factory.connect(
      tokenToAggregatorInfoMap[t.address]!.aggregatorAddress,
      signer,
    ),
  );
  const tokenPairs = tokens.map(t =>
    IERC20__factory.connect(
      tokenToAggregatorInfoMap[t.address]!.tokenPairAddress ?? ADDRESS_ZERO,
      signer,
    ),
  );
  const invertPrices = tokens.map(t =>
    tokenToAggregatorInfoMap[t.address]!.invert ?? false,
  );
  return [
    tokens,
    aggregators,
    tokenPairs,
    invertPrices,
  ];
}

async function getNewOracleMap(core: CoreProtocolArbitrumOne): Promise<Record<string, AggregatorInfo[]>> {
  const tokenToNewOracleMap: Record<string, AggregatorInfo[]> = {};
  const tokensToOldOraclesMap: Record<string, any> = {
    [core.tokens.dPtREthJun2025.address]: {
      tokenPairAddress: core.tokens.weth.address,
      aggregatorAddress: Deployments.PendlePtREthJun2025PriceOracle[core.network].address,
      pendleRegistry: core.pendleEcosystem.rEthJun2025.pendleRegistry,
      rename: 'PendlePtREthJun2025PriceOracleV2',
    },
    [core.tokens.dPtWeEthApr2024.address]: {
      tokenPairAddress: core.tokens.eEth.address,
      aggregatorAddress: Deployments.PendlePtWeETHApr2024PriceOracle[core.network].address,
      pendleRegistry: core.pendleEcosystem.weEthApr2024.pendleRegistry,
      rename: 'PendlePtWeETHApr2024PriceOracleV2',
    },
    [core.tokens.dPtWstEthJun2024.address]: {
      tokenPairAddress: core.tokens.stEth.address,
      aggregatorAddress: Deployments.PendlePtWstEthJun2024PriceOracle[core.network].address,
      pendleRegistry: core.pendleEcosystem.wstEthJun2024.pendleRegistry,
      rename: 'PendlePtWstEthJun2024PriceOracleV2',
    },
    [core.tokens.dPtWstEthJun2025.address]: {
      tokenPairAddress: core.tokens.stEth.address,
      aggregatorAddress: Deployments.PendlePtWstEthJun2025PriceOracle[core.network].address,
      pendleRegistry: core.pendleEcosystem.wstEthJun2025.pendleRegistry,
      rename: 'PendlePtWstEthJun2025PriceOracleV2',
    },
    [core.tokens.grail.address]: {
      tokenPairAddresses: [core.tokens.weth.address, core.tokens.usdc.address],
      aggregatorAddress: Deployments.GrailTWAPPriceOracleV1[core.network].address,
      camelotPools: [core.camelotEcosystem.grailWethV3Pool, core.camelotEcosystem.grailUsdcV3Pool],
      renames: ['GrailWethTWAPPriceOracleV2', 'GrailUsdcTWAPPriceOracleV2'],
    },
    [core.tokens.jones.address]: {
      tokenPairAddresses: [core.tokens.weth.address],
      aggregatorAddress: Deployments.JonesTWAPPriceOracleV1[core.network].address,
      camelotPools: [core.jonesEcosystem.jonesWethV3Pool],
      renames: ['JonesTWAPPriceOracleV2'],
    },
    [core.tokens.premia.address]: {
      tokenPairAddresses: [core.tokens.weth.address],
      aggregatorAddress: Deployments.PremiaTWAPPriceOracleV1[core.network].address,
      camelotPools: [core.premiaEcosystem.premiaWethV3Pool],
      renames: ['PremiaTWAPPriceOracleV2'],
    },
    [core.tokens.dpx.address]: {
      tokenPairAddresses: [core.tokens.weth.address],
      aggregatorAddress: Deployments.DPXTWAPPriceOracleV1[core.network].address,
      camelotPools: [core.camelotEcosystem.dpxWethV3Pool],
      renames: ['DPXTWAPPriceOracleV2'],
    },
  };
  const oldTokens = Object.keys(tokensToOldOraclesMap);
  for (let i = 0; i < oldTokens.length; i++) {
    const oldToken = oldTokens[i];
    const oldOracle = tokensToOldOraclesMap[oldToken];
    if ('pendleRegistry' in oldOracle && 'rename' in oldOracle) {
      const newOracleAddress = await deployContractAndSave(
        'PendlePtPriceOracleV2',
        getPendlePtPriceOracleV2ConstructorParams(
          core,
          IPendlePtIsolationModeVaultFactory__factory.connect(oldToken, core.hhUser1),
          oldOracle.pendleRegistry,
        ),
        oldOracle.rename,
      );
      tokenToNewOracleMap[oldToken] = [
        {
          tokenPairAddress: oldOracle.tokenPairAddress,
          aggregatorAddress: newOracleAddress,
        },
      ];
    } else if ('camelotPools' in oldOracle && 'renames' in oldOracle) {
      tokenToNewOracleMap[oldToken] = [];
      const pools = oldOracle.camelotPools as IAlgebraV3Pool[];
      for (let i = 0; i < pools.length; i++) {
        const newOracleAddress = await deployContractAndSave(
          'TWAPPriceOracleV2',
          getTWAPPriceOracleV2ConstructorParams(
            core,
            IERC20__factory.connect(oldToken, core.hhUser1),
            pools[i],
          ),
          oldOracle.renames[i],
        );
        tokenToNewOracleMap[oldToken].push({
          tokenPairAddress: oldOracle.tokenPairAddresses[i],
          aggregatorAddress: newOracleAddress,
        });
      }
    } else {
      throw new Error(`Invalid token ${oldToken}`);
    }
  }

  return tokenToNewOracleMap;
}

/**
 * This script encodes the following transactions:
 * - Deploys the OracleAggregator and sets it as the oracle for each market
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const [
    chainlinkTokens,
    chainlinkAggregators,
    ,
    chainlinkInvertPrices,
  ] = getChainlinkOracleData(CHAINLINK_PRICE_AGGREGATORS_MAP[network], core.governance);
  const chainlinkOracleV3Address = await deployContractAndSave(
    'ChainlinkPriceOracleV3',
    getChainlinkPriceOracleV3ConstructorParams(
      chainlinkTokens,
      chainlinkAggregators,
      chainlinkInvertPrices,
      core.dolomiteRegistry,
      core.dolomiteMargin,
    ),
    'ChainlinkPriceOracleV3',
  );
  const chainlinkOracleV3 = ChainlinkPriceOracleV3__factory.connect(chainlinkOracleV3Address, core.hhUser1);

  const [
    redstoneTokens,
    redstoneAggregators,
    ,
    redstoneInvertPrices,
  ] = getChainlinkOracleData(REDSTONE_PRICE_AGGREGATORS_MAP[network], core.governance);
  const redstoneOracleV3Address = await deployContractAndSave(
    'RedstonePriceOracleV3',
    getRedstonePriceOracleV3ConstructorParams(
      core,
      redstoneTokens.map(t => t.address),
      redstoneAggregators.map(a => a.address),
      redstoneInvertPrices,
    ),
    'RedstonePriceOracleV3',
  );
  const redstoneOracleV3 = RedstonePriceOracleV3__factory.connect(redstoneOracleV3Address, core.hhUser1);

  const tokenToNewOracleMap = await getNewOracleMap(core);
  const oracleAggregatorV2Address = await deployContractAndSave(
    'OracleAggregatorV2',
    await getOracleAggregatorV2ConstructorParams(core, chainlinkOracleV3, redstoneOracleV3, tokenToNewOracleMap) as any,
    'OracleAggregatorV2',
  );
  const oracleAggregatorV2 = OracleAggregatorV2__factory.connect(oracleAggregatorV2Address, core.hhUser1);

  const dolomiteRegistryImplementationV8Address = await deployContractAndSave(
    'DolomiteRegistryImplementation',
    [],
    'DolomiteRegistryImplementationV8',
  );

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteRegistryProxy',
      'upgradeTo',
      [dolomiteRegistryImplementationV8Address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteRegistry',
      'ownerSetOracleAggregator',
      [oracleAggregatorV2.address],
    ),
  );

  const marketsLength = (await core.dolomiteMargin.getNumMarkets()).toNumber();
  const pricesBefore: Record<number, BigNumber> = {};
  for (let i = 0; i < marketsLength; i++) {
    pricesBefore[i] = (await core.dolomiteMargin.getMarketPrice(i)).value;
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        core,
        'dolomiteMargin',
        'ownerSetPriceOracle',
        [i, oracleAggregatorV2.address],
      ),
    );
  }

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    skipTimeDelay: true,
    invariants: async () => {
      assertHardhatInvariant(
        await core.dolomiteRegistry.oracleAggregator() === oracleAggregatorV2.address,
        'Invalid oracle aggregator',
      );
      assertHardhatInvariant(
        await chainlinkOracleV3.getInvertPriceByToken(core.tokens.eEth.address),
        'Expected eETH to be inverted',
      );
      assertHardhatInvariant(
        (await oracleAggregatorV2.getOraclesByToken(core.tokens.grail.address)).length === 2,
        'Expected GRAIL oracles to have length = 2',
      );

      console.log('\n\tChecking price deltas...');
      for (let i = 0; i < marketsLength; i++) {
        assertHardhatInvariant(
          await core.dolomiteMargin.getMarketPriceOracle(i) === oracleAggregatorV2.address,
          'Invalid oracle address',
        );
        const token = IERC20Metadata__factory.connect(
          await core.dolomiteMargin.getMarketTokenAddress(i),
          core.hhUser1,
        );
        const symbol = await token.symbol();
        const priceBefore = pricesBefore[i];
        const priceAfter = (await core.dolomiteMargin.getMarketPrice(i)).value;
        const delta = priceAfter.sub(priceBefore);
        if (!delta.eq(ZERO_BI)) {
          console.log(
            `\t[${i}]: ${symbol} = `,
            `${formatUnits(ONE_ETH_BI.mul(delta).div(priceBefore).mul(100).toString())}%`,
          );
        }
      }
    },
  };
}

doDryRunAndCheckDeployment(main);
