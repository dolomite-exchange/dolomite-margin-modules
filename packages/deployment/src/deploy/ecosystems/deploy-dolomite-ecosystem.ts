import CoreDeployments from '@dolomite-exchange/dolomite-margin/dist/migrations/deployed.json';
import { getDolomiteOwnerConstructorParams } from '@dolomite-exchange/modules-admin/src/admin';
import { DolomiteOwnerV1__factory, DolomiteOwnerV2__factory } from '@dolomite-exchange/modules-admin/src/types';
import {
  BorrowPositionRouter__factory,
  DepositWithdrawalRouter__factory,
  EventEmitterRegistry__factory,
  GenericTraderProxyV2__factory,
  GenericTraderRouter__factory,
  IDepositWithdrawalProxy__factory,
  ILiquidatorAssetRegistry__factory,
  ILiquidatorProxyV5__factory,
  IPartiallyDelayedMultiSig__factory,
  RegistryProxy__factory,
} from '@dolomite-exchange/modules-base/src/types';
import { GNOSIS_SAFE_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import {
  getDolomiteErc4626ImplementationConstructorParams,
  getDolomiteMigratorConstructorParams,
  getIsolationModeFreezableLiquidatorProxyConstructorParamsWithoutCore,
  getRegistryProxyConstructorParams,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAnyNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { DolomiteNetwork } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
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
import { CoreProtocolParams } from 'packages/base/test/utils/core-protocols/core-protocol-abstract';
import { getDeployedVaults } from 'packages/base/test/utils/ecosystem-utils/deployed-vaults';
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
import { deployDolomiteAccountRiskOverrideSetter } from './helpers/deploy-dolomite-account-risk-override-setter';
import { deployDolomiteAdminContracts } from './helpers/deploy-dolomite-admin-contracts';
import { deployDolomiteRegistry } from './helpers/deploy-dolomite-registry';
import { deployInterestSetters } from './helpers/deploy-interest-setters';
import { deployOracleAggregator } from './helpers/deploy-oracle-aggregator';
import { encodeDolomiteAccountRegistryMigrations } from './helpers/encode-dolomite-account-registry-migrations';
import { encodeDolomiteAccountRiskOverrideSetterMigrations } from './helpers/encode-dolomite-account-risk-override-setter-migrations';
import { encodeDolomiteOwnerMigrations } from './helpers/encode-dolomite-owner-migrations';
import { encodeDolomiteRegistryMigrations } from './helpers/encode-dolomite-registry-migrations';
import { encodeDolomiteRouterMigrations } from './helpers/encode-dolomite-router-migrations';
import { encodeIsolationModeFreezableLiquidatorMigrations } from './helpers/encode-isolation-mode-freezable-liquidator-migrations';

const FIVE_MINUTES_SECONDS = 60 * 5;
const HANDLER_ADDRESS = '0xdF86dFdf493bCD2b838a44726A1E58f66869ccBe'; // Level Initiator

async function main<T extends DolomiteNetwork>(): Promise<DryRunOutput<T>> {
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
  const depositWithdrawalProxy = IDepositWithdrawalProxy__factory.connect(
    CoreDeployment.DepositWithdrawalProxy[network].address,
    hhUser1,
  );
  const dolomiteMargin = getDolomiteMarginContract<T>(config, hhUser1);
  const expiry = getExpiryContract<T>(config, hhUser1);

  const liquidatorAssetRegistry = ILiquidatorAssetRegistry__factory.connect(
    CoreDeployments.LiquidatorAssetRegistry[network].address,
    hhUser1,
  );

  const dolomiteOwnerV1Address = await deployContractAndSave(
    'DolomiteOwnerV1',
    getDolomiteOwnerConstructorParams(GNOSIS_SAFE_MAP[network], FIVE_MINUTES_SECONDS),
    'DolomiteOwnerV1',
  );
  const dolomiteOwnerV1 = DolomiteOwnerV1__factory.connect(dolomiteOwnerV1Address, gnosisSafeSigner);
  const dolomiteOwnerV2Address = await deployContractAndSave(
    'DolomiteOwnerV2',
    getDolomiteOwnerConstructorParams(GNOSIS_SAFE_MAP[network], FIVE_MINUTES_SECONDS),
    'DolomiteOwnerV2',
  );
  const dolomiteOwnerV2 = DolomiteOwnerV2__factory.connect(dolomiteOwnerV2Address, gnosisSafeSigner);
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

  const [dolomiteAccountRegistryImplementationAddress, dolomiteAccountRegistryProxy] =
    await deployDolomiteAccountRegistry(dolomiteMargin, hhUser1, network);

  const { dolomiteRegistry, dolomiteRegistryProxy, dolomiteRegistryImplementationAddress } =
    await deployDolomiteRegistry(
      dolomiteMargin,
      eventEmitterProxyAddress,
      dolomiteAccountRegistryProxy,
      network,
      hhUser1,
    );

  const {
    dolomiteAccountRiskOverrideSetter,
    dolomiteAccountRiskOverrideSetterProxy,
    dolomiteAccountRiskOverrideSetterImplementationAddress,
  } = await deployDolomiteAccountRiskOverrideSetter(dolomiteMargin, hhUser1);

  const coreFor4626 = {
    dolomiteRegistry,
    dolomiteMargin,
    network: config.network,
  } as any;
  await deployContractAndSave(
    'DolomiteERC4626',
    await getDolomiteErc4626ImplementationConstructorParams(coreFor4626),
    getMaxDeploymentVersionNameByDeploymentKey('DolomiteERC4626Implementation', 1),
  );
  await deployContractAndSave(
    'DolomiteERC4626WithPayable',
    await getDolomiteErc4626ImplementationConstructorParams(coreFor4626),
    getMaxDeploymentVersionNameByDeploymentKey('DolomiteERC4626WithPayableImplementation', 1),
  );

  const genericTraderProxyV2LibAddress = await deployContractAndSave(
    'GenericTraderProxyV2Lib',
    [],
    getMaxDeploymentVersionNameByDeploymentKey('GenericTraderProxyV2Lib', 1),
  );
  const genericTraderProxyV2Address = await deployContractAndSave(
    'GenericTraderProxyV2',
    [dolomiteRegistry.address, dolomiteMargin.address],
    getMaxDeploymentVersionNameByDeploymentKey('GenericTraderProxy', 2),
    { GenericTraderProxyV2Lib: genericTraderProxyV2LibAddress },
  );
  const genericTraderProxy = GenericTraderProxyV2__factory.connect(genericTraderProxyV2Address, hhUser1);

  const liquidatorProxyV5Address = await deployContractAndSave(
    'LiquidatorProxyV5',
    [network, expiry.address, dolomiteMargin.address, dolomiteRegistry.address, liquidatorAssetRegistry.address],
    undefined,
    { GenericTraderProxyV2Lib: genericTraderProxyV2LibAddress },
  );
  const liquidatorProxyV5 = ILiquidatorProxyV5__factory.connect(liquidatorProxyV5Address, hhUser1);

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

  const depositWithdrawalRouterImplementationAddress = await deployContractAndSave(
    'DepositWithdrawalRouter',
    [dolomiteRegistry.address, dolomiteMargin.address],
    getMaxDeploymentVersionNameByDeploymentKey('DepositWithdrawalRouterImplementation', 3),
  );
  const depositWithdrawalRouterCalldata = await DepositWithdrawalRouter__factory.connect(
    depositWithdrawalRouterImplementationAddress,
    hhUser1,
  ).populateTransaction.initialize();
  const depositWithdrawalRouterProxyAddress = await deployContractAndSave(
    'RouterProxy',
    [depositWithdrawalRouterImplementationAddress, dolomiteMargin.address, depositWithdrawalRouterCalldata.data!],
    'DepositWithdrawalRouterProxy',
  );

  const borrowPositionRouterImplementationAddress = await deployContractAndSave(
    'BorrowPositionRouter',
    [dolomiteRegistry.address, dolomiteMargin.address],
    getMaxDeploymentVersionNameByDeploymentKey('BorrowPositionRouterImplementation', 1),
  );
  const borrowPositionRouterCalldata = await BorrowPositionRouter__factory.connect(
    borrowPositionRouterImplementationAddress,
    hhUser1,
  ).populateTransaction.initialize();
  const borrowPositionRouterProxyAddress = await deployContractAndSave(
    'RouterProxy',
    [borrowPositionRouterImplementationAddress, dolomiteMargin.address, borrowPositionRouterCalldata.data!],
    'BorrowPositionRouterProxy',
  );

  const genericTraderRouterImplementationAddress = await deployContractAndSave(
    'GenericTraderRouter',
    [dolomiteRegistry.address, dolomiteMargin.address],
    getMaxDeploymentVersionNameByDeploymentKey('GenericTraderRouterImplementation', 1),
  );
  const genericTraderRouterCalldata = await GenericTraderRouter__factory.connect(
    genericTraderRouterImplementationAddress,
    hhUser1,
  ).populateTransaction.initialize();
  const genericTraderRouterProxyAddress = await deployContractAndSave(
    'RouterProxy',
    [genericTraderRouterImplementationAddress, dolomiteMargin.address, genericTraderRouterCalldata.data!],
    'GenericTraderRouterProxy',
  );

  const safeDelegateCallLibAddress = await deployContractAndSave(
    'SafeDelegateCallLib',
    [],
    getMaxDeploymentVersionNameByDeploymentKey('SafeDelegateCallLib', 1),
  );

  await deployContractAndSave(
    'IsolationModeTokenVaultV1ActionsImpl',
    [],
    getMaxDeploymentVersionNameByDeploymentKey('IsolationModeTokenVaultV1ActionsImpl', 11),
    { SafeDelegateCallLib: safeDelegateCallLibAddress },
  );

  await deployContractAndSave(
    'AsyncIsolationModeTokenVaultV1ActionsImpl',
    [],
    getMaxDeploymentVersionNameByDeploymentKey('AsyncIsolationModeTokenVaultV1ActionsImpl', 2),
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

  const { adminClaimExcessTokens, adminPauseMarket } = await deployDolomiteAdminContracts(
    dolomiteMargin,
    dolomiteRegistry,
    hhUser1,
  );

  // We can't set up the core protocol here because there are too many missing contracts/context
  const governanceAddress = await dolomiteMargin.connect(hhUser1).owner();
  const governance = await impersonateOrFallback(governanceAddress, true, hhUser1);
  const core = {
    config,
    delayedMultiSig,
    depositWithdrawalProxy,
    dolomiteMargin,
    dolomiteRegistry,
    governance,
    hhUser1,
    liquidatorAssetRegistry,
    liquidatorProxyV5,
    genericTraderProxy: genericTraderProxy as any,
    gnosisSafe: gnosisSafeSigner,
    gnosisSafeAddress: gnosisSafeAddress,
    network: config.network,
    ownerAdapterV1: dolomiteOwnerV1,
    ownerAdapterV2: dolomiteOwnerV2,
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
    liquidatorProxyV5,
    oracleAggregator.address,
    dolomiteRegistryImplementationAddress,
    transactions,
    core,
  );

  await encodeDolomiteAccountRiskOverrideSetterMigrations(
    dolomiteAccountRiskOverrideSetter,
    dolomiteAccountRiskOverrideSetterProxy,
    dolomiteAccountRiskOverrideSetterImplementationAddress,
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
    DepositWithdrawalRouter__factory.connect(depositWithdrawalRouterProxyAddress, hhUser1),
    [depositWithdrawalRouterProxyAddress, borrowPositionRouterProxyAddress, genericTraderRouterProxyAddress],
    [
      depositWithdrawalRouterImplementationAddress,
      borrowPositionRouterImplementationAddress,
      genericTraderRouterImplementationAddress,
    ],
    deployedVaults,
    transactions,
  );

  // This must be the last encoded transaction
  await encodeDolomiteOwnerMigrations(dolomiteOwnerV2, adminClaimExcessTokens, adminPauseMarket, transactions, core);

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
