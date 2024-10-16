import CoreDeployments from '@dolomite-exchange/dolomite-margin/dist/migrations/deployed.json';
import {
  DolomiteAccountRegistry__factory,
  DolomiteRegistryImplementation__factory,
  EventEmitterRegistry__factory,
  IDolomiteMargin,
  IDolomiteRegistry,
  IDolomiteRegistry__factory,
  IERC20__factory,
  IERC20Metadata__factory,
  IGenericTraderProxyV1,
  IGenericTraderProxyV1__factory,
  IIsolationModeTokenVaultV1__factory,
  ILiquidatorAssetRegistry__factory,
  IPartiallyDelayedMultiSig__factory,
  RegistryProxy,
  RegistryProxy__factory,
} from '@dolomite-exchange/modules-base/src/types';
import {
  CHAINLINK_PRICE_AGGREGATORS_MAP,
  INVALID_TOKEN_MAP,
  SLIPPAGE_TOLERANCE_FOR_PAUSE_SENTINEL,
} from '@dolomite-exchange/modules-base/src/utils/constants';
import {
  getDolomiteMigratorConstructorParams,
  getIsolationModeFreezableLiquidatorProxyConstructorParamsWithoutCore,
  getRegistryProxyConstructorParams,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAnyNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, NetworkType } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '@dolomite-exchange/modules-base/src/utils/SignerWithAddressWithSafety';
import {
  getRealLatestBlockNumber,
  impersonateOrFallback,
  resetForkIfPossible,
} from '@dolomite-exchange/modules-base/test/utils';
import { DolomiteMargin } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { getDolomiteMarginContract, getExpiryContract } from '@dolomite-exchange/modules-base/test/utils/setup';
import { getLinearStepFunctionInterestSetterConstructorParams } from '@dolomite-exchange/modules-interest-setters/src/interest-setters-constructors';
import { TokenInfo } from '@dolomite-exchange/modules-oracles/src';
import { getChainlinkPriceOracleV3ConstructorParams as getChainlinkPriceOracleV3ConstructorParams } from '@dolomite-exchange/modules-oracles/src/oracles-constructors';
import {
  IChainlinkAggregator__factory,
  OracleAggregatorV2,
  OracleAggregatorV2__factory,
} from '@dolomite-exchange/modules-oracles/src/types';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { isArraysEqual } from 'packages/base/src/utils';
import { CoreProtocolAbstract } from 'packages/base/test/utils/core-protocols/core-protocol-abstract';
import ModuleDeployments from '../../deploy/deployments.json';
import {
  deployContractAndSave,
  EncodedTransaction,
  getMaxDeploymentVersionNameByDeploymentKey,
  getOldDeploymentVersionNamesByDeploymentKey,
  prettyPrintEncodedDataWithTypeSafety,
  readDeploymentFile,
  TRANSACTION_BUILDER_VERSION,
} from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../utils/dry-run-utils';
import getScriptName from '../../utils/get-script-name';

const handlerAddress = '0xdF86dFdf493bCD2b838a44726A1E58f66869ccBe'; // Level Initiator

