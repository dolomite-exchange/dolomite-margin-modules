import { BigNumberish } from 'ethers';
import {
  CustomTestToken,
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
  IDolomiteRegistry,
  RegistryProxy__factory,
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
import { createRegistryProxy, DolomiteMargin } from '../dolomite';
import { CoreProtocol, CoreProtocolSetupConfig } from '../setup';
import { Network, NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP } from '../../../src/utils/no-deps-constants';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { network } from 'hardhat';
import { TestInterestSetter, TestInterestSetter__factory } from '@dolomite-exchange/modules-interest-setters/src/types';

type TestIsolationModeTokenVault =
  TestIsolationModeTokenVaultV1
  | TestIsolationModeTokenVaultV1WithPausable
  | TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa;

export interface TestEcosystem {
  testExchangeWrapper: TestDolomiteMarginExchangeWrapper;
  testInterestSetter: TestInterestSetter;
  testPriceOracle: TestPriceOracle;
}

export async function createTestIsolationModeFactory(
  core: CoreProtocol,
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

export async function createTestHandlerRegistry(
  core: CoreProtocol,
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

export async function createTestFreezableIsolationModeVaultFactory(
  executionFee: BigNumberish,
  registry: TestHandlerRegistry,
  core: CoreProtocol,
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

export async function createTestEcosystem<T extends Network>(
  dolomiteMargin: DolomiteMargin,
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
