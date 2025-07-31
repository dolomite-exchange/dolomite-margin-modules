import { address } from '@dolomite-margin/dist/src';
import { Provider } from '@ethersproject/providers';
import { BigNumberish, PopulatedTransaction } from 'ethers';
import { DolomiteNetwork, Network } from 'packages/base/src/utils/no-deps-constants';
import {
  BorrowPositionRouter,
  BorrowPositionRouter__factory,
  DepositWithdrawalRouter,
  DepositWithdrawalRouter__factory,
  DolomiteAccountRegistry,
  DolomiteAccountRegistry__factory,
  DolomiteERC20,
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
  EventEmitterRegistry,
  EventEmitterRegistry__factory,
  GenericTraderProxyV2,
  GenericTraderRouter,
  GenericTraderRouter__factory,
  IDolomiteMargin,
  IDolomiteMarginV2,
  IERC20Metadata__factory,
  IExpiry,
  IExpiryV2,
  IsolationModeTraderProxy,
  IsolationModeTraderProxy__factory,
  LiquidatorProxyV6,
  LiquidatorProxyV6__factory,
  RegistryProxy,
  RegistryProxy__factory,
  RouterProxy,
  RouterProxy__factory,
  TestBorrowPositionRouter,
  TestBorrowPositionRouter__factory,
  TestDepositWithdrawalRouter,
  TestDepositWithdrawalRouter__factory,
} from '../../src/types';
import {
  getDolomiteErc20ProxyConstructorParams,
  getDolomiteErc4626ProxyConstructorParams,
  getDolomiteErc4626WithPayableProxyConstructorParams,
  getEventEmitterRegistryConstructorParams,
  getIsolationModeTraderProxyConstructorParams,
  getRegistryProxyConstructorParams,
  getRouterProxyConstructorParams,
} from '../../src/utils/constructors/dolomite';
import {
  createArtifactFromBaseWorkspaceIfNotExists,
  createContractWithAbi,
  createContractWithLibrary,
  createContractWithLibraryAndArtifact,
  createContractWithName,
  LibraryName,
} from '../../src/utils/dolomite-utils';
import { SignerWithAddressWithSafety } from '../../src/utils/SignerWithAddressWithSafety';
import { CoreProtocolType } from './setup';
import { UpgradeableProxy__factory } from 'packages/liquidity-mining/src/types';
import { AdminRegistry, AdminRegistry__factory } from 'packages/admin/src/types';

export type DolomiteMargin<T extends DolomiteNetwork> = T extends Network.ArbitrumOne
  ? IDolomiteMargin
  : IDolomiteMarginV2;
export type Expiry<T extends DolomiteNetwork> = T extends Network.ArbitrumOne ? IExpiry : IExpiryV2;

export async function createIsolationModeTokenVaultV1ActionsImpl(): Promise<Record<LibraryName, address>> {
  const safeDelegateCallLib = await createContractWithName('SafeDelegateCallLib', []);
  const contract = await createContractWithLibrary(
    'IsolationModeTokenVaultV1ActionsImpl',
    { SafeDelegateCallLib: safeDelegateCallLib.address },
    [],
  );
  return { IsolationModeTokenVaultV1ActionsImpl: contract.address };
}

export async function createAsyncIsolationModeTokenVaultV1ActionsImpl(): Promise<Record<LibraryName, address>> {
  const contract = await createContractWithLibrary(
    'AsyncIsolationModeTokenVaultV1ActionsImpl',
    {},
    [],
  );
  return { AsyncIsolationModeTokenVaultV1ActionsImpl: contract.address };
}

export async function createAsyncIsolationModeUnwrapperTraderImpl(): Promise<Record<LibraryName, address>> {
  const contract = await createContractWithName('AsyncIsolationModeUnwrapperTraderImpl', []);
  return { AsyncIsolationModeUnwrapperTraderImpl: contract.address };
}

