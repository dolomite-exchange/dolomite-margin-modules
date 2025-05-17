import { TestInterestSetter, TestInterestSetter__factory } from '@dolomite-exchange/modules-interest-setters/src/types';
import { BigNumberish } from 'ethers';
import { artifacts, network } from 'hardhat';
import fs, { readFileSync } from 'fs';
import { Artifact } from 'hardhat/types';
import { join } from 'path';
import {
  CustomTestToken,
  IERC20,
  IIsolationModeTokenVaultV1,
  IsolationModeTraderProxy,
  IsolationModeTraderProxy__factory,
  TestAsyncFreezableIsolationModeVaultFactory,
  TestAsyncFreezableIsolationModeVaultFactory__factory,
  TestAsyncProtocol,
  TestAsyncProtocolIsolationModeVaultFactory,
  TestAsyncProtocolIsolationModeVaultFactory__factory,
  TestDolomiteMarginExchangeWrapper,
  TestDolomiteMarginExchangeWrapper__factory,
  TestHandlerRegistry,
  TestHandlerRegistry__factory,
  TestIsolationModeTokenVaultV1,
  TestIsolationModeTokenVaultV1WithAsyncFreezable,
  TestIsolationModeTokenVaultV1WithAsyncFreezableAndPausable,
  TestIsolationModeTokenVaultV1WithFreezable,
  TestIsolationModeTokenVaultV1WithPausable,
  TestIsolationModeTokenVaultV1WithPausableAndOnlyEoa,
  TestIsolationModeVaultFactory,
  TestIsolationModeVaultFactory__factory,
  TestPriceOracle,
  TestPriceOracle__factory,
  TestUpgradeableAsyncIsolationModeUnwrapperTrader,
  TestUpgradeableAsyncIsolationModeUnwrapperTrader__factory,
  TestUpgradeableAsyncIsolationModeWrapperTrader,
  TestUpgradeableAsyncIsolationModeWrapperTrader__factory,
} from '../../../src/types';
import {
  createContractWithAbi,
  createContractWithLibrary,
  createContractWithLibraryAndArtifact
} from '../../../src/utils/dolomite-utils';
import { DolomiteNetwork } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';
import {
  createAsyncIsolationModeUnwrapperTraderImpl,
  createAsyncIsolationModeWrapperTraderImpl,
  createIsolationModeTokenVaultV1ActionsImpl,
  createRegistryProxy,
  DolomiteMargin,
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

export async function createTestIsolationModeVaultFactory<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  underlyingToken: CustomTestToken,
  userVaultImplementation: TestIsolationModeTokenVault | IIsolationModeTokenVaultV1,
): Promise<TestIsolationModeVaultFactory> {
  return await createContractWithAbi<TestIsolationModeVaultFactory>(
    TestIsolationModeVaultFactory__factory.abi,
    TestIsolationModeVaultFactory__factory.bytecode,
    [
      underlyingToken.address,
      core.borrowPositionProxyV2.address,
      userVaultImplementation.address,
      core.dolomiteRegistry.address,
      core.dolomiteMargin.address,
    ],
  );
}

export async function createTestIsolationModeTokenVaultV1(): Promise<TestIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  const artifact = await createArtifactFromWorkspaceIfNotExists('TestIsolationModeTokenVaultV1');
  return await createContractWithLibraryAndArtifact(
    artifact,
    libraries,
    [],
  );
}

type FreezableVault =
  TestIsolationModeTokenVaultV1WithFreezable
  | TestIsolationModeTokenVaultV1WithAsyncFreezable
  | TestIsolationModeTokenVaultV1WithAsyncFreezableAndPausable;

export async function createTestHandlerRegistry<T extends DolomiteNetwork>(
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

export async function createTestAsyncFreezableIsolationModeVaultFactory<T extends DolomiteNetwork>(
  executionFee: BigNumberish,
  registry: TestHandlerRegistry,
  core: CoreProtocolType<T>,
  underlyingToken: CustomTestToken | IERC20,
  userVaultImplementation: FreezableVault | IIsolationModeTokenVaultV1,
): Promise<TestAsyncFreezableIsolationModeVaultFactory> {
  return await createContractWithAbi<TestAsyncFreezableIsolationModeVaultFactory>(
    TestAsyncFreezableIsolationModeVaultFactory__factory.abi,
    TestAsyncFreezableIsolationModeVaultFactory__factory.bytecode,
    [
      executionFee,
      registry.address,
      underlyingToken.address,
      core.dolomiteRegistry.address,
      core.borrowPositionProxyV2.address,
      userVaultImplementation.address,
      core.dolomiteMargin.address,
    ],
  );
}

export async function createTestAsyncProtocolIsolationModeVaultFactory<T extends DolomiteNetwork>(
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
      underlyingToken.address,
      core.dolomiteRegistry.address,
      core.borrowPositionProxyV2.address,
      userVaultImplementation.address,
      core.dolomiteMargin.address,
    ],
  );
}

export async function createTestUpgradeableAsyncIsolationModeWrapperTrader<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  registry: TestHandlerRegistry,
  factory: TestAsyncFreezableIsolationModeVaultFactory,
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

export async function createTestUpgradeableAsyncIsolationModeUnwrapperTrader<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  registry: TestHandlerRegistry,
  factory: TestAsyncFreezableIsolationModeVaultFactory,
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

export async function createTestEcosystem<T extends DolomiteNetwork>(
  dolomiteMargin: DolomiteMargin<T>,
  signer: SignerWithAddressWithSafety,
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

// @follow-up This is causing bugs
async function createArtifactFromWorkspaceIfNotExists(artifactName: string): Promise<Artifact> {
  if (await artifacts.artifactExists(artifactName)) {
    // GUARD STATEMENT!
    return artifacts.readArtifact(artifactName);
  }
  const children = [
    '../../../../../packages/base',
  ];

  const contractsFolders = ['contracts_coverage', 'contracts'];
  for (const contractFolder of contractsFolders) {
    for (const child of children) {
      const artifactPath = join(
        __dirname,
        child,
        `artifacts/${contractFolder}/test/${artifactName}.sol/${artifactName}.json`,
      );
      if (fs.existsSync(artifactPath)) {
        const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
        await artifacts.saveArtifactAndDebugFile(artifact);
        return artifact;
      }
    }
  }

  return Promise.reject(new Error(`Could not find ${artifactName}`));
}
