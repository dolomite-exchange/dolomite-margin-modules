import {
  IIsolationModeVaultFactory,
  IsolationModeFreezableLiquidatorProxy__factory,
} from '@dolomite-exchange/modules-base/src/types';
import {
  getIsolationModeFreezableLiquidatorProxyConstructorParams,
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { impersonate } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getGmxV2IsolationModeUnwrapperTraderV2ConstructorParams,
  getGmxV2IsolationModeVaultFactoryConstructorParams,
  getGmxV2IsolationModeWrapperTraderV2ConstructorParams,
  getGmxV2MarketTokenPriceOracleConstructorParams,
  getGmxV2RegistryConstructorParams,
  GMX_V2_CALLBACK_GAS_LIMIT,
  GMX_V2_EXECUTION_FEE,
} from '@dolomite-exchange/modules-gmx-v2/src/gmx-v2-constructors';
import {
  GmxV2IsolationModeTokenVaultV1__factory,
  GmxV2IsolationModeUnwrapperTraderV2__factory,
  GmxV2IsolationModeWrapperTraderV2__factory,
  GmxV2MarketTokenPriceOracle__factory,
  GmxV2Registry__factory,
  IGmxV2IsolationModeUnwrapperTraderV2,
  IGmxV2IsolationModeUnwrapperTraderV2__factory,
  IGmxV2IsolationModeVaultFactory__factory,
  IGmxV2IsolationModeWrapperTraderV2,
  IGmxV2IsolationModeWrapperTraderV2__factory,
  IGmxV2Registry__factory,
} from '@dolomite-exchange/modules-gmx-v2/src/types';
import { BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodeAddIsolationModeMarket,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Deploys new unwrapper / wrapper contracts for PT-wstETH (Jun 2024)
 * - Deploys new unwrapper / wrapper contracts for PT-wstETH (Jun 2025)
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const gmxV2RegistryImplementationAddress = await deployContractAndSave(
    'GmxV2Registry',
    [],
    'GmxV2RegistryImplementationV1',
  );
  const gmxV2RegistryImplementation = GmxV2Registry__factory.connect(gmxV2RegistryImplementationAddress, core.hhUser1);

  const gmxV2RegistryProxyAddress = await deployContractAndSave(
    'RegistryProxy',
    await getGmxV2RegistryConstructorParams(core, gmxV2RegistryImplementation, GMX_V2_CALLBACK_GAS_LIMIT),
    'GmxV2RegistryProxy',
  );
  const gmxV2RegistryProxy = IGmxV2Registry__factory.connect(gmxV2RegistryProxyAddress, core.hhUser1);

  const gmxV2LibraryAddress = await deployContractAndSave(
    'GmxV2Library',
    [],
    'GmxV2LibraryV1',
  );
  const gmxV2TokenVaultAddress = await deployContractAndSave(
    'GmxV2IsolationModeTokenVaultV1',
    [core.tokens.weth.address],
    'GmxV2IsolationModeTokenVaultV1',
    { GmxV2Library: gmxV2LibraryAddress },
  );
  const gmxV2TokenVault = GmxV2IsolationModeTokenVaultV1__factory.connect(gmxV2TokenVaultAddress, core.hhUser1);

  const stablecoins = [
    core.marketIds.usdc,
    core.marketIds.usdt,
    core.marketIds.nativeUsdc,
    core.marketIds.dai,
    core.marketIds.mim,
  ];
  const gmxV2PriceOracleAddress = await deployContractAndSave(
    'GmxV2MarketTokenPriceOracle',
    getGmxV2MarketTokenPriceOracleConstructorParams(core, gmxV2RegistryProxy),
    'GmxV2MarketTokenPriceOracleV1',
  );
  const gmxV2PriceOracle = GmxV2MarketTokenPriceOracle__factory.connect(gmxV2PriceOracleAddress, core.hhUser1);

  const gmTokens = [
    core.gmxEcosystemV2.gmTokens.arbUsd,
    core.gmxEcosystemV2.gmTokens.btcUsd,
    core.gmxEcosystemV2.gmTokens.ethUsd,
    core.gmxEcosystemV2.gmTokens.linkUsd,
  ];
  const supplyCaps = [
    parseEther(`${3_000_000}`),
    parseEther(`${5_000_000}`),
    parseEther(`${5_000_000}`),
    parseEther(`${2_000_000}`),
  ];
  const gmNames = [
    'ARB',
    'BTC',
    'ETH',
    'LINK',
  ];

  const asyncUnwrapperLibAddress = await deployContractAndSave(
    'AsyncIsolationModeUnwrapperTraderImpl',
    [],
    'AsyncIsolationModeUnwrapperTraderImplV1',
  );
  const unwrapperImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeUnwrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeUnwrapperTraderV2',
    { GmxV2Library: gmxV2LibraryAddress, AsyncIsolationModeUnwrapperTraderImpl: asyncUnwrapperLibAddress },
  );
  const unwrapperImplementation = GmxV2IsolationModeUnwrapperTraderV2__factory.connect(
    unwrapperImplementationAddress,
    core.hhUser1
  );

  const asyncWrapperLibAddress = await deployContractAndSave(
    'AsyncIsolationModeWrapperTraderImpl',
    [],
    'AsyncIsolationModeWrapperTraderImplV1',
  );
  const wrapperImplementationAddress = await deployContractAndSave(
    'GmxV2IsolationModeWrapperTraderV2',
    [core.tokens.weth.address],
    'GmxV2IsolationModeWrapperTraderV2',
    { GmxV2Library: gmxV2LibraryAddress, AsyncIsolationModeWrapperTraderImpl: asyncWrapperLibAddress },
  );
  const wrapperImplementation = GmxV2IsolationModeWrapperTraderV2__factory.connect(
    wrapperImplementationAddress,
    core.hhUser1
  );

  const factories: IIsolationModeVaultFactory[] = [];
  const unwrappers: IGmxV2IsolationModeUnwrapperTraderV2[] = [];
  const wrappers: IGmxV2IsolationModeWrapperTraderV2[] = [];

  for (let i = 0; i < gmTokens.length; i += 1) {
    const factoryAddress = await deployContractAndSave(
      'GmxV2IsolationModeVaultFactory',
      getGmxV2IsolationModeVaultFactoryConstructorParams(
        core,
        gmxV2RegistryProxy,
        [...stablecoins, gmTokens[i].longMarketId],
        [],
        gmTokens[i].marketToken,
        gmxV2TokenVault,
        GMX_V2_EXECUTION_FEE,
      ),
      `GmxV2${gmNames[i]}IsolationModeVaultFactory`,
    );
    const factory = IGmxV2IsolationModeVaultFactory__factory.connect(factoryAddress, core.hhUser1);

    const unwrapperProxyAddress = await deployContractAndSave(
      'GmxV2IsolationModeUnwrapperTraderV2',
      await getGmxV2IsolationModeUnwrapperTraderV2ConstructorParams(
        core,
        unwrapperImplementation,
        factory,
        gmxV2RegistryProxy,
      ),
      `GmxV2${gmNames[i]}IsolationModeUnwrapperTraderV2?`,
    );

    const wrapperProxyAddress = await deployContractAndSave(
      'GmxV2IsolationModeWrapperTraderV2',
      await getGmxV2IsolationModeWrapperTraderV2ConstructorParams(
        core,
        wrapperImplementation,
        factory,
        gmxV2RegistryProxy,
      ),
      `GmxV2${gmNames[i]}IsolationModeWrapperTraderV2?`,
    );

    factories.push(factory);
    unwrappers.push(IGmxV2IsolationModeUnwrapperTraderV2__factory.connect(unwrapperProxyAddress, core.hhUser1));
    wrappers.push(IGmxV2IsolationModeWrapperTraderV2__factory.connect(wrapperProxyAddress, core.hhUser1));
  }

  const freezableLiquidatorProxyAddress = await deployContractAndSave(
    'IsolationModeFreezableLiquidatorProxy',
    getIsolationModeFreezableLiquidatorProxyConstructorParams(core),
    'IsolationModeFreezableLiquidatorProxyV1',
  );
  const freezableLiquidatorProxy = IsolationModeFreezableLiquidatorProxy__factory.connect(
    freezableLiquidatorProxyAddress,
    core.hhUser1,
  );

  const marketId = await core.dolomiteMargin.getNumMarkets();
  const gmMarketIds: BigNumberish[] = [];
  for (let i = 0; i < 4; i++) {
    gmMarketIds.push(marketId.add(i));
  }

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [freezableLiquidatorProxy.address, true],
    ),
    ...await Promise.all(
      factories.map(factory =>
        prettyPrintEncodedDataWithTypeSafety(
          core,
          { gmxV2PriceOracle },
          'gmxV2PriceOracle',
          'ownerSetMarketToken',
          [factory.address, true],
        ),
      ),
    ),
    ...await Promise.all(
      gmMarketIds.map(marketId =>
        prettyPrintEncodedDataWithTypeSafety(
          core,
          core,
          'liquidatorAssetRegistry',
          'ownerAddLiquidatorToAssetWhitelist',
          [marketId, freezableLiquidatorProxyAddress],
        ),
      ),
    ),
    ...(
      await Promise.all(
        factories.map((factory, i) => prettyPrintEncodeAddIsolationModeMarket(
          core,
          factory,
          gmxV2PriceOracle,
          unwrappers[i],
          wrappers[i],
          gmMarketIds[i],
          TargetCollateralization._120,
          TargetLiquidationPenalty.Base,
          supplyCaps[i],
        )),
      )
    ).reduce((acc, cur) => acc.concat(cur), []),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    invariants: async () => {
      const OLD_DURATION = '';
      const NEW_DURATION = 86_400 * 7 * 40; // 40 weeks
      const nftId = '';
      assertHardhatInvariant(
        (await core.liquidityMiningEcosystem.oArbVesterV2.vestingPositions(nftId)).duration.eq(OLD_DURATION),
        'Invalid duration before',
      );

      const signer = await impersonate('');
      await core.liquidityMiningEcosystem.oArbVesterV2.connect(signer)
        .extendDurationForPosition(nftId, NEW_DURATION);

      assertHardhatInvariant(
        (await core.liquidityMiningEcosystem.oArbVesterV2.vestingPositions(nftId)).duration.eq(NEW_DURATION),
        'Invalid duration after',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