async function deployInterestSetters(): Promise<void> {
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.06'), parseEther('0.94'), parseEther('0.70')),
    'LinearStepFunction6L94U70OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.06'), parseEther('0.94'), parseEther('0.80')),
    'LinearStepFunction6L94U80OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.06'), parseEther('0.94'), parseEther('0.90')),
    'LinearStepFunction6L94U90OInterestSetter',
  );

  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.08'), parseEther('0.92'), parseEther('0.70')),
    'LinearStepFunction8L92U70OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.08'), parseEther('0.92'), parseEther('0.80')),
    'LinearStepFunction8L92U80OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.08'), parseEther('0.92'), parseEther('0.90')),
    'LinearStepFunction8L92U90OInterestSetter',
  );

  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.10'), parseEther('0.90'), parseEther('0.90')),
    'LinearStepFunction10L90U90OInterestSetter',
  );

  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.10'), parseEther('0.90'), parseEther('0.95')),
    'LinearStepFunction10L90U95OInterestSetter',
  );

  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.12'), parseEther('0.88'), parseEther('0.90')),
    'LinearStepFunction12L88U90OInterestSetter',
  );

  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.14'), parseEther('0.86'), parseEther('0.90')),
    'LinearStepFunction14L86U90OInterestSetter',
  );

  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.15'), parseEther('1.35'), parseEther('0.70')),
    'LinearStepFunction15L135U70OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.15'), parseEther('1.35'), parseEther('0.75')),
    'LinearStepFunction15L135U75OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.15'), parseEther('1.35'), parseEther('0.80')),
    'LinearStepFunction15L135U80OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.15'), parseEther('1.35'), parseEther('0.85')),
    'LinearStepFunction15L135U85OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.15'), parseEther('1.35'), parseEther('0.90')),
    'LinearStepFunction15L135U90OInterestSetter',
  );

  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.16'), parseEther('0.84'), parseEther('0.70')),
    'LinearStepFunction16L84U70OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.16'), parseEther('0.84'), parseEther('0.80')),
    'LinearStepFunction16L84U80OInterestSetter',
  );
  await deployContractAndSave(
    'LinearStepFunctionInterestSetter',
    getLinearStepFunctionInterestSetterConstructorParams(parseEther('0.16'), parseEther('0.84'), parseEther('0.90')),
    'LinearStepFunction16L84U90OInterestSetter',
  );
}

async function getOracleAggregator<T extends NetworkType>(
  network: T,
  dolomiteRegistry: IDolomiteRegistry,
  dolomiteMargin: DolomiteMargin<T>,
): Promise<OracleAggregatorV2> {
  const tokens = Object.keys(CHAINLINK_PRICE_AGGREGATORS_MAP[network]).map((t) =>
    IERC20__factory.connect(t, dolomiteMargin.signer),
  );

  const aggregators = tokens.map((t) =>
    IChainlinkAggregator__factory.connect(
      CHAINLINK_PRICE_AGGREGATORS_MAP[network][t.address]!.aggregatorAddress,
      dolomiteMargin.signer,
    ),
  );
  const decimals = await Promise.all(
    tokens.map((token) => {
      const invalidTokenSettings = INVALID_TOKEN_MAP[network][token.address];
      if (invalidTokenSettings) {
        return Promise.resolve(invalidTokenSettings.decimals);
      }

      return IERC20Metadata__factory.connect(token.address, token.signer).decimals();
    }),
  );
  const tokenPairs = tokens.map((t) =>
    IERC20__factory.connect(
      CHAINLINK_PRICE_AGGREGATORS_MAP[network][t.address]!.tokenPairAddress ?? ADDRESS_ZERO,
      dolomiteMargin.signer,
    ),
  );
  const invertPrices = tokens.map(() => false);
  const chainlinkPriceOracleAddress = await deployContractAndSave(
    'ChainlinkPriceOracleV3',
    getChainlinkPriceOracleV3ConstructorParams<T>(tokens, aggregators, invertPrices, dolomiteRegistry, dolomiteMargin),
    getMaxDeploymentVersionNameByDeploymentKey('ChainlinkPriceOracle', 3),
  );

  const tokenInfos = tokens.map<TokenInfo>((token, i) => {
    return {
      token: token.address,
      decimals: decimals[i],
      oracleInfos: [
        {
          oracle: chainlinkPriceOracleAddress,
          weight: 100,
          tokenPair: tokenPairs[i].address,
        },
      ],
    };
  });
  const oracleAggregatorAddress = await deployContractAndSave(
    'OracleAggregatorV2',
    [tokenInfos as any[], dolomiteMargin.address],
    getMaxDeploymentVersionNameByDeploymentKey('OracleAggregator', 2),
  );
  return OracleAggregatorV2__factory.connect(oracleAggregatorAddress, dolomiteMargin.signer);
}

