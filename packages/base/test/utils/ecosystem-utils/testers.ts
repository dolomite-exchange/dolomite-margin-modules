import { TestInterestSetter, TestInterestSetter__factory } from '@dolomite-exchange/modules-interest-setters/src/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumberish } from 'ethers';
import { network } from 'hardhat';
import {
  CustomTestToken,
  IERC20,
  IIsolationModeTokenVaultV1,
  IsolationModeTraderProxy,
  IsolationModeTraderProxy__factory,
  TestAsyncProtocol,
  TestAsyncProtocolIsolationModeVaultFactory,
  TestAsyncProtocolIsolationModeVaultFactory__factory,
  TestDolomiteMarginExchangeWrapper,
  TestDolomiteMarginExchangeWrapper__factory,
  TestFreezableIsolationModeVaultFactory,
  TestFreezableIsolationModeVaultFactory__factory,
  TestHandlerRegistry,
  TestHandlerRegistry__factory,
  TestIsolationModeFactory,
  TestIsolationModeFactory__factory,
  TestIsolationModeTokenVaultV1,
  TestIsolationModeTokenVaultV1WithFreezable,
  TestIsolationModeTokenVaultV1WithAsyncFreezableAndPausable,
  TestIsolationModeTokenVaultV1WithPausable,
  TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa,
  TestPriceOracle,
  TestPriceOracle__factory,
  TestUpgradeableAsyncIsolationModeUnwrapperTrader,
  TestUpgradeableAsyncIsolationModeUnwrapperTrader__factory,
  TestUpgradeableAsyncIsolationModeWrapperTrader,
  TestUpgradeableAsyncIsolationModeWrapperTrader__factory,
  TestIsolationModeTokenVaultV1WithAsyncFreezable,
} from '../../../src/types';
import { createContractWithAbi, createContractWithLibrary } from '../../../src/utils/dolomite-utils';
import { NetworkType } from '../../../src/utils/no-deps-constants';
import {
  createAsyncIsolationModeUnwrapperTraderImpl,
  createAsyncIsolationModeWrapperTraderImpl,
  createRegistryProxy,
  DolomiteMargin
} from '../dolomite';
import { CoreProtocolType } from '../setup';

type TestIsolationModeTokenVault =
  TestIsolationModeTokenVaultV1
  | TestIsolationModeTokenVaultV1WithPausable
  | TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa;

export interface TestEcosystem {
  testExchangeWrapper: TestDolomiteMarginExchangeWrapper;
  testInterestSetter: TestInterestSetter;
  testPriceOracle: TestPriceOracle;
}

export async function createTestIsolationModeFactory<T extends NetworkType>(
  core: CoreProtocolType<T>,
  underlyingToken: CustomTestToken,
  userVaultImplementation: TestIsolationModeTokenVault | IIsolationModeTokenVaultV1,
): Promise<TestIsolationModeFactory> {
  return await createContractWithAbi<TestIsolationModeFactory>(
    TestIsolationModeFactory__factory.abi,
    TestIsolationModeFactory__factory.bytecode,
    [
      core.dolomiteRegistry.address,
      underlyingToken.address,
      core.borrowPositionProxyV2.address,
      userVaultImplementation.address,
      core.dolomiteMargin.address,
    ],
  );
}

type FreezableVault =
  TestIsolationModeTokenVaultV1WithFreezable
  | TestIsolationModeTokenVaultV1WithAsyncFreezable 
  | TestIsolationModeTokenVaultV1WithAsyncFreezableAndPausable;

export async function createTestHandlerRegistry<T extends NetworkType>(
  core: CoreProtocolType<T>,
): Promise<TestHandlerRegistry> {
  const implementation = await createContractWithAbi<TestHandlerRegistry>(
    TestHandlerRegistry__factory.abi,
    TestHandlerRegistry__factory.bytecode,
    [],
  );
  const data = await implementation.populateTransaction.initialize(core.dolomiteRegistryProxy.address);
  const proxy = await createRegistryProxy(implementation.address, data.data!, core);
  return TestHandlerRegistry__factory.connect(proxy.address, core.hhUser1);
}

export async function createTestFreezableIsolationModeVaultFactory<T extends NetworkType>(
  executionFee: BigNumberish,
  registry: TestHandlerRegistry,
  core: CoreProtocolType<T>,
  underlyingToken: CustomTestToken | IERC20,
  userVaultImplementation: FreezableVault | IIsolationModeTokenVaultV1,
): Promise<TestFreezableIsolationModeVaultFactory> {
  return await createContractWithAbi<TestFreezableIsolationModeVaultFactory>(
    TestFreezableIsolationModeVaultFactory__factory.abi,
    TestFreezableIsolationModeVaultFactory__factory.bytecode,
    [
      executionFee,
      registry.address,
      core.dolomiteRegistry.address,
      underlyingToken.address,
      core.borrowPositionProxyV2.address,
      userVaultImplementation.address,
      core.dolomiteMargin.address,
    ],
  );
}