export async function createAsyncIsolationModeWrapperTraderImpl(): Promise<Record<LibraryName, address>> {
  const contract = await createContractWithName('AsyncIsolationModeWrapperTraderImpl', []);
  return { AsyncIsolationModeWrapperTraderImpl: contract.address };
}

export async function createRegistryProxy(
  implementationAddress: string,
  initializationCalldata: string | PopulatedTransaction,
  core: CoreProtocolType<DolomiteNetwork>,
): Promise<RegistryProxy> {
  const calldata =
    typeof initializationCalldata === 'object' && 'data' in initializationCalldata
      ? initializationCalldata.data!
      : (initializationCalldata as string);
  return createContractWithAbi(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    getRegistryProxyConstructorParams(implementationAddress, calldata, core.dolomiteMargin),
  );
}

export async function createRouterProxy(
  implementationAddress: string,
  initializationCalldata: string | PopulatedTransaction,
  core: CoreProtocolType<DolomiteNetwork>,
): Promise<RouterProxy> {
  const calldata =
    typeof initializationCalldata === 'object' && 'data' in initializationCalldata
      ? initializationCalldata.data!
      : initializationCalldata as string;
  return createContractWithAbi(
    RouterProxy__factory.abi,
    RouterProxy__factory.bytecode,
    getRouterProxyConstructorParams(implementationAddress, calldata, core.dolomiteMargin),
  );
}

export async function createDolomiteErc20Proxy(
  implementation: DolomiteERC20,
  marketId: BigNumberish,
  core: CoreProtocolType<DolomiteNetwork>,
): Promise<RegistryProxy> {
  return createContractWithAbi(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getDolomiteErc20ProxyConstructorParams(core, implementation, marketId),
  );
}

export async function createDolomiteErc4626Proxy(
  marketId: BigNumberish,
  core: CoreProtocolType<DolomiteNetwork>,
): Promise<RegistryProxy> {
  return createContractWithAbi(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getDolomiteErc4626ProxyConstructorParams(core, marketId),
  );
}

export async function createDolomiteErc4626WithPayableProxy(
  marketId: BigNumberish,
  core: CoreProtocolType<DolomiteNetwork>,
): Promise<RegistryProxy> {
  return createContractWithAbi(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getDolomiteErc4626WithPayableProxyConstructorParams(core, marketId),
  );
}

export async function createDolomiteAccountRegistryImplementation(): Promise<DolomiteAccountRegistry> {
  return createContractWithAbi(DolomiteAccountRegistry__factory.abi, DolomiteAccountRegistry__factory.bytecode, []);
}

export async function createDolomiteRegistryImplementation(): Promise<DolomiteRegistryImplementation> {
  return createContractWithAbi(
    DolomiteRegistryImplementation__factory.abi,
    DolomiteRegistryImplementation__factory.bytecode,
    [],
  );
}

export async function createAndUpgradeDolomiteRegistry<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
): Promise<void> {
  const implementation = await createDolomiteRegistryImplementation();
  await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(implementation.address);
}

export async function createIsolationModeTraderProxy<T extends DolomiteNetwork>(
  implementationAddress: string,
  initializationCalldata: string,
  core: CoreProtocolType<T>,
): Promise<IsolationModeTraderProxy> {
  return createContractWithAbi(
    IsolationModeTraderProxy__factory.abi,
    IsolationModeTraderProxy__factory.bytecode,
    getIsolationModeTraderProxyConstructorParams(implementationAddress, initializationCalldata, core),
  );
}

export async function createAdminRegistry<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
): Promise<AdminRegistry> {
  const implementation = await createContractWithAbi<AdminRegistry>(
    AdminRegistry__factory.abi,
    AdminRegistry__factory.bytecode,
    [core.dolomiteMargin.address],
  );
  const transaction = await implementation.populateTransaction.initialize();
  const proxy = await createContractWithAbi(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    [implementation.address, core.dolomiteMargin.address, transaction.data],
  );
  return AdminRegistry__factory.connect(proxy.address, core.governance) as AdminRegistry;
}