async function deployDolomiteAccountRegistry<T extends NetworkType>(
  dolomiteMargin: DolomiteMargin<T>,
  signer: SignerWithAddressWithSafety,
  network: T,
): Promise<RegistryProxy> {
  const dolomiteAccountRegistryImplementationAddress = await deployContractAndSave(
    'DolomiteAccountRegistry',
    [],
    getMaxDeploymentVersionNameByDeploymentKey('DolomiteAccountRegistryImplementation', 1),
  );
  const dolomiteAccountRegistryImplementation = DolomiteAccountRegistry__factory.connect(
    dolomiteAccountRegistryImplementationAddress,
    signer,
  );
  const factories = [] as string[];

  if (!(ModuleDeployments as any)['DolomiteAccountRegistryProxy'][network]) {
    const marketsLength = await dolomiteMargin.getNumMarkets();
    for (let i = 0; i < marketsLength.toNumber(); i++) {
      const tokenAddress = await dolomiteMargin.getMarketTokenAddress(i);
      const name = await IERC20Metadata__factory.connect(tokenAddress, signer).name();
      if (name.startsWith('Dolomite Isolation:') || name.startsWith('Dolomite:')) {
        factories.push(tokenAddress);
      }
    }
  }

  const calldata = await dolomiteAccountRegistryImplementation.populateTransaction.initialize(factories);

  const registryProxyAddress = await deployContractAndSave(
    'RegistryProxy',
    getRegistryProxyConstructorParams(dolomiteAccountRegistryImplementation.address, calldata.data!, dolomiteMargin),
    'DolomiteAccountRegistryProxy',
  );
  return RegistryProxy__factory.connect(registryProxyAddress, signer);
}

