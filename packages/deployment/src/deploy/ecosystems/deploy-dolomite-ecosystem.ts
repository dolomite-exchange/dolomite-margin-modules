import CoreDeployments from '@dolomite-exchange/dolomite-margin/dist/migrations/deployed.json';
import {
  DolomiteRegistryImplementation__factory,
  EventEmitterRegistry__factory,
  IDolomiteMargin, IDolomiteOwner__factory,
  IDolomiteRegistry__factory,
  IGenericTraderProxyV1,
  IGenericTraderProxyV1__factory,
  ILiquidatorAssetRegistry__factory,
  IPartiallyDelayedMultiSig__factory,
  RegistryProxy__factory,
} from '@dolomite-exchange/modules-base/src/types';
import {
  GNOSIS_SAFE_MAP,
  SLIPPAGE_TOLERANCE_FOR_PAUSE_SENTINEL,
} from '@dolomite-exchange/modules-base/src/utils/constants';
import {
  getDolomiteMigratorConstructorParams,
  getDolomiteOwnerConstructorParams,
  getIsolationModeFreezableLiquidatorProxyConstructorParamsWithoutCore,
  getRegistryProxyConstructorParams,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAnyNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { NetworkType } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '@dolomite-exchange/modules-base/src/utils/SignerWithAddressWithSafety';
import {
  getRealLatestBlockNumber,
  impersonateOrFallback,
  resetForkIfPossible,
} from '@dolomite-exchange/modules-base/test/utils';
import {
  getDolomiteMarginContract,
  getExpiryContract,
  getPayableToken,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { ethers } from 'hardhat';
import { CoreProtocolAbstract } from 'packages/base/test/utils/core-protocols/core-protocol-abstract';
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
import { deployDolomiteAccountRegistry } from './helpers/deploy-dolomite-account-registry';
import { deployInterestSetters } from './helpers/deploy-interest-setters';
import { deployOracleAggregator } from './helpers/deploy-oracle-aggregator';
import { encodeDolomiteOwnerMigrations } from './helpers/encode-dolomite-owner-migrations';
import { encodeDolomiteRegistryMigrations } from './helpers/encode-dolomite-registry-migrations';

const THIRTY_MINUTES_SECONDS = 60 * 30;
const HANDLER_ADDRESS = '0xdF86dFdf493bCD2b838a44726A1E58f66869ccBe'; // Level Initiator

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

  await deployContractAndSave(
    'DolomiteERC4626',
    [],
    getMaxDeploymentVersionNameByDeploymentKey('DolomiteERC4626Implementation', 1),
  );
  await deployContractAndSave(
    'DolomiteERC4626WithPayable',
    [getPayableToken(network, hhUser1).address],
    getMaxDeploymentVersionNameByDeploymentKey('DolomiteERC4626WithPayableImplementation', 1),
  );
  const dolomiteOwnerAddress = await deployContractAndSave(
    'DolomiteOwner',
    getDolomiteOwnerConstructorParams(GNOSIS_SAFE_MAP[network], THIRTY_MINUTES_SECONDS),
    'DolomiteOwnerV1',
  );
  const dolomiteOwner = IDolomiteOwner__factory.connect(dolomiteOwnerAddress, hhUser1);
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
    getDolomiteMigratorConstructorParams(dolomiteMargin, dolomiteRegistry, HANDLER_ADDRESS),
    getMaxDeploymentVersionNameByDeploymentKey('DolomiteMigrator', 1),
  );
  const oracleAggregator = await deployOracleAggregator(network, dolomiteRegistry, dolomiteMargin);

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

  await encodeDolomiteOwnerMigrations(dolomiteOwner, transactions, core);

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

// noinspection JSIgnoredPromiseFromCall
doDryRunAndCheckDeployment(main);