export async function createEventEmitter<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
): Promise<EventEmitterRegistry> {
  const implementation = await createContractWithAbi<EventEmitterRegistry>(
    EventEmitterRegistry__factory.abi,
    EventEmitterRegistry__factory.bytecode,
    [],
  );
  const proxy = await createContractWithAbi(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getEventEmitterRegistryConstructorParams(core, implementation),
  );
  return EventEmitterRegistry__factory.connect(proxy.address, core.hhUser1) as EventEmitterRegistry;
}

export async function createDepositWithdrawalRouter(
  core: CoreProtocolType<any>,
  payableToken: { address: string },
): Promise<DepositWithdrawalRouter> {
  const implementation = await createContractWithAbi<DepositWithdrawalRouter>(
    DepositWithdrawalRouter__factory.abi,
    DepositWithdrawalRouter__factory.bytecode,
    [core.dolomiteRegistry.address, core.dolomiteMargin.address],
  );
  const initCalldata = await implementation.populateTransaction.initialize();

  const proxy = await createContractWithAbi(
    RouterProxy__factory.abi,
    RouterProxy__factory.bytecode,
    [implementation.address, core.dolomiteMargin.address, initCalldata.data!],
  );
  await proxy.connect(core.governance).ownerLazyInitialize(payableToken.address);
  return DepositWithdrawalRouter__factory.connect(proxy.address, core.hhUser1) as DepositWithdrawalRouter;
}

export async function createBorrowPositionRouter(
  core: CoreProtocolType<any>,
): Promise<BorrowPositionRouter> {
  const implementation = await createContractWithAbi<BorrowPositionRouter>(
    BorrowPositionRouter__factory.abi,
    BorrowPositionRouter__factory.bytecode,
    [core.dolomiteRegistry.address, core.dolomiteMargin.address],
  );
  const initCalldata = await implementation.populateTransaction.initialize();

  const proxy = await createContractWithAbi(
    RouterProxy__factory.abi,
    RouterProxy__factory.bytecode,
    [implementation.address, core.dolomiteMargin.address, initCalldata.data!],
  );
  return BorrowPositionRouter__factory.connect(proxy.address, core.hhUser1) as BorrowPositionRouter;
}

export async function createGenericTraderRouter(
  core: CoreProtocolType<any>,
): Promise<GenericTraderRouter> {
  const implementation = await createContractWithAbi<GenericTraderRouter>(
    GenericTraderRouter__factory.abi,
    GenericTraderRouter__factory.bytecode,
    [core.dolomiteRegistry.address, core.dolomiteMargin.address],
  );
  const initCalldata = await implementation.populateTransaction.initialize();

  const proxy = await createContractWithAbi(
    RouterProxy__factory.abi,
    RouterProxy__factory.bytecode,
    [implementation.address, core.dolomiteMargin.address, initCalldata.data!],
  );
  return GenericTraderRouter__factory.connect(proxy.address, core.hhUser1) as GenericTraderRouter;
}

export async function createGenericTraderProxyV2Lib(): Promise<Record<LibraryName, address>> {
  const artifact = await createArtifactFromBaseWorkspaceIfNotExists('GenericTraderProxyV2Lib', 'proxies');
  const contract = await createContractWithLibraryAndArtifact(
    artifact,
    {},
    [],
  );
  return { GenericTraderProxyV2Lib: contract.address };
}

export async function createGenericTraderProxyV2(core: CoreProtocolType<any>): Promise<GenericTraderProxyV2> {
  const libraries = await createGenericTraderProxyV2Lib();
  const artifact = await createArtifactFromBaseWorkspaceIfNotExists('GenericTraderProxyV2', 'proxies');
  return await createContractWithLibraryAndArtifact(
    artifact,
    libraries,
    [Network.ArbitrumOne, core.dolomiteRegistry.address, core.dolomiteMargin.address],
  );
}

