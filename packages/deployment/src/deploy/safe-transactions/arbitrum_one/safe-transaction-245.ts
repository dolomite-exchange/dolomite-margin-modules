import { IERC20, IERC20__factory } from '@dolomite-exchange/modules-base/src/types';
import {
  AggregatorInfo,
  CHAINLINK_PRICE_AGGREGATORS_MAP,
  REDSTONE_PRICE_AGGREGATORS_MAP,
} from '@dolomite-exchange/modules-base/src/utils/constants';
import {
  createContractWithAbi,
  getAndCheckSpecificNetwork,
} from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { SignerWithAddressWithSafety } from '@dolomite-exchange/modules-base/src/utils/SignerWithAddressWithSafety';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getChainlinkPriceOracleV3ConstructorParams,
  getOracleAggregatorV2ConstructorParams,
  getRedstonePriceOracleV3ConstructorParams,
  getTWAPPriceOracleV2ConstructorParams,
} from '@dolomite-exchange/modules-oracles/src/oracles-constructors';
import {
  ChainlinkPriceOracleV3__factory,
  IChainlinkAggregator,
  IChainlinkAggregator__factory,
  OracleAggregatorV2__factory,
  RedstonePriceOracleV3__factory,
  TWAPPriceOracleV2__factory,
} from '@dolomite-exchange/modules-oracles/src/types';
import { IPendlePtIsolationModeVaultFactory__factory } from '@dolomite-exchange/modules-pendle/src/types';
import { createPendlePtPriceOracleV2 } from '@dolomite-exchange/modules-pendle/test/pendle-ecosystem-utils';
import { BaseContract, BigNumber } from 'ethers';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { ADDRESS_ZERO, Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';
import * as Deployments from '../../deployments.json';

function getChainlinkOracleData(
  tokenToAggregatorInfoMap: Record<string, AggregatorInfo>,
  signer: SignerWithAddressWithSafety,
): [IERC20[], IChainlinkAggregator[], IERC20[], boolean[]] {
  const tokens = Object.keys(tokenToAggregatorInfoMap)
    .map(t => IERC20__factory.connect(t, signer));
  const aggregators = tokens.map(t =>
    IChainlinkAggregator__factory.connect(
      tokenToAggregatorInfoMap[t.address].aggregatorAddress,
      signer,
    ),
  );
  const tokenPairs = tokens.map(t =>
    IERC20__factory.connect(
      tokenToAggregatorInfoMap[t.address].tokenPairAddress ?? ADDRESS_ZERO,
      signer,
    ),
  );
  const invertPrices = tokens.map(t =>
    tokenToAggregatorInfoMap[t.address].invert ?? false,
  );
  return [
    tokens,
    aggregators,
    tokenPairs,
    invertPrices,
  ];
}

async function getNewOracleMap(core: CoreProtocolArbitrumOne): Promise<Record<string, AggregatorInfo>> {
  const tokenToNewOracleMap: Record<string, AggregatorInfo> = {};
  const tokensToOldOraclesMap: Record<string, any> = {
    [core.tokens.dPtREthJun2025.address]: {
      tokenPairAddress: core.tokens.weth.address,
      aggregatorAddress: Deployments.PendlePtREthJun2025PriceOracle[core.network].address,
      pendleRegistry: core.pendleEcosystem.rEthJun2025.pendleRegistry,
    },
    [core.tokens.dPtWeEthApr2024.address]: {
      tokenPairAddress: core.tokens.eEth.address,
      aggregatorAddress: Deployments.PendlePtWeETHApr2024PriceOracle[core.network].address,
      pendleRegistry: core.pendleEcosystem.weEthApr2024.pendleRegistry,
    },
    [core.tokens.dPtWstEthJun2024.address]: {
      tokenPairAddress: core.tokens.stEth.address,
      aggregatorAddress: Deployments.PendlePtWstEthJun2024PriceOracle[core.network].address,
      pendleRegistry: core.pendleEcosystem.wstEthJun2024.pendleRegistry,
    },
    [core.tokens.dPtWstEthJun2025.address]: {
      tokenPairAddress: core.tokens.stEth.address,
      aggregatorAddress: Deployments.PendlePtWstEthJun2024PriceOracle[core.network].address,
      pendleRegistry: core.pendleEcosystem.wstEthJun2025.pendleRegistry,
    },
    [core.tokens.grail.address]: {
      tokenPairAddress: core.tokens.weth.address,
      aggregatorAddress: Deployments.GrailTWAPPriceOracleV1[core.network].address,
      camelotPool: core.camelotEcosystem.grailWethV3Pool,
    },
    [core.tokens.jones.address]: {
      tokenPairAddress: core.tokens.weth.address,
      aggregatorAddress: Deployments.JonesTWAPPriceOracleV1[core.network].address,
      camelotPool: core.jonesEcosystem.jonesWethV3Pool,
    },
    [core.tokens.premia.address]: {
      tokenPairAddress: core.tokens.weth.address,
      aggregatorAddress: Deployments.PremiaTWAPPriceOracleV1[core.network].address,
      camelotPool: core.premiaEcosystem.premiaWethV3Pool,
    },
    [core.tokens.dpx.address]: {
      tokenPairAddress: core.tokens.weth.address,
      aggregatorAddress: Deployments.DPXTWAPPriceOracleV1[core.network].address,
      camelotPool: core.camelotEcosystem.dpxWethV3Pool,
    },
  };
  const oldTokens = Object.keys(tokensToOldOraclesMap);
  for (let i = 0; i < oldTokens.length; i++) {
    const oldToken = oldTokens[i];
    let newOracleAddress: string;
    if ('pendleRegistry' in tokensToOldOraclesMap[oldToken]) {
      newOracleAddress = await createPendlePtPriceOracleV2(
        core,
        IPendlePtIsolationModeVaultFactory__factory.connect(oldToken, core.hhUser1),
        tokensToOldOraclesMap[oldToken].pendleRegistry,
      );
    } else if ('camelotPool' in tokensToOldOraclesMap[oldToken]) {
      newOracleAddress = await deployContractAndSave(
        TWAPPriceOracleV2__factory.abi,
        TWAPPriceOracleV2__factory.bytecode,
        getTWAPPriceOracleV2ConstructorParams(
          core,
          IERC20__factory.connect(oldToken, core.hhUser1),
          tokensToOldOraclesMap[oldToken].camelotPool,
        ),
      );
    } else {
      throw new Error(`Invalid token ${oldToken}`);
    }

    tokenToNewOracleMap[oldToken] = {
      tokenPairAddress: tokensToOldOraclesMap[oldToken].tokenPairAddress,
      aggregatorAddress: newOracle.address,
    };
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
      redstoneTokens,
      redstoneAggregators,
      redstoneInvertPrices,
      core.dolomiteRegistry,
      core.dolomiteMargin,
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

  const dolomiteRegistryImplementationV7Address = await deployContractAndSave(
    'DolomiteRegistryImplementation',
    [],
    'DolomiteRegistryImplementationV7',
  );

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteRegistryProxy',
      'upgradeTo',
      [dolomiteRegistryImplementationV7Address],
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
    invariants: async () => {
      assertHardhatInvariant(
        await core.dolomiteRegistry.oracleAggregator() === oracleAggregatorV2.address,
        'Invalid oracle aggregator',
      );

      for (let i = 0; i < marketsLength; i++) {
        assertHardhatInvariant(
          await core.dolomiteMargin.getMarketPriceOracle(i) === oracleAggregatorV2.address,
          'Invalid oracle address',
        );

        const priceBefore = pricesBefore[i];
        const priceAfter = (await core.dolomiteMargin.getMarketPrice(i)).value;
        console.log(
          `[${i}]: price deltas`,
          priceBefore.toString(),
          priceAfter.toString(),
          priceBefore.sub(priceAfter).toString(),
        );
      }
    },
  };
}

doDryRunAndCheckDeployment(main);