async function main<T extends NetworkType>(): Promise<DryRunOutput<T>> {
  const network = (await getAnyNetwork()) as T;
  const config: any = {
    network,
    networkNumber: parseInt(network, 10),
  };
  await resetForkIfPossible(await getRealLatestBlockNumber(true, network), network);
  const [hhUser1] = await Promise.all(
    (await ethers.getSigners()).map((s) => SignerWithAddressWithSafety.create(s.address)),
  );
  const transactions: EncodedTransaction[] = [];

  const dolomiteMargin = getDolomiteMarginContract<T>(config, hhUser1);
  const expiry = getExpiryContract<T>(config, hhUser1);

  const liquidatorAssetRegistry = ILiquidatorAssetRegistry__factory.connect(
    CoreDeployments.LiquidatorAssetRegistry[network].address,
    hhUser1,
  );

  const eventEmitterRegistryImplementationAddress = await deployContractAndSave(
    'EventEmitterRegistry',
    [],
    getMaxDeploymentVersionNameByDeploymentKey('EventEmitterRegistryImplementation', 1),
  );
  const eventEmitterRegistryImplementation = EventEmitterRegistry__factory.connect(
    eventEmitterRegistryImplementationAddress,
    hhUser1,
  );
  const eventEmitterRegistryCalldata = await eventEmitterRegistryImplementation.populateTransaction.initialize();
  const eventEmitterProxyAddress = await deployContractAndSave(
    'RegistryProxy',
    getRegistryProxyConstructorParams(
      eventEmitterRegistryImplementationAddress,
      eventEmitterRegistryCalldata.data!,
      dolomiteMargin,
    ),
    'EventEmitterRegistryProxy',
  );
  const eventEmitterProxy = RegistryProxy__factory.connect(eventEmitterProxyAddress, hhUser1);

  const dolomiteAccountRegistryProxy = await deployDolomiteAccountRegistry(dolomiteMargin, hhUser1, network);

  const registryImplementationAddress = await deployContractAndSave(
    'DolomiteRegistryImplementation',
    [],
    getMaxDeploymentVersionNameByDeploymentKey('DolomiteRegistryImplementation', 1),
  );
  const registryImplementation = DolomiteRegistryImplementation__factory.connect(
    registryImplementationAddress,
    hhUser1,
  );
  const registryImplementationCalldata = await registryImplementation.populateTransaction.initialize(
    CoreDeployments.GenericTraderProxyV1[network].address,
    CoreDeployments.Expiry[network].address,
    SLIPPAGE_TOLERANCE_FOR_PAUSE_SENTINEL,
    CoreDeployments.LiquidatorAssetRegistry[network].address,
    eventEmitterProxyAddress,
    dolomiteAccountRegistryProxy.address,
  );
  const dolomiteRegistryAddress = await deployContractAndSave(
    'RegistryProxy',
    getRegistryProxyConstructorParams(
      registryImplementationAddress,
      registryImplementationCalldata.data!,
      dolomiteMargin,
    ),
    'DolomiteRegistryProxy',
  );
  const dolomiteRegistry = IDolomiteRegistry__factory.connect(dolomiteRegistryAddress, hhUser1);
  const dolomiteRegistryProxy = RegistryProxy__factory.connect(dolomiteRegistryAddress, hhUser1);

  const dolomiteMigratorAddress = await deployContractAndSave(
    'DolomiteMigrator',
    getDolomiteMigratorConstructorParams(dolomiteMargin, dolomiteRegistry, handlerAddress),
    getMaxDeploymentVersionNameByDeploymentKey('DolomiteMigrator', 1),
  );
  const oracleAggregator = await getOracleAggregator(network, dolomiteRegistry, dolomiteMargin);

  const isolationModeFreezableLiquidatorProxyAddress = await deployContractAndSave(
    'IsolationModeFreezableLiquidatorProxy',
    getIsolationModeFreezableLiquidatorProxyConstructorParamsWithoutCore(
      dolomiteRegistry,
      liquidatorAssetRegistry,
      dolomiteMargin,
      expiry,
      config,
    ),
    getMaxDeploymentVersionNameByDeploymentKey('IsolationModeFreezableLiquidatorProxy', 1),
  );

  const safeDelegateCallLibAddress = await deployContractAndSave(
    'SafeDelegateCallLib',
    [],
    getMaxDeploymentVersionNameByDeploymentKey('SafeDelegateCallLib', 1),
  );

  await deployContractAndSave(
    'IsolationModeTokenVaultV1ActionsImpl',
    [],
    getMaxDeploymentVersionNameByDeploymentKey('IsolationModeTokenVaultV1ActionsImpl', 1),
    { SafeDelegateCallLib: safeDelegateCallLibAddress },
  );

  await deployContractAndSave(
    'AsyncIsolationModeUnwrapperTraderImpl',
    [],
    getMaxDeploymentVersionNameByDeploymentKey('AsyncIsolationModeUnwrapperTraderImpl', 1),
  );

  await deployContractAndSave(
    'AsyncIsolationModeWrapperTraderImpl',
    [],
    getMaxDeploymentVersionNameByDeploymentKey('AsyncIsolationModeWrapperTraderImpl', 1),
  );

  await deployInterestSetters();

  if (network === '80084') {
    // Berachain testnet
    await deployContractAndSave('TestPriceOracle', []);
  }

  // We can't set up the core protocol here because there are too many missing contracts/context
  const genericTraderAddress = CoreDeployments.GenericTraderProxyV1[network].address;
  const governanceAddress = await dolomiteMargin.connect(hhUser1).owner();
  const governance = await impersonateOrFallback(governanceAddress, true, hhUser1);
  const core = {
    config,
    dolomiteMargin,
    dolomiteRegistry,
    hhUser1,
    delayedMultiSig: IPartiallyDelayedMultiSig__factory.connect(governanceAddress, governance),
    genericTraderProxy: IGenericTraderProxyV1__factory.connect(genericTraderAddress, governance),
  } as any;

  await encodeDolomiteRegistryMigrations(
    dolomiteRegistry,
    dolomiteRegistryProxy,
    dolomiteAccountRegistryProxy.address,
    dolomiteMigratorAddress,
    oracleAggregator.address,
    registryImplementationAddress,
    transactions,
    core,
  );

  if ((await eventEmitterProxy.implementation()) !== eventEmitterRegistryImplementation.address) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(core, { eventEmitterProxy }, 'eventEmitterProxy', 'upgradeTo', [
        eventEmitterRegistryImplementation.address,
      ]),
    );
  }

  const genericTraderProxy = core.genericTraderProxy as IGenericTraderProxyV1;
  if ((await genericTraderProxy.EVENT_EMITTER_REGISTRY()) !== eventEmitterProxy.address) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { genericTraderProxy },
        'genericTraderProxy',
        'ownerSetEventEmitterRegistry',
        [eventEmitterProxy.address],
      ),
    );
  }

  if (!(await core.dolomiteMargin.getIsGlobalOperator(isolationModeFreezableLiquidatorProxyAddress))) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomite: dolomiteMargin as IDolomiteMargin },
        'dolomite',
        'ownerSetGlobalOperator',
        [isolationModeFreezableLiquidatorProxyAddress, true],
      ),
    );

    const oldFreezableLiquidatorNames = getOldDeploymentVersionNamesByDeploymentKey(
      'IsolationModeFreezableLiquidatorProxy',
      1,
    );
    const oldFreezableLiquidatorAddresses: string[] = [];
    for (let i = 0; i < oldFreezableLiquidatorNames.length; i++) {
      const oldVersion = readDeploymentFile()[oldFreezableLiquidatorNames[i]][network]?.address;
      if (oldVersion) {
        oldFreezableLiquidatorAddresses.push(oldVersion);
      }

      if (oldVersion && (await core.dolomiteMargin.getIsGlobalOperator(oldVersion))) {
        transactions.push(
          await prettyPrintEncodedDataWithTypeSafety(
            core,
            { dolomite: dolomiteMargin as IDolomiteMargin },
            'dolomite',
            'ownerSetGlobalOperator',
            [oldVersion, false],
          ),
        );
      }
    }

    const numMarkets = await dolomiteMargin.getNumMarkets();
    for (let i = 0; i < numMarkets.toNumber(); i++) {
      const liquidators = await liquidatorAssetRegistry.getLiquidatorsForAsset(i);
      for (let j = 0; j < oldFreezableLiquidatorAddresses.length; j++) {
        if (liquidators.some((l) => l === oldFreezableLiquidatorAddresses[j])) {
          transactions.push(
            await prettyPrintEncodedDataWithTypeSafety(
              core,
              { registry: liquidatorAssetRegistry },
              'registry',
              'ownerRemoveLiquidatorFromAssetWhitelist',
              [i, oldFreezableLiquidatorAddresses[j]],
            ),
            await prettyPrintEncodedDataWithTypeSafety(
              core,
              { registry: liquidatorAssetRegistry },
              'registry',
              'ownerAddLiquidatorToAssetWhitelist',
              [i, isolationModeFreezableLiquidatorProxyAddress],
            ),
          );
        }
      }
    }
  }

  return {
    core: {
      delayedMultiSig: IPartiallyDelayedMultiSig__factory.connect(
        CoreDeployments.PartiallyDelayedMultiSig[network].address,
        hhUser1,
      ),
      config: {
        network,
      },
    } as CoreProtocolAbstract<T> as any,
    invariants: async () => {},
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
      meta: {
        name: 'Dolomite Ecosystem',
        txBuilderVersion: TRANSACTION_BUILDER_VERSION,
      },
    },
  };
}