export async function createTestAsyncProtocolIsolationModeVaultFactory<T extends NetworkType>(
  executionFee: BigNumberish,
  registry: TestHandlerRegistry,
  core: CoreProtocolType<T>,
  underlyingToken: CustomTestToken | IERC20,
  userVaultImplementation: FreezableVault | IIsolationModeTokenVaultV1,
): Promise<TestAsyncProtocolIsolationModeVaultFactory> {
  return await createContractWithAbi<TestAsyncProtocolIsolationModeVaultFactory>(
    TestAsyncProtocolIsolationModeVaultFactory__factory.abi,
    TestAsyncProtocolIsolationModeVaultFactory__factory.bytecode,
    [
      executionFee,
      registry.address,
      core.dolomiteRegistry.address,
      underlyingToken.address,
      core.borrowPositionProxyV2.address,
      userVaultImplementation.address,
      core.dolomiteMargin.address,
    ],
  );
}

export async function createTestUpgradeableAsyncIsolationModeWrapperTrader<T extends NetworkType>(
  core: CoreProtocolType<T>,
  registry: TestHandlerRegistry,
  factory: TestFreezableIsolationModeVaultFactory,
  asyncProtocol: TestAsyncProtocol,
): Promise<TestUpgradeableAsyncIsolationModeWrapperTrader> {
  const libraries = await createAsyncIsolationModeWrapperTraderImpl();
  const implementation = await createContractWithLibrary<TestUpgradeableAsyncIsolationModeWrapperTrader>(
    'TestUpgradeableAsyncIsolationModeWrapperTrader',
    libraries,
    [asyncProtocol.address, core.tokens.weth.address],
  );

  const calldata = await implementation.populateTransaction.initialize(
    factory.address,
    registry.address,
    core.dolomiteMargin.address,
  );
  const proxy = await createContractWithAbi<IsolationModeTraderProxy>(
    IsolationModeTraderProxy__factory.abi,
    IsolationModeTraderProxy__factory.bytecode,
    [implementation.address, core.dolomiteMargin.address, calldata.data],
  );

  return TestUpgradeableAsyncIsolationModeWrapperTrader__factory.connect(proxy.address, core.hhUser1);
}

export async function createTestUpgradeableAsyncIsolationModeUnwrapperTrader<T extends NetworkType>(
  core: CoreProtocolType<T>,
  registry: TestHandlerRegistry,
  factory: TestFreezableIsolationModeVaultFactory,
  asyncProtocol: TestAsyncProtocol,
): Promise<TestUpgradeableAsyncIsolationModeUnwrapperTrader> {
  const libraries = await createAsyncIsolationModeUnwrapperTraderImpl();
  const implementation = await createContractWithLibrary<TestUpgradeableAsyncIsolationModeWrapperTrader>(
    'TestUpgradeableAsyncIsolationModeUnwrapperTrader',
    libraries,
    [asyncProtocol.address, core.tokens.weth.address],
  );

  const calldata = await implementation.populateTransaction.initialize(
    factory.address,
    registry.address,
    core.dolomiteMargin.address,
  );
  const proxy = await createContractWithAbi<IsolationModeTraderProxy>(
    IsolationModeTraderProxy__factory.abi,
    IsolationModeTraderProxy__factory.bytecode,
    [implementation.address, core.dolomiteMargin.address, calldata.data],
  );

  return TestUpgradeableAsyncIsolationModeUnwrapperTrader__factory.connect(proxy.address, core.hhUser1);
}

export async function createTestEcosystem<T extends NetworkType>(
  dolomiteMargin: DolomiteMargin<T>,
  signer: SignerWithAddress,
): Promise<TestEcosystem | undefined> {
  if (network.name !== 'hardhat') {
    return undefined;
  }

  const testExchangeWrapper = await createContractWithAbi<TestDolomiteMarginExchangeWrapper>(
    TestDolomiteMarginExchangeWrapper__factory.abi,
    TestDolomiteMarginExchangeWrapper__factory.bytecode,
    [dolomiteMargin.address],
  );
  const testInterestSetter = await createContractWithAbi<TestInterestSetter>(
    TestInterestSetter__factory.abi,
    TestInterestSetter__factory.bytecode,
    [],
  );
  const testPriceOracle = await createContractWithAbi<TestPriceOracle>(
    TestPriceOracle__factory.abi,
    TestPriceOracle__factory.bytecode,
    [],
  );
  return {
    testExchangeWrapper: testExchangeWrapper.connect(signer),
    testInterestSetter: testInterestSetter.connect(signer),
    testPriceOracle: testPriceOracle.connect(signer),
  };
}