export async function createLiquidatorProxyV6(
  core: CoreProtocolType<any>,
): Promise<LiquidatorProxyV6> {
  const libraries = await createGenericTraderProxyV2Lib();
  const artifact = await createArtifactFromBaseWorkspaceIfNotExists('LiquidatorProxyV6', 'proxies');
  const liquidatorProxyImplementation = await createContractWithLibraryAndArtifact(
    artifact,
    libraries,
    [
      core.config.network,
      core.expiry.address,
      core.dolomiteMargin.address,
      core.dolomiteRegistry.address,
      core.liquidatorAssetRegistry.address,
    ],
  );
  const data = await liquidatorProxyImplementation.populateTransaction.initialize();
  const proxy = await createContractWithAbi(
    UpgradeableProxy__factory.abi,
    UpgradeableProxy__factory.bytecode,
    [liquidatorProxyImplementation.address, core.dolomiteMargin.address, data.data!],
  );
  return LiquidatorProxyV6__factory.connect(
    proxy.address,
    core.hhUser1,
  );
}

export async function createTestBorrowPositionRouter(
  core: CoreProtocolType<any>,
): Promise<TestBorrowPositionRouter> {
  const implementation = await createContractWithAbi<TestBorrowPositionRouter>(
    TestBorrowPositionRouter__factory.abi,
    TestBorrowPositionRouter__factory.bytecode,
    [core.dolomiteRegistry.address, core.dolomiteMargin.address],
  );
  const initCalldata = await implementation.populateTransaction.initialize();

  const proxy = await createContractWithAbi(
    RouterProxy__factory.abi,
    RouterProxy__factory.bytecode,
    [implementation.address, core.dolomiteMargin.address, initCalldata.data!],
  );
  return TestBorrowPositionRouter__factory.connect(proxy.address, core.hhUser1) as TestBorrowPositionRouter;
}

export async function createTestDepositWithdrawalRouter(
  core: CoreProtocolType<any>,
  payableToken: { address: string },
): Promise<TestDepositWithdrawalRouter> {
  const implementation = await createContractWithAbi<TestDepositWithdrawalRouter>(
    TestDepositWithdrawalRouter__factory.abi,
    TestDepositWithdrawalRouter__factory.bytecode,
    [core.dolomiteRegistry.address, core.dolomiteMargin.address],
  );
  const initCalldata = await implementation.populateTransaction.initialize();

  const proxy = await createContractWithAbi(
    RouterProxy__factory.abi,
    RouterProxy__factory.bytecode,
    [implementation.address, core.dolomiteMargin.address, initCalldata.data!],
  );

  await TestDepositWithdrawalRouter__factory.connect(proxy.address, core.governance)
    .ownerLazyInitialize(payableToken.address);

  return TestDepositWithdrawalRouter__factory.connect(proxy.address, core.hhUser1) as TestDepositWithdrawalRouter;
}

export async function setupNewGenericTraderProxy<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
) {
  const implementation = await createDolomiteRegistryImplementation();
  await core.dolomiteRegistryProxy.upgradeTo(implementation.address);

  await core.dolomiteRegistry!.ownerSetGenericTraderProxy(core.genericTraderProxy!.address);
  await core.dolomiteRegistry!.ownerSetLiquidatorAssetRegistry(core.liquidatorAssetRegistry!.address);
  await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(marketId, core.liquidatorProxyV4.address);

  await core.dolomiteMargin.ownerSetGlobalOperator(core.genericTraderProxy!.address, true);
  await core.dolomiteMargin.ownerSetGlobalOperator(core.liquidatorProxyV4.address, true);
}

export async function isIsolationModeByMarketId(marketId: BigNumberish, core: CoreProtocolType<any>): Promise<boolean> {
  return isIsolationModeByTokenAddress(await core.dolomiteMargin.getMarketTokenAddress(marketId), core.governance);
}

export async function isIsolationModeByTokenAddress(
  tokenAddress: string,
  signerOrProvider: SignerWithAddressWithSafety | Provider,
): Promise<boolean> {
  const tokenName = await IERC20Metadata__factory.connect(tokenAddress, signerOrProvider).name();

  return tokenName.startsWith('Dolomite Isolation:') || tokenName === 'Dolomite: Fee + Staked GLP';
}