async function encodeDolomiteRegistryMigrations(
  dolomiteRegistry: IDolomiteRegistry,
  dolomiteRegistryProxy: RegistryProxy,
  dolomiteAccountRegistryAddress: string,
  dolomiteMigratorAddress: string,
  oracleAggregatorAddress: string,
  registryImplementationAddress: string,
  transactions: EncodedTransaction[],
  core: any,
) {
  if ((await dolomiteRegistryProxy.implementation()) !== registryImplementationAddress) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteRegistryProxy },
        'dolomiteRegistryProxy',
        'upgradeTo',
        [registryImplementationAddress],
      ),
    );
  }

  let needsRegistryDolomiteAccountRegistryEncoding = true;
  try {
    const foundDolomiteAccountRegistryAddress = await dolomiteRegistry.dolomiteAccountRegistry();
    needsRegistryDolomiteAccountRegistryEncoding =
      foundDolomiteAccountRegistryAddress !== dolomiteAccountRegistryAddress;
  } catch (e) {}
  if (needsRegistryDolomiteAccountRegistryEncoding) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteRegistry },
        'dolomiteRegistry',
        'ownerSetDolomiteAccountRegistry',
        [dolomiteAccountRegistryAddress],
      ),
    );
  }

  let needsRegistryMigratorEncoding = true;
  let needsRegistryOracleAggregatorEncoding = true;
  try {
    const foundDolomiteMigratorAddress = await dolomiteRegistry.dolomiteMigrator();
    const foundOracleAggregatorAddress = await dolomiteRegistry.oracleAggregator();
    if (foundDolomiteMigratorAddress === ADDRESS_ZERO && foundOracleAggregatorAddress === ADDRESS_ZERO) {
      needsRegistryMigratorEncoding = false;
      needsRegistryOracleAggregatorEncoding = false;
      await dolomiteRegistry.lazyInitialize(dolomiteMigratorAddress, oracleAggregatorAddress);
    } else if (
      foundDolomiteMigratorAddress === dolomiteMigratorAddress &&
      foundOracleAggregatorAddress === oracleAggregatorAddress
    ) {
      needsRegistryMigratorEncoding = false;
      needsRegistryOracleAggregatorEncoding = false;
    } else if (foundDolomiteMigratorAddress === dolomiteMigratorAddress) {
      needsRegistryMigratorEncoding = false;
    } else if (foundOracleAggregatorAddress === oracleAggregatorAddress) {
      needsRegistryOracleAggregatorEncoding = false;
    }
  } catch (e) {}
  if (needsRegistryMigratorEncoding) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteRegistry },
        'dolomiteRegistry',
        'ownerSetDolomiteMigrator',
        [dolomiteMigratorAddress],
      ),
    );
  }
  if (needsRegistryOracleAggregatorEncoding) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteRegistry },
        'dolomiteRegistry',
        'ownerSetOracleAggregator',
        [oracleAggregatorAddress],
      ),
    );
  }

  let selectors: string[];
  try {
    selectors = await dolomiteRegistry.isolationModeMulticallFunctions();
  } catch (e) {
    selectors = [];
  }
  const functionNames = [
    'depositIntoVaultForDolomiteMargin',
    'withdrawFromVaultForDolomiteMargin',
    'openBorrowPosition',
    'openMarginPosition',
    'transferIntoPositionWithUnderlyingToken',
    'transferIntoPositionWithOtherToken',
    'transferFromPositionWithUnderlyingToken',
    'transferFromPositionWithOtherToken',
    'swapExactInputForOutput',
    'closeBorrowPositionWithUnderlyingVaultToken',
    'closeBorrowPositionWithOtherTokens',
  ];
  const expectedSelectors = functionNames
    .map((name) => IIsolationModeTokenVaultV1__factory.createInterface().getSighash(name))
    .sort((a, b) => parseInt(a, 16) - parseInt(b, 16));
  if (!isArraysEqual(selectors, expectedSelectors)) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteRegistry },
        'dolomiteRegistry',
        'ownerSetIsolationModeMulticallFunctions',
        [expectedSelectors],
      ),
    );
  }
}

// noinspection JSIgnoredPromiseFromCall
doDryRunAndCheckDeployment(main);
