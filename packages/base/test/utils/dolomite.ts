import { address } from '@dolomite-margin/dist/src';
import { BigNumber, BigNumberish } from 'ethers';
import { Network, NetworkType } from 'packages/base/src/utils/no-deps-constants';
import {
  DolomiteAccountRegistry,
  DolomiteAccountRegistry__factory,
  DolomiteERC20,
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
  EventEmitterRegistry,
  EventEmitterRegistry__factory,
  IDolomiteMargin,
  IDolomiteMarginV2,
  IERC20,
  IERC20Metadata__factory,
  IExpiry,
  IExpiryV2,
  IsolationModeTraderProxy,
  IsolationModeTraderProxy__factory,
  RegistryProxy,
  RegistryProxy__factory,
} from '../../src/types';
import {
  getDolomiteErc20ProxyConstructorParams,
  getEventEmitterRegistryConstructorParams,
  getIsolationModeTraderProxyConstructorParams,
  getRegistryProxyConstructorParams,
} from '../../src/utils/constructors/dolomite';
import {
  createContractWithAbi,
  createContractWithLibrary,
  createContractWithName,
  LibraryName,
} from '../../src/utils/dolomite-utils';
import { CoreProtocolType } from './setup';

export type DolomiteMargin<T extends NetworkType> = T extends Network.ArbitrumOne ? IDolomiteMargin : IDolomiteMarginV2;
export type Expiry<T extends NetworkType> = T extends Network.ArbitrumOne ? IExpiry : IExpiryV2;

export async function createIsolationModeTokenVaultV1ActionsImpl(): Promise<Record<LibraryName, address>> {
  const safeDelegateCallLib = await createContractWithName('SafeDelegateCallLib', []);
  const contract = await createContractWithLibrary(
    'IsolationModeTokenVaultV1ActionsImpl',
    { SafeDelegateCallLib: safeDelegateCallLib.address },
    [],
  );
  return { IsolationModeTokenVaultV1ActionsImpl: contract.address };
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
  initializationCalldata: string,
  core: CoreProtocolType<NetworkType>,
): Promise<RegistryProxy> {
  return createContractWithAbi(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    getRegistryProxyConstructorParams(implementationAddress, initializationCalldata, core.dolomiteMargin),
  );
}

export async function createDolomiteErc20Proxy(
  implementation: DolomiteERC20,
  marketId: BigNumberish,
  core: CoreProtocolType<NetworkType>,
): Promise<RegistryProxy> {
  return createContractWithAbi(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getDolomiteErc20ProxyConstructorParams(core, implementation, marketId),
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

export async function createAndUpgradeDolomiteRegistry<T extends NetworkType>(
  core: CoreProtocolType<T>,
): Promise<void> {
  const implementation = await createDolomiteRegistryImplementation();
  await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(implementation.address);
}

export async function createIsolationModeTraderProxy<T extends NetworkType>(
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

export async function createEventEmitter<T extends NetworkType>(
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

export async function setupNewGenericTraderProxy<T extends NetworkType>(
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

export async function isIsolationMode(marketId: BigNumberish, core: CoreProtocolType<any>): Promise<boolean> {
  const tokenName = await IERC20Metadata__factory.connect(
    await core.dolomiteMargin.getMarketTokenAddress(marketId),
    core.governance,
  ).name();

  return tokenName.startsWith('Dolomite Isolation:') || tokenName.startsWith('Dolomite:');
}

export async function freezeAndGetOraclePrice(core: CoreProtocolType<any>, token: IERC20): Promise<BigNumber> {
  const marketId = await core.dolomiteMargin.getMarketIdByTokenAddress(token.address);
  const price = await core.dolomiteMargin.getMarketPrice(marketId);
  await core.testEcosystem!.testPriceOracle.setPrice(token.address, price.value);
  await core.dolomiteMargin.ownerSetPriceOracle(marketId, core.testEcosystem!.testPriceOracle.address);
  return price.value;
}
