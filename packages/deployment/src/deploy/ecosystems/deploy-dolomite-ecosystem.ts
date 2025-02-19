import CoreDeployments from '@dolomite-exchange/dolomite-margin/dist/migrations/deployed.json';
import {
  DolomiteRegistryImplementation__factory,
  EventEmitterRegistry__factory,
  GenericTraderProxyV2__factory,
  IDolomiteOwner__factory,
  IDolomiteRegistry__factory,
  ILiquidatorAssetRegistry__factory,
  IPartiallyDelayedMultiSig__factory,
  RegistryProxy__factory,
} from '@dolomite-exchange/modules-base/src/types';
import {
  GNOSIS_SAFE_MAP,
  PAYABLE_TOKEN_MAP,
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
  CoreProtocolType,
  getDolomiteMarginContract,
  getExpiryContract,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import * as CoreDeployment from '@dolomite-margin/dist/migrations/deployed.json';
import { ethers } from 'hardhat';
import {
  CoreProtocolParams,
} from 'packages/base/test/utils/core-protocols/core-protocol-abstract';
import ModuleDeployments from 'packages/deployment/src/deploy/deployments.json';
import {
  deployContractAndSave,
  getMaxDeploymentVersionNameByDeploymentKey,
  TRANSACTION_BUILDER_VERSION,
} from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../utils/encoding/base-encoder-utils';
import getScriptName from '../../utils/get-script-name';
import { deployDolomiteAccountRegistry } from './helpers/deploy-dolomite-account-registry';
import { deployInterestSetters } from './helpers/deploy-interest-setters';
import { deployOracleAggregator } from './helpers/deploy-oracle-aggregator';
import { encodeDolomiteOwnerMigrations } from './helpers/encode-dolomite-owner-migrations';
import { encodeDolomiteRegistryMigrations } from './helpers/encode-dolomite-registry-migrations';
import { encodeIsolationModeFreezableLiquidatorMigrations } from './helpers/encode-isolation-mode-freezable-liquidator-migrations';
import { encodeDolomiteRouterMigrations } from './helpers/encode-dolomite-router-migrations';
import { getDeployedVaults } from 'packages/base/test/utils/ecosystem-utils/deployed-vaults';
import { encodeDolomiteAccountRegistryMigrations } from './helpers/encode-dolomite-account-registry-migrations';

const THIRTY_MINUTES_SECONDS = 60 * 30;
const HANDLER_ADDRESS = '0xdF86dFdf493bCD2b838a44726A1E58f66869ccBe'; // Level Initiator

async function main<T extends NetworkType>(): Promise<DryRunOutput<T>> {
  const network = (await getAnyNetwork()) as T;
  if (!(ModuleDeployments.CREATE3Factory as any)?.[network]) {
    return Promise.reject(new Error('CREATE3 not found! Please deploy first!'));
  }

  const config: any = {
    network,
    networkNumber: parseInt(network, 10),
  };
  await resetForkIfPossible(await getRealLatestBlockNumber(true, network), network);
  const [hhUser1] = await Promise.all(
    (await ethers.getSigners()).map((s) => SignerWithAddressWithSafety.create(s.address)),
  );
  const gnosisSafeAddress = GNOSIS_SAFE_MAP[network];
  const gnosisSafeSigner = await impersonateOrFallback(gnosisSafeAddress, true, hhUser1);
  const transactions: EncodedTransaction[] = [];

  const delayedMultiSig = IPartiallyDelayedMultiSig__factory.connect(
    CoreDeployment.PartiallyDelayedMultiSig[network].address,
    gnosisSafeSigner,
  );
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
    [],
    getMaxDeploymentVersionNameByDeploymentKey('DolomiteERC4626WithPayableImplementation', 1),
  );
  const dolomiteOwnerAddress = await deployContractAndSave(
    'DolomiteOwnerV1',
    getDolomiteOwnerConstructorParams(GNOSIS_SAFE_MAP[network], THIRTY_MINUTES_SECONDS),
    'DolomiteOwnerV1',
  );
  const dolomiteOwnerV1 = IDolomiteOwner__factory.connect(dolomiteOwnerAddress, gnosisSafeSigner);
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

  const [ dolomiteAccountRegistryImplementationAddress, dolomiteAccountRegistryProxy ] = await deployDolomiteAccountRegistry(dolomiteMargin, hhUser1, network);

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
    CoreDeployments.BorrowPositionProxyV2[network].address,
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

  const genericTraderProxyV2LibAddress = await deployContractAndSave(
    'GenericTraderProxyV2Lib',
    [],
    getMaxDeploymentVersionNameByDeploymentKey('GenericTraderProxyV2Lib', 1),
  );
  const genericTraderProxyV2Address = await deployContractAndSave(
    'GenericTraderProxyV2',
    [network, dolomiteRegistry.address, dolomiteMargin.address],
    getMaxDeploymentVersionNameByDeploymentKey('GenericTraderProxy', 2),
    { GenericTraderProxyV2Lib: genericTraderProxyV2LibAddress },
  );
  const genericTraderProxy = GenericTraderProxyV2__factory.connect(genericTraderProxyV2Address, hhUser1) as any;

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

  const depositWithdrawalRouterAddress = await deployContractAndSave(
    'DepositWithdrawalRouter',
    [PAYABLE_TOKEN_MAP[network].address, dolomiteRegistry.address, dolomiteMargin.address],
    getMaxDeploymentVersionNameByDeploymentKey('DepositWithdrawalRouter', 1),
  );

  const borrowPositionRouterAddress = await deployContractAndSave(
    'BorrowPositionRouter',
    [dolomiteRegistry.address, dolomiteMargin.address],
    getMaxDeploymentVersionNameByDeploymentKey('BorrowPositionRouter', 1),
  );

  const genericTraderRouterAddress = await deployContractAndSave(
    'GenericTraderRouter',
    [dolomiteRegistry.address, dolomiteMargin.address],
    getMaxDeploymentVersionNameByDeploymentKey('GenericTraderRouter', 1),
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

  // We can't set up the core protocol here because there are too many missing contracts/context
  const governanceAddress = await dolomiteMargin.connect(hhUser1).owner();
  const governance = await impersonateOrFallback(governanceAddress, true, hhUser1);
  const core = {
    config,
    delayedMultiSig,
    dolomiteMargin,
    dolomiteRegistry,
    governance,
    hhUser1,
    liquidatorAssetRegistry,
    genericTraderProxy, // @follow-up Corey can you double check how I deploy the new generic trader proxy?
    gnosisSafe: gnosisSafeSigner,
    gnosisSafeAddress: gnosisSafeAddress,
    ownerAdapterV1: dolomiteOwnerV1,
    ownerAdapterV2: dolomiteOwnerV1, // TODO: fix after review + test
  } as CoreProtocolType<T>;

  await encodeDolomiteAccountRegistryMigrations(
    dolomiteAccountRegistryProxy,
    dolomiteAccountRegistryImplementationAddress,
    transactions,
    core,
  );

  await encodeDolomiteRegistryMigrations(
    dolomiteRegistry,
    dolomiteRegistryProxy,
    CoreDeployments.BorrowPositionProxyV2[network].address,
    dolomiteAccountRegistryProxy,
    dolomiteMigratorAddress,
    genericTraderProxy,
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

  await encodeIsolationModeFreezableLiquidatorMigrations(
    core,
    isolationModeFreezableLiquidatorProxyAddress,
    transactions,
  );

  const deployedVaults = await getDeployedVaults(config, dolomiteMargin, governance);
  await encodeDolomiteRouterMigrations(
    core,
    [depositWithdrawalRouterAddress, borrowPositionRouterAddress, genericTraderRouterAddress],
    deployedVaults,
    transactions,
  );

  // This must be the last encoded transaction
  await encodeDolomiteOwnerMigrations(dolomiteOwnerV1, transactions, core);

  return {
    core: {
      ...(core as any as CoreProtocolParams<T>),
      config: {
        network,
      },
    } as any,
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
