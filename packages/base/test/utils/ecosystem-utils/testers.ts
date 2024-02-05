import { TestInterestSetter, TestInterestSetter__factory } from '@dolomite-exchange/modules-interest-setters/src/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumberish } from 'ethers';
import { network } from 'hardhat';
import {
  CustomTestToken,
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
  IDolomiteRegistry,
  RegistryProxy__factory,
  TestAsyncIsolationModeTraderBase,
  TestAsyncIsolationModeTraderBase__factory,
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
  TestIsolationModeTokenVaultV1WithFreezableAndPausable,
  TestIsolationModeTokenVaultV1WithPausable,
  TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa,
  TestPriceOracle,
  TestPriceOracle__factory,
} from '../../../src/types';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP, NetworkType } from '../../../src/utils/no-deps-constants';
import { createRegistryProxy, DolomiteMargin } from '../dolomite';
import { CoreProtocolSetupConfig, CoreProtocolType } from '../setup';

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
  userVaultImplementation: TestIsolationModeTokenVault,
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
  | TestIsolationModeTokenVaultV1WithFreezableAndPausable;

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
  underlyingToken: CustomTestToken,
  userVaultImplementation: FreezableVault,
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

export async function createTestEcosystem<T extends NetworkType>(
  dolomiteMargin: DolomiteMargin<T>,
  dolomiteRegistry: IDolomiteRegistry,
  governor: SignerWithAddress,
  signer: SignerWithAddress,
  config: CoreProtocolSetupConfig<T>,
): Promise<TestEcosystem | undefined> {
  if (network.name !== 'hardhat') {
    return undefined;
  }

  if (config.blockNumber >= NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP[config.network]) {
    const genericTrader = await dolomiteRegistry.genericTraderProxy();
    await dolomiteMargin.ownerSetGlobalOperator(genericTrader, true);
    const registryProxy = RegistryProxy__factory.connect(dolomiteRegistry.address, governor);
    const newRegistry = await createContractWithAbi<DolomiteRegistryImplementation>(
      DolomiteRegistryImplementation__factory.abi,
      DolomiteRegistryImplementation__factory.bytecode,
      [],
    );
    await registryProxy.upgradeTo(newRegistry.address);
    await dolomiteRegistry.ownerSetSlippageToleranceForPauseSentinel('70000000000000000'); // 7%
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
