import { IERC20, IERC20__factory } from '@dolomite-exchange/modules-base/src/types';
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
} from '@dolomite-exchange/modules-oracles/src/oracles-constructors';
import {
  ChainlinkPriceOracleV3__factory,
  IChainlinkAggregator,
  IChainlinkAggregator__factory,
  OracleAggregatorV2__factory,
  RedstonePriceOracleV3__factory,
} from '@dolomite-exchange/modules-oracles/src/types';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { ADDRESS_ZERO, Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

function getOracleData(
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

/**
 * This script encodes the following transactions:
 * - Deploys new AsyncIsolationModeWrapperTraderImpl library
 * - Deploys a new wrapper trader for each GM token
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const [
    chainlinkTokens,
    chainlinkAggregators,
    ,
    chainlinkInvertPrices,
  ] = getOracleData(CHAINLINK_PRICE_AGGREGATORS_MAP[network], core.governance);
  const chainlinkOracleV3Address = await deployContractAndSave(
    'ChainlinkPriceOracleV3',
    await getChainlinkPriceOracleV3ConstructorParams(
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
  ] = getOracleData(REDSTONE_PRICE_AGGREGATORS_MAP[network], core.governance);
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

  const oracleAggregatorV2Address = await deployContractAndSave(
    'OracleAggregatorV2',
    await getOracleAggregatorV2ConstructorParams(core, chainlinkOracleV3, redstoneOracleV3) as any,
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
  for (let i = 0; i < marketsLength; i++) {
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
    },
  };
}

doDryRunAndCheckDeployment(main);
