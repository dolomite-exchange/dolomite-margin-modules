import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  GammaIsolationModeTokenVaultV1,
  GammaIsolationModeUnwrapperTraderV2,
  GammaIsolationModeUnwrapperTraderV2__factory,
  GammaIsolationModeVaultFactory,
  GammaIsolationModeVaultFactory__factory,
  GammaIsolationModeWrapperTraderV2,
  GammaIsolationModeWrapperTraderV2__factory,
  GammaPoolPriceOracle,
  GammaPoolPriceOracle__factory,
  GammaRegistry,
  GammaRegistry__factory,
  IGammaIsolationModeVaultFactory,
  IGammaPool,
  IGammaRegistry,
  TestGammaIsolationModeWrapperTraderV2,
  TestGammaIsolationModeWrapperTraderV2__factory
} from '../src/types';
import { createContractWithAbi, createContractWithLibrary } from 'packages/base/src/utils/dolomite-utils';
import {
  RegistryProxy,
  RegistryProxy__factory,
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeUnwrapperTraderV2__factory,
  SimpleIsolationModeWrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2__factory
} from 'packages/base/src/types';
import {
  getGammaIsolationModeVaultFactoryConstructorParams,
  getGammaRegistryConstructorParams,
  getGammaUnwrapperTraderV2ConstructorParams,
  getGammaWrapperTraderV2ConstructorParams
} from '../src/gamma-constructors';
import { createIsolationModeTokenVaultV1ActionsImpl } from 'packages/base/test/utils/dolomite';
import { BigNumberish, Bytes, BytesLike, ethers } from 'ethers';
import { GenericTraderType } from '@dolomite-exchange/zap-sdk';
import { ONE_BI } from 'packages/base/src/utils/no-deps-constants';
import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { GenericEventEmissionType } from '@dolomite-exchange/dolomite-margin/dist/src/modules/GenericTraderProxyV1';

export async function createGammaRegistry(core: CoreProtocolArbitrumOne): Promise<GammaRegistry> {
  const implementation = await createContractWithAbi<GammaRegistry>(
    GammaRegistry__factory.abi,
    GammaRegistry__factory.bytecode,
    [],
  );
  const proxy = await createContractWithAbi<RegistryProxy>(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getGammaRegistryConstructorParams(implementation, core),
  );
  return GammaRegistry__factory.connect(proxy.address, core.hhUser1);
}

export async function createGammaIsolationModeTokenVaultV1(): Promise<GammaIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<GammaIsolationModeTokenVaultV1>(
    'GammaIsolationModeTokenVaultV1',
    libraries,
    [],
  );
}

export async function createGammaIsolationModeVaultFactory(
  gammaRegistry: IGammaRegistry | GammaRegistry,
  gammaPool: IGammaPool,
  userVaultImplementation: GammaIsolationModeTokenVaultV1,
  core: CoreProtocolArbitrumOne,
): Promise<GammaIsolationModeVaultFactory> {
  return createContractWithAbi<GammaIsolationModeVaultFactory>(
    GammaIsolationModeVaultFactory__factory.abi,
    GammaIsolationModeVaultFactory__factory.bytecode,
    getGammaIsolationModeVaultFactoryConstructorParams(gammaRegistry, gammaPool, userVaultImplementation, core),
  );
}

export async function createGammaUnwrapperTraderV2(
  core: CoreProtocolArbitrumOne,
  factory: IGammaIsolationModeVaultFactory | GammaIsolationModeVaultFactory,
  registry: IGammaRegistry | GammaRegistry,
): Promise<GammaIsolationModeUnwrapperTraderV2> {
  return createContractWithAbi<GammaIsolationModeUnwrapperTraderV2>(
    GammaIsolationModeUnwrapperTraderV2__factory.abi,
    GammaIsolationModeUnwrapperTraderV2__factory.bytecode,
    getGammaUnwrapperTraderV2ConstructorParams(core, factory, registry),
  );
}

export async function createGammaWrapperTraderV2(
  core: CoreProtocolArbitrumOne,
  factory: IGammaIsolationModeVaultFactory | GammaIsolationModeVaultFactory,
  registry: IGammaRegistry | GammaRegistry,
): Promise<GammaIsolationModeWrapperTraderV2> {
  return createContractWithAbi<GammaIsolationModeWrapperTraderV2>(
    GammaIsolationModeWrapperTraderV2__factory.abi,
    GammaIsolationModeWrapperTraderV2__factory.bytecode,
    getGammaWrapperTraderV2ConstructorParams(core, factory, registry),
  );
}

export async function createTestGammaWrapperTraderV2(
  core: CoreProtocolArbitrumOne,
  factory: IGammaIsolationModeVaultFactory | GammaIsolationModeVaultFactory,
  registry: IGammaRegistry | GammaRegistry,
): Promise<TestGammaIsolationModeWrapperTraderV2> {
  return createContractWithAbi<TestGammaIsolationModeWrapperTraderV2>(
    TestGammaIsolationModeWrapperTraderV2__factory.abi,
    TestGammaIsolationModeWrapperTraderV2__factory.bytecode,
    getGammaWrapperTraderV2ConstructorParams(core, factory, registry),
  );
}

export async function createGammaPoolPriceOracle(
  core: CoreProtocolArbitrumOne,
  registry: IGammaRegistry | GammaRegistry,
): Promise<GammaPoolPriceOracle> {
  return createContractWithAbi<GammaPoolPriceOracle>(
    GammaPoolPriceOracle__factory.abi,
    GammaPoolPriceOracle__factory.bytecode,
    [
      registry.address,
      core.dolomiteMargin.address,
    ],
  );
}

export function getUnwrappingParams(
  accountNumber: BigNumberish,
  marketId1: BigNumberish,
  amountIn: BigNumberish,
  marketId2: BigNumberish,
  minAmountOut: BigNumberish,
  unwrapper: GammaIsolationModeUnwrapperTraderV2,
  aggregator: { address: string },
  aggregatorData: BytesLike
): any {
  return {
    accountNumber,
    amountIn,
    minAmountOut,
    marketPath: [marketId1, marketId2],
    traderParams: [
      {
        trader: unwrapper.address,
        traderType: GenericTraderType.IsolationModeUnwrapper,
        tradeData: ethers.utils.defaultAbiCoder.encode(
          ['address', 'bytes'],
          [aggregator.address, aggregatorData]
        ),
        makerAccountIndex: 0,
      },
    ],
    makerAccounts: [],
    userConfig: {
      deadline: '123123123123123',
      balanceCheckFlag: BalanceCheckFlag.None,
      eventType: GenericEventEmissionType.None,
    },
  };
}
