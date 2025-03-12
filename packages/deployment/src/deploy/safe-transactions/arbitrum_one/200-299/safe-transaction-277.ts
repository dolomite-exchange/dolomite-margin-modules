import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber, impersonate } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getGmxV2IsolationModeUnwrapperTraderV2ConstructorParams,
  getGmxV2IsolationModeVaultFactoryConstructorParams,
  getGmxV2IsolationModeWrapperTraderV2ConstructorParams,
  getGmxV2MarketTokenPriceOracleConstructorParams,
  GMX_V2_EXECUTION_FEE,
} from '@dolomite-exchange/modules-gmx-v2/src/gmx-v2-constructors';
import {
  GmxV2IsolationModeTokenVaultV1__factory,
  GmxV2IsolationModeUnwrapperTraderV2__factory,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeVaultFactory__factory,
  GmxV2IsolationModeWrapperTraderV2__factory,
  GmxV2MarketTokenPriceOracle__factory,
  IGmxV2IsolationModeUnwrapperTraderV2,
  IGmxV2IsolationModeUnwrapperTraderV2__factory,
  IGmxV2IsolationModeWrapperTraderV2,
  IGmxV2IsolationModeWrapperTraderV2__factory,
} from '@dolomite-exchange/modules-gmx-v2/src/types';
import { BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import hardhat from 'hardhat';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { ADDRESS_ZERO, Network } from 'packages/base/src/utils/no-deps-constants';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddAsyncIsolationModeMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import { encodeInsertChainlinkOracleV3 } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';

import ModuleDeployments from '../../../deployments.json';

/**
 * This script encodes the following transactions:
 * - Deploys new single-sided gmBTC
 * - Deploys new single-sided gmETH
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  if (hardhat.network.name === 'hardhat') {
    const impersonator1 = await impersonate(core.delayedMultiSig.address, true);
    await core.delayedMultiSig.connect(impersonator1).changeTimeLock(0);
    console.log('Timelock skipped');

    const [owner1] = await core.delayedMultiSig.getOwners();
    const multisigOwner = await impersonate(owner1, true);
    await core.delayedMultiSig
      .connect(multisigOwner)
      .executeMultipleTransactions([815, 816, 817, 818, 819, 820, 821, 822, 823]);
    console.log('Transactions executed');
  }

  const gmxV2TokenVault = GmxV2IsolationModeTokenVaultV1__factory.connect(
    ModuleDeployments.GmxV2IsolationModeTokenVaultImplementationV14[network].address,
    core.hhUser1,
  );

  const otherStablecoinMarketIds = [
    core.marketIds.nativeUsdc,
    core.marketIds.usdc,
    core.marketIds.usdt,
    core.marketIds.dai,
    core.marketIds.mim,
  ];
  const gmxV2PriceOracleAddress = await deployContractAndSave(
    'GmxV2MarketTokenPriceOracle',
    getGmxV2MarketTokenPriceOracleConstructorParams(core, core.gmxV2Ecosystem.live.registry),
    'GmxV2MarketTokenPriceOracleV2',
  );
  const gmxV2PriceOracle = GmxV2MarketTokenPriceOracle__factory.connect(gmxV2PriceOracleAddress, core.hhUser1);

  const gmTokens = [core.gmxV2Ecosystem.gmTokens.btc, core.gmxV2Ecosystem.gmTokens.eth];
  const supplyCaps = [parseEther(`${3_000_000}`), parseEther(`${2_000_000}`)];
  const gmNames = ['SingleSidedBTC', 'SingleSidedETH'];

  const skipLongToken = false;

  const unwrapperImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeUnwrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeUnwrapperTraderImplementationV5',
    { ...core.gmxV2Ecosystem.live.gmxV2LibraryMap, ...core.libraries.unwrapperTraderImpl },
  );
  const unwrapperImplementation = GmxV2IsolationModeUnwrapperTraderV2__factory.connect(
    unwrapperImplementationAddress,
    core.hhUser1,
  );

  const wrapperImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeWrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeWrapperTraderImplementationV6',
    { ...core.gmxV2Ecosystem.live.gmxV2LibraryMap, ...core.libraries.wrapperTraderImpl },
  );
  const wrapperImplementation = GmxV2IsolationModeWrapperTraderV2__factory.connect(
    wrapperImplementationAddress,
    core.hhUser1,
  );

  const factories: GmxV2IsolationModeVaultFactory[] = [];
  const unwrappers: IGmxV2IsolationModeUnwrapperTraderV2[] = [];
  const wrappers: IGmxV2IsolationModeWrapperTraderV2[] = [];

  for (let i = 0; i < gmTokens.length; i += 1) {
    const factoryAddress = await deployContractAndSave(
      'GmxV2IsolationModeVaultFactory',
      getGmxV2IsolationModeVaultFactoryConstructorParams(
        core,
        core.gmxV2Ecosystem.live.registry,
        [gmTokens[i].longMarketId, gmTokens[i].longMarketId, ...otherStablecoinMarketIds],
        [gmTokens[i].longMarketId, gmTokens[i].longMarketId, ...otherStablecoinMarketIds],
        gmTokens[i],
        gmxV2TokenVault,
        GMX_V2_EXECUTION_FEE,
        skipLongToken,
      ),
      `GmxV2${gmNames[i]}IsolationModeVaultFactory`,
      core.gmxV2Ecosystem.live.gmxV2LibraryMap,
    );
    const factory = GmxV2IsolationModeVaultFactory__factory.connect(factoryAddress, core.hhUser1);

    const unwrapperProxyAddress = await deployContractAndSave(
      'IsolationModeTraderProxy',
      await getGmxV2IsolationModeUnwrapperTraderV2ConstructorParams(
        core,
        unwrapperImplementation,
        factory,
        core.gmxV2Ecosystem.live.registry,
        skipLongToken,
      ),
      `GmxV2${gmNames[i]}AsyncIsolationModeUnwrapperTraderProxyV2`,
    );

    const wrapperProxyAddress = await deployContractAndSave(
      'IsolationModeTraderProxy',
      await getGmxV2IsolationModeWrapperTraderV2ConstructorParams(
        core,
        wrapperImplementation,
        factory,
        core.gmxV2Ecosystem.live.registry,
        skipLongToken,
      ),
      `GmxV2${gmNames[i]}AsyncIsolationModeWrapperTraderProxyV2`,
    );

    factories.push(factory);
    unwrappers.push(IGmxV2IsolationModeUnwrapperTraderV2__factory.connect(unwrapperProxyAddress, core.hhUser1));
    wrappers.push(IGmxV2IsolationModeWrapperTraderV2__factory.connect(wrapperProxyAddress, core.hhUser1));
  }

  const marketId = await core.dolomiteMargin.getNumMarkets();
  const gmMarketIds: BigNumberish[] = [];
  for (let i = 0; i < gmTokens.length; i++) {
    gmMarketIds.push(marketId.add(i));
  }

  const transactions: EncodedTransaction[] = [];

  transactions.push(...(await encodeInsertChainlinkOracleV3(core, core.gmxV2Ecosystem.gmTokens.btc.indexToken, false)));

  for (let i = 0; i < factories.length; i++) {
    const factory = factories[i];
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        core.gmxV2Ecosystem.live,
        'registry',
        'ownerSetGmxMarketToIndexToken',
        [gmTokens[i].marketToken.address, gmTokens[i].indexToken.address],
      ),
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { gmxV2PriceOracle },
        'gmxV2PriceOracle',
        'ownerSetMarketToken',
        [factory.address, true],
      ),
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { oracleAggregatorV2: core.oracleAggregatorV2 },
        'oracleAggregatorV2',
        'ownerInsertOrUpdateToken',
        [
          {
            decimals: await factory.decimals(),
            token: factory.address,
            oracleInfos: [
              {
                oracle: gmxV2PriceOracle.address,
                weight: 100,
                tokenPair: ADDRESS_ZERO,
              },
            ],
          },
        ],
      ),
      ...(await encodeAddAsyncIsolationModeMarket(
        core,
        factory,
        core.oracleAggregatorV2,
        unwrappers[i],
        wrappers[i],
        core.gmxV2Ecosystem.live.registry,
        gmMarketIds[i],
        TargetCollateralization._120,
        TargetLiquidationPenalty.Base,
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
    },
    invariants: async () => {
      assertHardhatInvariant(factories.length === 2, 'Invalid # of factories');
      for (let i = 0; i < factories.length; i += 1) {
        assertHardhatInvariant(
          (await core.dolomiteMargin.getMarketTokenAddress(gmMarketIds[i])) === factories[i].address,
          `Invalid factory at index ${i}`,
        );
        const liquidators = await core.liquidatorAssetRegistry.getLiquidatorsForAsset(gmMarketIds[i]);
        assertHardhatInvariant(
          liquidators[0] === core.liquidatorProxyV4.address && liquidators[1] === core.freezableLiquidatorProxy.address,
          'Invalid whitelisted liquidators',
        );
        assertHardhatInvariant(
          (await factories[i].isTokenConverterTrusted(unwrappers[i].address)) &&
            (await factories[i].isTokenConverterTrusted(wrappers[i].address)),
          'Invalid token converters',
        );

        const price = await core.dolomiteMargin.getMarketPrice(gmMarketIds[i]);
        console.log(`\tOracle price for ${gmNames[i]}: `, price.value.toString());
      }
    },
  };
}

doDryRunAndCheckDeployment(main);
